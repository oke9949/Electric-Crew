import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import {
  Bot, Building2, FileSearch, LocateFixed, MapPinned, MessageCircle,
  Plus, RefreshCw, Send, Sparkles, Users
} from 'lucide-react'
import { supabase } from './supabase'

export type CompanyRef = { company_id:string; company_name:string; role:string; status:string }
type ChatChannel = { id:string; company_id:string; name:string; kind:string; project_id?:string|null }
type ChatMessage = { id:string; channel_id:string; sender_id:string; body:string; created_at:string; sender?:{display_name?:string}|null }
type ProjectPoint = { id:string; name:string; project_code?:string|null; location?:string|null; latitude?:number|null; longitude?:number|null }
type SystemPoint = { id:string; project_id:string; code:string; name?:string|null; latitude?:number|null; longitude?:number|null; location_accuracy_m?:number|null; location_captured_at?:string|null }
type UserPoint = { user_id:string; latitude:number; longitude:number; accuracy_m?:number|null; captured_at:string; sharing:boolean; profile?:{display_name?:string}|null }
type GeoPoint = { latitude:number; longitude:number; accuracy:number }

function errorText(reason:any){return reason?.message || 'A művelet nem sikerült.'}
function timeText(value:string){return new Intl.DateTimeFormat('hu-HU',{hour:'2-digit',minute:'2-digit',month:'short',day:'numeric'}).format(new Date(value))}
function getCurrentLocation(){
  return new Promise<GeoPoint>((resolve,reject)=>{
    if(!navigator.geolocation){reject(new Error('A készülék nem támogatja a helymeghatározást.'));return}
    navigator.geolocation.getCurrentPosition(
      result=>resolve({latitude:result.coords.latitude,longitude:result.coords.longitude,accuracy:result.coords.accuracy}),
      reason=>reject(new Error('A helymeghatározás nem sikerült: '+reason.message)),
      {enableHighAccuracy:true,timeout:15000,maximumAge:30000}
    )
  })
}

export function CompanyChat({company,user}:{company:CompanyRef;user:User}){
  const [channels,setChannels]=useState<ChatChannel[]>([])
  const [projects,setProjects]=useState<ProjectPoint[]>([])
  const [active,setActive]=useState<string>('')
  const [messages,setMessages]=useState<ChatMessage[]>([])
  const [draft,setDraft]=useState('')
  const [busy,setBusy]=useState(true)
  const [sending,setSending]=useState(false)
  const [error,setError]=useState('')

  async function loadChannels(){
    setError('')
    const [channelResult,projectResult]=await Promise.all([
      supabase.from('chat_channels').select('*').eq('company_id',company.company_id).order('created_at'),
      supabase.from('projects').select('id,name,project_code,location').eq('company_id',company.company_id).eq('active',true).order('name')
    ])
    if(channelResult.error) throw channelResult.error
    if(projectResult.error) throw projectResult.error
    let next=(channelResult.data||[]) as ChatChannel[]
    if(!next.some(item=>item.kind==='COMPANY')){
      const created=await supabase.from('chat_channels').insert({
        company_id:company.company_id,name:'Céges chatszoba',kind:'COMPANY',created_by:user.id
      }).select('*').single()
      if(created.error){
        const retry=await supabase.from('chat_channels').select('*').eq('company_id',company.company_id).order('created_at')
        if(retry.error) throw retry.error
        next=(retry.data||[]) as ChatChannel[]
      }else next=[created.data as ChatChannel,...next]
    }
    setChannels(next)
    setProjects((projectResult.data||[]) as ProjectPoint[])
    setActive(current=>current&&next.some(item=>item.id===current)?current:(next[0]?.id||''))
  }

  async function loadMessages(channelId=active){
    if(!channelId){setMessages([]);return}
    const {data,error}=await supabase.from('chat_messages')
      .select('id,channel_id,sender_id,body,created_at,sender:profiles!chat_messages_sender_id_fkey(display_name)')
      .eq('channel_id',channelId).order('created_at').limit(300)
    if(error){setError(error.message);return}
    setMessages((data||[]) as unknown as ChatMessage[])
  }

  useEffect(()=>{setBusy(true);loadChannels().catch(e=>setError(errorText(e))).finally(()=>setBusy(false))},[company.company_id])
  useEffect(()=>{void loadMessages()},[active])
  useEffect(()=>{
    if(!active)return
    const channel=supabase.channel('ec-chat-'+active)
      .on('postgres_changes',{event:'*',schema:'public',table:'chat_messages',filter:'channel_id=eq.'+active},()=>void loadMessages(active))
      .subscribe()
    return()=>{void supabase.removeChannel(channel)}
  },[active])

  async function addProjectRoom(projectId:string){
    if(!projectId)return
    const project=projects.find(item=>item.id===projectId)
    const existing=channels.find(item=>item.project_id===projectId)
    if(existing){setActive(existing.id);return}
    const {data,error}=await supabase.from('chat_channels').insert({
      company_id:company.company_id,project_id:projectId,name:project?.project_code||project?.name||'Projekt',
      kind:'PROJECT',created_by:user.id
    }).select('*').single()
    if(error){setError(error.message);return}
    const next=[...channels,data as ChatChannel]
    setChannels(next);setActive(data.id)
  }

  async function send(event:FormEvent){
    event.preventDefault()
    const body=draft.trim()
    if(!body||!active)return
    setSending(true);setError('')
    const {error}=await supabase.from('chat_messages').insert({
      channel_id:active,company_id:company.company_id,sender_id:user.id,body
    })
    if(error)setError(error.message)
    else{setDraft('');await loadMessages(active)}
    setSending(false)
  }

  const selected=channels.find(item=>item.id===active)
  return <div className="collab-page">
    <div className="page-hero"><div><h1>Céges kommunikáció</h1><p>Valós idejű céges és projektcsatornák, egy helyen.</p></div>
      <div className="hero-actions"><select aria-label="Projekt chatszoba létrehozása" defaultValue="" onChange={e=>{void addProjectRoom(e.target.value);e.currentTarget.value='' }}><option value="">+ Projektcsatorna</option>{projects.map(project=><option key={project.id} value={project.id}>{project.project_code||project.name}</option>)}</select></div>
    </div>
    {error&&<InlineNotice>{error}</InlineNotice>}
    <div className="chat-layout">
      <aside className="chat-channels"><b>Chatszobák</b>{channels.map(channel=><button className={active===channel.id?'active':''} key={channel.id} onClick={()=>setActive(channel.id)}><MessageCircle size={18}/><span>{channel.name}</span></button>)}</aside>
      <section className="chat-panel">
        <header><div><span className="eyebrow">{selected?.kind==='COMPANY'?'MINDEN MUNKATÁRS':'PROJEKT'}</span><h2>{selected?.name||'Chatszoba'}</h2></div><button className="icon-btn" onClick={()=>void loadMessages()} aria-label="Üzenetek frissítése"><RefreshCw size={18}/></button></header>
        <div className="message-stream">{busy?<Busy/>:messages.length?messages.map(message=><article className={message.sender_id===user.id?'message mine':'message'} key={message.id}><div><b>{message.sender?.display_name||'Munkatárs'}</b><time>{timeText(message.created_at)}</time></div><p>{message.body}</p></article>):<Empty icon={MessageCircle} text="Még nincs üzenet. Indítsd el a beszélgetést!"/>}</div>
        <form className="message-composer" onSubmit={send}><textarea value={draft} onChange={e=>setDraft(e.target.value)} maxLength={5000} rows={2} placeholder="Írj üzenetet a csapatnak…" required/><button className="btn primary" disabled={sending||!draft.trim()}><Send size={17}/>{sending?'Küldés…':'Küldés'}</button></form>
      </section>
    </div>
  </div>
}

export function KnowledgeAssistant({company,user}:{company:CompanyRef;user:User}){
  const [conversation,setConversation]=useState<string>('')
  const [messages,setMessages]=useState<Array<{id:string;role:string;content:string;created_at:string}>>([])
  const [question,setQuestion]=useState('')
  const [busy,setBusy]=useState(true)
  const [thinking,setThinking]=useState(false)
  const [error,setError]=useState('')

  async function ensureConversation(){
    const existing=await supabase.from('ai_conversations').select('*').eq('company_id',company.company_id).eq('user_id',user.id).order('updated_at',{ascending:false}).limit(1).maybeSingle()
    if(existing.error)throw existing.error
    if(existing.data)return existing.data.id
    const created=await supabase.from('ai_conversations').insert({company_id:company.company_id,user_id:user.id,title:'Electric Crew AI'}).select('id').single()
    if(created.error)throw created.error
    return created.data.id
  }

  async function load(id=conversation){
    if(!id)return
    const {data,error}=await supabase.from('ai_messages').select('*').eq('conversation_id',id).order('created_at')
    if(error){setError(error.message);return}
    setMessages(data||[])
  }

  useEffect(()=>{setBusy(true);ensureConversation().then(id=>{setConversation(id);return load(id)}).catch(e=>setError(errorText(e))).finally(()=>setBusy(false))},[company.company_id])

  async function ask(event?:FormEvent,preset?:string){
    event?.preventDefault()
    const prompt=(preset||question).trim()
    if(!prompt||!conversation)return
    setThinking(true);setError('')
    const inserted=await supabase.from('ai_messages').insert({conversation_id:conversation,role:'user',content:prompt}).select('*').single()
    if(inserted.error){setError(inserted.error.message);setThinking(false);return}
    setMessages(current=>[...current,inserted.data])
    setQuestion('')
    try{
      const {data:{session}}=await supabase.auth.getSession()
      if(!session)throw new Error('A munkamenet lejárt. Jelentkezz be újra.')
      const response=await fetch('/api/ai',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.access_token},body:JSON.stringify({mode:'assistant',companyId:company.company_id,question:prompt})})
      const result=await response.json()
      if(!response.ok)throw new Error(result.error||'Az AI-szolgáltatás nem válaszolt.')
      const saved=await supabase.from('ai_messages').insert({conversation_id:conversation,role:'assistant',content:result.answer}).select('*').single()
      if(saved.error)throw saved.error
      setMessages(current=>[...current,saved.data])
    }catch(e){setError(errorText(e))}
    finally{setThinking(false)}
  }

  const presets=['Mi igényel ma vezetői figyelmet?','Készíts heti projektösszefoglalót!','Mely feladatok és anyagok kockázatosak?']
  return <div className="assistant-page">
    <div className="page-hero"><div><h1>Electric Crew AI</h1><p>A cég saját projektjei, feladatai, készlete és dokumentumai alapján válaszol.</p></div><div className="hero-actions"><span className="ai-live"><Sparkles size={16}/>Vállalati tudás aktív</span></div></div>
    <div className="notice ok"><Bot size={17}/><span>Az asszisztens csak a bejelentkezett felhasználó számára engedélyezett céges adatokat kapja meg.</span></div>
    <div className="ai-presets">{presets.map(item=><button className="btn" key={item} disabled={thinking} onClick={()=>void ask(undefined,item)}>{item}</button>)}</div>
    {error&&<InlineNotice>{error}</InlineNotice>}
    <section className="ai-chat"><div className="message-stream">{busy?<Busy/>:messages.length?messages.map(item=><article className={item.role==='user'?'message mine':'message ai-message'} key={item.id}><div><b>{item.role==='user'?'Te':'Electric Crew AI'}</b><time>{timeText(item.created_at)}</time></div><p>{item.content}</p></article>):<Empty icon={Bot} text="Kérdezz rá egy projektre, feladatra, anyagra vagy kockázatra."/ >}{thinking&&<div className="ai-thinking"><RefreshCw className="spin" size={17}/>Az Electric Crew adatait elemzem…</div>}</div>
      <form className="message-composer" onSubmit={event=>void ask(event)}><textarea value={question} onChange={e=>setQuestion(e.target.value)} rows={3} maxLength={2000} placeholder="Például: Melyik aktív projekt csúszhat meg, és miért?" required/><button className="btn primary" disabled={thinking||!question.trim()}><Sparkles size={17}/>Elemzés</button></form>
    </section>
  </div>
}

export function DocumentAiButton({company,document,onDone}:{company:CompanyRef;document:any;onDone:()=>void}){
  const [busy,setBusy]=useState(false)
  async function analyze(){
    setBusy(true)
    try{
      const isDwg=String(document.file_name||'').toLowerCase().endsWith('.dwg')
      if(isDwg)throw new Error('A DWG bináris rajz közvetlenül nem olvasható az AI számára. Tölts fel ugyanebből a rajzból PDF-exportot vagy képi előnézetet; a rendszer azt anyaglistává tudja alakítani, a DWG pedig megmarad eredeti forrásként.')
      const booked=await supabase.from('document_material_items').select('id',{count:'exact',head:true}).eq('document_id',document.id).eq('stock_status','BOOKED')
      if(booked.error)throw booked.error
      if(booked.count)throw new Error('A dokumentum már tartalmaz raktárra vett tételeket, ezért nem elemezhető újra. Így a készletmozgások forrása és auditlánca változatlan marad.')
      const signed=await supabase.storage.from('company-documents').createSignedUrl(document.storage_path,300)
      if(signed.error)throw signed.error
      const {data:{session}}=await supabase.auth.getSession()
      if(!session)throw new Error('A munkamenet lejárt.')
      const response=await fetch('/api/ai',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.access_token},body:JSON.stringify({mode:'document',companyId:company.company_id,document:{id:document.id,url:signed.data.signedUrl,mimeType:document.mime_type,fileName:document.file_name}})})
      const result=await response.json()
      if(!response.ok)throw new Error(result.error||'A dokumentumelemzés nem sikerült.')
      const updated=await supabase.from('documents').update({document_type:result.documentType||document.description||'egyeb',ai_summary:result.summary,ai_fields:result.fields||{}}).eq('id',document.id)
      if(updated.error)throw updated.error
      const cleared=await supabase.from('document_material_items').delete().eq('document_id',document.id)
      if(cleared.error)throw cleared.error
      const materials=(Array.isArray(result.materials)?result.materials:[]).filter((item:any)=>String(item?.name||'').trim()).map((item:any,index:number)=>({
        company_id:company.company_id,document_id:document.id,project_id:document.project_id||null,line_number:index+1,
        name:String(item.name).trim(),sku:item.sku||null,quantity:numberOrNull(item.quantity),unit:item.unit||null,
        unit_price:numberOrNull(item.unitPrice),total_price:numberOrNull(item.totalPrice),currency:item.currency||result.fields?.currency||'HUF',
        net_amount:numberOrNull(item.netAmount),vat_amount:numberOrNull(item.vatAmount),gross_amount:numberOrNull(item.grossAmount),
        confidence:confidenceOrNull(item.confidence),source_text:item.sourceText||null,
        stock_status:isReviewableItem(item)?'PENDING':'NEEDS_REVIEW'
      }))
      if(materials.length){const inserted=await supabase.from('document_material_items').insert(materials);if(inserted.error)throw inserted.error}
      if(result.financial){
        const f=result.financial
        const saved=await supabase.from('financial_entries').upsert({
          company_id:company.company_id,source_document_id:document.id,project_id:document.project_id||null,entry_type:f.entryType==='INCOME'?'INCOME':'EXPENSE',
          counterparty:f.counterparty||result.fields?.supplier||result.fields?.customer||null,reference_number:f.referenceNumber||result.fields?.invoiceNumber||null,
          issue_date:dateOrNull(f.issueDate||result.fields?.issueDate),due_date:dateOrNull(f.dueDate||result.fields?.dueDate),
          net_amount:numberOrZero(f.netAmount??result.fields?.netTotal),vat_amount:numberOrZero(f.vatAmount??result.fields?.vatTotal),gross_amount:numberOrZero(f.grossAmount??result.fields?.grossTotal),
          currency:f.currency||result.fields?.currency||'HUF',status:f.status||'RECORDED',confidence:confidenceOrNull(f.confidence),created_by:session.user.id,updated_at:new Date().toISOString()
        },{onConflict:'source_document_id'})
        if(saved.error)throw saved.error
      }
      onDone()
    }catch(e){window.alert(errorText(e))}
    finally{setBusy(false)}
  }
  return <button className="btn ai-doc-btn" onClick={()=>void analyze()} disabled={busy} title="A dokumentum tartalmának feldolgozása"><FileSearch size={16}/>{busy?'AI elemzés…':document.ai_summary?'Újraelemzés':'AI elemzés'}</button>
}

function numberOrNull(value:any){const number=Number(value);return value===null||value===''||!Number.isFinite(number)?null:number}
function numberOrZero(value:any){return numberOrNull(value)??0}
function confidenceOrNull(value:any){const number=numberOrNull(value);return number===null?null:Math.min(1,Math.max(0,number))}
function dateOrNull(value:any){return /^\d{4}-\d{2}-\d{2}$/.test(String(value||''))?String(value):null}
function isReviewableItem(item:any){return Boolean(String(item?.name||'').trim()&&Number(item?.quantity)>0&&String(item?.unit||'').trim()&&Number(item?.confidence??1)>=0.6)}

export function CompanyMap({company,user}:{company:CompanyRef;user:User}){
  const mapRef=useRef<HTMLDivElement|null>(null)
  const mapInstance=useRef<any>(null)
  const personMarkers=useRef<Record<string,any>>({})
  const systemMarkers=useRef<Record<string,any>>({})
  const [projects,setProjects]=useState<ProjectPoint[]>([])
  const [systems,setSystems]=useState<SystemPoint[]>([])
  const [people,setPeople]=useState<UserPoint[]>([])
  const [selectedProject,setSelectedProject]=useState('')
  const [selectedSystem,setSelectedSystem]=useState('')
  const [selectedPerson,setSelectedPerson]=useState('')
  const [position,setPosition]=useState<GeoPoint|null>(null)
  const [locatingSystem,setLocatingSystem]=useState(false)
  const [busy,setBusy]=useState(true)
  const [error,setError]=useState('')

  async function load(){
    setError('')
    const [p,u]=await Promise.all([
      supabase.from('projects').select('id,name,project_code,location,latitude,longitude').eq('company_id',company.company_id).eq('active',true),
      supabase.from('user_locations').select('user_id,latitude,longitude,accuracy_m,captured_at,sharing,profile:profiles!user_locations_user_id_fkey(display_name)').eq('company_id',company.company_id).eq('sharing',true)
    ])
    if(p.error)throw p.error
    if(u.error)throw u.error
    const nextProjects=(p.data||[]) as ProjectPoint[]
    const projectIds=nextProjects.map(project=>project.id)
    let nextSystems:SystemPoint[]=[]
    if(projectIds.length){
      const s=await supabase.from('systems').select('id,project_id,code,name,latitude,longitude,location_accuracy_m,location_captured_at').in('project_id',projectIds).order('code')
      if(s.error)throw s.error
      nextSystems=(s.data||[]) as SystemPoint[]
    }
    setProjects(nextProjects)
    setSystems(nextSystems)
    setPeople((u.data||[]) as unknown as UserPoint[])
  }

  useEffect(()=>{setBusy(true);load().catch(e=>setError(errorText(e))).finally(()=>setBusy(false))},[company.company_id])
  useEffect(()=>{
    const channel=supabase.channel('ec-locations-'+company.company_id)
      .on('postgres_changes',{event:'*',schema:'public',table:'user_locations',filter:'company_id=eq.'+company.company_id},()=>void load())
      .subscribe()
    return()=>{void supabase.removeChannel(channel)}
  },[company.company_id])

  const activePeople=useMemo(()=>[...people].sort((a,b)=>(a.profile?.display_name||'Munkatárs').localeCompare(b.profile?.display_name||'Munkatárs','hu')),[people])
  const selectedPersonPoint=activePeople.find(person=>person.user_id===selectedPerson)
  const selectedSystemPoint=systems.find(system=>system.id===selectedSystem)
  useEffect(()=>{if(selectedPerson&&!people.some(person=>person.user_id===selectedPerson))setSelectedPerson('')},[people,selectedPerson])
  useEffect(()=>{if(selectedSystem&&!systems.some(system=>system.id===selectedSystem))setSelectedSystem('')},[systems,selectedSystem])

  const points=useMemo(()=>[
    ...projects.filter(p=>p.latitude!=null&&p.longitude!=null).map(p=>({id:p.id,lat:Number(p.latitude),lng:Number(p.longitude),label:p.project_code||p.name,type:'project'})),
    ...systems.filter(s=>s.latitude!=null&&s.longitude!=null).map(s=>({id:s.id,lat:Number(s.latitude),lng:Number(s.longitude),label:s.code+(s.name?' · '+s.name:''),type:'system'})),
    ...people.map(p=>({id:p.user_id,lat:Number(p.latitude),lng:Number(p.longitude),label:p.profile?.display_name||'Munkatárs',type:'person'}))
  ],[projects,systems,people])

  useEffect(()=>{
    let cancelled=false
    const render=()=>{
      if(cancelled||!mapRef.current)return false
      if(mapInstance.current){mapInstance.current.remove();mapInstance.current=null}
      personMarkers.current={}
      systemMarkers.current={}
      const first=points[0]||{lat:47.4979,lng:19.0402}
      const map=L.map(mapRef.current).setView([first.lat,first.lng],points.length?12:7)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap'}).addTo(map)
      const bounds:any[]=[]
      points.forEach(point=>{
        const markerStyle=point.type==='project'
          ?{radius:9,color:'#f51f27',fillColor:'#f51f27',fillOpacity:1,weight:3}
          :point.type==='system'
            ?{radius:8,color:'#2563eb',fillColor:'#dbeafe',fillOpacity:1,weight:3}
            :{radius:9,color:'#111',fillColor:'#fff',fillOpacity:1,weight:3}
        const marker=L.circleMarker([point.lat,point.lng],markerStyle).addTo(map)
        const kind=point.type==='project'?'Projekt':point.type==='system'?'Rendszer':'Munkatárs'
        marker.bindPopup('<b>'+escapeHtml(point.label)+'</b><br>'+kind)
        if(point.type==='person')personMarkers.current[point.id]=marker
        if(point.type==='system')systemMarkers.current[point.id]=marker
        bounds.push([point.lat,point.lng])
      })
      if(bounds.length>1)map.fitBounds(bounds,{padding:[35,35]})
      mapInstance.current=map
      return true
    }
    render()
    return()=>{cancelled=true;if(mapInstance.current){mapInstance.current.remove();mapInstance.current=null}}
  },[points])

  function showPerson(){
    if(!selectedPersonPoint||!mapInstance.current)return
    mapInstance.current.setView([Number(selectedPersonPoint.latitude),Number(selectedPersonPoint.longitude)],17,{animate:true})
    personMarkers.current[selectedPersonPoint.user_id]?.openPopup()
  }

  function showSystem(){
    if(!selectedSystemPoint||selectedSystemPoint.latitude==null||selectedSystemPoint.longitude==null||!mapInstance.current)return
    mapInstance.current.setView([Number(selectedSystemPoint.latitude),Number(selectedSystemPoint.longitude)],18,{animate:true})
    systemMarkers.current[selectedSystemPoint.id]?.openPopup()
  }

  async function shareLocation(){
    setError('')
    try{
      const next=await getCurrentLocation()
      setPosition(next)
      const {error}=await supabase.from('user_locations').upsert({company_id:company.company_id,user_id:user.id,latitude:next.latitude,longitude:next.longitude,accuracy_m:next.accuracy,sharing:true,captured_at:new Date().toISOString()},{onConflict:'company_id,user_id'})
      if(error)throw error
      await load()
    }catch(e){setError(errorText(e))}
  }

  async function saveSystemPoint(){
    if(!selectedSystem)return
    setLocatingSystem(true);setError('')
    try{
      const next=await getCurrentLocation()
      const capturedAt=new Date().toISOString()
      setPosition(next)
      const {error}=await supabase.from('systems').update({
        latitude:next.latitude,longitude:next.longitude,location_accuracy_m:next.accuracy,
        location_captured_at:capturedAt,location_updated_by:user.id
      }).eq('id',selectedSystem)
      if(error)throw error
      await load()
    }catch(e){setError(errorText(e))}
    finally{setLocatingSystem(false)}
  }

  async function saveProjectPoint(){
    if(!position||!selectedProject)return
    const {error}=await supabase.from('projects').update({latitude:position.latitude,longitude:position.longitude}).eq('id',selectedProject)
    if(error)setError(error.message);else void load()
  }

  const systemOptionLabel=(system:SystemPoint)=>{
    const project=projects.find(item=>item.id===system.project_id)
    return [project?.project_code||project?.name,system.code,system.name].filter(Boolean).join(' · ')
  }

  return <div className="map-page"><div className="page-hero"><div><h1>Élő munkatérkép</h1><p>Aktív projektek, műszaki rendszerek és önként megosztott munkatársi helyzetek.</p></div><div className="hero-actions"><button className="btn primary" onClick={()=>void shareLocation()}><LocateFixed size={17}/>Saját helyzet megosztása</button></div></div>
    {error&&<InlineNotice>{error}</InlineNotice>}
    <div className="map-layout"><section className="map-card"><div ref={mapRef} className="ec-map" aria-label="Electric Crew térkép"/>{busy&&<div className="map-loading"><Busy/></div>}</section>
      <aside className="map-side"><div className="settings-card"><MapPinned/><div><span>Aktív projektek</span><b>{projects.length}</b><small>{projects.filter(p=>p.latitude!=null).length} térképen</small></div></div><div className="settings-card"><Building2/><div><span>Rendszerek</span><b>{systems.length}</b><small>{systems.filter(s=>s.latitude!=null&&s.longitude!=null).length} térképen</small></div></div><div className="settings-card"><Users/><div><span>Helyzetet megosztók</span><b>{people.length}</b><small>Csak aktív cégtagok számára látható</small></div></div>
        <div className="map-project-editor"><b>Aktív munkatársak</b><p>Válassz ki egy helyzetet megosztó munkatársat, majd fókuszálj rá a térképen.</p><div style={{display:'grid',gridTemplateColumns:'minmax(0,1fr) auto',gap:8,alignItems:'stretch'}}><select aria-label="Aktív munkatárs kiválasztása" value={selectedPerson} onChange={e=>setSelectedPerson(e.target.value)}><option value="">Válassz munkatársat</option>{activePeople.map(person=><option key={person.user_id} value={person.user_id}>{person.profile?.display_name||'Munkatárs'}</option>)}</select><button className="btn primary" disabled={!selectedPersonPoint} onClick={showPerson}><LocateFixed size={16}/>Mutasd</button></div>{selectedPersonPoint&&<small>Utolsó frissítés: {timeText(selectedPersonPoint.captured_at)}{selectedPersonPoint.accuracy_m!=null?` · Pontosság: ±${Math.round(Number(selectedPersonPoint.accuracy_m))} m`:''}</small>}{!activePeople.length&&<small>Jelenleg nincs helyzetet megosztó munkatárs.</small>}</div>
        <div className="map-project-editor"><b>Rendszer helyének megjelölése</b><p>Állj a rendszer mellett, válaszd ki, majd a „Jelöld ide” gomb friss GPS-koordinátát ment hozzá.</p><select aria-label="Rendszer kiválasztása helymegjelöléshez" value={selectedSystem} onChange={e=>setSelectedSystem(e.target.value)}><option value="">Válassz rendszert</option>{systems.map(system=><option key={system.id} value={system.id}>{systemOptionLabel(system)}</option>)}</select><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}><button className="btn" disabled={!selectedSystemPoint||selectedSystemPoint.latitude==null||selectedSystemPoint.longitude==null} onClick={showSystem}><MapPinned size={16}/>Mutasd</button><button className="btn primary" disabled={!selectedSystem||locatingSystem} onClick={()=>void saveSystemPoint()}><LocateFixed size={16}/>{locatingSystem?'GPS…':'Jelöld ide'}</button></div>{selectedSystemPoint?.location_captured_at&&<small>Utolsó jelölés: {timeText(selectedSystemPoint.location_captured_at)}{selectedSystemPoint.location_accuracy_m!=null?` · Pontosság: ±${Math.round(Number(selectedSystemPoint.location_accuracy_m))} m`:''}</small>}</div>
        {['OWNER','ADMIN','MANAGER'].includes(company.role)&&<div className="map-project-editor"><b>Projekt helyzetének rögzítése</b><p>A saját aktuális koordinátádat rendelheted a kiválasztott projekthez.</p><select value={selectedProject} onChange={e=>setSelectedProject(e.target.value)}><option value="">Válassz projektet</option>{projects.map(p=><option key={p.id} value={p.id}>{p.project_code||p.name}</option>)}</select><button className="btn" disabled={!position||!selectedProject} onClick={()=>void saveProjectPoint()}><Building2 size={16}/>Koordináta mentése</button></div>}
      </aside>
    </div>
  </div>
}

function escapeHtml(value:string){return value.replace(/[&<>'\"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','\"':'&quot;'}[char]||char))}
function InlineNotice({children}:{children:any}){return <div className="notice error"><span>{children}</span></div>}
function Busy(){return <div className="loading"><RefreshCw className="spin"/> Betöltés…</div>}
function Empty({icon:Icon,text}:{icon:any;text:string}){return <div className="empty"><Icon size={30}/><span>{text}</span></div>}
