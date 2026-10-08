import { reactive } from '/vendor/vue.esm-browser.prod.js'

export const store = reactive({
  // ── État global ───────────────────────────────────────────
  settings:      null,       // objet settings chargé depuis GET /settings
  activeSession: null,       // session en cours (status='in_progress')
  pendingAction: null,       // action IA en attente de confirmation
  pendingAdjustments: [],    // ajustements coach retournés par POST /sessions/:id/start
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
  },

  setPendingAction(action) {
    this.pendingAction = action
  },

  clearPendingAction() {
    this.pendingAction = null
  },

  setPendingAdjustments(adjustments) {
    this.pendingAdjustments = adjustments || []
  },

  clearPendingAdjustments() {
    this.pendingAdjustments = []
  },

  setSettings(settings) {
    this.settings = settings
  },

  getSetting(key, defaultValue = null) {
    if (!this.settings) return defaultValue
    return this.settings[key] ?? defaultValue
  }
})
