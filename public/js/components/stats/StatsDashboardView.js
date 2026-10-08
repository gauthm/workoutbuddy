import { reactive, onMounted, inject } from '/vendor/vue.esm-browser.prod.js'
import { stats as statsApi } from '../../api.js'
import { t } from '../../i18n.js'
import PageHeader     from '../layout/PageHeader.js'
import LoadingSpinner from '../common/LoadingSpinner.js'
import ErrorBanner    from '../common/ErrorBanner.js'
import StreakCard      from './StreakCard.js'
import VolumeChart     from './VolumeChart.js'
import PRList          from './PRList.js'

export default {
  name: 'StatsDashboardView',
  components: { PageHeader, LoadingSpinner, ErrorBanner, StreakCard, VolumeChart, PRList },

  setup() {
    const router = inject('router')
    const state = reactive({
      loading:  false,
      error:    null,
      overview: null,
      volume:   [],
      records:  [],
      volumeGroupBy: 'week',
    })

    async function load() {
      state.loading = true; state.error = null
      try {
        const [overview, volumeData, recordsData] = await Promise.all([
          statsApi.overview(),
          statsApi.volume({ weeks: 12, group_by: state.volumeGroupBy }),
          statsApi.records(),
        ])
        state.overview = overview
        state.volume   = volumeData.data
        state.records  = recordsData.records
      } catch (err) {
        state.error = err.message
      } finally {
        state.loading = false
      }
    }

    async function toggleGroupBy() {
      state.volumeGroupBy = state.volumeGroupBy === 'week' ? 'muscle' : 'week'
      try {
        const data = await statsApi.volume({ weeks: 12, group_by: state.volumeGroupBy })
        state.volume = data.data
      } catch (_) {}
    }

    onMounted(load)
    return { state, load, toggleGroupBy, router, t }
  },

  template: `
    <div class="view">
      <PageHeader :title="t('stats.title')" />

      <div class="view__content">
        <LoadingSpinner v-if="state.loading" />
        <ErrorBanner v-else-if="state.error" :message="state.error" :retry="load" />

        <template v-else-if="state.overview">
          <!-- Streak -->
          <StreakCard
            :current-streak="state.overview.current_week_streak"
            :longest-streak="state.overview.longest_week_streak"
            :total-sessions="state.overview.total_sessions"
            :total-weeks="state.overview.total_weeks_trained"
          />

          <!-- Volume -->
          <section style="padding:0 1rem">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.5rem">
              <h3 class="detail-section__title" style="margin:0">{{ t('stats.volume_chart') }}</h3>
              <button class="btn btn--secondary"
                style="padding:0.25rem 0.6rem;font-size:0.75rem"
                @click="toggleGroupBy()">
                {{ state.volumeGroupBy === 'week' ? t('stats.by_muscle') : t('stats.by_week') }}
              </button>
            </div>
            <div v-if="!state.volume.length"
              style="color:var(--color-text-muted);font-size:0.85rem;padding:1rem 0">
              {{ t('stats.no_data') }}
            </div>
            <VolumeChart
              v-else
              :data="state.volume"
              :group-by="state.volumeGroupBy"
              canvas-id="volume-chart-main"
            />
          </section>

          <!-- Records -->
          <section style="padding:0 1rem;margin-top:1.5rem">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.5rem">
              <h3 class="detail-section__title" style="margin:0">{{ t('stats.personal_records') }}</h3>
            </div>
            <PRList :records="state.records" :limit="5" />
            <button v-if="state.records.length > 5"
              class="btn btn--secondary btn--full" style="margin-top:0.75rem"
              @click="router.push('#/stats/records')">
              {{ t('stats.see_all_records') }}
            </button>
          </section>

          <!-- Liens rapides -->
          <section style="padding:1rem;margin-top:1rem;display:flex;flex-direction:column;gap:0.5rem">
            <button class="btn btn--secondary btn--full"
              @click="router.push('#/stats/bodyweight')">
              ⚖️ {{ t('stats.bodyweight_link') }}
            </button>
          </section>
        </template>
      </div>
    </div>
  `
}
