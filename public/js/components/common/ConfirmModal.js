import { t } from '../../i18n.js'
import { useDialog } from '../../utils/dialog.js'
export default {
  name: 'ConfirmModal',
  props: {
    title:       { type: String, required: true },
    body:        { type: String, default: '' },
    confirmText: { type: String, default: '' },
    cancelText:  { type: String, default: '' },
    danger:      { type: Boolean, default: false },
    busy:        { type: Boolean, default: false },
  },
  emits: ['confirm', 'cancel'],
  setup(props, { emit }) {
    return {
      t,
      dialogRef: useDialog(() => !props.busy && emit('cancel')),
      onConfirm: () => !props.busy && emit('confirm'),
      onCancel:  () => !props.busy && emit('cancel'),
    }
  },
  template: `
    <div class="modal-overlay" @click.self="onCancel()">
      <div ref="dialogRef" class="modal" role="dialog" aria-modal="true" :aria-label="title" tabindex="-1">
        <div class="modal__heading">
          <h2 class="modal__title">{{ title }}</h2>
          <button class="icon-btn" :aria-label="t('common.close')" :disabled="busy" @click="onCancel()">✕</button>
        </div>
        <p v-if="body" class="modal__body">{{ body }}</p>
        <slot />
        <div class="modal__actions">
          <button class="btn btn--secondary" :disabled="busy" @click="onCancel()">
            {{ cancelText || t('common.cancel') }}
          </button>
          <button
            class="btn"
            :class="danger ? 'btn--danger' : 'btn--primary'"
            :disabled="busy" @click="onConfirm()"
          >
            {{ confirmText || t('common.confirm') }}
          </button>
        </div>
      </div>
    </div>
  `
}
