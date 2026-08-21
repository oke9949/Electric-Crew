import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}

function activationHtml(requestUrl: string) {
  const email = new URL(requestUrl).searchParams.get('email') || ''
  const safeEmail = email.replace(/[&<>'"]/g, '')
  return `<!doctype html><html lang="hu"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Electric Crew – dolgozói aktiválás</title><style>
  :root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;font-family:system-ui,-apple-system,Segoe UI,sans-serif;background:#121317;color:#fff;min-height:100vh;display:grid;place-items:center;padding:24px}.card{width:min(100%,480px);background:#1d1f25;border:1px solid #343843;border-radius:22px;padding:24px;box-shadow:0 24px 80px #0008}h1{font-size:28px;margin:8px 0}p{color:#b9bec9;line-height:1.45}.brand{font-weight:800;letter-spacing:.08em;color:#ff3b30}.field{display:grid;gap:7px;margin:14px 0}.field span{font-size:13px;font-weight:700;color:#dfe3ea}input{width:100%;border:1px solid #454b58;background:#15171c;color:#fff;border-radius:12px;padding:14px 15px;font-size:16px;outline:none}input:focus{border-color:#ff3b30}button{width:100%;border:0;border-radius:12px;padding:14px 16px;font-size:16px;font-weight:800;background:#ff3028;color:#fff;margin-top:8px}.msg{margin-top:14px;padding:12px 14px;border-radius:12px;display:none}.err{display:block;background:#4a1f24;color:#ffd8dc}.ok{display:block;background:#173b2b;color:#c8ffe1}.small{font-size:12px;color:#8f96a3;margin-top:16px}</style></head><body><main class="card"><div class="brand">ELECTRIC CREW</div><h1>Dolgozói fiók aktiválása</h1><p>Állíts be saját jelszót az előre engedélyezett dolgozói hozzáféréshez.</p><form id="f"><label class="field"><span>Név</span><input id="name" required autocomplete="name"></label><label class="field"><span>E-mail</span><input id="email" type="email" required autocomplete="email" value="${safeEmail}"></label><label class="field"><span>Meghívási kód</span><input id="code" required autocomplete="off" autocapitalize="none"></label><label class="field"><span>Új jelszó</span><input id="password" type="password" minlength="8" required autocomplete="new-password"></label><label class="field"><span>Jelszó ismét</span><input id="confirm" type="password" minlength="8" required autocomplete="new-password"></label><button id="submit">Fiók aktiválása</button><div id="msg" class="msg"></div></form><div class="small">A meghívási kód egyszer használható. Sikeres aktiválás után az Electric Crew webapp nyílik meg.</div></main><script>
  const hash=new URLSearchParams(location.hash.slice(1));if(hash.get('code'))document.getElementById('code').value=hash.get('code');
  document.getElementById('f').addEventListener('submit',async e=>{e.preventDefault();const msg=document.getElementById('msg');msg.className='msg';msg.textContent='';const password=document.getElementById('password').value;if(password!==document.getElementById('confirm').value){msg.className='msg err';msg.textContent='A két jelszó nem egyezik.';return}const btn=document.getElementById('submit');btn.disabled=true;btn.textContent='Aktiválás…';try{const r=await fetch(location.origin+location.pathname,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:document.getElementById('email').value,displayName:document.getElementById('name').value,activationCode:document.getElementById('code').value,password})});const data=await r.json();if(!r.ok)throw new Error(data.error||'Az aktiválás nem sikerült.');msg.className='msg ok';msg.textContent='Aktiválás kész. Most már be tudsz lépni.';setTimeout(()=>location.href='https://electric-crew-app.vercel.app/',1200)}catch(err){msg.className='msg err';msg.textContent=err.message||'Az aktiválás nem sikerült.'}finally{btn.disabled=false;btn.textContent='Fiók aktiválása'}})
</script></body></html>`
}

async function sha256Hex(value: string) {
  const bytes = new TextEncoder().encode(value)
  const hash = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(hash)).map(byte => byte.toString(16).padStart(2, '0')).join('')
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method === 'GET') return new Response(activationHtml(req.url), { headers: { ...cors, 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const { email, password, displayName, activationCode } = await req.json()
    const normalizedEmail = String(email || '').trim().toLowerCase()
    const name = String(displayName || '').trim()
    const code = String(activationCode || '').trim().toLowerCase()
    const pwd = String(password || '')

    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalizedEmail)) return json({ error: 'Érvénytelen e-mail cím.' }, 400)
    if (pwd.length < 8) return json({ error: 'A jelszó legalább 8 karakter legyen.' }, 400)
    if (!name) return json({ error: 'Add meg a neved.' }, 400)
    if (!/^[a-f0-9]{36}$/.test(code)) return json({ error: 'Érvénytelen meghívási kód.' }, 400)

    const url = Deno.env.get('SUPABASE_URL')
    const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!url || !serviceRole) return json({ error: 'A szolgáltatás nincs megfelelően konfigurálva.' }, 500)

    const admin = createClient(url, serviceRole, { auth: { persistSession: false, autoRefreshToken: false } })
    const tokenHash = await sha256Hex(code)
    const { data: invite, error: inviteError } = await admin.from('company_invites').select('id,company_id,role').eq('email', normalizedEmail).eq('status', 'PENDING').eq('token_hash', tokenHash).gt('expires_at', new Date().toISOString()).maybeSingle()
    if (inviteError) throw inviteError
    if (!invite) return json({ error: 'A meghívás nem található, lejárt vagy már felhasználták.' }, 400)

    const { data: created, error: createError } = await admin.auth.admin.createUser({ email: normalizedEmail, password: pwd, email_confirm: true, user_metadata: { display_name: name } })
    if (createError || !created.user) {
      if (String(createError?.message || '').toLowerCase().includes('already')) return json({ error: 'Ehhez az e-mail címhez már tartozik fiók. Jelentkezz be a meglévő jelszavaddal.' }, 409)
      throw createError || new Error('A felhasználó létrehozása nem sikerült.')
    }

    const userId = created.user.id
    const { error: memberError } = await admin.from('company_members').upsert({ company_id: invite.company_id, user_id: userId, role: invite.role, status: 'ACTIVE' }, { onConflict: 'company_id,user_id' })
    if (memberError) { await admin.auth.admin.deleteUser(userId); throw memberError }

    const { error: acceptError } = await admin.from('company_invites').update({ status: 'ACCEPTED', accepted_by: userId, accepted_at: new Date().toISOString() }).eq('id', invite.id).eq('status', 'PENDING')
    if (acceptError) {
      await admin.from('company_members').delete().eq('company_id', invite.company_id).eq('user_id', userId)
      await admin.auth.admin.deleteUser(userId)
      throw acceptError
    }

    return json({ ok: true })
  } catch (error) {
    console.error('activate-employee failed', error)
    return json({ error: 'A dolgozói fiók aktiválása nem sikerült.' }, 500)
  }
})
