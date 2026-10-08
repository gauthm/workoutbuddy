import { reactive, inject, computed } from '/vendor/vue.esm-browser.prod.js'
import { sets as api }  from '../../api.js'
import { estimate1RM }  from '../../utils/rm.js'
import { t }            from '../../i18n.js'
import AITooltip        from './AITooltip.js'

export default {
  name: 'SetRow',
  components: { AITooltip },
  props: {
    set:               { type: Object,  required: true },
    sessionExerciseId: { type: Number,  required: true },
    targetWeight:      { type: Number,  default: 0 },
    targetReps:        { type: Number,  default: 8 },
    setNumber:         { type: Number,  required: true },
    isNew:             { type: Boolean, default: false },
    restSeconds:       { type: Number,  default: 90 },
    // Champs bulle / suggestion
    isFirstTime:       { type: Boolean, default: false },
    tooltipText:       { type: String,  default: '' },  // texte pour la bulle ℹ️
  },
  emits: ['validated', 'rest-start'],

  setup(props, { emit }) {
    const store = inject('store')

    const local = reactive({
      weight_kg: props.isNew ? props.targetWeight : (props.set.weight_kg ?? props.targetWeight),
      reps:      props.isNew ? props.targetReps   : (props.set.reps      ?? props.targetReps),
      rpe:       props.set.rpe  || '',
      saving:    false,
    })

    const showRpe = () => store.getSetting('show_rpe_field', false)

    // ── Calcul du 10RM en temps réel ─────────────────────────
    const formula = () => store.getSetting('rm_formula', 'epley')

    const live10rm = computed(() => {
      const w = parseFloat(local.weight_kg) || 0
      const r = parseInt(local.reps)        || 0
      if (w <= 0 || r <= 0) return null
      const rm1 = estimate1RM(w, r, formula())
      if (!rm1) return null
      return Math.round((rm1 / (1 + 10 / 30)) * 10) / 10
    })

    // 10RM affiché pour une série déjà validée
    const saved10rm = computed(() => {
      if (!props.set.is_completed || !props.set.weight_kg || !props.set.reps) return null
      const rm1 = estimate1RM(props.set.weight_kg, props.set.reps, formula())
      if (!rm1) return null
      return Math.round((rm1 / (1 + 10 / 30)) * 10) / 10
    })

    async function validate() {
      if (local.saving) return
      local.saving = true
      try {
        let result
        if (props.isNew) {
          result = await api.create(props.sessionExerciseId, {
            set_number:   props.setNumber,
            weight_kg:    parseFloat(local.weight_kg) || 0,
            reps:         parseInt(local.reps)         || 0,
            rpe:          local.rpe ? parseFloat(local.rpe) : null,
            is_completed: true,
            is_warmup:    false,
          })
        } else {
          result = await api.update(props.set.id, {
            weight_kg:    parseFloat(local.weight_kg) || 0,
            reps:         parseInt(local.reps)         || 0,
            rpe:          local.rpe ? parseFloat(local.rpe) : null,
            is_completed: true,
          })
        }
        if (result._new_pr) {
          store.showToast(
            t('session.pr_toast', {
              weight: result.weight_kg,
              reps:   result.reps,
              rm:     result._estimated_1rm,
            }),
            'success',
            5000
          )
        }
        emit('validated', result)
        emit('rest-start', props.restSeconds)
      } catch (err) {
        store.showToast(err.message, 'error')
      } finally {
        local.saving = false
      }
    }

    return { local, validate, showRpe, live10rm, saved10rm, t }
  },

  template: `
    <div class="set-row" :class="{ 'set-row--done': set.is_completed && !isNew }">

      <!-- # -->
      <span class="set-row__num">{{ setNumber }}</span>

      <!-- KG + bulle tooltip -->
      <div class="set-row__kg-wrap">
        <input
          class="set-row__input"
          type="number" step="0.5" min="0"
          v-model="local.weight_kg"
          :disabled="set.is_completed && !isNew"
        />
        <!-- Bulle : visible si texte disponible -->
        <AITooltip
          v-if="tooltipText"
          :text="tooltipText"
          :is-first="isFirstTime"
        />
      </div>

      <!-- REPS -->
      <input
        class="set-row__input set-row__input--reps"
        type="number" min="0"
        v-model="local.reps"
        :disabled="set.is_completed && !isNew"
      />

      <!-- 10RM (calculé en temps réel si non validé, depuis les valeurs enregistrées sinon) -->
      <span class="set-row__10rm">
        <template v-if="set.is_completed && !isNew">
          {{ saved10rm !== null ? saved10rm + ' kg' : '—' }}
        </template>
        <template v-else>
          {{ live10rm !== null ? live10rm + ' kg' : '—' }}
        </template>
      </span>

      <!-- RPE optionnel -->
      <input v-if="showRpe() && (isNew || !set.is_completed)"
        class="set-row__input set-row__input--rpe"
        type="number" step="0.5" min="6" max="10"
        :placeholder="t('session.rpe_label')"
        v-model="local.rpe"
      />

      <!-- Bouton valider / check -->
      <button
        v-if="isNew || !set.is_completed"
        class="set-row__btn"
        :disabled="local.saving"
        :title="t('session.validate')"
        @click="validate()">
        {{ local.saving ? '…' : '✓' }}
      </button>
      <span v-else class="set-row__done">✓</span>
    </div>
  `
}
