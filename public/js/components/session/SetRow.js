import { reactive, inject, computed, watch } from '/vendor/vue.esm-browser.prod.js'
import { sets as api } from '../../api.js'
import { estimate10RM } from '../../utils/rm.js'
import { t } from '../../i18n.js'

export default {
  name: 'SetRow',
  props: {
    set: { type: Object, required: true }, sessionExerciseId: { type: Number, required: true },
    targetWeight: { type: Number, default: 0 }, targetReps: { type: Number, default: 8 },
    displayNumber: { type: Number, default: null },
    setNumber: { type: Number, required: true }, isNew: { type: Boolean, default: false },
    restSeconds: { type: Number, default: 90 }, rmApplicable: { type: Boolean, default: true },
    isWarmup: { type: Boolean, default: false }, isCurrent: { type: Boolean, default: false },
  },
  emits: ['validated', 'reverted', 'rest-start', 'saving-change'],
  setup(props, { emit }) {
    const store = inject('store')
    const local = reactive({weight_kg: props.set.weight_kg ?? props.targetWeight,
      reps: props.set.reps ?? props.targetReps, rpe: props.set.rpe ?? '', saving: false, touched: false})
    const done = computed(() => !!props.set.is_completed && !props.isNew)
    const dirty = computed(() => Number(local.weight_kg) !== Number(props.set.weight_kg)
      || Number(local.reps) !== Number(props.set.reps) || (local.rpe === '' ? null : Number(local.rpe)) !== (props.set.rpe ?? null))
    watch(() => [props.targetWeight, props.targetReps], ([weight,reps]) => {
      if (props.isNew && !local.touched) {local.weight_kg = weight; local.reps = reps}
    })
    async function validate() {
      if (local.saving || (done.value && !dirty.value)) return
      const weight = Number(local.weight_kg), reps = Number(local.reps)
      const rpe = local.rpe === '' ? null : Number(local.rpe)
      if (String(local.weight_kg).trim() === '' || !Number.isFinite(weight) || weight < 0
        || !Number.isInteger(reps) || reps < 1 || (rpe !== null && (!Number.isFinite(rpe) || rpe < 6 || rpe > 10))) {
        store.showToast(t('session.invalid_set'), 'error'); return
      }
      const wasDone = done.value
      local.saving = true
      emit('saving-change',true)
      try {
        const body = {weight_kg: weight, reps, rpe, is_completed: true}
        const result = props.isNew
          ? await api.create(props.sessionExerciseId, {...body, set_number: props.setNumber, is_warmup: props.isWarmup})
          : await api.update(props.set.id, body)
        if (result._new_pr) store.showToast(t('session.pr_toast', {weight: result.weight_kg, reps: result.reps, rm: result._estimated_1rm}), 'success', 5000)
        emit('validated', result)
        if (!wasDone) emit('rest-start', {seconds: props.isWarmup ? Math.min(props.restSeconds,60) : props.restSeconds, setId: result.id})
      } catch (error) { store.showToast(error.message === 'SET_NUMBER_EXISTS' ? t('session.set_conflict') : error.detail || error.message, 'error') }
      finally {local.saving = false;emit('saving-change',false)}
    }
    async function revert() {
      if (local.saving || !done.value) return
      local.saving=true
      emit('saving-change',true)
      try {
        const result=await api.update(props.set.id,{is_completed:false})
        emit('reverted',result)
      } catch(error) {store.showToast(error.detail || error.message,'error')}
      finally {local.saving=false;emit('saving-change',false)}
    }
    const tenRM = computed(() => {
      if (!props.rmApplicable) return null
      const value=estimate10RM(Number(local.weight_kg),Number(local.reps),store.getSetting('rm_formula','epley'))
      return value > 0 ? value : null
    })
    return {local, done, dirty, validate, revert, tenRM, t, showRpe: () => store.getSetting('show_rpe_field', false)}
  },
  template: `
    <form class="set-row" :class="{'set-row--done': done && !dirty, 'set-row--current': isCurrent && !done, 'set-row--rpe': showRpe(), 'set-row--warmup': isWarmup}" @submit.prevent="validate()">
      <span class="set-row__num" :title="isWarmup ? t('session.warmup') : t('session.col_set')">{{ isWarmup ? t('session.warmup_short') : (displayNumber ?? setNumber) }}</span>
      <input class="set-row__input" type="number" inputmode="decimal" step="any" min="0" required
        :aria-label="t('session.set_weight', {n:displayNumber ?? setNumber})" v-model.number="local.weight_kg" :disabled="local.saving" @input="local.touched = true" />
      <input class="set-row__input set-row__input--reps" type="number" inputmode="numeric" step="1" min="1" required
        :aria-label="t('session.set_reps', {n:displayNumber ?? setNumber})" v-model.number="local.reps" :disabled="local.saving" @input="local.touched = true" />
      <output class="set-row__10rm" :title="t('session.10rm_hint')"
        :aria-label="t('session.set_10rm', {n:displayNumber ?? setNumber, value:tenRM ?? '—'})">{{ tenRM ?? '—' }}</output>
      <button :type="done && !dirty ? 'button' : 'submit'" class="set-row__btn" :class="{'set-row__btn--done':done && !dirty}" :disabled="local.saving"
        @click="done && !dirty ? revert() : undefined"
        :aria-label="done && !dirty ? t('session.undo_set', {n:displayNumber ?? setNumber}) : done ? t('session.save_set', {n:displayNumber ?? setNumber}) : t('session.validate_set', {n:displayNumber ?? setNumber})"
        :title="done && !dirty ? t('session.undo_set', {n:displayNumber ?? setNumber}) : t('session.validate_set', {n:displayNumber ?? setNumber})">{{local.saving ? '…' : '✓'}}</button>
      <label v-if="showRpe()" class="set-row__effort">
        <span>{{ t('session.rpe_label') }}</span>
        <input class="set-row__input set-row__input--rpe" type="number" step="0.5" min="6" max="10" :aria-label="t('session.set_rpe', {n:displayNumber ?? setNumber})"
          v-model.number="local.rpe" :disabled="local.saving" />
      </label>
    </form>
  `,
}
