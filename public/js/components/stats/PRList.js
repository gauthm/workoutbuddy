import { inject } from '/vendor/vue.esm-browser.prod.js'
import { t, exerciseName } from '../../i18n.js'

export default {
  name: 'PRList',
  props: {
    records: { type: Array, default: () => [] },
    // record: { exercise_id, exercise_name_fr, reps, weight_kg, estimated_1rm_kg, achieved_date }
    limit:   { type: Number, default: 10 },
  },
  setup() {
    const router = inject('router')
    return { t, router, exerciseName }
  },
  template: `
    <div class="pr-list">
      <div v-if="!records.length"
        style="color:var(--color-text-muted);font-size:0.9rem;padding:1rem 0">
        {{ t('stats.no_records') }}
      </div>
      <button type="button"
        v-for="r in records.slice(0, limit)" :key="r.id || r.exercise_id + r.reps"
        class="pr-row"
        @click="router.push('#/stats/exercise/' + r.exercise_id)">
        <div class="pr-row__info">
          <span class="pr-row__name">{{ exerciseName(r) }}</span>
          <span class="pr-row__detail">
            {{ r.weight_kg }} kg × {{ r.reps }} rep{{ r.reps > 1 ? 's' : '' }}
          </span>
        </div>
        <div class="pr-row__rm">
          <span class="pr-row__rm-value">{{ r.estimated_1rm_kg }} kg</span>
          <span class="pr-row__rm-label">1RM</span>
        </div>
      </button>
    </div>
  `
}
