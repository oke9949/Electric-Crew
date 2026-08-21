import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import AppUpdateManager from './AppUpdateManager'
import EmployeeInviteActivation from './EmployeeInviteActivation'
import IosInstallGuide from './IosInstallGuide'
import './styles.css'
import './sidebar-fix.css'
import './ios-pwa.css'

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => undefined))
}

const activationMode = new URLSearchParams(window.location.search).get('activate') === 'employee'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {activationMode ? <EmployeeInviteActivation /> : <><AppUpdateManager /><IosInstallGuide /><App /></>}
  </React.StrictMode>
)
