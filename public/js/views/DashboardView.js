import { reactive, onMounted, inject } from '/vendor/vue.esm-browser.prod.js'
import { programs as api } from '../api.js'
import { t } from '../i18n.js'
import EmptyState from '../components/common/EmptyState.js'
import LoadingSpinner from '../components/common/LoadingSpinner.js'
import ErrorBanner from '../components/common/ErrorBanner.js'
import CalendarView from '../components/calendar/CalendarView.js'

export default {
  name: 'DashboardView',
  components: { EmptyState, LoadingSpinner, ErrorBanner, CalendarView },
  setup() {
    const router = inject('router')
    const store  = inject('store')
    const state = reactive({ loading: true, error: null, activeProgram: null })

    async function load() {
      state.loading = true
      state.error = null
      try {
        const data = await api.list()
        state.activeProgram = data.programs.find(p => p.is_active) || null
      } catch (err) {
        state.error = err.message
      } finally {
        state.loading = false
      }
    }

    onMounted(load)

    return { state, load, router, t }
  },
  template: `
    <div class="view dashboard-view">
      <header class="page-header">
        <h1 class="page-header__title">WorkoutBuddy</h1>
      </header>
      <main class="view__content">
        <LoadingSpinner v-if="state.loading" />
        <ErrorBanner v-else-if="state.error" :message="state.error" :retry="load" />
        <button v-else-if="state.activeProgram" class="exercise-card dashboard-program"
          @click="router.push('#/programs/' + state.activeProgram.id)">
          <div class="exercise-card__main">
            <span class="exercise-card__name">{{ state.activeProgram.name }}</span>
            <span class="badge badge--custom">{{ t(state.activeProgram.is_finished ? 'programs.finished_badge' : 'dashboard.active_program') }}</span>
          </div>
        </button>
        <EmptyState
          v-else
          icon="🏋️"
          :message="t('session.no_program')">
          <button class="btn btn--primary" style="margin-top:1rem"
            @click="router.push('#/programs/new')">
            {{ t('programs.new') }}
          </button>
        </EmptyState>
        <p v-if="state.activeProgram && !state.activeProgram.is_finished && state.activeProgram.weekly_progress?.is_complete"
          class="weekly-complete" role="status">✓ {{ t('programs.week_complete') }}</p>
        <div class="dashboard-shortcuts">
          <button class="btn btn--secondary" @click="router.push('#/programs')">{{ t('programs.title') }}</button>
          <button class="btn btn--secondary" @click="router.push('#/session/history')">{{ t('session.history_title') }}</button>
        </div>
        <CalendarView :embedded="true" />
      </main>
    </div>
  `
}
