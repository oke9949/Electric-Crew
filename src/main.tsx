import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import AppUpdateManager from './AppUpdateManager'
import EmployeeInviteActivation from './EmployeeInviteActivation'
import DemoAccessGate from './DemoAccessGate'
import './styles.css'
import './sidebar-fix.css'

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => undefined))
}

const activationMode = new URLSearchParams(window.location.search).get('activate') === 'employee'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {activationMode ? <EmployeeInviteActivation/> : <DemoAccessGate><AppUpdateManager/><App /></DemoAccessGate>}
  </React.StrictMode>
)
