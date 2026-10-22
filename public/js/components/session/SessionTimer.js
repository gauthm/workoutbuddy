import { parseUtcTimestamp } from '../../utils/date.js'
import { ref, onMounted, onUnmounted } from '/vendor/vue.esm-browser.prod.js'
import { getTimerWorker } from '../../timer-worker-singleton.js'

export default {
  name: 'SessionTimer',
  props: {
    startedAt: { type: String, required: true }
    // Format: "2025-07-10T14:30:00" (without Z: SQLite UTC)
  },

  setup(props) {
    const elapsed = ref(0)
    const worker = getTimerWorker()

    function onMessage(e) {
      if (e.data.type === 'SESSION_TICK') {
        elapsed.value = e.data.elapsed
      }
    }

    function format(sec) {
      const h = Math.floor(sec / 3600)
      const m = Math.floor((sec % 3600) / 60)
      const s = sec % 60
      if (h > 0) {
        return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
      }
      return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
    }

    onMounted(() => {
      worker.addEventListener('message', onMessage)
      // Calculate seconds elapsed since the start
      const elapsedSec = Math.max(
        0,
        Math.floor((Date.now() - parseUtcTimestamp(props.startedAt)) / 1000)
      )
      worker.postMessage({ type: 'START_SESSION', payload: { elapsed_seconds: Number.isFinite(elapsedSec) ? elapsedSec : 0 } })
    })

    onUnmounted(() => {
      worker.removeEventListener('message', onMessage)
      // Do not stop the worker here: it continues in the background
      // RestTimer or the end of the session will stop it
    })

    return { elapsed, format }
  },

  template: `
    <span class="session-timer">{{ format(elapsed) }}</span>
  `
}
