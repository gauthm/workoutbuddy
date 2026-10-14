import { reactive, onMounted, onUnmounted, inject, nextTick }
  from '/vendor/vue.esm-browser.prod.js'
import { stats as statsApi, exercises as exercisesApi } from '../../api.js'
import { t, exerciseName } from '../../i18n.js'
import { estimate1RM } from '../../utils/rm.js'
import PageHeader     from '../layout/PageHeader.js'
import LoadingSpinner from '../common/LoadingSpinner.js'
import ErrorBanner    from '../common/ErrorBanner.js'
import EmptyState     from '../common/EmptyState.js'

const PERIODS = [
  { key: 30,  labelKey: 'stats.days_30' },
  { key: 90,  labelKey: 'stats.days_90' },
  { key: 180, labelKey: 'stats.days_180' },
  { key: 365, labelKey: 'stats.days_365' },
]

const FORMULAS = ['epley', 'brzycki', 'lander', 'oconner', 'lombardi']

export default {
  name: 'ExerciseProgressView',
  props: { id: { type: String, required: true } },
  components: { PageHeader, LoadingSpinner, ErrorBanner, EmptyState },

  setup(props) {
    const store = inject('store')
    let chartInstance = null

    const state = reactive({
      loading:    false,
      error:      null,
      exercise:   null,
      data:       [],
      days:       180,
      formula:    store.getSetting('rm_formula', 'epley'),
    })

    async function load() {
      state.loading = true; state.error = null
      try {
        const [exercise, progress] = await Promise.all([
          exercisesApi.get(props.id),
          statsApi.exercise(props.id, { days: state.days }),
        ])
        state.exercise = exercise
        state.data     = progress.data
        recalculate()
      } catch (err) {
        state.error = err.message
      } finally {
        state.loading = false
        await nextTick()
        renderChart()
      }
    }

    async function changePeriod(days) {
      state.days = days
      try {
        const progress = await statsApi.exercise(props.id, { days })
        state.data    = progress.data
        recalculate()
        await nextTick()
        renderChart()
      } catch (err) { state.error = err.message }
    }

    function recalculate() {
      state.data = state.data.map(row => ({ ...row,
        estimated_1rm_kg: Math.round(estimate1RM(row.weight_kg, row.reps, state.formula) * 100) / 100,
      }))
    }

    async function changeFormula(formula) {
      state.formula = formula
      recalculate()
      await nextTick()
      renderChart()
    }

    function renderChart() {
      const styles = getComputedStyle(document.documentElement)
      const mutedColor = styles.getPropertyValue('--color-text-muted').trim()
      const textColor = styles.getPropertyValue('--color-text').trim()
      const gridColor = styles.getPropertyValue('--color-border').trim()
      if (!window.Chart) return
      const canvas = document.getElementById('exercise-progress-chart')
      if (!canvas || !state.data.length) return
      if (chartInstance) { chartInstance.destroy(); chartInstance = null }

      chartInstance = new window.Chart(canvas, {
        type: 'line',
        data: {
          datasets: [{
            label:           t('stats.rm_estimated'),
            data:            state.data.map(d => ({ x: d.date, y: d.estimated_1rm_kg })),
            borderColor:     '#e67e22',
            backgroundColor: 'rgba(230,126,34,0.1)',
            pointRadius:     4,
            pointHoverRadius: 6,
            tension:         0.2,
            fill:            true,
          }],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                title: (items) => items[0]?.label || '',
                label: (ctx) =>
                  `${t('stats.rm_estimated')} : ${ctx.parsed.y} kg`,
              }
            },
          },
          scales: {
            x: {
              // 'category' (fallback documenté du plan) : le bundle UMD
              // de Chart.js 4 n'inclut pas d'adaptateur de date, 'time' échouerait
              type:  'category',
              ticks: { color: mutedColor, maxTicksLimit: 8 },
              grid:  { color: gridColor },
            },
            y: {
              ticks: { color: mutedColor, callback: (v) => `${v} kg` },
              grid:  { color: gridColor },
            },
          },
        },
      })
    }

    onMounted(load)
    onUnmounted(() => {
      if (chartInstance) { chartInstance.destroy(); chartInstance = null }
    })

    return { state, load, changePeriod, changeFormula, PERIODS, FORMULAS, t, exerciseName }
  },

  template: `
    <div class="view">
      <PageHeader
        :title="exerciseName(state.exercise) || t('stats.exercise_progress')"
        :show-back="true"
      />
      <div class="view__content" style="padding:0 1rem">
        <LoadingSpinner v-if="state.loading" />
        <ErrorBanner v-else-if="state.error" :message="state.error" :retry="load" />

        <template v-else>
          <!-- Sélecteur de période -->
          <div class="period-selector">
            <button
              v-for="p in PERIODS" :key="p.key"
              class="period-btn"
              :class="{ 'period-btn--active': state.days === p.key }"
              @click="changePeriod(p.key)">
              {{ t(p.labelKey) }}
            </button>
          </div>

          <!-- Sélecteur de formule -->
          <div class="formula-selector">
            <span class="form-label" style="margin-right:0.5rem">
              {{ t('stats.formula_label') }} :
            </span>
            <select class="form-select" style="width:auto;display:inline;font-size:0.85rem"
              :value="state.formula"
              @change="changeFormula($event.target.value)">
              <option v-for="f in FORMULAS" :key="f" :value="f">{{ f }}</option>
            </select>
          </div>

          <!-- Graphique -->
          <EmptyState v-if="!state.data.length"
            icon="📈" :message="t('stats.no_data')" />

          <div v-else class="progress-chart-container">
            <canvas id="exercise-progress-chart" />
          </div>

          <!-- Tableau des données récentes -->
          <div v-if="state.data.length" class="progress-table">
            <div class="detail-section__title" style="margin-bottom:0.5rem">
              {{ t('stats.rm_estimated') }} — {{ t('stats.recent_sessions') }}
            </div>
            <div v-for="d in [...state.data].reverse().slice(0, 10)" :key="d.date"
              class="progress-row">
              <span class="progress-row__date">{{ d.date }}</span>
              <span class="progress-row__weight">{{ d.weight_kg }} kg × {{ d.reps }}</span>
              <span class="progress-row__rm">{{ d.estimated_1rm_kg }} kg</span>
            </div>
          </div>
        </template>
      </div>
    </div>
  `
}
