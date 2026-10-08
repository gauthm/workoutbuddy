import { reactive, onMounted, inject } from '/vendor/vue.esm-browser.prod.js'
import { programs as api } from '../api.js'
import { t } from '../i18n.js'
import EmptyState from '../components/common/EmptyState.js'

export default {
  name: 'DashboardView',
  components: { EmptyState },
  setup() {
    const router = inject('router')
    const store  = inject('store')
    const state = reactive({ loading: true, activeProgram: null })

    async function load() {
      state.loading = true
      try {
        const data = await api.list()
        state.activeProgram = data.programs.find(p => p.is_active) || null
      } catch {
        state.activeProgram = null
      } finally {
        state.loading = false
      }
    }

    onMounted(load)

    return { state, router, t }
  },
  template: `
    <div class="view">
      <header class="page-header">
        <h1 class="page-header__title">WorkoutBuddy</h1>
      </header>
      <main class="view__content">
        <div v-if="state.activeProgram" class="exercise-card"
          @click="router.push('#/programs/' + state.activeProgram.id)">
          <div class="exercise-card__main">
            <span class="exercise-card__name">{{ state.activeProgram.name }}</span>
            <span class="badge badge--custom">{{ t('dashboard.active_program') }}</span>
          </div>
        </div>
        <EmptyState
          v-else-if="!state.loading"
          icon="🏋️"
          :message="t('session.no_program')">
          <button class="btn btn--primary" style="margin-top:1rem"
            @click="router.push('#/programs/new')">
            {{ t('session.create_program') }}
          </button>
        </EmptyState>
      </main>
    </div>
  `
}
