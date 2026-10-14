import { reactive } from '/vendor/vue.esm-browser.prod.js'
import { stopSessionTimers } from './timer-worker-singleton.js'

export const store = reactive({
  // ── État global ───────────────────────────────────────────
  settings:      null,       // objet settings chargé depuis GET /settings
  activeRest: null,
  activeRestExerciseId: null,
  activeSession: null,       // session en cours (status='in_progress')
  pendingAdjustments: [],    // ajustements du moteur retournés par POST /sessions/:id/start
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
