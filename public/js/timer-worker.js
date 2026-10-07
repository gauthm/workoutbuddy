// Web Worker — tourne en arrière-plan même si l'onglet est en arrière-plan
// Implémentation complète en T2.5 — ce fichier est un stub fonctionnel minimal

let restInterval = null
let sessionInterval = null
let restRemaining = 0
let sessionElapsed = 0

self.onmessage = function(e) {
  const { type, payload } = e.data

  if (type === 'START_REST') {
    if (restInterval) clearInterval(restInterval)
    restRemaining = payload.duration_seconds
    restInterval = setInterval(() => {
      restRemaining--
      self.postMessage({ type: 'REST_TICK', remaining: restRemaining })
      if (restRemaining <= 0) {
        clearInterval(restInterval)
        restInterval = null
        self.postMessage({ type: 'REST_COMPLETE' })
      }
    }, 1000)
  }

  if (type === 'STOP_REST') {
    if (restInterval) { clearInterval(restInterval); restInterval = null }
    self.postMessage({ type: 'REST_STOPPED' })
  }

  if (type === 'START_SESSION') {
    if (sessionInterval) clearInterval(sessionInterval)
    sessionElapsed = payload.elapsed_seconds || 0
    sessionInterval = setInterval(() => {
      sessionElapsed++
      self.postMessage({ type: 'SESSION_TICK', elapsed: sessionElapsed })
    }, 1000)
  }

  if (type === 'STOP_SESSION') {
    if (sessionInterval) { clearInterval(sessionInterval); sessionInterval = null }
  }
}
