import { ref, inject } from '/vendor/vue.esm-browser.prod.js'
import { coach as api } from '../../api.js'
import { t } from '../../i18n.js'
import ConfirmModal from '../common/ConfirmModal.js'

const SIGNAL_ICONS = {
  equipment_limit_approaching: '⏳',
  max_load_reached:        '🏋️',
  min_increment_too_large: '📏',
  no_exercise_available:   '❌',
  no_rotation_possible:    '🔄',
  persistent_plateau:      '📉',
  high_fatigue:            '😴',
}

export default {
  name: 'AdviceCard',
  props: { advice: { type: Object, required: true } },
  emits: ['dismissed', 'purchased'],
  components: { ConfirmModal },
  setup(props, { emit }) {
    const store  = inject('store')
    const router = inject('router')
    const showInventoryConfirm = ref(false)

    async function dismiss() {
      try {
        await api.dismissAdvice(props.advice.id)
        emit('dismissed', props.advice.id)
        store.showToast(t('coach.advice_dismiss') + ' ✓', 'info')
      } catch (err) { store.showToast(err.message, 'error') }
    }

    async function markPurchased() {
      try {
        await api.purchasedAdvice(props.advice.id)
        emit('purchased', props.advice.id)
        showInventoryConfirm.value = true
      } catch (err) { store.showToast(err.message, 'error') }
    }

    return {
      dismiss, markPurchased, showInventoryConfirm,
      icon: SIGNAL_ICONS[props.advice.signal_type] || '⚠️',
      goToEquipment: () => { showInventoryConfirm.value = false; router.push('#/exercises/material') },
      t,
      fallback: () => { const d = props.advice.signal_data || {}; const data = typeof d === 'string' ? JSON.parse(d) : d;
        const key = props.advice.signal_type === 'equipment_limit_approaching' ? (data.resistance_is_approximate ? 'coach.band_forecast' : 'coach.limit_forecast') : props.advice.signal_type === 'max_load_reached' ? (data.resistance_is_approximate ? 'coach.band_forecast' : 'coach.limit_reached') : null;
        return key ? t(key, {exercise: data.exercise_name_fr, max: data.max_load_kg, sessions: data.estimated_sessions}) : t('coach.advice_generating') },
    }
  },
  template: `
    <div class="advice-card">
      <div class="advice-card__header">
        <span class="advice-card__icon">{{ icon }}</span>
        <span class="advice-card__label">{{ t('coach.advice_label') }}</span>
      </div>
      <div class="advice-card__body">
        <p v-if="advice.advice_text" class="advice-card__text">{{ advice.advice_text }}</p>
        <p v-else class="advice-card__text advice-card__text--muted">{{ fallback() }}</p>
      </div>
      <div class="advice-card__actions">
        <button class="btn btn--secondary advice-card__btn" @click="dismiss()">{{ t('coach.advice_dismiss') }}</button>
        <button class="btn btn--primary advice-card__btn" @click="markPurchased()">{{ t('coach.advice_purchased') }}</button>
      </div>
      <ConfirmModal v-if="showInventoryConfirm"
        :title="t('coach.update_inventory')"
        :body="t('coach.inventory_question')"
        @confirm="goToEquipment()" @cancel="showInventoryConfirm = false" />
    </div>
  `
}
