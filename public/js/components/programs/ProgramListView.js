import { reactive, onMounted, inject } from '/vendor/vue.esm-browser.prod.js'
import { programs as api } from '../../api.js'
import { t } from '../../i18n.js'
import PageHeader     from '../layout/PageHeader.js'
import LoadingSpinner from '../common/LoadingSpinner.js'
import ErrorBanner    from '../common/ErrorBanner.js'
import EmptyState     from '../common/EmptyState.js'
import ProgramCard    from './ProgramCard.js'

export default {
  name: 'ProgramListView',
  components: { PageHeader, LoadingSpinner, ErrorBanner, EmptyState, ProgramCard },

  setup() {
    const router = inject('router')
    const state = reactive({ loading: false, error: null, programs: [] })

    async function load() {
      state.loading = true; state.error = null
      try {
        const data = await api.list()
        state.programs = data.programs
      } catch (err) { state.error = err.message }
      finally { state.loading = false }
    }

    onMounted(load)
    return { state, load, router, t }
  },

  template: `
    <div class="view">
      <PageHeader :title="t('programs.title')" />
      <div class="view__content">
        <LoadingSpinner v-if="state.loading" />
        <ErrorBanner   v-else-if="state.error" :message="state.error" :retry="load" />
        <EmptyState    v-else-if="!state.programs.length"
          icon="📋" :message="t('programs.no_programs')">
          <button class="btn btn--primary" style="margin-top:1rem"
            @click="router.push('#/coach')">
            {{ t('programs.create_via_coach') }}
          </button>
        </EmptyState>
        <div v-else>
          <ProgramCard
            v-for="p in state.programs" :key="p.id"
            :program="p"
            @click="router.push('#/programs/' + p.id)"
          />
        </div>
      </div>
    </div>
  `
}
