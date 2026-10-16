import { reactive, watch } from '/vendor/vue.esm-browser.prod.js'
import { router } from './router.js'
import { store } from './store.js'
import { onRequestActivity, settings as settingsApi } from './api.js'

export const appUpdates = reactive({ ready: false })
let started = false, edited = false, reloading = false, idleTimer
const readOnlyViews = new Set(['DashboardView', 'StatsDashboardView', 'ExerciseProgressView', 'SessionHistoryView', 'CalendarView'])

export function canApplyUpdate() {
  const route = router.currentRoute
  const reading = readOnlyViews.has(route.name) ||
    (route.name === 'ExerciseListView' && !['material', 'pain'].includes(route.params.tab))
  return reading && !edited && !store.activeSession && store.pendingRequests === 0 &&
    !document.querySelector('.modal-overlay, .settings-save-dock') &&
    !document.activeElement?.matches('input, textarea, select, [contenteditable="true"]')
}

export function applyAppUpdate() {
  if (reloading || !appUpdates.ready || store.pendingRequests > 0) return
  reloading = true
  window.location.reload()
}

function scheduleUpdate() {
  clearTimeout(idleTimer)
  if (appUpdates.ready && document.visibilityState === 'visible' && canApplyUpdate()) {
    idleTimer = setTimeout(() => {
      if (document.visibilityState === 'visible' && canApplyUpdate()) applyAppUpdate()
    }, 750)
  }
}

export function startAppUpdates() {
  if (started || !('serviceWorker' in navigator)) return
  started = true
  onRequestActivity(pending => { store.pendingRequests = pending })
  let controlled = !!navigator.serviceWorker.controller
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // First installation takes control without interrupting the initial page load.
    if (controlled) { appUpdates.ready = true; scheduleUpdate() }
    controlled = true
  })
  document.addEventListener('input', () => { edited = true; clearTimeout(idleTimer) }, true)
  document.addEventListener('change', () => { edited = true; clearTimeout(idleTimer) }, true)
  watch(() => JSON.stringify(router.currentRoute), () => { edited = false; scheduleUpdate() }, { flush: 'post' })
  watch(() => [store.pendingRequests, store.activeSession], scheduleUpdate, { flush: 'post' })

  navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).then(reg => {
    const check = () => {
      if (navigator.onLine && document.visibilityState === 'visible') reg.update().catch(() => {})
      scheduleUpdate()
    }
    const resume = () => {
      check()
      if (navigator.onLine && document.visibilityState === 'visible') settingsApi.get().catch(() => {})
    }
    document.addEventListener('visibilitychange', resume)
    window.addEventListener('online', resume)
    window.addEventListener('pageshow', resume)
    setInterval(check, 5 * 60_000)
    check()
  }).catch(err => console.warn('[SW] Échec enregistrement :', err.message))
}
