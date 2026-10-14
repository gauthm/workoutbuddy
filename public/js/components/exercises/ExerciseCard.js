import { inject } from '/vendor/vue.esm-browser.prod.js'
import { t, tm, exerciseName } from '../../i18n.js'

export default {
  name: 'ExerciseCard',
  props: {
    exercise: { type: Object, required: true }
  },
  emits: ['click'],
  setup() { return { t, tm, exerciseName } },
  template: `
    <div class="exercise-card" @click="$emit('click')">
      <div class="exercise-card__main">
        <span class="exercise-card__name">{{ exerciseName(exercise) }}</span>
        <span v-if="exercise.is_custom" class="badge badge--custom">
          {{ t('exercises.custom_badge') }}
        </span>
      </div>
      <div class="exercise-card__meta">
        <span class="exercise-card__muscles">
          {{ exercise.primary_muscles.map(m => tm(m)).join(', ') }}
        </span>
        <span class="exercise-card__arrow">›</span>
      </div>
    </div>
  `
}
