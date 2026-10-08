import { reactive, inject } from '/vendor/vue.esm-browser.prod.js'
import { t } from '../../i18n.js'
import SetRow       from './SetRow.js'
import RestTimer    from './RestTimer.js'
import ExerciseHelp from './ExerciseHelp.js'

export default {
  name: 'ExerciseBlock',
  props: {
    sessionExercise: { type: Object, required: true },
    // { id, exercise_id, name_fr, sets[], template_exercise_id? }
    targetWeight:    { type: Number, default: 0 },
    targetRepsMin:   { type: Number, default: 8 },
    targetRepsMax:   { type: Number, default: 12 },
    restSeconds:     { type: Number, default: 90 },
    exerciseDetail:  { type: Object, default: null }, // Exercise complet
    history:         { type: Array, default: () => [] },
  },
  emits: ['set-validated'],
  components: { SetRow, RestTimer, ExerciseHelp },

  setup(props, { emit }) {
    const store = inject('store')
    const state = reactive({
      sets:       [...(props.sessionExercise.sets || [])],
      restActive: false,
      restDuration: props.restSeconds,
      showHelp:   false,
      pendingNewSet: false,
    })

    function onValidated(set) {
      // Mettre à jour ou ajouter dans la liste locale
      const idx = state.sets.findIndex(s => s.id === set.id)
      if (idx >= 0) state.sets[idx] = { ...set, is_completed: 1 }
      else state.sets.push({ ...set, is_completed: 1 })
      state.pendingNewSet = false
      emit('set-validated', set)
    }

    function startRest(seconds) {
      state.restDuration = seconds
      state.restActive = true
    }

    function addSet() {
      state.pendingNewSet = true
    }

    const formula = () => store.getSetting('rm_formula', 'epley')
    const lastCompletedSet = () => {
      const done = state.sets.filter(s => s.is_completed)
      return done.length ? done[done.length - 1] : null
    }

    return { state, onValidated, startRest, addSet, formula, lastCompletedSet, t }
  },

  template: `
    <div class="exercise-block">
      <div class="exercise-block__header">
        <span class="exercise-block__name">{{ sessionExercise.name_fr }}</span>
        <button class="icon-btn" @click="state.showHelp = true" :title="t('session.help')">❓</button>
      </div>

      <div class="exercise-block__target" v-if="targetWeight > 0">
        {{ t('session.target') }} : {{ targetWeight }} kg ×
        {{ targetRepsMin }}<template v-if="targetRepsMax > targetRepsMin">–{{ targetRepsMax }}</template>
      </div>

      <!-- Séries existantes -->
      <SetRow
        v-for="(set, i) in state.sets" :key="set.id"
        :set="set"
        :session-exercise-id="sessionExercise.id"
        :target-weight="targetWeight"
        :target-reps="targetRepsMin"
        :set-number="i + 1"
        :is-new="false"
        :rest-seconds="restSeconds"
        @validated="onValidated"
        @rest-start="startRest"
      />

      <!-- Série en cours d'ajout -->
      <SetRow
        v-if="state.pendingNewSet"
        :set="{}"
        :session-exercise-id="sessionExercise.id"
        :target-weight="lastCompletedSet()?.weight_kg || targetWeight"
        :target-reps="lastCompletedSet()?.reps || targetRepsMin"
        :set-number="state.sets.length + 1"
        :is-new="true"
        :rest-seconds="restSeconds"
        @validated="onValidated"
        @rest-start="startRest"
      />

      <!-- Bouton ajouter série -->
      <button class="exercise-block__add-set" @click="addSet()" :disabled="state.pendingNewSet">
        + {{ t('session.add_set') }}
      </button>

      <!-- Timer de repos -->
      <div v-if="state.restActive" style="padding:0.75rem 1rem">
        <RestTimer
          :duration="state.restDuration"
          :active="state.restActive"
          @complete="state.restActive = false"
          @skip="state.restActive = false"
        />
      </div>

      <!-- Modal aide -->
      <ExerciseHelp
        v-if="state.showHelp && exerciseDetail"
        :exercise="exerciseDetail"
        :last-weight="lastCompletedSet()?.weight_kg || targetWeight"
        :last-reps="lastCompletedSet()?.reps || targetRepsMin"
        :formula="formula()"
        :history="history"
        @close="state.showHelp = false"
      />
    </div>
  `
}
