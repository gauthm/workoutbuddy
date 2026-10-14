import { t } from '../../i18n.js'
import { useDialog } from '../../utils/dialog.js'

export default {
  name: 'ModalDialog',
  props: { title: { type: String, required: true } },
  emits: ['close'],
  setup(_, { emit }) {
    return { t, dialogRef: useDialog(() => emit('close')) }
  },
  template: `
    <div class="modal-overlay" @click.self="$emit('close')">
      <div ref="dialogRef" class="modal" role="dialog" aria-modal="true" :aria-label="title" tabindex="-1">
        <div class="modal__heading">
          <h2 class="modal__title">{{ title }}</h2>
          <button class="icon-btn" :aria-label="t('common.close')" @click="$emit('close')">✕</button>
        </div>
        <slot />
      </div>
    </div>
  `
}
