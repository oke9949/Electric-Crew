import { useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, PackageCheck, X } from 'lucide-react'
import { supabase } from './supabase'

type Material = { id:string; name:string; sku?:string|null; unit:string; stock_quantity:number|string }
type DocumentItem = {
  id:string; document_id:string; line_number:number; name:string; sku?:string|null;
  quantity?:number|string|null; unit?:string|null; unit_price?:number|string|null;
  total_price?:number|string|null; net_amount?:number|string|null; vat_amount?:number|string|null;
  gross_amount?:number|string|null; currency?:string|null; confidence?:number|string|null;
  material_id?:string|null; stock_status?:'PENDING'|'NEEDS_REVIEW'|'BOOKED'; stock_transaction_id?:string|null;
  documents?:{file_name?:string|null;document_type?:string|null}|null;
}
type Draft = DocumentItem & { selected:boolean; materialChoice:string }

const money=(value:number|string|null|undefined,currency='HUF')=>value==null||value===''?'—':new Intl.NumberFormat('hu-HU',{style:'currency',currency:currency||'HUF',maximumFractionDigits:2}).format(Number(value))
const normalize=(value:unknown)=>String(value||'').trim().toLocaleLowerCase('hu-HU')
const isValid=(item:Pick<DocumentItem,'name'|'quantity'|'unit'>)=>Boolean(String(item.name||'').trim()&&Number(item.quantity)>0&&String(item.unit||'').trim())

function suggestedMaterial(item:DocumentItem,materials:Material[]){
  if(item.material_id&&materials.some(material=>material.id===item.material_id))return item.material_id
  const sku=normalize(item.sku)
  const name=normalize(item.name)
  const unit=normalize(item.unit)
  return materials.find(material=>(sku&&normalize(material.sku)===sku)||(normalize(material.name)===name&&normalize(material.unit)===unit))?.id||'__new__'
}

export function DocumentMaterialIntakeList({items,materials,canManage,onDone}:{items:DocumentItem[];materials:Material[];canManage:boolean;onDone:()=>void|Promise<void>}){
  const [active,setActive]=useState<{documentId:string;fileName:string;items:DocumentItem[]}|null>(null)
  const [message,setMessage]=useState('')
  const groups=useMemo(()=>{
    const byDocument=new Map<string,{documentId:string;fileName:string;items:DocumentItem[]}>()
    for(const item of items){
      const group=byDocument.get(item.document_id)||{documentId:item.document_id,fileName:item.documents?.file_name||'Dokumentum',items:[]}
      group.items.push(item);byDocument.set(item.document_id,group)
    }
    return [...byDocument.values()].map(group=>({...group,items:group.items.sort((a,b)=>a.line_number-b.line_number)}))
  },[items])

  if(!groups.length)return <div className="table-card"><div className="empty">Még nincs AI által kinyert anyagtétel. A Dokumentumok oldalon futtasd az AI elemzést egy számlán, szállítólevélen vagy anyaglistán.</div></div>
  return <div className="invoice-groups">
    {message&&<div className="notice ok"><CheckCircle2 size={17}/><span>{message}</span></div>}
    {groups.map(group=>{
      const booked=group.items.filter(item=>item.stock_status==='BOOKED'||item.stock_transaction_id).length
      const pending=group.items.length-booked
      return <section className="invoice-group" key={group.documentId}>
        <header><div><span className="eyebrow">FORRÁS DOKUMENTUM</span><h3>{group.fileName}</h3><small>{group.items.length} tétel · {booked?`${booked} már raktárra véve`:'még nincs raktárra véve'}</small></div>
          {pending>0&&<button className="btn primary stock-intake-open" disabled={!canManage} onClick={()=>setActive(group)} title={canManage?'Tételek ellenőrzése és jóváhagyása':'Vezetői jogosultság szükséges'}><PackageCheck size={17}/>Raktárkészletre felvitel</button>}
          {pending===0&&<span className="status s-completed">Raktárra véve</span>}
        </header>
        <div className="invoice-item-list">{group.items.map(item=><article className={`invoice-item ${item.stock_status==='BOOKED'?'booked':''}`} key={item.id}>
          <div><b>{item.name}</b><span>{item.sku||`Tétel ${item.line_number}`}</span></div><div><span>Mennyiség</span><b>{item.quantity??'—'} {item.unit||''}</b></div><div><span>Egységár</span><b>{money(item.unit_price,item.currency||'HUF')}</b></div><div><span>Nettó / bruttó</span><b>{money(item.net_amount??item.total_price,item.currency||'HUF')} / {money(item.gross_amount??item.total_price,item.currency||'HUF')}</b></div><div><span>Állapot</span><b>{item.stock_status==='BOOKED'?'Raktárra véve':isValid(item)?'Ellenőrizhető':'Javítandó'}</b></div>
        </article>)}</div>
      </section>
    })}
    {active&&<StockIntakeModal group={active} materials={materials} onClose={()=>setActive(null)} onDone={async result=>{setActive(null);setMessage(`${result.booked} tétel sikeresen raktárkészletre került${result.alreadyBooked?`, ${result.alreadyBooked} korábban már könyvelve volt`:''}.`);await onDone()}}/>}
  </div>
}

function StockIntakeModal({group,materials,onClose,onDone}:{group:{documentId:string;fileName:string;items:DocumentItem[]};materials:Material[];onClose:()=>void;onDone:(result:{booked:number;alreadyBooked:number})=>void|Promise<void>}){
  const [drafts,setDrafts]=useState<Draft[]>(()=>group.items.map(item=>({...item,selected:item.stock_status!=='BOOKED'&&isValid(item)&&Number(item.confidence??1)>=0.6,materialChoice:suggestedMaterial(item,materials)})))
  const [busy,setBusy]=useState(false),[error,setError]=useState('')
  const selected=drafts.filter(item=>item.selected&&item.stock_status!=='BOOKED')
  const invalid=selected.filter(item=>!isValid(item))
  const update=(id:string,patch:Partial<Draft>)=>setDrafts(rows=>rows.map(row=>row.id===id?{...row,...patch}:row))
  async function submit(){
    if(!selected.length||invalid.length)return
    setBusy(true);setError('')
    try{
      const payload=selected.map(item=>({itemId:item.id,name:String(item.name).trim(),sku:String(item.sku||'').trim()||null,quantity:Number(item.quantity),unit:String(item.unit||'').trim(),unitPrice:item.unit_price==null?'':Number(item.unit_price),materialId:item.materialChoice==='__new__'?'':item.materialChoice,createNew:item.materialChoice==='__new__'}))
      const {data,error}=await supabase.rpc('book_document_material_items',{p_document_id:group.documentId,p_items:payload})
      if(error)throw error
      await onDone({booked:Number((data as any)?.booked||0),alreadyBooked:Number((data as any)?.alreadyBooked||0)})
    }catch(reason:any){setError(reason?.message||'A készletre vétel nem sikerült.')}finally{setBusy(false)}
  }
  return <div className="modal-wrap"><div className="scrim" onClick={onClose}/><section className="modal intake-modal" role="dialog" aria-modal="true" aria-labelledby="stock-intake-title"><header className="modal-head"><div><span className="eyebrow">JÓVÁHAGYÁS SZÜKSÉGES</span><h2 id="stock-intake-title">Raktárkészletre felvitel</h2><small>{group.fileName}</small></div><button className="icon-btn" onClick={onClose} disabled={busy} aria-label="Jóváhagyási ablak bezárása"><X size={18}/></button></header>
    <div className="notice"><AlertTriangle size={17}/><span>Az AI nem módosít automatikusan készletet. Ellenőrizd, javítsd és jelöld ki a könyvelendő sorokat.</span></div>
    <div className="intake-rows">{drafts.map(item=>{const booked=item.stock_status==='BOOKED'||Boolean(item.stock_transaction_id);const valid=isValid(item);return <article className={`intake-row ${booked?'booked':''} ${!valid?'invalid':''}`} key={item.id}>
      <label className="intake-check"><input type="checkbox" checked={booked||item.selected} disabled={booked||busy} onChange={event=>update(item.id,{selected:event.target.checked})}/><span>{booked?'Már könyvelve':'Jóváhagyom'}</span></label>
      <label><span>Megnevezés</span><input value={item.name} disabled={booked||busy} onChange={event=>update(item.id,{name:event.target.value})}/></label>
      <label><span>Mennyiség</span><input type="number" min="0.0001" step="any" value={item.quantity??''} disabled={booked||busy} onChange={event=>update(item.id,{quantity:event.target.value})}/></label>
      <label><span>Mértékegység</span><input value={item.unit||''} disabled={booked||busy} onChange={event=>update(item.id,{unit:event.target.value})}/></label>
      <label className="intake-material"><span>Raktári párosítás</span><select value={item.materialChoice} disabled={booked||busy} onChange={event=>update(item.id,{materialChoice:event.target.value})}><option value="__new__">+ Új anyag létrehozása</option>{materials.map(material=><option key={material.id} value={material.id}>{material.name} · {material.stock_quantity} {material.unit}</option>)}</select></label>
      <div className="intake-price"><span>Egységár / nettó / bruttó</span><b>{money(item.unit_price,item.currency||'HUF')} · {money(item.net_amount??item.total_price,item.currency||'HUF')} · {money(item.gross_amount??item.total_price,item.currency||'HUF')}</b><small>AI biztonság: {item.confidence==null?'—':`${Math.round(Number(item.confidence)*100)}%`}</small></div>
      {!valid&&<small className="intake-error">A könyveléshez megnevezés, pozitív mennyiség és mértékegység szükséges.</small>}
    </article>})}</div>
    {error&&<div className="notice error" role="alert">{error}</div>}
    <footer className="modal-actions intake-actions"><span>{selected.length} kiválasztott tétel</span><button className="btn" onClick={onClose} disabled={busy}>Mégse</button><button className="btn primary" onClick={()=>void submit()} disabled={busy||!selected.length||Boolean(invalid.length)}><PackageCheck size={17}/>{busy?'Könyvelés…':`${selected.length} tétel bevételezése`}</button></footer>
  </section></div>
}
