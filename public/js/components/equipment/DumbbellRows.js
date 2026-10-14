import { reactive, watch, inject } from '/vendor/vue.esm-browser.prod.js'
import { equipment as api } from '../../api.js'
import { t } from '../../i18n.js'
import ConfirmModal from '../common/ConfirmModal.js'

export default {
  name: 'DumbbellRows',
  components: { ConfirmModal },
  props: {
    category: { type: String, required: true },
    items: { type: Array, required: true },
    quantityKey: { type: String, required: true },
    weightKey: { type: String, required: true },
    mode: { type: String, default: 'weight' },
  },
  emits: ['saved', 'deleted'],
  setup(props, { emit, expose }) {
    const store = inject('store')
    const state = reactive({ rows: [], deleteTarget: null, deleting: false })
    let nextKey = 0
    const makeRow = item => ({ key: `row-${++nextKey}`, id: item?.id ?? null,
      name: item?.name ?? '', count: item?.count ?? '', weight_kg: item?.weight_kg ?? '',
      resistance_min_kg: item?.resistance_min_kg ?? '', resistance_max_kg: item?.resistance_max_kg ?? '',
      weight_min_kg: item?.weight_min_kg ?? '', weight_max_kg: item?.weight_max_kg ?? '', weight_step_kg: item?.weight_step_kg ?? '',
      original: item ? JSON.stringify(values(item)) : null,
      saving: false })
    function values(row) {
      const keys = props.mode === 'band' ? ['count','resistance_min_kg','resistance_max_kg'] : props.mode === 'adjustable' ? ['count','weight_min_kg','weight_max_kg','weight_step_kg'] : ['count','weight_kg']
      return Object.fromEntries(keys.map(key => [key, row[key] === '' ? null : Number(row[key])]))
    }
    const dirty = row => row.id === null || JSON.stringify(values(row)) !== row.original
    watch(() => props.items, items => {
      const existing = new Map(state.rows.filter(row => row.id !== null).map(row => [row.id, row]))
      const drafts = state.rows.filter(row => row.id === null)
      state.rows = [...items.map(item => existing.get(item.id) || makeRow(item)), ...drafts]

    }, { immediate: true })
    function addRow() { state.rows.push(makeRow()) }
    async function save(row) {
      if (row.saving) return
      const body = values(row), count = body.count
      const numeric = Object.values(body)
      const invalidRange = props.mode === 'band' ? body.resistance_min_kg >= body.resistance_max_kg : props.mode === 'adjustable' ? body.weight_min_kg >= body.weight_max_kg : false
      if (!Number.isInteger(count) || count < 1 || numeric.some(v => !Number.isFinite(v) || v <= 0) || invalidRange || (props.category === 'plate' && count % 2)) {
        store.showToast(t('equipment.inventory_invalid'), 'error')
        return false
      }
      row.saving = true
      try {
        const item = row.id === null
          ? await api.create({ ...body, category: props.category, name: t('equipment.category_' + props.category) })
          : await api.update(row.id, body)
        row.id = item.id
        row.count = item.count
        for (const key of Object.keys(body)) row[key] = item[key]
        row.original = JSON.stringify(values(item))
        emit('saved', item)
        store.showToast(t('equipment.inventory_saved'), 'success')
        return true
      } catch (error) { store.showToast(error.detail || error.message, 'error'); return false }
      finally { row.saving = false }
    }
    function remove(row) {
      if (row.saving) return
      if (row.id === null) state.rows = state.rows.filter(item => item.key !== row.key)
      else state.deleteTarget = row
    }
    async function confirmDelete() {
      if (state.deleting || !state.deleteTarget) return
      const row = state.deleteTarget
      state.deleting = true
      try {
        await api.delete(row.id)
        state.rows = state.rows.filter(item => item.key !== row.key)
        emit('deleted', row.id)
        state.deleteTarget = null
        store.showToast(t('equipment.inventory_deleted'), 'success')
      } catch (error) { store.showToast(error.message, 'error') }
      finally { state.deleting = false }
    }
    expose({ async saveAll() {
      for (const row of state.rows) {
        if (row.id === null && Object.entries(values(row)).filter(([key]) => key !== 'count').every(([,v]) => v === null)) continue
        if (dirty(row) && !await save(row)) return false
      }
      return true
    } })
    return { state, t, addRow, save, remove, dirty, confirmDelete }
  },
  template: `
    <div class="dumbbell-rows" :data-category="category" role="group" :aria-label="t('equipment.category_' + category)">
      <div class="dumbbell-rows__columns" aria-hidden="true">
        <span>{{ t(quantityKey) }}</span><span>{{ t(weightKey) }}</span><span></span>
      </div>
      <form v-for="(row, index) in state.rows" :key="row.key" class="dumbbell-row" @submit.prevent="save(row)">
        <input class="form-input" type="number" min="1" step="1" required v-model.number="row.count"
          :aria-label="t(quantityKey) + ' — ' + t('equipment.inventory_row', { number: index + 1 })" :disabled="row.saving" />
        <div v-if="mode === 'band'" class="inventory-range">
          <input class="form-input" type="number" min="0.01" step="any" required v-model.number="row.resistance_min_kg" :disabled="row.saving" :aria-label="t('equipment.resistance_min_kg')" />
          <span>→</span>
          <input class="form-input" type="number" min="0.01" step="any" required v-model.number="row.resistance_max_kg" :disabled="row.saving" :aria-label="t('equipment.resistance_max_kg')" />
        </div>
        <div v-else-if="mode === 'adjustable'" class="inventory-range inventory-range--adjustable">
          <input class="form-input" type="number" min="0.01" step="any" required v-model.number="row.weight_min_kg" :disabled="row.saving" :aria-label="t('equipment.weight_min_kg')" />
          <span>→</span>
          <input class="form-input" type="number" min="0.01" step="any" required v-model.number="row.weight_max_kg" :disabled="row.saving" :aria-label="t('equipment.weight_max_kg')" />
          <input class="form-input" type="number" min="0.01" step="any" required v-model.number="row.weight_step_kg" :disabled="row.saving" :aria-label="t('equipment.weight_step_kg')" :title="t('equipment.weight_step_kg')" />
        </div>
        <input v-else class="form-input" type="number" min="0.01" step="any" required v-model.number="row.weight_kg"
          :aria-label="t(weightKey) + ' — ' + t('equipment.inventory_row', { number: index + 1 })" :disabled="row.saving" />
        <div class="dumbbell-row__actions">
          <button type="submit" class="icon-btn dumbbell-row__save" :disabled="row.saving || !dirty(row)"
            :aria-label="t('common.save') + ' — ' + t('equipment.inventory_row', { number: index + 1 })">{{ row.saving ? '…' : '✓' }}</button>
          <button type="button" class="icon-btn icon-btn--danger" :disabled="row.saving || state.deleting" @click="remove(row)"
            :aria-label="t('common.delete') + ' — ' + t('equipment.inventory_row', { number: index + 1 })">×</button>
        </div>
      </form>
      <button type="button" class="btn btn--secondary dumbbell-rows__add" @click="addRow()">+ {{ t('equipment.inventory_add_row') }}</button>
      <ConfirmModal v-if="state.deleteTarget" :title="t('equipment.delete_confirm')"
        :body="t('equipment.inventory_delete_description', { count: state.deleteTarget.count, weight: state.deleteTarget.weight_kg ?? state.deleteTarget.resistance_max_kg ?? state.deleteTarget.weight_max_kg })"
        :danger="true" :confirm-text="t('common.delete')" @confirm="confirmDelete()" @cancel="state.deleteTarget = null" />
    </div>
  `,
}
