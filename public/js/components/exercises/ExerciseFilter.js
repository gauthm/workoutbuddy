import { reactive } from '/vendor/vue.esm-browser.prod.js'
import { t } from '../../i18n.js'

const MUSCLES = [
  'chest','back','shoulders','biceps','triceps',
  'quads','hamstrings','glutes','calves','core','traps','forearms'
]
const EQUIPMENT = [
  'barbell','ez_bar','dumbbell_fixed','dumbbell_adjustable','kettlebell',
  'resistance_band','bench','rack','pullup_bar','cable_machine','other'
]
const MOVEMENTS = [
  'push_horizontal','push_vertical','pull_horizontal','pull_vertical',
  'squat','hinge','lunge','core','other'
]

export default {
  name: 'ExerciseFilter',
  props: {
    filters: { type: Object, required: true }
    // { muscle, equipment, movement, q }
  },
  emits: ['change'],

  setup(props, { emit }) {
    const local = reactive({ ...props.filters })

    function update(key, value) {
      local[key] = value
      emit('change', { ...local })
    }

    function clearAll() {
      local.muscle = ''; local.equipment = ''; local.movement = ''; local.q = ''
      emit('change', { ...local })
    }

    const hasFilters = () => local.muscle || local.equipment || local.movement || local.q

    return { local, update, clearAll, hasFilters, t, MUSCLES, EQUIPMENT, MOVEMENTS }
  },

  template: `
    <div class="exercise-filter">
      <div class="exercise-filter__search">
        <input
          class="form-input"
          type="search"
          :placeholder="t('exercises.search')"
          :value="local.q"
          @input="update('q', $event.target.value)"
        />
      </div>
      <div class="exercise-filter__chips">
        <select class="form-select form-select--compact"
          :value="local.muscle" @change="update('muscle', $event.target.value)">
          <option value="">{{ t('exercises.filter_muscle') }}</option>
          <option v-for="m in MUSCLES" :key="m" :value="m">{{ t('muscles.' + m) }}</option>
        </select>
        <select class="form-select form-select--compact"
          :value="local.movement" @change="update('movement', $event.target.value)">
          <option value="">{{ t('exercises.filter_movement') }}</option>
          <option v-for="mv in MOVEMENTS" :key="mv" :value="mv">{{ t('movement.' + mv) }}</option>
        </select>
        <button v-if="hasFilters()" class="btn btn--secondary" style="padding:0.4rem 0.75rem"
          @click="clearAll()">✕</button>
      </div>
    </div>
  `
}
