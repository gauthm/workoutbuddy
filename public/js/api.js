// Wrappers fetch vers /api/v1/
// Toutes les fonctions retournent la donnée directement ou lèvent une Error.
// L'appelant (composant ou store) gère les erreurs.

const BASE = '/api/v1'

async function request(method, path, body = undefined) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' }
  }
  if (body !== undefined) opts.body = JSON.stringify(body)
  const res = await fetch(`${BASE}${path}`, opts)
  if (res.status === 204) return null
  const data = await res.json()
  if (!res.ok) {
    const err = new Error(data.error || `HTTP ${res.status}`)
    err.status = res.status
    err.detail = data.detail
    throw err
  }
  return data
}

// ── Exercices ────────────────────────────────────────────────
export const exercises = {
  list:      (params = {}) => request('GET', '/exercises?' + new URLSearchParams(params)),
  get:       (id)          => request('GET', `/exercises/${id}`),
  create:    (body)        => request('POST', '/exercises', body),
  update:    (id, body)    => request('PUT', `/exercises/${id}`, body),
  delete:    (id)          => request('DELETE', `/exercises/${id}`),
  history:   (id, params)  => request('GET', `/exercises/${id}/history?` + new URLSearchParams(params)),
  rmHistory: (id, params)  => request('GET', `/exercises/${id}/rm-history?` + new URLSearchParams(params)),
}

// ── Équipement ────────────────────────────────────────────────
export const equipment = {
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
  testAI:      ()     => request('POST', '/settings/test-ai'),
  listModels:  ()     => request('GET', '/settings/ai-models'),
}

// ── Programmes (stubs pour tâches futures) ───────────────────
export const programs = {
  list:       (params = {}) => request('GET', '/programs?' + new URLSearchParams(params)),
  get:        (id)          => request('GET', `/programs/${id}`),
  create:     (body)        => request('POST', '/programs', body),
  update:     (id, body)    => request('PUT', `/programs/${id}`, body),
  delete:     (id)          => request('DELETE', `/programs/${id}`),
  activate:   (id)          => request('POST', `/programs/${id}/activate`),
  generate:   (body)        => request('POST', '/programs/generate', body),
  nextSession:(id)          => request('GET', `/programs/${id}/next-session`),
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

// ── Coach IA ──────────────────────────────────────────────────
export const coach = {
  advice:              ()        => request('GET', '/ai/advice'),
  dismissAdvice:       (id)      => request('POST', `/ai/advice/${id}/dismiss`),
  purchasedAdvice:     (id)      => request('POST', `/ai/advice/${id}/purchased`),
  applyAction:         (body)    => request('POST', '/ai/apply-action', body),
  generateAdvice:      ()        => request('POST', '/ai/generate-equipment-advice'),
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

  // Backup manuel
  backup: () => request('POST', '/backup'),
}
