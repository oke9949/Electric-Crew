import { useCallback, useEffect, useRef, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { Download, RefreshCw, X } from 'lucide-react'
import { APP_VERSION } from './version'
import './app-update.css'

type GithubRelease = {
  tag_name?: string
  html_url?: string
  name?: string
  assets?: Array<{ name?: string; browser_download_url?: string }>
}

type UpdateInfo = {
  version: string
  downloadUrl: string
}

const RELEASE_API = 'https://api.github.com/repos/oke9949/Electric-Crew/releases/latest'
const CHECK_INTERVAL_MS = 15 * 60 * 1000
const BACKGROUND_CHECK_MS = 6 * 60 * 60 * 1000

function normalizeVersion(value: string) {
  const match = value.match(/(\d+)\.(\d+)\.(\d+)/)
  return match ? `${match[1]}.${match[2]}.${match[3]}` : ''
}

function isNewerVersion(candidate: string, current: string) {
  const a = normalizeVersion(candidate).split('.').map(Number)
  const b = normalizeVersion(current).split('.').map(Number)
  if (a.length !== 3 || b.length !== 3 || a.some(Number.isNaN) || b.some(Number.isNaN)) return false

  for (let i = 0; i < 3; i += 1) {
    if (a[i] > b[i]) return true
    if (a[i] < b[i]) return false
  }
  return false
}

async function fetchAvailableUpdate(): Promise<UpdateInfo | null> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 8000)

  try {
    const response = await fetch(RELEASE_API, {
      headers: { Accept: 'application/vnd.github+json' },
      cache: 'no-store',
      signal: controller.signal,
    })
    if (!response.ok) throw new Error(`GitHub release check failed: ${response.status}`)

    const release = (await response.json()) as GithubRelease
    const version = normalizeVersion(release.tag_name || release.name || '')
    if (!version || !isNewerVersion(version, APP_VERSION)) return null

    const apk = (release.assets || []).find(asset =>
      String(asset.name || '').toLowerCase().endsWith('.apk') && String(asset.name || '').includes(version),
    )
    const releaseUrl = release.html_url || `https://github.com/oke9949/Electric-Crew/releases/tag/android-v${version}`

    return {
      version,
      downloadUrl: apk?.browser_download_url || releaseUrl,
    }
  } finally {
    window.clearTimeout(timeout)
  }
}

export default function AppUpdateManager() {
  const nativeAndroid = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android'
  const [update, setUpdate] = useState<UpdateInfo | null>(null)
  const [checking, setChecking] = useState(false)
  const [dismissedVersion, setDismissedVersion] = useState('')
  const lastCheck = useRef(0)
  const checkingRef = useRef(false)

  const check = useCallback(async (force = false) => {
    if (!nativeAndroid || checkingRef.current) return

    const now = Date.now()
    if (!force && now - lastCheck.current < CHECK_INTERVAL_MS) return

    checkingRef.current = true
    setChecking(true)
    try {
      const available = await fetchAvailableUpdate()
      lastCheck.current = Date.now()
      setUpdate(available)
    } catch (error) {
      console.warn('Electric Crew update check failed', error)
    } finally {
      checkingRef.current = false
      setChecking(false)
    }
  }, [nativeAndroid])

  useEffect(() => {
    if (!nativeAndroid) return

    void check(true)
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void check()
    }
    document.addEventListener('visibilitychange', onVisibility)
    const interval = window.setInterval(() => void check(), BACKGROUND_CHECK_MS)

    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.clearInterval(interval)
    }
  }, [check, nativeAndroid])

  if (!nativeAndroid || !update || dismissedVersion === update.version) return null

  return (
    <aside className="app-update-banner" role="status" aria-live="polite">
      <div className="app-update-copy">
        <span className="app-update-eyebrow">FRISSÍTÉS ELÉRHETŐ</span>
        <strong>Electric Crew v{update.version}</strong>
        <small>Telepítve: v{APP_VERSION}. Töltsd le az új APK-t, majd erősítsd meg az Android telepítést.</small>
      </div>
      <div className="app-update-actions">
        <a className="btn primary" href={update.downloadUrl} target="_blank" rel="noreferrer">
          <Download size={17}/> APK letöltése
        </a>
        <button className="icon-btn" type="button" title="Újraellenőrzés" onClick={() => void check(true)} disabled={checking}>
          <RefreshCw size={17} className={checking ? 'spin' : ''}/>
        </button>
        <button className="icon-btn" type="button" title="Később" onClick={() => setDismissedVersion(update.version)}>
          <X size={17}/>
        </button>
      </div>
    </aside>
  )
}
