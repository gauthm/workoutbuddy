import { t } from '../../i18n.js'
export default {
  name: 'ConfirmModal',
  props: {
    title:       { type: String, required: true },
    body:        { type: String, default: '' },
    confirmText: { type: String, default: '' },
    cancelText:  { type: String, default: '' },
    danger:      { type: Boolean, default: false },
  },
  emits: ['confirm', 'cancel'],
  setup(props, { emit }) {
    return {
      t,
      onConfirm: () => emit('confirm'),
      onCancel:  () => emit('cancel'),
    }
  },
  template: `
    <div class="modal-overlay" @click.self="onCancel()">
      <div class="modal" role="dialog" :aria-label="title">
        <h2 class="modal__title">{{ title }}</h2>
        <p v-if="body" class="modal__body">{{ body }}</p>
        <slot />
        <div class="modal__actions">
          <button class="btn btn--secondary" @click="onCancel()">
            {{ cancelText || t('common.cancel') }}
          </button>
          <button
            class="btn"
            :class="danger ? 'btn--danger' : 'btn--primary'"
            @click="onConfirm()"
          >
            {{ confirmText || t('common.confirm') }}
          </button>
        </div>
      </div>
    </div>
  `
}
