import { reactive, onMounted, onUnmounted, inject, computed, nextTick }
  from '/vendor/vue.esm-browser.prod.js'
import { bodyweight as api } from '../../api.js'
import { kgToLb, formatWeight } from '../../utils/weight.js'
import { t } from '../../i18n.js'
import { isoDate } from '../../utils/date.js'
import PageHeader     from '../layout/PageHeader.js'
import LoadingSpinner from '../common/LoadingSpinner.js'
import ErrorBanner    from '../common/ErrorBanner.js'
import EmptyState     from '../common/EmptyState.js'
import ConfirmModal   from '../common/ConfirmModal.js'

// ── Calculate the 7-day moving average ──────────────────────────────────
function movingAverage(entries, windowDays = 7) {
  return entries.map((entry, idx) => {
    const windowStart = idx - windowDays + 1
    const slice = entries.slice(Math.max(0, windowStart), idx + 1)
    const avg   = slice.reduce((sum, e) => sum + e.weight_kg, 0) / slice.length
    return { date: entry.date, avg: Math.round(avg * 100) / 100 }
  })
}

// ── Trend (compare the last 7 days with the previous 7 days) ────────
function computeTrend(entries) {
  if (entries.length < 2) return 'stable'
  const last7  = entries.slice(-7)
  const prev7  = entries.slice(-14, -7)
  if (prev7.length === 0) return 'stable'
  const avgLast = last7.reduce((s, e) => s + e.weight_kg, 0) / last7.length
  const avgPrev = prev7.reduce((s, e) => s + e.weight_kg, 0) / prev7.length
  const diff = avgLast - avgPrev
  if (diff > 0.3) return 'up'
  if (diff < -0.3) return 'down'
  return 'stable'
}

export default {
  name: 'BodyWeightView',
  components: {
    PageHeader, LoadingSpinner, ErrorBanner, EmptyState, ConfirmModal
  },

  setup() {
    const store = inject('store')

    const state = reactive({
      loading:    false,
      error:      null,
      entries:    [],           // BodyWeight[] sorted by date ascending
      showForm:   false,
      form:       { date: isoDate(), weight_kg: '', notes: '' },
      saving:     false,
      deleteTarget: null,
    })

    let chartInstance = null

    const unit = computed(() => store.getSetting('unit', 'kg'))

    const latestEntry = computed(() => {
      if (!state.entries.length) return null
      return state.entries[state.entries.length - 1]
    })

    const trend = computed(() => computeTrend(state.entries))

    // ── Loading ──────────────────────────────────────────────
    async function load() {
      state.loading = true; state.error = null
      try {
        const data = await api.list({ days: 365 })
        // Sort by date ascending for the chart
        state.entries = [...data.entries].sort((a, b) => a.date.localeCompare(b.date))
      } catch (err) {
        state.error = err.message
      } finally {
        state.loading = false
        await nextTick()
        renderChart()
      }
    }

    // ── Chart rendering ──────────────────────────────────────
    function renderChart() {
      const styles = getComputedStyle(document.documentElement)
      const mutedColor = styles.getPropertyValue('--color-text-muted').trim()
      const textColor = styles.getPropertyValue('--color-text').trim()
      const gridColor = styles.getPropertyValue('--color-border').trim()
      const primaryColor = styles.getPropertyValue('--color-primary').trim()
      if (!window.Chart) {
        console.warn('[BodyWeightView] Chart.js non disponible')
        return
      }
      const canvas = document.getElementById('bodyweight-chart')
      if (!canvas || state.entries.length === 0) return

      // Destroy the previous instance
      if (chartInstance) {
        chartInstance.destroy()
        chartInstance = null
      }

      const movAvg = movingAverage(state.entries)

      // Convert to the selected unit
      const rawData = state.entries.map(e => ({
        x: e.date,
        y: unit.value === 'lb'
          ? Math.round(kgToLb(e.weight_kg) * 10) / 10
          : e.weight_kg,
      }))
      const avgData = movAvg.map(e => ({
        x: e.date,
        y: unit.value === 'lb'
          ? Math.round(kgToLb(e.avg) * 10) / 10
          : e.avg,
      }))

      chartInstance = new window.Chart(canvas, {
        type: 'line',
        data: {
          labels: state.entries.map(e => e.date),
          datasets: [
            {
              label:           t('bodyweight.weight'),
              data:            rawData,
              borderColor:     mutedColor,
              backgroundColor: primaryColor + '1a',
              pointRadius:     3,
              pointHoverRadius: 5,
              tension:         0.2,
              fill:            false,
            },
            {
              label:           t('bodyweight.moving_avg'),
              data:            avgData,
              borderColor:     primaryColor,
              backgroundColor: 'transparent',
              pointRadius:     0,
              borderWidth:     2,
              tension:         0.3,
              fill:            false,
            },
          ],
        },
        options: {
          responsive:         true,
          maintainAspectRatio: false,
          interaction:        { mode: 'index', intersect: false },
          plugins: {
            legend: {
              labels: { color: textColor, font: { size: 12 } }
            },
            tooltip: {
              callbacks: {
                label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y} ${unit.value}`
              }
            },
          },
          scales: {
            x: {
              // 'category' is the documented fallback: the UMD bundle
              // for Chart.js 4 has no date adapter, so 'time' would fail
              type:    'category',
              ticks:   { color: mutedColor, maxTicksLimit: 8 },
              grid:    { color: gridColor },
            },
            y: {
              ticks: {
                color:    mutedColor,
                callback: (v) => `${v} ${unit.value}`,
              },
              grid: { color: gridColor },
            },
          },
        },
      })
    }

    // ── Add ───────────────────────────────────────────────────
    async function saveEntry() {
      if (!state.form.weight_kg || parseFloat(state.form.weight_kg) <= 0) {
        store.showToast(t('bodyweight.invalid_weight'), 'error'); return
      }
      state.saving = true
      try {
        // Convert lb → kg if needed
        const weightKg = unit.value === 'lb'
          ? Math.round(parseFloat(state.form.weight_kg) / 2.20462 * 100) / 100
          : parseFloat(state.form.weight_kg)

        await api.create({
          date:      state.form.date,
          weight_kg: weightKg,
          notes:     state.form.notes || null,
        })
        state.form   = { date: isoDate(), weight_kg: '', notes: '' }
        state.showForm = false
        store.showToast(t('bodyweight.saved_toast'), 'success')
        await load()
      } catch (err) {
        store.showToast(err.message, 'error')
      } finally {
        state.saving = false
      }
    }

    // ── Delete ─────────────────────────────────────────────
    async function doDelete() {
      if (!state.deleteTarget) return
      try {
        await api.delete(state.deleteTarget.id)
        store.showToast(t('bodyweight.deleted_toast'), 'success')
        state.deleteTarget = null
        await load()
      } catch (err) {
        store.showToast(err.message, 'error')
      }
    }

    function displayWeight(kg) {
      return formatWeight(kg, unit.value)
    }

    onMounted(load)
    onUnmounted(() => {
      if (chartInstance) { chartInstance.destroy(); chartInstance = null }
    })

    return {
      state, unit, latestEntry, trend,
      saveEntry, doDelete, displayWeight, load, t,
    }
  },

  template: `
    <div class="view">
      <PageHeader :title="t('bodyweight.title')">
        <template #actions>
          <button class="btn btn--primary"
            style="padding:0.4rem 0.75rem;font-size:0.85rem"
            @click="state.showForm = !state.showForm">
            {{ state.showForm ? t('common.close') : t('bodyweight.add') }}
          </button>
        </template>
      </PageHeader>

      <div class="view__content" style="padding:0 1rem">
        <LoadingSpinner v-if="state.loading" />
        <ErrorBanner v-else-if="state.error" :message="state.error" :retry="load" />

        <template v-else>
          <!-- Add form -->
          <div v-if="state.showForm" class="bw-form">
            <form @submit.prevent="saveEntry">
              <div class="form-group">
                <label class="form-label" for="BodyWeightView-state-form-date">{{ t('bodyweight.date') }}</label>
                <input id="BodyWeightView-state-form-date" class="form-input" type="date" v-model="state.form.date" required />
              </div>
              <div class="form-group">
                <label class="form-label" for="BodyWeightView-state-form-weight_kg">
                  {{ t('bodyweight.weight') }} ({{ unit }})
                </label>
                <input id="BodyWeightView-state-form-weight_kg" class="form-input" type="number" step="0.1" min="20" max="500"
                  v-model="state.form.weight_kg" required
                  :placeholder="unit === 'kg' ? '75.0' : '165.0'" />
              </div>
              <div class="form-group">
                <label class="form-label" for="BodyWeightView-state-form-notes">{{ t('bodyweight.notes') }}</label>
                <input id="BodyWeightView-state-form-notes" class="form-input" type="text" v-model="state.form.notes" />
              </div>
              <button type="submit" class="btn btn--primary btn--full"
                :disabled="state.saving">
                {{ state.saving ? t('common.loading') : t('common.save') }}
              </button>
            </form>
          </div>

          <EmptyState v-if="!state.entries.length"
            icon="⚖️" :message="t('bodyweight.no_entries')">
            <button class="btn btn--primary" style="margin-top:1rem"
              @click="state.showForm = true">
              {{ t('bodyweight.add') }}
            </button>
          </EmptyState>

          <template v-else>
            <!-- Summary -->
            <div class="bw-summary">
              <div class="bw-summary__item">
                <div class="detail-section__title">{{ t('bodyweight.latest') }}</div>
                <div class="bw-summary__value">
                  {{ displayWeight(latestEntry.weight_kg) }}
                </div>
                <div style="font-size:0.75rem;color:var(--color-text-muted)">
                  {{ latestEntry.date }}
                </div>
              </div>
              <div class="bw-summary__item">
                <div class="detail-section__title">{{ t('bodyweight.trend') }}</div>
                <div class="bw-summary__value"
                  :style="{
                    color: trend==='up' ? 'var(--color-warning)'
                         : trend==='down' ? 'var(--color-success)'
                         : 'var(--color-text-muted)'
                  }">
                  {{ t('bodyweight.trend_' + trend) }}
                </div>
              </div>
            </div>

            <!-- Chart -->
            <div class="bw-chart-container">
              <canvas id="bodyweight-chart"></canvas>
            </div>

            <!-- Entry list (last 30) -->
            <div class="bw-list">
              <div
                v-for="entry in [...state.entries].reverse().slice(0, 30)"
                :key="entry.id"
                class="bw-list-row">
                <div class="bw-list-row__info">
                  <span class="bw-list-row__date">{{ entry.date }}</span>
                  <span class="bw-list-row__weight">
                    {{ displayWeight(entry.weight_kg) }}
                  </span>
                </div>
                <button class="icon-btn icon-btn--danger"
                  @click="state.deleteTarget = entry">🗑</button>
              </div>
            </div>
          </template>
        </template>
      </div>

      <ConfirmModal
        v-if="state.deleteTarget"
        :title="t('bodyweight.delete_confirm')"
        :body="state.deleteTarget ? state.deleteTarget.date + ' — ' + displayWeight(state.deleteTarget.weight_kg) : ''"
        :danger="true"
        @confirm="doDelete()"
        @cancel="state.deleteTarget = null"
      />
    </div>
  `
}
