import { ref } from '/vendor/vue.esm-browser.prod.js'
import { t } from '../../i18n.js'

const ACTION_KEYS = {
  create_program:           'coach.action_create_program',
  update_program:           'coach.action_update_program',
  activate_program:         'coach.action_activate_program',
  create_session:           'coach.action_create_session',
  schedule_sessions:        'coach.action_schedule_sessions',
  add_equipment:            'coach.action_add_equipment',
  swap_exercise:            'coach.action_swap_exercise',
  update_progression_state: 'coach.action_update_progression',
  update_settings:          'coach.action_update_settings',
  trigger_deload:           'coach.action_trigger_deload',
  complete_user_profile:    'coach.action_complete_profile',
}

const ACTION_ICONS = {
  create_program:           '📋',
  update_program:           '✏️',
  activate_program:         '▶️',
  create_session:           '🏋️',
  schedule_sessions:        '📅',
  add_equipment:            '🛒',
  swap_exercise:            '🔄',
  update_progression_state: '⚖️',
  update_settings:          '⚙️',
  trigger_deload:           '😴',
  complete_user_profile:    '👤',
}

function buildSummary(action) {
  const d = action.data || {}
  switch (action.action) {
    case 'create_program': {
      const tpls = d.templates || []
      const exCount = tpls.reduce((s, t) => s + (t.exercises||[]).length, 0)
      return `"${d.name}" · ${d.goal} · ${d.level} · ${d.days_per_week}j/sem · ${tpls.length} séance(s) · ${exCount} exercice(s)`
    }
    case 'complete_user_profile': {
      const fields = Object.keys(d).filter(k => k !== 'onboarding_step' && k !== 'onboarding_completed')
      return fields.length > 0 ? `Champs mis à jour : ${fields.join(', ')}` : 'Avancement onboarding'
    }
    case 'create_session':   return `"${d.name}" le ${d.scheduled_date}`
    case 'schedule_sessions': return `${(d.sessions||[]).length} séance(s) planifiée(s)`
    case 'add_equipment':     return `${d.name} (${d.category})${d.weight_kg ? ' · ' + d.weight_kg + ' kg' : ''}`
    case 'activate_program':  return `Programme ID ${d.program_id}`
    case 'trigger_deload':    return `Déload pour le programme ID ${d.program_id}`
    case 'swap_exercise':     return `Remplacement exercice template #${d.template_exercise_id} → ${d.new_exercise_id}`
    case 'update_settings':   return Object.entries(d).map(([k,v]) => `${k} = ${v}`).join(', ')
    default: return JSON.stringify(d).slice(0, 120)
  }
}

export default {
  name: 'ActionPreview',
  props: {
    action:  { type: Object,  required: true },
    index:   { type: Number,  default: 0 },
    total:   { type: Number,  default: 1 },
    applying:{ type: Boolean, default: false },
  },
  emits: ['confirm', 'cancel'],
  setup(props) {
    const showJson = ref(false)
    return {
      showJson, t,
      icon:    ACTION_ICONS[props.action.action]  || '⚡',
      label:   ACTION_KEYS[props.action.action]   || props.action.action,
      summary: buildSummary(props.action),
    }
  },
  template: `
    <div class="action-preview">
      <div class="action-preview__header">
        <span class="action-preview__icon">{{ icon }}</span>
        <div class="action-preview__type-wrap">
          <span class="action-preview__type">{{ t(label) }}</span>
          <span v-if="total > 1" class="action-preview__counter">({{ index+1 }}/{{ total }})</span>
        </div>
      </div>
      <p class="action-preview__explanation">{{ action.explanation }}</p>
      <p class="action-preview__summary">{{ summary }}</p>
      <button class="action-preview__toggle" @click="showJson = !showJson">
        {{ showJson ? '▲ Masquer JSON' : '▼ Détails JSON' }}
      </button>
      <pre v-if="showJson" class="action-preview__json">{{ JSON.stringify(action.data, null, 2) }}</pre>
      <div class="action-preview__actions">
        <button class="btn btn--secondary" :disabled="applying" @click="$emit('cancel')">
          {{ t('coach.action_cancel') }}
        </button>
        <button class="btn btn--primary" :disabled="applying" @click="$emit('confirm')">
          {{ applying ? '…' : t('coach.action_apply') }}
        </button>
      </div>
    </div>
  `
}
