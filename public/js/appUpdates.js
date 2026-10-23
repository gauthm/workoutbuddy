import { reactive, watch, shallowRef, onBeforeUnmount } from '/vendor/vue.esm-browser.prod.js'
import { router } from './router.js'
import { store } from './store.js'
import { onRequestActivity, settings as settingsApi } from './api.js'

export const appUpdates = reactive({ ready: false, edited: false, saving: false, error: false })
export const updateSaver = shallowRef(null)
let started = false, reloading = false, idleTimer

// Screens own validation and persistence; a failed save must never reload the page.
export function useUpdateSaver(saver) {
  updateSaver.value = saver
  onBeforeUnmount(() => { if (updateSaver.value === saver) updateSaver.value = null })
}

export async function saveAndApplyUpdate() {
  if (reloading || appUpdates.saving || !appUpdates.ready || store.pendingRequests > 0 ||
      store.activeSession || document.querySelector('.modal-overlay')) return
  const saver = updateSaver.value
  if (!saver && !canApplyUpdate()) return
  const route = JSON.stringify(router.currentRoute)
  appUpdates.saving = true
  appUpdates.error = false
  clearTimeout(idleTimer)
  try {
    if (saver && (saver.busy() || await saver.save() !== true || saver.dirty())) {
      appUpdates.error = true
      return
    }
    if (route !== JSON.stringify(router.currentRoute) || saver !== updateSaver.value) return
    applyAppUpdate()
  } catch { appUpdates.error = true }
  finally { appUpdates.saving = false }
}
const readOnlyViews = new Set(['DashboardView', 'StatsDashboardView', 'ExerciseProgressView', 'SessionHistoryView', 'CalendarView'])

export function canApplyUpdate() {
  const route = router.currentRoute
  const reading = readOnlyViews.has(route.name) ||
    (route.name === 'ExerciseListView' && !['material', 'pain'].includes(route.params.tab))
  return reading && !appUpdates.edited && !appUpdates.saving && !store.activeSession && store.pendingRequests === 0 &&
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
  document.addEventListener('input', () => { appUpdates.edited = true; clearTimeout(idleTimer) }, true)
  document.addEventListener('change', () => { appUpdates.edited = true; clearTimeout(idleTimer) }, true)
  watch(() => JSON.stringify(router.currentRoute), () => { appUpdates.edited = false; appUpdates.error = false; scheduleUpdate() }, { flush: 'post' })
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
