import { onMounted, onUnmounted, watch } from '/vendor/vue.esm-browser.prod.js'
import { t } from '../../i18n.js'

// Palette de couleurs par groupe musculaire
const MUSCLE_COLORS = {
  chest:      '#e74c3c',
  back:       '#3498db',
  quads:      '#2ecc71',
  hamstrings: '#27ae60',
  glutes:     '#1abc9c',
  shoulders:  '#9b59b6',
  biceps:     '#e67e22',
  triceps:    '#f39c12',
  calves:     '#16a085',
  core:       '#2980b9',
  traps:      '#8e44ad',
  forearms:   '#d35400',
  other:      '#95a5a6',
}

export default {
  name: 'VolumeChart',
  props: {
    data:    { type: Array, default: () => [] },
    // data: [{ period: "2025-W27", volume_kg: float, sets?: int, muscle?: string }]
    groupBy: { type: String, default: 'week' }, // 'week' | 'muscle'
    canvasId:{ type: String, default: 'volume-chart' },
  },

  setup(props) {
    let chartInstance = null

    function render() {
      if (!window.Chart) return
      if (!props.data || props.data.length === 0) return

      const canvas = document.getElementById(props.canvasId)
      if (!canvas) return

      if (chartInstance) { chartInstance.destroy(); chartInstance = null }

      if (props.groupBy === 'week') {
        // Histogramme simple : volume total par semaine
        chartInstance = new window.Chart(canvas, {
          type: 'bar',
          data: {
            labels: props.data.map(d => d.period),
            datasets: [{
              label:           t('stats.volume_chart'),
              data:            props.data.map(d => d.volume_kg),
              backgroundColor: 'rgba(230,126,34,0.7)',
              borderColor:     '#e67e22',
              borderWidth:     1,
              borderRadius:    4,
            }],
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: {
                callbacks: {
                  label: (ctx) => `${Math.round(ctx.parsed.y)} kg`,
                }
              },
            },
            scales: {
              x: {
                ticks: { color: '#888', maxTicksLimit: 8, maxRotation: 45 },
                grid:  { display: false },
              },
              y: {
                ticks: { color: '#888', callback: (v) => `${v} kg` },
                grid:  { color: 'rgba(255,255,255,0.05)' },
                beginAtZero: true,
              },
            },
          },
        })
        return
      }

      // group_by = muscle : histogramme empilé par muscle
      // Collecter toutes les périodes et tous les muscles uniques
      const periodsSet = new Set(props.data.map(d => d.period))
      const musclesSet = new Set(props.data.map(d => d.muscle || 'other'))
      const periods    = Array.from(periodsSet).sort()
      const muscles    = Array.from(musclesSet)

      // Construire un objet { muscle → Map<period, volume> }
      const volumeMap = {}
      for (const m of muscles) {
        volumeMap[m] = new Map()
        for (const p of periods) volumeMap[m].set(p, 0)
      }
      for (const d of props.data) {
        const m = d.muscle || 'other'
        volumeMap[m].set(d.period, (volumeMap[m].get(d.period) || 0) + d.volume_kg)
      }

      const datasets = muscles.map(m => ({
        label:           m,
        data:            periods.map(p => Math.round(volumeMap[m].get(p) * 100) / 100),
        backgroundColor: MUSCLE_COLORS[m] || MUSCLE_COLORS.other,
        stack:           'volume',
        borderRadius:    2,
      }))

      chartInstance = new window.Chart(canvas, {
        type: 'bar',
        data: { labels: periods, datasets },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: {
            legend: {
              labels: { color: '#e8e8e8', font: { size: 10 }, boxWidth: 12 },
            },
          },
          scales: {
            x: {
              stacked: true,
              ticks:   { color: '#888', maxTicksLimit: 8 },
              grid:    { display: false },
            },
            y: {
              stacked: true,
              ticks:   { color: '#888', callback: (v) => `${v} kg` },
              grid:    { color: 'rgba(255,255,255,0.05)' },
              beginAtZero: true,
            },
          },
        },
      })
    }

    watch(() => [props.data, props.groupBy], render, { deep: true })
    onMounted(render)
    onUnmounted(() => { if (chartInstance) { chartInstance.destroy(); chartInstance = null } })
  },

  template: `
    <div class="chart-container">
      <canvas :id="canvasId" />
    </div>
  `
}
