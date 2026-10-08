// Web Worker — pas d'accès au DOM, pas d'import ES module (syntaxe classic)
// Communique via postMessage / onmessage

let restInterval    = null
let sessionInterval = null
let restRemaining   = 0
let sessionElapsed  = 0

self.onmessage = function(e) {
  const { type, payload } = e.data

  // ── Repos ────────────────────────────────────────────────
  if (type === 'START_REST') {
    if (restInterval) clearInterval(restInterval)
    restRemaining = payload.duration_seconds
    self.postMessage({ type: 'REST_TICK', remaining: restRemaining })
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

  if (type === 'SKIP_REST') {
    if (restInterval) { clearInterval(restInterval); restInterval = null }
    restRemaining = 0
    self.postMessage({ type: 'REST_COMPLETE' })
  }

  // ── Séance ───────────────────────────────────────────────
  if (type === 'START_SESSION') {
    if (sessionInterval) clearInterval(sessionInterval)
    sessionElapsed = payload.elapsed_seconds || 0
    self.postMessage({ type: 'SESSION_TICK', elapsed: sessionElapsed })
    sessionInterval = setInterval(() => {
      sessionElapsed++
      self.postMessage({ type: 'SESSION_TICK', elapsed: sessionElapsed })
    }, 1000)
  }

  if (type === 'STOP_SESSION') {
    if (sessionInterval) { clearInterval(sessionInterval); sessionInterval = null }
  }

  if (type === 'PING') {
    // Test de connectivité
    self.postMessage({ type: 'PONG' })
  }
}
