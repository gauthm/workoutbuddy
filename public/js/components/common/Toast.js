import { t } from '../../i18n.js'

export default {
  name: 'Toast',
  props: {
    toast: { type: Object, required: true }
    // toast: { id, message, type:'success'|'error'|'info'|'warning' }
  },
  emits: ['dismiss'],
  setup() { return { t } },
  template: `
    <div
      class="toast"
      :class="'toast--' + toast.type"
      role="alert"
    >
      <span>{{ toast.message }}</span>
      <button class="toast__dismiss" :aria-label="t('common.close')" @click="$emit('dismiss')">✕</button>
    </div>
  `
}
