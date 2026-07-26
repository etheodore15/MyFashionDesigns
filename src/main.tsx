import React from 'react'
import ReactDOM from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import './index.css'

// Offline after first load (§13). The service worker precaches the bundle;
// no runtime network requests are made by the app itself (Rule 4).
//
// Updates have to land without anyone knowing what a cache is: an installed
// PWA can otherwise keep serving a months-old build indefinitely, because the
// page it is showing was loaded long ago. So we (a) keep asking the service
// worker to check for a new build, and (b) reload once the new one takes
// over. The first-install takeover is skipped — only a genuine update
// reloads, so there is no reload on a visitor's very first visit.
if ('serviceWorker' in navigator) {
  const wasControlled = Boolean(navigator.serviceWorker.controller)
  let reloading = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!wasControlled || reloading) return
    reloading = true
    window.location.reload()
  })
}

const UPDATE_CHECK_MS = 60_000

registerSW({
  immediate: true,
  onRegisteredSW(_url, registration) {
    if (!registration) return
    const check = () => { void registration.update() }
    setInterval(check, UPDATE_CHECK_MS)
    // Coming back to an installed app is the moment an update matters most.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') check()
    })
  }
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
