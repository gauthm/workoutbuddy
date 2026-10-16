import { reactive, onMounted, inject } from '/vendor/vue.esm-browser.prod.js'
import { programs as api } from '../../api.js'
import { t } from '../../i18n.js'
import PageHeader     from '../layout/PageHeader.js'
import LoadingSpinner from '../common/LoadingSpinner.js'
import ErrorBanner    from '../common/ErrorBanner.js'
import ProgramCard    from './ProgramCard.js'
import EmptyState from '../common/EmptyState.js'

export default {
  name: 'ProgramListView',
  components: { PageHeader, LoadingSpinner, ErrorBanner, ProgramCard, EmptyState },

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
      <PageHeader :title="t('programs.title')"><template #actions><button v-if="state.programs.length" class="btn btn--primary" @click="router.push('#/programs/new')">{{ t('programs.new') }}</button></template></PageHeader>
      <div class="view__content">
        <p class="program-activation-hint program-activation-hint--list">{{ t('programs.single_active_hint') }}</p>
        <LoadingSpinner v-if="state.loading" />
        <ErrorBanner   v-else-if="state.error" :message="state.error" :retry="load" />
        <EmptyState v-else-if="!state.programs.length" icon="🏋️" :message="t('dashboard.no_program')">
          <button class="btn btn--primary" @click="router.push('#/programs/new')">{{ t('programs.new') }}</button>
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
