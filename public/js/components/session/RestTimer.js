import { ref, onMounted, onUnmounted, watch } from '/vendor/vue.esm-browser.prod.js'
import { getTimerWorker } from '../../timer-worker-singleton.js'
import { t } from '../../i18n.js'

// Son de fin de repos — initialisé une seule fois
let audioCtx = null
function playBeep() {
  try {
    // Essayer d'abord le fichier MP3
    const audio = new Audio('/sounds/timer-end.mp3')
    audio.play().catch(() => {
      // Fallback : bip synthétique via Web Audio API
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)()
      const osc = audioCtx.createOscillator()
      const gain = audioCtx.createGain()
      osc.connect(gain)
      gain.connect(audioCtx.destination)
      osc.frequency.value = 880
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5)
      osc.start(audioCtx.currentTime)
      osc.stop(audioCtx.currentTime + 0.5)
    })
  } catch (_) { /* silencieux si tout échoue */ }
}

function vibrate() {
  try {
    if ('vibrate' in navigator) {
      navigator.vibrate([200, 100, 200, 100, 200])
    }
  } catch (_) { /* silencieux */ }
}

export default {
  name: 'RestTimer',
  props: {
    duration:      { type: Number, required: true },  // secondes
    active:        { type: Boolean, default: false },
    soundEnabled:  { type: Boolean, default: true },
    vibrEnabled:   { type: Boolean, default: true },
  },
  emits: ['complete', 'skip'],

  setup(props, { emit }) {
    const remaining   = ref(props.duration)
    const worker = getTimerWorker()
    let wakeLock = null

    async function acquireWakeLock() {
      try {
        if ('wakeLock' in navigator) {
          wakeLock = await navigator.wakeLock.request('screen')
        }
      } catch (_) { /* Wake Lock non supporté, silencieux */ }
    }

    function releaseWakeLock() {
      if (wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null }
    }

    function onMessage(e) {
      if (e.data.type === 'REST_TICK') {
        remaining.value = e.data.remaining
      }
      if (e.data.type === 'REST_COMPLETE') {
        remaining.value = 0
        releaseWakeLock()
        if (props.soundEnabled) playBeep()
        if (props.vibrEnabled) vibrate()
        emit('complete')
      }
      if (e.data.type === 'REST_STOPPED') {
        releaseWakeLock()
      }
    }

    function onVisibilityChange() {
      if (document.visibilityState === 'visible' && props.active) {
        acquireWakeLock()
      }
    }

    watch(() => props.active, async (val) => {
      if (val) {
        remaining.value = props.duration
        worker.postMessage({ type: 'START_REST', payload: { duration_seconds: props.duration } })
        await acquireWakeLock()
      } else {
        worker.postMessage({ type: 'STOP_REST' })
        releaseWakeLock()
      }
    }, { immediate: false })

    onMounted(() => {
      worker.addEventListener('message', onMessage)
      document.addEventListener('visibilitychange', onVisibilityChange)
    })

    onUnmounted(() => {
      worker.removeEventListener('message', onMessage)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      releaseWakeLock()
    })

    function skip() {
      worker.postMessage({ type: 'SKIP_REST' })
      emit('skip')
    }

    // Cercle SVG
    const RADIUS = 28
    const circumference = 2 * Math.PI * RADIUS
    const dashOffset = () => {
      const pct = Math.max(0, remaining.value / props.duration)
      return circumference * (1 - pct)
    }
    const strokeColor = () => {
      const pct = remaining.value / props.duration
      if (pct > 0.5) return 'var(--color-success)'
      if (pct > 0.2) return 'var(--color-warning)'
      return 'var(--color-danger)'
    }

    return { remaining, skip, circumference, RADIUS, dashOffset, strokeColor, t }
  },

  template: `
    <div v-if="active" class="rest-timer">
      <svg width="80" height="80" viewBox="0 0 80 80">
        <!-- Fond -->
        <circle cx="40" cy="40" :r="RADIUS"
          fill="none" stroke="var(--color-border)" stroke-width="5"/>
        <!-- Progression -->
        <circle cx="40" cy="40" :r="RADIUS"
          fill="none"
          :stroke="strokeColor()"
          stroke-width="5"
          :stroke-dasharray="circumference"
          :stroke-dashoffset="dashOffset()"
          stroke-linecap="round"
          transform="rotate(-90 40 40)"
          style="transition: stroke-dashoffset 0.9s linear, stroke 0.3s"
        />
        <!-- Texte -->
        <text x="40" y="45" text-anchor="middle"
          fill="var(--color-text)" font-size="16" font-weight="700">
          {{ remaining }}s
        </text>
      </svg>
      <button class="btn btn--secondary"
        style="padding:0.3rem 0.9rem;font-size:0.8rem;margin-top:0.3rem"
        @click="skip()">
        {{ t('session.rest_skip') }}
      </button>
    </div>
  `
}
