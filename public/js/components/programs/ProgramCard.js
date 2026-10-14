import { t } from '../../i18n.js'

const GOAL_KEYS = {
  strength: 'programs.goal_strength', hypertrophy: 'programs.goal_hypertrophy',
  endurance: 'programs.goal_endurance', weight_loss: 'programs.goal_weight_loss',
  general_fitness: 'programs.goal_general',
}

export default {
  name: 'ProgramCard',
  props: { program: { type: Object, required: true } },
  emits: ['click'],
  setup() { return { t, GOAL_KEYS } },
  template: `
    <div class="program-card" :class="{ 'program-card--active': program.is_active }"
      @click="$emit('click')">
      <div class="program-card__header">
        <span class="program-card__name">{{ program.name }}</span>
        <span v-if="program.is_active" class="badge badge--active">
          {{ t(program.is_finished ? 'programs.finished_badge' : 'programs.active_badge') }}
        </span>
      </div>
      <div class="program-card__meta">
        <span>{{ t(GOAL_KEYS[program.goal] || 'programs.goal_general') }}</span>
        <span>·</span>
        <span>{{ program.days_per_week }} {{ t('programs.days_per_week') }}</span>
        <span>·</span>
        <span>{{ t('programs.week') }} {{ program.current_week }}</span>
      </div>
    </div>
  `
}
