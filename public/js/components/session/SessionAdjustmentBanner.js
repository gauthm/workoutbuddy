import { ref } from '/vendor/vue.esm-browser.prod.js'
import { t }   from '../../i18n.js'

const ICONS = {
  increase:   '📈',
  decrease:   '📉',
  first_time: '🤖',
}

export default {
  name: 'SessionAdjustmentBanner',
  props: {
    adjustments: { type: Array, default: () => [] },
  },
  emits: ['dismiss'],

  setup() {
    const expanded = ref(false)
    return { expanded, t, ICONS }
  },

  template: `
    <div v-if="adjustments.length" class="adjustment-banner">
      <!-- En-tête cliquable -->
      <div class="adjustment-banner__header" @click="expanded = !expanded">
        <span class="adjustment-banner__icon">🧠</span>
        <span class="adjustment-banner__title">
          {{ t('session.adjustment_title', { n: adjustments.length }) }}
        </span>
        <span class="adjustment-banner__toggle">{{ expanded ? '▲' : '▼' }}</span>
      </div>

      <!-- Détail des ajustements (accordéon) -->
      <div v-if="expanded" class="adjustment-banner__list">
        <div
          v-for="adj in adjustments"
          :key="adj.template_exercise_id"
          class="adjustment-row"
          :class="'adjustment-row--' + adj.change_type">

          <span class="adjustment-row__icon">{{ ICONS[adj.change_type] || '•' }}</span>

          <div class="adjustment-row__info">
            <span class="adjustment-row__name">{{ adj.exercise_name_fr }}</span>
            <span class="adjustment-row__target">
              {{ adj.target_weight_kg > 0 ? adj.target_weight_kg + ' kg' : t('session.adjustment_bodyweight') }}
              × {{ adj.target_reps }} {{ t('session.adjustment_reps') }}
            </span>
            <span class="adjustment-row__reason">{{ adj.explanation }}</span>
          </div>
        </div>
      </div>

      <!-- Fermer -->
      <button class="adjustment-banner__dismiss" @click="$emit('dismiss')">
        {{ t('session.adjustment_dismiss') }}
      </button>
    </div>
  `
}
