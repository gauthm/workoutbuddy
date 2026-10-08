import { reactive, inject } from '/vendor/vue.esm-browser.prod.js'
import { sets as api } from '../../api.js'
import { t } from '../../i18n.js'

export default {
  name: 'SetRow',
  props: {
    set:              { type: Object, required: true },
    sessionExerciseId:{ type: Number, required: true },
    targetWeight:     { type: Number, default: 0 },
    targetReps:       { type: Number, default: 8 },
    setNumber:        { type: Number, required: true },
    isNew:            { type: Boolean, default: false }, // série non encore créée
    restSeconds:      { type: Number, default: 90 },
  },
  emits: ['validated', 'deleted', 'rest-start'],

  setup(props, { emit }) {
    const store = inject('store')

    // Si la série existe déjà (is_new=false), afficher les valeurs existantes
    // Si nouvelle, pré-remplir avec target
    const local = reactive({
      weight_kg: props.isNew ? props.targetWeight : props.set.weight_kg,
      reps:      props.isNew ? props.targetReps   : props.set.reps,
      rpe:       props.set.rpe || '',
      saving:    false,
    })

    const showRpe = () => store.getSetting('show_rpe_field', false)
    const showRir = () => store.getSetting('show_rir_field', false)

    async function validate() {
      if (local.saving) return
      local.saving = true
      try {
        let result
        if (props.isNew) {
          // Créer la série
          result = await api.create(props.sessionExerciseId, {
            set_number:   props.setNumber,
            weight_kg:    parseFloat(local.weight_kg) || 0,
            reps:         parseInt(local.reps) || 0,
            rpe:          local.rpe ? parseFloat(local.rpe) : null,
            is_completed: true,
            is_warmup:    false,
          })
        } else {
          // Mettre à jour la série existante
          result = await api.update(props.set.id, {
            weight_kg:    parseFloat(local.weight_kg) || 0,
            reps:         parseInt(local.reps) || 0,
            rpe:          local.rpe ? parseFloat(local.rpe) : null,
            is_completed: true,
          })
        }

        // PR détecté
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

    return { local, validate, showRpe, showRir, t }
  },

  template: `
    <div class="set-row" :class="{ 'set-row--done': set.is_completed && !isNew }">
      <span class="set-row__num">{{ t('session.set_number') }}{{ setNumber }}</span>

      <input
        class="set-row__input"
        type="number" step="0.5" min="0"
        v-model="local.weight_kg"
        :disabled="set.is_completed && !isNew"
      />
      <span class="set-row__unit">kg</span>

      <input
        class="set-row__input set-row__input--reps"
        type="number" min="0"
        v-model="local.reps"
        :disabled="set.is_completed && !isNew"
      />
      <span class="set-row__unit">r</span>

      <input v-if="showRpe() && (isNew || !set.is_completed)"
        class="set-row__input set-row__input--rpe"
        type="number" step="0.5" min="6" max="10"
        :placeholder="t('session.rpe_label')"
        v-model="local.rpe"
      />

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
