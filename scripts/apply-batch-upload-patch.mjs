import fs from 'node:fs'

const path='src/App.tsx'
let source=fs.readFileSync(path,'utf8')

const importAnchor="import { DocumentMaterialIntakeList } from './InvoiceStockIntake'"
const importLine="import { BatchDocumentUpload } from './BatchDocumentUpload'"
if(!source.includes(importLine)){
  if(!source.includes(importAnchor))throw new Error('App import anchor not found')
  source=source.replace(importAnchor,importAnchor+'\n'+importLine)
}

const replacement=`function Documents({company,user}:{company:Company;user:User}){
  const [rows,setRows]=useState<any[]>([]),[projects,setProjects]=useState<any[]>([]),[systems,setSystems]=useState<any[]>([]),[busy,setBusy]=useState(true),[error,setError]=useState('')
  async function load(){
    setBusy(true)
    const [d,p,s]=await Promise.all([
      supabase.from('documents').select('*').eq('company_id',company.company_id).order('created_at',{ascending:false}),
      supabase.from('projects').select('id,name,project_code').eq('company_id',company.company_id),
      supabase.from('system_dashboard').select('id,code,project_id').eq('company_id',company.company_id)
    ])
    setRows(d.data||[]);setProjects(p.data||[]);setSystems(s.data||[])
    if(d.error||p.error||s.error)setError((d.error||p.error||s.error)?.message||'A dokumentumadatok betöltése nem sikerült.')
    setBusy(false)
  }
  useEffect(()=>{void load()},[company.company_id])
  async function download(d:any){const {data,error}=await supabase.storage.from('company-documents').download(d.storage_path);if(error){setError(error.message);return}const url=URL.createObjectURL(data);const a=document.createElement('a');a.href=url;a.download=d.file_name;a.click();URL.revokeObjectURL(url)}
  async function remove(d:any){if(!confirm('Törlöd a dokumentumot?'))return;const {count,error:linkedError}=await supabase.from('material_transactions').select('id',{count:'exact',head:true}).eq('source_document_id',d.id);if(linkedError){setError(linkedError.message);return}if(count){setError('A dokumentum nem törölhető, mert már raktári készletmozgás kapcsolódik hozzá.');return}const {error}=await supabase.from('documents').delete().eq('id',d.id);if(error){setError(error.message);return}const {error:s}=await supabase.storage.from('company-documents').remove([d.storage_path]);if(s)setError('A dokumentum adatrekordja törölve lett, de a tárolt fájl takarítása nem sikerült: '+s.message);else void load()}
  return <><PageHero title="Dokumentumok" text="Csoportos kép- és dokumentumfeltöltés AI-alapú automatikus rendezéssel."/><BatchDocumentUpload company={company} user={user} projects={projects} systems={systems} onDone={load}/>{error&&<Notice type="error">{error}</Notice>}{busy?<Loading/>:<div className="cards-list">{rows.map(d=>{const classification=d.ai_fields?._classification;const systemCode=systems.find(s=>s.id===d.system_id)?.code;return <div className="list-row document-row" key={d.id}><div className="list-icon"><FileText/></div><div className="grow"><b>{d.file_name}</b><span>{projects.find(p=>p.id===d.project_id)?.project_code||'Általános'}{systemCode?' · '+systemCode:''} · {d.document_type||'Feldolgozás alatt'} · {fmtDate(d.created_at)} · {d.file_size?(Math.round(d.file_size/1024)+' KB'):''}</span>{classification?.reviewStatus==='NEEDS_REVIEW'&&<small className="ai-summary">⚠ Ellenőrzendő AI-besorolás{classification.confidence!=null?' · '+Math.round(Number(classification.confidence)*100)+'% bizonyosság':''}</small>}{classification?.reviewStatus==='AUTO_CLASSIFIED'&&<small className="ai-summary">AI rendezve{classification.confidence!=null?' · '+Math.round(Number(classification.confidence)*100)+'% bizonyosság':''}</small>}{d.ai_summary&&<small className="ai-summary">{d.ai_summary}</small>}</div><div className="row-actions"><DocumentAiButton company={company} document={d} onDone={load}/><button className="icon-btn" onClick={()=>download(d)} title="Letöltés"><Download size={17}/></button>{d.uploaded_by===user.id&&<button className="icon-btn danger-btn" onClick={()=>remove(d)} title="Törlés"><Trash2 size={17}/></button>}</div></div>})}{!rows.length&&<Empty text="Még nincs dokumentum."/>}</div>}</>
}

function Teams(`

const pattern=/function Documents\(\{company,user\}:\{company:Company;user:User\}\)\{[\s\S]*?\nfunction Teams\(/
if(!pattern.test(source))throw new Error('Documents/UploadPanel block not found')
source=source.replace(pattern,replacement)

fs.writeFileSync(path,source)
