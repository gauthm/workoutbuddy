import { ref, onMounted, onUnmounted } from '/vendor/vue.esm-browser.prod.js'
import { getTimerWorker } from '../../timer-worker-singleton.js'

export default {
  name: 'SessionTimer',
  props: {
    startedAt: { type: String, required: true }
    // Format : "2025-07-10T14:30:00" (sans Z — UTC de SQLite)
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
      // Calculer le nombre de secondes écoulées depuis le démarrage
      const elapsedSec = Math.max(
        0,
        Math.floor((Date.now() - new Date(props.startedAt + 'Z').getTime()) / 1000)
      )
      worker.postMessage({ type: 'START_SESSION', payload: { elapsed_seconds: elapsedSec } })
    })

    onUnmounted(() => {
      worker.removeEventListener('message', onMessage)
      // NE PAS stopper le worker ici — il continue en arrière-plan
      // Il sera stoppé par RestTimer ou à la fin de la séance
    })

    return { elapsed, format }
  },

  template: `
    <span class="session-timer">{{ format(elapsed) }}</span>
  `
}
