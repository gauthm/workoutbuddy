// One lock for the whole app, retained across internal navigation.
export function createScreenWakeLock({ navigator, document, onChange = () => {} }) {
  const supported = typeof navigator?.wakeLock?.request === 'function'
  let enabled = false, disposed = false, pending = false, retry = false, lock = null, unavailable = false
  const visible = () => document.visibilityState === 'visible'
  const notify = () => onChange({ supported, active: !!lock && !lock.released, unavailable })

  async function sync() {
    if (disposed || !enabled || !visible()) {
      const previous = lock
      lock = null
      unavailable = false
      notify()
      if (previous) await previous.release().catch(() => {})
      return
    }
    if (!supported || lock) return
    if (pending) { retry = true; return }
    pending = true
    unavailable = false
    notify()
    try {
      const acquired = await navigator.wakeLock.request('screen')
      if (disposed || !enabled || !visible()) {
        await acquired.release().catch(() => {})
        return
      }
      lock = acquired
      acquired.addEventListener('release', () => {
        if (lock !== acquired) return
        lock = null
        unavailable = enabled && visible()
        notify()
      }, { once: true })
    } catch {
      unavailable = enabled && visible() && !disposed
    } finally {
      pending = false
      notify()
      if (retry) { retry = false; sync() }
    }
  }

  document.addEventListener('visibilitychange', sync)
  notify()
  return {
    setEnabled(value) { enabled = value === true; return sync() },
    dispose() {
      disposed = true
      document.removeEventListener('visibilitychange', sync)
      return sync()
    },
  }
}
