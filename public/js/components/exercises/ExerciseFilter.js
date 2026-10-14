import { reactive, watch } from '/vendor/vue.esm-browser.prod.js'
import { t, tm } from '../../i18n.js'
import { EQUIPMENT_FAMILIES } from '../equipment/inventoryCatalog.js'

const MUSCLES = [
  'chest','back','shoulders','biceps','triceps',
  'quads','hamstrings','glutes','calves','core','traps','forearms',
  'lower_back','inner_thigh','neck'
]
const MOVEMENTS = [
  'push_horizontal','push_vertical','pull_horizontal','pull_vertical',
  'squat','hinge','lunge','core','other'
]

export default {
  name: 'ExerciseFilter',
  props: {
    expanded: { type: Boolean, default: false },
    filters: { type: Object, required: true }
    // { muscle, equipment, movement, q }
  },
  emits: ['change','toggle'],

  setup(props, { emit }) {
    const local = reactive({ ...props.filters })
    watch(() => props.filters, value => Object.assign(local, value), { deep: true })

    function update(key, value) {
      local[key] = value
      emit('change', { ...local })
    }

    function clearAll() {
      local.muscle = ''; local.equipment = ''; local.movement = ''; local.q = ''; local.equipment_family = ''; local.available = false
      emit('change', { ...local })
    }

    const hasFilters = () => local.muscle || local.equipment || local.movement || local.q || local.equipment_family || local.available

    return { local, update, clearAll, hasFilters, t, tm, MUSCLES, EQUIPMENT_FAMILIES, MOVEMENTS }
  },

  template: `
    <div class="exercise-filter">
      <div class="catalog-search">
        <input
          class="form-input"
          type="search"
          :aria-label="t('exercises.search')"
          :placeholder="t('exercises.search')"
          :value="local.q"
          @input="update('q', $event.target.value)"
        />
      </div>
      <details class="exercise-filter__panel" :open="expanded" @toggle="$emit('toggle',$event.target.open)">
        <summary>
          <span>{{ t('exercises.filters') }}</span>
          <button v-if="hasFilters()" type="button" class="btn btn--secondary exercise-filter__clear"
            :aria-label="t('exercises.clear_filters')" @click.stop.prevent="clearAll()">✕</button>
        </summary>
        <div class="exercise-filter__rows">
        <select class="form-select"
          :aria-label="t('exercises.filter_muscle')"
          :value="local.muscle" @change="update('muscle', $event.target.value)">
          <option value="">{{ t('exercises.filter_muscle') }}</option>
          <option v-for="m in MUSCLES" :key="m" :value="m">{{ tm(m) }}</option>
        </select>
        <select class="form-select"
          :aria-label="t('exercises.filter_movement')"
          :value="local.movement" @change="update('movement', $event.target.value)">
          <option value="">{{ t('exercises.filter_movement') }}</option>
          <option v-for="mv in MOVEMENTS" :key="mv" :value="mv">{{ t('movement.' + mv) }}</option>
        </select>
        <select class="form-select" :aria-label="t('exercises.filter_equipment_family')"
          :value="local.equipment_family" @change="update('equipment_family', $event.target.value)">
          <option value="">{{ t('exercises.filter_equipment_family') }}</option>
          <option value="bodyweight">{{ t('exercises.bodyweight') }}</option>
          <option v-for="family in EQUIPMENT_FAMILIES" :key="family.id" :value="family.id">{{ t('equipment.family_' + family.id) }}</option>
        </select>
      <label class="exercise-filter__available">
        <input type="checkbox" :checked="local.available" @change="update('available', $event.target.checked)" />
        <span>{{ t('exercises.available_equipment') }}</span>
      </label>
        </div>
      </details>
    </div>
  `
}
