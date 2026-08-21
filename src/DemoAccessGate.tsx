import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { supabase } from './supabase'

type GateState = 'loading' | 'ready' | 'error'

export default function DemoAccessGate({ children }: { children: ReactNode }) {
  const demoToken = useMemo(() => new URLSearchParams(window.location.search).get('demo'), [])
  const [state, setState] = useState<GateState>(demoToken ? 'loading' : 'ready')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!demoToken) return

    let active = true

    async function openTesterSession() {
      try {
        const { data: current } = await supabase.auth.getSession()
        if (current.session?.user?.user_metadata?.tester_account === true) {
          if (active) setState('ready')
          return
        }

        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
        if (!supabaseUrl) throw new Error('Hiányzó Supabase URL.')

        const response = await fetch(`${supabaseUrl}/functions/v1/demo-session`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: demoToken }),
        })

        const payload = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(payload?.error || 'A tesztelő munkamenet nem indítható.')
        if (!payload?.access_token || !payload?.refresh_token) throw new Error('Hiányos tesztelő munkamenet.')

        const { error: sessionError } = await supabase.auth.setSession({
          access_token: payload.access_token,
          refresh_token: payload.refresh_token,
        })
        if (sessionError) throw sessionError

        if (active) setState('ready')
      } catch (e: any) {
        if (!active) return
        setError(e?.message || 'A tesztelő link nem nyitható meg.')
        setState('error')
      }
    }

    openTesterSession()
    return () => { active = false }
  }, [demoToken])

  if (state === 'loading') {
    return <div className="splash"><img className="splash-wordmark" src="/ec-wordmark.svg" alt="Electric Crew"/><span>Tesztelői hozzáférés megnyitása…</span></div>
  }

  if (state === 'error') {
    return <div className="auth-wrap"><div className="auth-card"><h1>A tesztelő link nem érhető el</h1><p className="muted">{error}</p><button className="btn primary wide" onClick={() => window.location.assign('/')}>Vissza a belépéshez</button></div></div>
  }

  return <>{children}</>
}
