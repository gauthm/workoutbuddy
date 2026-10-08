import { reactive, onMounted, inject } from '/vendor/vue.esm-browser.prod.js'
import { sessions as api } from '../../api.js'
import { t } from '../../i18n.js'
import PageHeader     from '../layout/PageHeader.js'
import LoadingSpinner from '../common/LoadingSpinner.js'
import EmptyState     from '../common/EmptyState.js'
import ErrorBanner    from '../common/ErrorBanner.js'

export default {
  name: 'SessionHistoryView',
  components: { PageHeader, LoadingSpinner, EmptyState, ErrorBanner },

  setup() {
    const router = inject('router')
    const state = reactive({ loading: false, error: null, sessions: [] })

    async function load() {
      state.loading = true; state.error = null
      try {
        const data = await api.list({ status: 'completed', limit: 50 })
        state.sessions = data.sessions
      } catch (err) { state.error = err.message }
      finally { state.loading = false }
    }

    onMounted(load)
    return { state, load, router, t }
  },

  template: `
    <div class="view">
      <PageHeader :title="t('session.history_title')" :show-back="true" />
      <div class="view__content">
        <LoadingSpinner v-if="state.loading" />
        <ErrorBanner   v-else-if="state.error" :message="state.error" :retry="load" />
        <EmptyState    v-else-if="!state.sessions.length"
          icon="📅" :message="t('session.no_history')" />
        <div v-else>
          <div
            v-for="s in state.sessions" :key="s.id"
            class="session-history-row"
            @click="router.push('#/session/' + s.id)">
            <div class="session-history-row__name">{{ s.name }}</div>
            <div class="session-history-row__meta">
              <span>{{ s.scheduled_date }}</span>
              <span v-if="s.duration_seconds">
                · {{ Math.floor(s.duration_seconds/60) }}min
              </span>
              <span v-if="s.total_volume_kg">
                · {{ s.total_volume_kg }}kg
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
}
