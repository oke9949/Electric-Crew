import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: cors })
}

async function sha256Hex(value: string) {
  const bytes = new TextEncoder().encode(value)
  const hash = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(hash)).map(byte => byte.toString(16).padStart(2, '0')).join('')
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
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
    const now = new Date().toISOString()

    const { data: invite, error: inviteError } = await admin
      .from('company_invites')
      .select('id,company_id,role,email,expires_at')
      .eq('email', normalizedEmail)
      .eq('status', 'PENDING')
      .eq('token_hash', tokenHash)
      .gt('expires_at', now)
      .maybeSingle()

    if (inviteError) throw inviteError
    if (!invite) return json({ error: 'A meghívás nem található, lejárt vagy már felhasználták.' }, 400)

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: normalizedEmail,
      password: pwd,
      email_confirm: true,
      user_metadata: { display_name: name },
    })

    if (createError || !created.user) {
      if (String(createError?.message || '').toLowerCase().includes('already')) {
        return json({ error: 'Ehhez az e-mail címhez már tartozik fiók. Jelentkezz be a meglévő jelszavaddal.' }, 409)
      }
      throw createError || new Error('A felhasználó létrehozása nem sikerült.')
    }

    const userId = created.user.id
    const { error: memberError } = await admin.from('company_members').upsert({
      company_id: invite.company_id,
      user_id: userId,
      role: invite.role,
      status: 'ACTIVE',
    }, { onConflict: 'company_id,user_id' })

    if (memberError) {
      await admin.auth.admin.deleteUser(userId)
      throw memberError
    }

    const { error: acceptError } = await admin.from('company_invites').update({
      status: 'ACCEPTED',
      accepted_by: userId,
      accepted_at: new Date().toISOString(),
    }).eq('id', invite.id).eq('status', 'PENDING')

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
