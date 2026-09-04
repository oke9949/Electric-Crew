import { useEffect, useState } from 'react'
import { PlusSquare, Share, X } from 'lucide-react'
import { shouldShowIosInstallGuide } from './ios-install'

const DISMISSED_KEY = 'electric-crew-ios-install-v1'

function isStandalone() {
  const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean }
  return Boolean(navigatorWithStandalone.standalone) || window.matchMedia('(display-mode: standalone)').matches
}

export default function IosInstallGuide() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    let dismissed = false
    try { dismissed = window.localStorage.getItem(DISMISSED_KEY) === 'dismissed' } catch { /* Safari may block storage. */ }
    setVisible(!dismissed && shouldShowIosInstallGuide({
      userAgent: navigator.userAgent,
      maxTouchPoints: navigator.maxTouchPoints,
      standalone: isStandalone(),
    }))
  }, [])

  function dismiss() {
    try { window.localStorage.setItem(DISMISSED_KEY, 'dismissed') } catch { /* Keep dismissal for this render. */ }
    setVisible(false)
  }

  if (!visible) return null

  return (
    <aside className="ios-install-guide" role="status" aria-live="polite" aria-labelledby="ios-install-title" aria-describedby="ios-install-help">
      <button className="ios-install-close" type="button" onClick={dismiss} aria-label="Telepítési útmutató bezárása"><X size={18}/></button>
      <span className="ios-install-eyebrow">IPHONE / IPAD</span>
      <strong id="ios-install-title">Tedd ki az Electric Crew-t a Főképernyőre</strong>
      <ol id="ios-install-help">
        <li><Share size={17}/><span>Koppints a Safari <b>Megosztás</b> gombjára.</span></li>
        <li><PlusSquare size={17}/><span>Válaszd a <b>Hozzáadás a Főképernyőhöz</b> lehetőséget.</span></li>
      </ol>
      <button className="btn primary" type="button" onClick={dismiss}>Értem</button>
    </aside>
  )
}
