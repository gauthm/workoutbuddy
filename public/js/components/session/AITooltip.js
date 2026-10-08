import { ref } from '/vendor/vue.esm-browser.prod.js'
import { t } from '../../i18n.js'

export default {
  name: 'AITooltip',
  props: {
    text:    { type: String,  required: true },   // texte de la bulle
    isFirst: { type: Boolean, default: false },   // premier essai (style différent)
  },
  setup() {
    const visible = ref(false)
    return { visible, t }
  },
  template: `
    <div class="ai-tooltip-wrap">
      <button
        class="ai-tooltip-btn"
        :class="{ 'ai-tooltip-btn--first': isFirst }"
        @click.stop="visible = !visible"
        :title="isFirst ? t('session.tooltip_first') : t('session.tooltip_progress')">
        {{ isFirst ? '🤖' : 'ℹ️' }}
      </button>
      <div v-if="visible" class="ai-tooltip-bubble" @click.stop>
        <p class="ai-tooltip-bubble__text">{{ text }}</p>
        <button class="ai-tooltip-bubble__close" @click="visible = false">✕</button>
      </div>
    </div>
  `
}
