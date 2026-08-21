import { useMemo, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { AlertTriangle, CheckCircle2, RefreshCw, Sparkles, Upload } from 'lucide-react'
import { supabase } from './supabase'

type CompanyRef = { company_id:string; company_name:string; role:string; status:string }
type ProjectRef = { id:string; name:string; project_code?:string|null }
type SystemRef = { id:string; code:string; project_id?:string|null }
type BatchStatus = { total:number; completed:number; uploaded:number; review:number; failed:number; current:string }
type Classification = { type:string; confidence:number|null; reviewStatus:'AUTO_CLASSIFIED'|'NEEDS_REVIEW'; reason?:string }

const categories=[
  ['auto','AI automatikus rendezés'],
  ['szamla','Számla'],['szallitolevel','Szállítólevél'],['jegyzokonyv','Jegyzőkönyv'],
  ['tanusitvany','Tanúsítvány'],['rajz','Rajz / terv'],['foto','Helyszíni fotó'],
  ['anyaglista','Anyaglista'],['egyeb','Egyéb']
]

export function BatchDocumentUpload({company,user,projects,systems,onDone}:{
  company:CompanyRef;user:User;projects:ProjectRef[];systems:SystemRef[];onDone:()=>void|Promise<void>
}){
  const [project,setProject]=useState('')
  const [system,setSystem]=useState('')
  const [category,setCategory]=useState('auto')
  const [busy,setBusy]=useState(false)
  const [status,setStatus]=useState<BatchStatus|null>(null)
  const [message,setMessage]=useState('')

  const filteredSystems=useMemo(()=>project?systems.filter(item=>item.project_id===project):[],[project,systems])

  async function uploadFiles(files:FileList|null){
    if(!files?.length||busy)return
    const list=Array.from(files)
    const batchId=crypto.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`
    setBusy(true);setMessage('')
    let completed=0,uploaded=0,review=0,failed=0
    setStatus({total:list.length,completed,uploaded,review,failed,current:list[0]?.name||''})

    for(let index=0;index<list.length;index++){
      const file=list[index]
      setStatus({total:list.length,completed,uploaded,review,failed,current:file.name})
      try{
        const document=await uploadOne(file,index,batchId)
        uploaded++
        const classification=await classifyAndPersist(document,file,batchId)
        if(classification.reviewStatus==='NEEDS_REVIEW')review++
      }catch(error:any){
        failed++
        console.error('Batch document upload error',file.name,error)
      }finally{
        completed++
        setStatus({total:list.length,completed,uploaded,review,failed,current:index+1<list.length?list[index+1].name:''})
      }
    }

    await onDone()
    setBusy(false)
    const parts=[`${uploaded}/${list.length} fájl feltöltve`]
    if(review)parts.push(`${review} ellenőrzendő`)
    if(failed)parts.push(`${failed} sikertelen`)
    setMessage(parts.join(' · '))
  }

  async function uploadOne(file:File,index:number,batchId:string){
    const safe=file.name.replace(/[^a-zA-Z0-9._-]+/g,'_')||`file-${index+1}`
    const path=`${company.company_id}/${project||'general'}/${system||'no-system'}/batch/${batchId}/${String(index+1).padStart(3,'0')}-${safe}`
    const {error:storageError}=await supabase.storage.from('company-documents').upload(path,file,{upsert:false})
    if(storageError)throw storageError

    const initialType=category==='auto'?null:category
    const initialFields={_classification:{reviewStatus:category==='auto'?'PENDING':'MANUAL',source:category==='auto'?'AI':'USER',batchId}}
    const inserted=await supabase.from('documents').insert({
      company_id:company.company_id,project_id:project||null,system_id:system||null,uploaded_by:user.id,
      file_name:file.name,storage_path:path,mime_type:file.type||null,file_size:file.size,
      description:category==='auto'?'AI automatikus rendezés':category,document_type:initialType,ai_fields:initialFields
    }).select('*').single()
    if(inserted.error){await supabase.storage.from('company-documents').remove([path]);throw inserted.error}
    return inserted.data
  }

  async function classifyAndPersist(document:any,file:File,batchId:string):Promise<Classification>{
    if(category!=='auto'){
      const classification:Classification={type:category,confidence:1,reviewStatus:'AUTO_CLASSIFIED'}
      await mergeClassification(document.id,{},classification,batchId,'USER')
      return classification
    }

    if(!isAiSupported(file)){
      const fallback=extensionCategory(file.name,file.type)
      const classification:Classification={
        type:fallback,confidence:null,reviewStatus:'NEEDS_REVIEW',
        reason:'A fájltípus tartalma közvetlenül nem elemezhető AI-val; a kategória csak fájltípus-alapú javaslat.'
      }
      await supabase.from('documents').update({
        document_type:fallback,
        ai_summary:'AI tartalomelemzés nem futott ehhez a fájltípushoz. Kézi ellenőrzés szükséges.',
        ai_fields:{_classification:{...classification,source:'FILE_TYPE',batchId}}
      }).eq('id',document.id)
      return classification
    }

    try{
      const signed=await supabase.storage.from('company-documents').createSignedUrl(document.storage_path,300)
      if(signed.error)throw signed.error
      const {data:{session}}=await supabase.auth.getSession()
      if(!session)throw new Error('A munkamenet lejárt.')
      const aiMime=file.type||document.mime_type||(file.name.toLowerCase().endsWith('.pdf')?'application/pdf':'application/octet-stream')
      const response=await fetch('/api/ai',{method:'POST',headers:{
        'Content-Type':'application/json',Authorization:'Bearer '+session.access_token
      },body:JSON.stringify({mode:'document',companyId:company.company_id,document:{
        id:document.id,url:signed.data.signedUrl,mimeType:aiMime,fileName:file.name
      }})})
      const result=await response.json()
      if(!response.ok)throw new Error(result.error||'Az AI-rendezés nem sikerült.')

      const confidence=confidenceOrNull(result.classificationConfidence)
      const type=allowedType(result.documentType)?result.documentType:'egyeb'
      const classification:Classification={
        type,confidence,reviewStatus:confidence!==null&&confidence>=0.65?'AUTO_CLASSIFIED':'NEEDS_REVIEW',
        reason:confidence!==null&&confidence>=0.65?undefined:'Az AI besorolási bizonyossága nem elég magas.'
      }

      const fields={...(result.fields||{}),_classification:{...classification,source:'AI',batchId}}
      const updated=await supabase.from('documents').update({document_type:type,ai_summary:result.summary||null,ai_fields:fields}).eq('id',document.id)
      if(updated.error)throw updated.error
      await persistMaterials(document,result)
      await persistFinancial(document,result,session.user.id)
      return classification
    }catch(error:any){
      const fallback=extensionCategory(file.name,file.type)
      const classification:Classification={type:fallback,confidence:null,reviewStatus:'NEEDS_REVIEW',reason:error?.message||'AI-feldolgozási hiba'}
      await supabase.from('documents').update({
        document_type:fallback,
        ai_summary:'A fájl feltöltése sikerült, de az AI-rendezés nem fejeződött be. Kézi ellenőrzés szükséges.',
        ai_fields:{_classification:{...classification,source:'AI_ERROR',batchId}}
      }).eq('id',document.id)
      return classification
    }
  }

  async function mergeClassification(documentId:string,fields:any,classification:Classification,batchId:string,source:string){
    const {error}=await supabase.from('documents').update({document_type:classification.type,ai_fields:{...fields,_classification:{...classification,source,batchId}}}).eq('id',documentId)
    if(error)throw error
  }

  function changeProject(next:string){setProject(next);setSystem('')}

  return <div className="upload-panel" aria-busy={busy}>
    <div><Upload size={24}/><div><b>Csoportos feltöltés</b><span>Projektet és rendszert egyszer válassz, majd több képet vagy dokumentumot egyszerre.</span></div></div>
    <select value={project} onChange={e=>changeProject(e.target.value)} disabled={busy} aria-label="Projekt kiválasztása"><option value="">Általános / nincs projekt</option>{projects.map(item=><option key={item.id} value={item.id}>{item.project_code||item.name}</option>)}</select>
    <select value={system} onChange={e=>setSystem(e.target.value)} disabled={busy||!project} aria-label="Rendszer kiválasztása"><option value="">Nincs rendszer</option>{filteredSystems.map(item=><option key={item.id} value={item.id}>{item.code}</option>)}</select>
    <select value={category} onChange={e=>setCategory(e.target.value)} disabled={busy} aria-label="Rendezési mód">{categories.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select>
    <label className="btn primary file-btn">{busy?<><RefreshCw className="spin" size={16}/>Feldolgozás…</>:<><Sparkles size={16}/>Fájlok kiválasztása</>}<input type="file" multiple disabled={busy} accept="image/*,.pdf,.dwg,.dxf,.doc,.docx,.xls,.xlsx,.txt" onChange={e=>{void uploadFiles(e.currentTarget.files);e.currentTarget.value=''}}/></label>
    {status&&<div className="full" style={{display:'grid',gap:4}}><small>{busy&&status.current?`Feldolgozás: ${status.current}`:`Kész: ${status.completed}/${status.total}`}</small><small>Feltöltve: {status.uploaded} · Ellenőrzendő: {status.review} · Sikertelen: {status.failed}</small></div>}
    {message&&<div className="full" style={{display:'flex',gap:8,alignItems:'center'}}>{status?.failed?<AlertTriangle size={17}/>:<CheckCircle2 size={17}/>}<small>{message}</small></div>}
  </div>
}

async function persistMaterials(document:any,result:any){
  const cleared=await supabase.from('document_material_items').delete().eq('document_id',document.id)
  if(cleared.error)throw cleared.error
  const materials=(Array.isArray(result.materials)?result.materials:[]).filter((item:any)=>String(item?.name||'').trim()).map((item:any,index:number)=>({
    company_id:document.company_id,document_id:document.id,project_id:document.project_id||null,line_number:index+1,
    name:String(item.name).trim(),sku:item.sku||null,quantity:numberOrNull(item.quantity),unit:item.unit||null,
    unit_price:numberOrNull(item.unitPrice),total_price:numberOrNull(item.totalPrice),currency:item.currency||result.fields?.currency||'HUF',
    net_amount:numberOrNull(item.netAmount),vat_amount:numberOrNull(item.vatAmount),gross_amount:numberOrNull(item.grossAmount),
    confidence:confidenceOrNull(item.confidence),source_text:item.sourceText||null,
    stock_status:isReviewableItem(item)?'PENDING':'NEEDS_REVIEW'
  }))
  if(materials.length){const inserted=await supabase.from('document_material_items').insert(materials);if(inserted.error)throw inserted.error}
}

async function persistFinancial(document:any,result:any,userId:string){
  if(!result.financial)return
  const f=result.financial
  const saved=await supabase.from('financial_entries').upsert({
    company_id:document.company_id,source_document_id:document.id,project_id:document.project_id||null,
    entry_type:f.entryType==='INCOME'?'INCOME':'EXPENSE',counterparty:f.counterparty||result.fields?.supplier||result.fields?.customer||null,
    reference_number:f.referenceNumber||result.fields?.invoiceNumber||null,issue_date:dateOrNull(f.issueDate||result.fields?.issueDate),
    due_date:dateOrNull(f.dueDate||result.fields?.dueDate),net_amount:numberOrZero(f.netAmount??result.fields?.netTotal),
    vat_amount:numberOrZero(f.vatAmount??result.fields?.vatTotal),gross_amount:numberOrZero(f.grossAmount??result.fields?.grossTotal),
    currency:f.currency||result.fields?.currency||'HUF',status:f.status||'RECORDED',confidence:confidenceOrNull(f.confidence),
    created_by:userId,updated_at:new Date().toISOString()
  },{onConflict:'source_document_id'})
  if(saved.error)throw saved.error
}

function isAiSupported(file:File){return file.type.startsWith('image/')||file.type==='application/pdf'||file.name.toLowerCase().endsWith('.pdf')}
function allowedType(value:any){return ['szamla','szallitolevel','jegyzokonyv','tanusitvany','rajz','foto','anyaglista','egyeb'].includes(String(value||''))}
function extensionCategory(name:string,mime:string){
  const lower=name.toLowerCase()
  if(mime.startsWith('image/'))return 'foto'
  if(lower.endsWith('.dwg')||lower.endsWith('.dxf'))return 'rajz'
  if(lower.endsWith('.pdf'))return 'egyeb'
  return 'egyeb'
}
function numberOrNull(value:any){const number=Number(value);return value===null||value===''||!Number.isFinite(number)?null:number}
function numberOrZero(value:any){return numberOrNull(value)??0}
function confidenceOrNull(value:any){const number=numberOrNull(value);return number===null?null:Math.min(1,Math.max(0,number))}
function dateOrNull(value:any){return /^\d{4}-\d{2}-\d{2}$/.test(String(value||''))?String(value):null}
function isReviewableItem(item:any){return Boolean(String(item?.name||'').trim()&&Number(item?.quantity)>0&&String(item?.unit||'').trim()&&Number(item?.confidence??1)>=0.6)}
