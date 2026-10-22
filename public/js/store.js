import { reactive } from '/vendor/vue.esm-browser.prod.js'
import { stopSessionTimers } from './timer-worker-singleton.js'

export const store = reactive({
  // ── Global state ───────────────────────────────────────────
  pendingRequests: 0,
  settings:      null,       // settings object loaded from GET /settings
  screenWakeLock: { supported: false, active: false, unavailable: false },
  activeRest: null,
  activeRestExerciseId: null,
  activeSession: null,       // current session (status='in_progress')
  pendingAdjustments: [],    // engine adjustments returned by POST /sessions/:id/start
  toast:         null,       // { id, message, type:'success'|'error'|'info'|'warning' }
  _toastTimer:   null,

  // ── Actions ───────────────────────────────────────────────
  showToast(message, type = 'info', duration = 3000) {
    if (this._toastTimer) clearTimeout(this._toastTimer)
    this.toast = { id: Date.now(), message, type }
    this._toastTimer = setTimeout(() => { this.toast = null }, duration)
  },

  dismissToast() {
    if (this._toastTimer) clearTimeout(this._toastTimer)
    this.toast = null
  },

  setActiveSession(session) {
    this.activeSession = session
  },

  clearActiveSession() {
    this.activeSession = null
    this.activeRest = null
    this.activeRestExerciseId = null
    stopSessionTimers()
  },

  setPendingAdjustments(adjustments) {
    this.pendingAdjustments = adjustments || []
  },

  clearPendingAdjustments() {
    this.pendingAdjustments = []
  },

  setSettings(settings) {
    this.settings = settings == null ? null : JSON.parse(JSON.stringify(settings))
  },

  getSetting(key, defaultValue = null) {
    if (!this.settings) return defaultValue
    return this.settings[key] ?? defaultValue
  }
})
