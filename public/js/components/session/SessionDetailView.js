import { reactive, onMounted } from '/vendor/vue.esm-browser.prod.js'
import { sessions as api } from '../../api.js'
import { formatDuration } from '../../utils/date.js'
import { t } from '../../i18n.js'
import PageHeader     from '../layout/PageHeader.js'
import LoadingSpinner from '../common/LoadingSpinner.js'
import ErrorBanner    from '../common/ErrorBanner.js'

export default {
  name: 'SessionDetailView',
  props: { id: { type: String, required: true } },
  components: { PageHeader, LoadingSpinner, ErrorBanner },

  setup(props) {
    const state = reactive({ loading: false, error: null, session: null })

    async function load() {
      state.loading = true; state.error = null
      try { state.session = await api.get(props.id) }
      catch (err) { state.error = err.message }
      finally { state.loading = false }
    }

    onMounted(load)
    return { state, load, formatDuration, t }
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
        </template>
      </div>
    </div>
  `
}
