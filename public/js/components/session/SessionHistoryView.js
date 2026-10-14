import { reactive, onMounted, inject, computed } from '/vendor/vue.esm-browser.prod.js'
import { sessions as api } from '../../api.js'
import { formatDuration, formatDate } from '../../utils/date.js'
import { t } from '../../i18n.js'
import PageHeader     from '../layout/PageHeader.js'
import LoadingSpinner from '../common/LoadingSpinner.js'
import ErrorBanner    from '../common/ErrorBanner.js'
import EmptyState     from '../common/EmptyState.js'
import ConfirmModal   from '../common/ConfirmModal.js'

export default {
  name: 'SessionHistoryView',
  components: {
    PageHeader, LoadingSpinner, ErrorBanner, EmptyState, ConfirmModal
  },

  setup() {
    const router = inject('router')
    const store  = inject('store')

    const state = reactive({
      loading:      false,
      error:        null,
      sessions:     [],
      filterStatus: 'all',
      filterQ:      '',
      deleteTarget: null,
      deleting:     false,
    })

    // ── Chargement ────────────────────────────────────────────
    async function load() {
      state.loading = true; state.error = null
      try {
        const params = { limit: 200 }
        if (state.filterStatus !== 'all') params.status = state.filterStatus
        const data = await api.list(params)
        state.sessions = data.sessions.sort((a, b) =>
          b.scheduled_date.localeCompare(a.scheduled_date)
        )
      } catch (err) {
        state.error = err.message
      } finally {
        state.loading = false
      }
    }

    // ── Filtrage local ─────────────────────────────────────────
    const filteredSessions = computed(() => {
      if (!state.filterQ.trim()) return state.sessions
      const q = state.filterQ.trim().toLowerCase()
      return state.sessions.filter(s => s.name.toLowerCase().includes(q))
    })

    // ── Stats globales ─────────────────────────────────────────
    const globalStats = computed(() => {
      const completed = state.sessions.filter(s => s.status === 'completed')
      const totalVol  = completed.reduce((sum, s) => sum + (s.total_volume_kg || 0), 0)
      const totalDur  = completed.reduce((sum, s) => sum + (s.duration_seconds || 0), 0)
      const withRpe   = completed.filter(s => s.rpe_avg)
      const avgRpe    = withRpe.length > 0
        ? withRpe.reduce((sum, s) => sum + s.rpe_avg, 0) / withRpe.length
        : null
      return {
        count:  completed.length,
        vol:    Math.round(totalVol),
        dur:    totalDur,
        avgRpe: avgRpe ? Math.round(avgRpe * 10) / 10 : null,
      }
    })

    // ── Suppression ───────────────────────────────────────────
    function askDelete(session) {
      state.deleteTarget = session
    }

    async function confirmDelete() {
      if (!state.deleteTarget) return
      state.deleting = true
      try {
        await api.delete(state.deleteTarget.id)
        state.sessions     = state.sessions.filter(s => s.id !== state.deleteTarget.id)
        state.deleteTarget = null
        store.showToast(t('session.deleted'), 'success')
      } catch (err) {
        store.showToast(err.message, 'error')
      } finally {
        state.deleting = false
      }
    }

    // ── Couleur badge statut ──────────────────────────────────
    function statusColor(status) {
      return {
        completed:   'var(--color-success)',
        planned:     'var(--color-warning)',
        skipped:     'var(--color-text-muted)',
        in_progress: 'var(--color-primary)',
      }[status] || 'var(--color-border)'
    }

    onMounted(load)

    return {
      state, filteredSessions, globalStats,
      load, askDelete, confirmDelete,
      statusColor, formatDuration, formatDate, router, t,
    }
  },

  template: `
    <div class="view">
      <PageHeader :title="t('session.history_title')" :show-back="true" />

      <div class="view__content">
        <LoadingSpinner v-if="state.loading" />
        <ErrorBanner   v-else-if="state.error" :message="state.error" :retry="load" />

        <template v-else>
          <!-- Stats globales -->
          <div v-if="globalStats.count > 0" class="history-stats">
            <div class="history-stats__item">
              <span class="history-stats__value">{{ globalStats.count }}</span>
              <span class="history-stats__label">{{ t('session.history_stat_sessions') }}</span>
            </div>
            <div class="history-stats__item">
              <span class="history-stats__value">{{ globalStats.vol.toLocaleString() }}</span>
              <span class="history-stats__label">{{ t('session.history_stat_volume') }}</span>
            </div>
            <div class="history-stats__item">
              <span class="history-stats__value">{{ formatDuration(globalStats.dur) }}</span>
              <span class="history-stats__label">{{ t('session.history_stat_time') }}</span>
            </div>
            <div v-if="globalStats.avgRpe" class="history-stats__item">
              <span class="history-stats__value">{{ globalStats.avgRpe }}</span>
              <span class="history-stats__label">{{ t('session.history_stat_rpe') }}</span>
            </div>
          </div>

          <!-- Filtres -->
          <div class="history-filters">
            <input
              class="form-input history-filters__search"
              type="search"
              :aria-label="t('session.history_search')"
              :placeholder="t('session.history_search')"
              v-model="state.filterQ"
            />
            <div class="history-filters__tabs">
              <button
                v-for="s in ['all','completed','skipped']" :key="s"
                class="history-filter-tab"
                :class="{ 'history-filter-tab--active': state.filterStatus === s }"
                @click="state.filterStatus = s; load()">
                {{ t('session.filter_' + s) }}
              </button>
            </div>
          </div>

          <!-- Liste vide -->
          <EmptyState
            v-if="!filteredSessions.length"
            icon="📅"
            :message="state.filterQ ? t('session.history_no_results') : t('session.history_empty')"
          />

          <!-- Liste des séances -->
          <div v-else class="history-list">
            <div
              v-for="s in filteredSessions"
              :key="s.id"
              class="history-row">

              <div class="history-row__main" @click="router.push('#/session/' + s.id)">
                <div class="history-row__top">
                  <span class="history-row__name">{{ s.name }}</span>
                  <span class="history-row__status-dot"
                    :style="{ background: statusColor(s.status) }" />
                </div>
                <div class="history-row__meta">
                  <span>{{ formatDate(s.scheduled_date) }}</span>
                  <span v-if="s.duration_seconds">
                    · {{ formatDuration(s.duration_seconds) }}
                  </span>
                  <span v-if="s.total_volume_kg">
                    · {{ s.total_volume_kg }} kg
                  </span>
                  <span v-if="s.rpe_avg">
                    · RPE {{ s.rpe_avg.toFixed(1) }}
                  </span>
                </div>
              </div>

              <button
                v-if="s.status !== 'in_progress'"
                class="history-row__delete"
                @click.stop="askDelete(s)"
                :title="t('session.delete')" :aria-label="t('session.delete')">
                🗑
              </button>
            </div>
          </div>
        </template>
      </div>

      <ConfirmModal
        v-if="state.deleteTarget"
        :title="t('session.delete_confirm_title')"
        :body="t('session.delete_confirm_body', { name: state.deleteTarget.name, date: formatDate(state.deleteTarget.scheduled_date) })"
        :danger="true"
        :confirm-text="t('common.delete')"
        @confirm="confirmDelete()"
        @cancel="state.deleteTarget = null"
      />
    </div>
  `
}
