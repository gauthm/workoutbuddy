// Web Worker — pas d'accès au DOM, pas d'import ES module (syntaxe classic)
// Communique via postMessage / onmessage

let restInterval    = null
let sessionInterval = null
let restRemaining   = 0
let sessionElapsed  = 0
let restDeadline = 0
let sessionStart = 0

self.onmessage = function(e) {
  const { type, payload } = e.data

  // ── Repos ────────────────────────────────────────────────
  if (type === 'START_REST') {
    if (restInterval) clearInterval(restInterval)
    restRemaining = payload.duration_seconds
    restDeadline = Date.now() + restRemaining * 1000
    self.postMessage({ type: 'REST_TICK', remaining: restRemaining })
    restInterval = setInterval(() => {
      restRemaining = Math.max(0, Math.ceil((restDeadline - Date.now()) / 1000))
      self.postMessage({ type: 'REST_TICK', remaining: restRemaining })
      if (restRemaining <= 0) {
        clearInterval(restInterval)
        restInterval = null
        self.postMessage({ type: 'REST_COMPLETE' })
      }
    }, 1000)
  }

  if (type === 'ADJUST_REST' && restInterval && Number.isFinite(payload?.seconds)) {
    restDeadline = Math.max(Date.now(),restDeadline+payload.seconds*1000)
    restRemaining = Math.max(0,Math.ceil((restDeadline-Date.now())/1000))
    self.postMessage({type:'REST_TICK',remaining:restRemaining})
    if (restRemaining === 0) {
      clearInterval(restInterval); restInterval = null
      self.postMessage({type:'REST_COMPLETE'})
    }
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
    sessionStart = Date.now() - sessionElapsed * 1000
    self.postMessage({ type: 'SESSION_TICK', elapsed: sessionElapsed })
    sessionInterval = setInterval(() => {
      sessionElapsed = Math.max(0, Math.floor((Date.now() - sessionStart) / 1000))
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
