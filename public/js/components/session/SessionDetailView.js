import { reactive, onMounted, inject } from '/vendor/vue.esm-browser.prod.js'
import { sessions as api } from '../../api.js'
import { formatDuration, formatDate } from '../../utils/date.js'
import { t } from '../../i18n.js'
import PageHeader     from '../layout/PageHeader.js'
import LoadingSpinner from '../common/LoadingSpinner.js'
import ErrorBanner    from '../common/ErrorBanner.js'
import ConfirmModal   from '../common/ConfirmModal.js'

export default {
  name: 'SessionDetailView',
  props: { id: { type: String, required: true } },
  components: { PageHeader, LoadingSpinner, ErrorBanner, ConfirmModal },

  setup(props) {
    const router = inject('router')
    const store  = inject('store')

    const state = reactive({ loading: false, error: null, session: null })
    const deleteState = reactive({ show: false, deleting: false })

    async function load() {
      state.loading = true; state.error = null
      try { state.session = await api.get(props.id) }
      catch (err) {
        if (err.status === 404) {
          store.showToast(t('session.unavailable'), 'info')
          router.replace('#/session/history')
        } else state.error = err.message
      }
      finally { state.loading = false }
    }

    async function doDelete() {
      if (deleteState.deleting) return
      deleteState.deleting = true
      try {
        await api.delete(props.id)
        store.showToast(t('session.deleted'), 'success')
        // Retirer le détail supprimé de l'entrée courante de navigation.
        router.replace('#/session/history')
      } catch (err) {
        store.showToast(err.message, 'error')
      } finally {
        deleteState.deleting = false
        deleteState.show     = false
      }
    }

    onMounted(load)
    return { state, load, deleteState, doDelete, formatDuration, formatDate, t }
  },

  template: `
    <div class="view">
      <PageHeader :title="state.session?.name || '…'" :show-back="true" />
      <div class="view__content" style="padding:0 1rem">
        <LoadingSpinner v-if="state.loading" />
        <ErrorBanner v-else-if="state.error" :message="state.error" :retry="load" />
        <template v-else-if="state.session">
          <div class="detail-section">
            <div style="display:flex;gap:1.5rem;margin-bottom:0.5rem">
              <div>
                <div class="detail-section__title">{{ t('session.duration') }}</div>
                <div style="font-size:1.2rem;font-weight:600">
                  {{ formatDuration(state.session.duration_seconds) }}
                </div>
              </div>
              <div v-if="state.session.total_volume_kg">
                <div class="detail-section__title">{{ t('session.volume') }}</div>
                <div style="font-size:1.2rem;font-weight:600">
                  {{ state.session.total_volume_kg }} kg
                </div>
              </div>
            </div>
            <div style="font-size:0.85rem;color:var(--color-text-muted)">
              {{ t('session.completed_on') }} {{ state.session.scheduled_date }}
            </div>
          </div>

          <div class="detail-section">
            <div v-for="se in state.session.exercises" :key="se.id"
              style="margin-bottom:1rem">
              <div style="font-weight:600;margin-bottom:0.4rem">{{ se.name_fr }}</div>
              <div style="display:flex;flex-wrap:wrap;gap:0.4rem">
                <span v-for="set in se.sets.filter(s=>s.is_completed&&!s.is_warmup)"
                  :key="set.id"
                  style="background:var(--color-surface-2);padding:3px 10px;border-radius:var(--radius-sm);font-size:0.85rem">
                  {{ set.weight_kg }}kg × {{ set.reps }}
                </span>
              </div>
            </div>
          </div>

          <button
            v-if="state.session && state.session.status !== 'in_progress'"
            class="btn btn--danger btn--full"
            style="margin:1rem 0"
            @click="deleteState.show = true">
            🗑 {{ t('session.delete') }}
          </button>
        </template>
      </div>

      <ConfirmModal
        v-if="deleteState.show"
        :title="t('session.delete_confirm_title')"
        :body="t('session.delete_confirm_body', { name: state.session?.name, date: formatDate(state.session?.scheduled_date) })"
        :danger="true"
        :confirm-text="t('common.delete')"
        @confirm="doDelete()"
        @cancel="deleteState.show = false"
      />
    </div>
  `
}
