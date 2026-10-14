import { ref, nextTick, onMounted, onBeforeUnmount } from '/vendor/vue.esm-browser.prod.js'
import { t } from '../../i18n.js'

export default {
  name: 'AITooltip',
  props: {
    text:    { type: String,  required: true },   // texte de la bulle
    isFirst: { type: Boolean, default: false },   // premier essai (style différent)
  },
  setup() {
    const visible = ref(false)
    const buttonRef = ref(null)
    const bubbleRef = ref(null)
    const position = ref({})
    function close() { visible.value = false }
    async function toggle() {
      visible.value = !visible.value
      if (!visible.value) return
      await nextTick()
      const button = buttonRef.value.getBoundingClientRect()
      const bubble = bubbleRef.value.getBoundingClientRect()
      const left = Math.max(8, Math.min(button.left + button.width / 2 - bubble.width / 2, window.innerWidth - bubble.width - 8))
      const above = button.top - bubble.height - 8
      const top = above >= 8 ? above : Math.max(8, Math.min(button.bottom + 8, window.innerHeight - bubble.height - 8))
      position.value = { left: `${left}px`, top: `${top}px` }
    }
    function onKeydown(event) { if (event.key === 'Escape') close() }
    function onPointerdown(event) {
      if (!buttonRef.value?.contains(event.target) && !bubbleRef.value?.contains(event.target)) close()
    }
    onMounted(() => {
      window.addEventListener('resize', close)
      document.addEventListener('keydown', onKeydown)
      document.addEventListener('pointerdown', onPointerdown)
    })
    onBeforeUnmount(() => {
      window.removeEventListener('resize', close)
      document.removeEventListener('keydown', onKeydown)
      document.removeEventListener('pointerdown', onPointerdown)
    })
    return { visible, buttonRef, bubbleRef, position, toggle, t }
  },
  template: `
    <div class="ai-tooltip-wrap">
      <button
        ref="buttonRef"
        class="ai-tooltip-btn"
        :class="{ 'ai-tooltip-btn--first': isFirst }"
        @click.stop="toggle()"
        :aria-expanded="visible"
        :title="isFirst ? t('session.tooltip_first') : t('session.tooltip_progress')" :aria-label="isFirst ? t('session.tooltip_first') : t('session.tooltip_progress')">
        {{ isFirst ? '🤖' : 'ℹ️' }}
      </button>
      <Teleport to="body">
      <div v-if="visible" ref="bubbleRef" class="ai-tooltip-bubble" :style="position" role="note" @click.stop>
        <p class="ai-tooltip-bubble__text">{{ text }}</p>
        <button class="ai-tooltip-bubble__close" :aria-label="t('common.close')" @click="visible = false">✕</button>
      </div>
      </Teleport>
    </div>
  `
}
