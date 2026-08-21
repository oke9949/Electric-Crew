import { useState } from 'react'
import { CheckCircle2, ShieldCheck } from 'lucide-react'
import { supabase } from './supabase'

export default function EmployeeInviteActivation(){
  const params=new URLSearchParams(window.location.search)
  const [email,setEmail]=useState(params.get('email')||'')
  const [activationCode,setActivationCode]=useState(params.get('code')||'')
  const [displayName,setDisplayName]=useState('')
  const [password,setPassword]=useState('')
  const [confirm,setConfirm]=useState('')
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const [done,setDone]=useState(false)

  async function submit(event:React.FormEvent){
    event.preventDefault();setError('')
    if(password!==confirm){setError('A két jelszó nem egyezik.');return}
    setBusy(true)
    try{
      const {data,error}=await supabase.functions.invoke('activate-employee',{body:{email,activationCode,displayName,password}})
      if(error)throw error
      if(data?.error)throw new Error(data.error)
      const login=await supabase.auth.signInWithPassword({email:email.trim(),password})
      if(login.error)throw login.error
      setDone(true)
      window.setTimeout(()=>window.location.assign('/'),700)
    }catch(err:any){
      setError(err?.message||'Az aktiválás nem sikerült.')
    }finally{setBusy(false)}
  }

  return <div className="auth-wrap"><div className="auth-card">
    <div className="brand-lockup brand-lockup-wordmark"><img className="brand-wordmark" src="/ec-wordmark.svg" alt="Electric Crew"/><span>Dolgozói meghívás</span></div>
    <h1>Dolgozói fiók aktiválása</h1>
    <p className="muted">Add meg a meghívott e-mail címet, a kapott egyszer használatos kódot és állíts be saját jelszót.</p>
    {done?<div className="notice ok"><CheckCircle2 size={17}/><span>Aktiválás kész. Beléptetünk…</span></div>:<form onSubmit={submit} className="form-grid">
      <label className="field full"><span>Név</span><input value={displayName} onChange={e=>setDisplayName(e.target.value)} required placeholder="Teljes név"/></label>
      <label className="field full"><span>E-mail</span><input type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} required/></label>
      <label className="field full"><span>Meghívási kód</span><input value={activationCode} onChange={e=>setActivationCode(e.target.value)} required autoCapitalize="none" autoCorrect="off" placeholder="36 karakteres kód"/></label>
      <label className="field full"><span>Új jelszó</span><input type="password" autoComplete="new-password" minLength={8} value={password} onChange={e=>setPassword(e.target.value)} required/></label>
      <label className="field full"><span>Új jelszó ismét</span><input type="password" autoComplete="new-password" minLength={8} value={confirm} onChange={e=>setConfirm(e.target.value)} required/></label>
      {error&&<div className="notice error full"><ShieldCheck size={17}/><span>{error}</span></div>}
      <button className="btn primary wide full" disabled={busy}>{busy?'Aktiválás…':'Fiók aktiválása'}</button>
    </form>}
    <button type="button" className="link-btn" onClick={()=>window.location.assign('/')}>Vissza a belépéshez</button>
  </div></div>
}
