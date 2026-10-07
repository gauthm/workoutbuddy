import { inject } from '/vendor/vue.esm-browser.prod.js'
import { t } from '../../i18n.js'

export default {
  name: 'ExerciseCard',
  props: {
    exercise: { type: Object, required: true }
    // exercise: Exercise (avec primary_muscles[], equipment_required[], is_custom bool)
  },
  emits: ['click'],
  setup() { return { t } },
  template: `
    <div class="exercise-card" @click="$emit('click')">
      <div class="exercise-card__main">
        <span class="exercise-card__name">{{ exercise.name_fr }}</span>
        <span v-if="exercise.is_custom" class="badge badge--custom">
          {{ t('exercises.custom_badge') }}
        </span>
      </div>
      <div class="exercise-card__meta">
        <span class="exercise-card__muscles">
          {{ exercise.primary_muscles.map(m => t('muscles.' + m) || m).join(', ') }}
        </span>
        <span class="exercise-card__arrow">›</span>
      </div>
    </div>
  `
}
