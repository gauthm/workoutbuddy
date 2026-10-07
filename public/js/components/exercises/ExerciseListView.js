import { reactive, onMounted, inject } from '/vendor/vue.esm-browser.prod.js'
import { exercises as api } from '../../api.js'
import { t } from '../../i18n.js'
import PageHeader      from '../layout/PageHeader.js'
import LoadingSpinner  from '../common/LoadingSpinner.js'
import ErrorBanner     from '../common/ErrorBanner.js'
import EmptyState      from '../common/EmptyState.js'
import ExerciseCard    from './ExerciseCard.js'
import ExerciseFilter  from './ExerciseFilter.js'

export default {
  name: 'ExerciseListView',
  components: { PageHeader, LoadingSpinner, ErrorBanner, EmptyState, ExerciseCard, ExerciseFilter },

  setup() {
    const router = inject('router')

    const state = reactive({
      loading: false,
      error: null,
      exercises: [],
      filters: { muscle: '', equipment: '', movement: '', q: '' },
    })

    async function load() {
      state.loading = true
      state.error = null
      try {
        // Construire les params en excluant les valeurs vides
        const params = {}
        if (state.filters.muscle)    params.muscle    = state.filters.muscle
        if (state.filters.equipment) params.equipment = state.filters.equipment
        if (state.filters.movement)  params.movement  = state.filters.movement
        if (state.filters.q)         params.q         = state.filters.q
        const data = await api.list(params)
        state.exercises = data.exercises
      } catch (err) {
        state.error = err.message
      } finally {
        state.loading = false
      }
    }

    function onFilterChange(newFilters) {
      Object.assign(state.filters, newFilters)
      load()
    }

    onMounted(load)

    return { state, load, onFilterChange, router, t }
  },

  template: `
    <div class="view">
      <PageHeader :title="t('exercises.title')">
        <template #actions>
          <button class="btn btn--primary" style="padding:0.4rem 0.75rem;font-size:0.85rem"
            @click="router.push('#/exercises/new')">
            +
          </button>
        </template>
      </PageHeader>

      <div class="view__content">
        <ExerciseFilter :filters="state.filters" @change="onFilterChange" />

        <LoadingSpinner v-if="state.loading" />
        <ErrorBanner   v-else-if="state.error"
          :message="state.error" :retry="load" />
        <EmptyState    v-else-if="state.exercises.length === 0"
          icon="🔍" :message="t('exercises.no_results')" />
        <div v-else class="exercise-list">
          <ExerciseCard
            v-for="ex in state.exercises"
            :key="ex.id"
            :exercise="ex"
            @click="router.push('#/exercises/' + ex.id)"
          />
        </div>
      </div>
    </div>
  `
}
