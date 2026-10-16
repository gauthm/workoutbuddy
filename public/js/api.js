// Wrappers fetch vers /api/v1/
// Toutes les fonctions retournent la donnée directement ou lèvent une Error.
// L'appelant (composant ou store) gère les erreurs.

const BASE = '/api/v1'
const securityErrors = {RATE_LIMITED: 'errors.rate_limited', AI_BUSY: 'errors.ai_busy', IMPORT_BUSY: 'errors.import_busy'}
let pendingRequests = 0
const activityListeners = new Set()
export function onRequestActivity(listener) {
  activityListeners.add(listener)
  listener(pendingRequests)
  return () => activityListeners.delete(listener)
}
function requestActivity(change) {
  pendingRequests += change
  for (const listener of activityListeners) listener(pendingRequests)
}

async function request(method, path, body = undefined) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' }
  }
  if (body !== undefined) opts.body = JSON.stringify(body)
  requestActivity(1)
  try {
    const res = await fetch(`${BASE}${path}`, opts)
    if (res.status === 204) return null
    const data = await res.json()
    if (!res.ok) {
      const message = securityErrors[data.error]
        ? (await import('./i18n.js')).t(securityErrors[data.error]) : data.error || `HTTP ${res.status}`
      const err = new Error(message)
      err.status = res.status
      err.detail = data.detail
      err.details = data.details
      throw err
    }
    return data
  } finally { requestActivity(-1) }
}

// ── Exercices ────────────────────────────────────────────────
export const exercises = {
  list:      (params = {}) => request('GET', '/exercises?' + new URLSearchParams(params)),
  get:       (id)          => request('GET', `/exercises/${id}`),
  history:   (id, params)  => request('GET', `/exercises/${id}/history?` + new URLSearchParams(params)),
  rmHistory: (id, params)  => request('GET', `/exercises/${id}/rm-history?` + new URLSearchParams(params)),
  toggleExclusion: (id, body) => request('PUT', `/exercises/${id}/toggle-exclusion`, body),
}

// ── Équipement ────────────────────────────────────────────────
export const equipment = {
  saveInventory: body => request('PUT', '/equipment/inventory', body),
  list:            ()          => request('GET', '/equipment'),
  create:          (body)      => request('POST', '/equipment', body),
  update:          (id, body)  => request('PUT', `/equipment/${id}`, body),
  delete:          (id)        => request('DELETE', `/equipment/${id}`),
  achievableLoads: (exerciseId) =>
    request('GET', `/equipment/achievable-loads?exercise_id=${encodeURIComponent(exerciseId)}`),
}

// ── Paramètres ────────────────────────────────────────────────
export const settings = {
  get:         ()     => request('GET', '/settings'),
  update:      (body) => request('PUT', '/settings', body),
  save:        (body) => request('POST', '/settings/save', body),
  testAI:      (body) => request('POST', '/settings/test-ai', body),
  listModels:  (body) => body ? request('POST', '/settings/ai-models', body) : request('GET', '/settings/ai-models'),
}

// ── Programmes (stubs pour tâches futures) ───────────────────
export const programs = {
  preview:    (body) => request('POST', '/programs/preview', body),
  generate:   (body) => request('POST', '/programs/generate', body),
  list:       (params = {}) => request('GET', '/programs?' + new URLSearchParams(params)),
  get:        (id)          => request('GET', `/programs/${id}`),
  update:     (id, body)    => request('PUT', `/programs/${id}`, body),
  delete:     (id)          => request('DELETE', `/programs/${id}`),
  activate:   (id)          => request('POST', `/programs/${id}/activate`),
  nextSession:(id)          => request('GET', `/programs/${id}/next-session`),
}

export const programExercises = {
  alternatives: id => request('GET', `/template-exercises/${id}/alternatives`),
  replace: (id,body) => request('POST', `/template-exercises/${id}/replace`,body),
}

// ── Sessions ─────────────────────────────────────────────────
export const sessions = {
  list:         (params = {}) => request('GET', '/sessions?' + new URLSearchParams(params)),
  get:          (id)          => request('GET', `/sessions/${id}`),
  create:       (body)        => request('POST', '/sessions', body),
  fromTemplate: (tplId, body) => request('POST', `/sessions/from-template/${tplId}`, body),
  start:        (id)          => request('POST', `/sessions/${id}/start`),
  complete:     (id)          => request('POST', `/sessions/${id}/complete`),
  skip:         (id)          => request('POST', `/sessions/${id}/skip`),
  reset:        (id, expectedStatus) => request('POST', `/sessions/${id}/reset`, {expected_status:expectedStatus}),
  unskip:       (id)          => request('POST', `/sessions/${id}/unskip`),
  update:       (id, body)    => request('PUT', `/sessions/${id}`, body),
  delete:       (id)          => request('DELETE', `/sessions/${id}`),
  target:       (id, teId)    => request('GET', `/sessions/${id}/target/${teId}`),
}

// ── Sets ─────────────────────────────────────────────────────
export const sets = {
  list:   (seId)       => request('GET', `/session-exercises/${seId}/sets`),
  create: (seId, body) => request('POST', `/session-exercises/${seId}/sets`, body),
  update: (id, body)   => request('PUT', `/sets/${id}`, body),
  delete: (id)         => request('DELETE', `/sets/${id}`),
}

// ── Stats ─────────────────────────────────────────────────────
export const stats = {
  overview:   ()          => request('GET', '/stats/overview'),
  streaks:    ()          => request('GET', '/stats/streaks'),
  volume:     (params={}) => request('GET', '/stats/volume?' + new URLSearchParams(params)),
  exercise:   (id, p={})  => request('GET', `/stats/exercises/${id}/progress?` + new URLSearchParams(p)),
  records:    (params={}) => request('GET', '/stats/personal-records?' + new URLSearchParams(params)),
}

// ── Poids de corps ────────────────────────────────────────────
export const bodyweight = {
  list:   (params={}) => request('GET', '/bodyweight?' + new URLSearchParams(params)),
  create: (body)      => request('POST', '/bodyweight', body),
  update: (id, body)  => request('PUT', `/bodyweight/${id}`, body),
  delete: (id)        => request('DELETE', `/bodyweight/${id}`),
}

// ── Profil utilisateur ────────────────────────────────────────
export const userProfile = {
  get:    ()       => request('GET', '/user-profile'),
  save:   (fields) => request('PUT', '/user-profile', fields),
  reset:  ()       => request('DELETE', '/user-profile'),
}

// ── Coach IA ──────────────────────────────────────────────────
export const coach = {
  chat: (body, { signal } = {}) => fetch(`${BASE}/ai/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal }),
  advice:              ()        => request('GET', '/ai/advice'),
  dismissAdvice:       (id)      => request('POST', `/ai/advice/${id}/dismiss`),
  purchasedAdvice:     (id)      => request('POST', `/ai/advice/${id}/purchased`),
  generateAdvice:      ()        => request('POST', '/ai/generate-equipment-advice'),
  conversations:        ()          => request('GET', '/ai/conversations'),
  messages:             (id)        => request('GET', `/ai/conversations/${id}/messages`),
  createConversation:   (title)     => request('POST', '/ai/conversations', title ? { title } : {}),
  activateConversation: (id)        => request('PATCH', `/ai/conversations/${id}`, { is_active: true }),
  renameConversation:   (id, title) => request('PATCH', `/ai/conversations/${id}`, { title }),
  deleteConversation:   (id)        => request('DELETE', `/ai/conversations/${id}`),
  // Note : /ai/chat utilise SSE — voir CoachView pour l'implémentation streaming
}

// ── Export/Import ─────────────────────────────────────────────
export const exportImport = {
  // Export JSON complet
  exportJson: () =>
    fetch(`${BASE}/export`).then(async res => {
      if (!res.ok) throw new Error('Erreur export')
      return res.blob()
    }),

  // Export CSV d'une table
  exportCsv: (table) =>
    fetch(`${BASE}/export/csv/${table}`).then(async res => {
      if (!res.ok) throw new Error('Erreur export CSV')
      return res.blob()
    }),

  // Import JSON
  importJson: (body) => request('POST', '/import', body),

  // Reset partiel : stats et historique uniquement
  resetStats: () => request('POST', '/reset-stats'),
  resetAll: () => request('POST', '/reset-all'),

  // Backup manuel
  backup: () => request('POST', '/backup'),
}
