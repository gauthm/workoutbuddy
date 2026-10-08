import { reactive, onMounted } from '/vendor/vue.esm-browser.prod.js'
import { exercises as api } from '../../api.js'
import { t } from '../../i18n.js'
import LoadingSpinner from '../common/LoadingSpinner.js'

export default {
  name: 'ExerciseSelector',
  emits: ['select', 'cancel'],
  components: { LoadingSpinner },

  setup(_, { emit }) {
    const state = reactive({
      loading: false, exercises: [], q: ''
    })

    async function load() {
      state.loading = true
      try {
        const data = await api.list(state.q ? { q: state.q } : {})
        state.exercises = data.exercises
      } finally { state.loading = false }
    }

    let searchTimer = null
    function onSearch(val) {
      state.q = val
      clearTimeout(searchTimer)
      searchTimer = setTimeout(load, 300)
    }

    onMounted(load)
    return { state, onSearch, t, emit }
  },

  template: `
    <div class="exercise-selector">
      <div style="padding:0.75rem">
        <input class="form-input" type="search"
          :placeholder="t('exercises.search')"
          @input="onSearch($event.target.value)" />
      </div>
      <LoadingSpinner v-if="state.loading" />
      <div class="exercise-selector__list" v-else>
        <button
          v-for="ex in state.exercises" :key="ex.id"
          class="exercise-selector__item"
          type="button"
          @click="emit('select', ex)">
          <span>{{ ex.name_fr }}</span>
          <span style="font-size:0.8rem;color:var(--color-text-muted)">
            {{ ex.primary_muscles.map(m => t('muscles.' + m)).join(', ') }}
          </span>
        </button>
      </div>
    </div>
  `
}
