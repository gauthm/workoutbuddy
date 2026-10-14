// Singleton : un seul Worker pour toute l'application
let _worker = null

export function getTimerWorker() {
  if (!_worker) {
    _worker = new Worker('/js/timer-worker.js')
    _worker.onerror = (err) => {
      console.error('[TimerWorker] Erreur :', err.message)
    }
  }
  return _worker
}

export function stopSessionTimers() {
  _worker?.postMessage({ type: 'STOP_REST' })
  _worker?.postMessage({ type: 'STOP_SESSION' })
}
