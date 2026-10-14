import { t } from '../../i18n.js'
let nextDraftId = 0
export function createDraftItem(values) { return { id: --nextDraftId, ...values } }
export default {
  name: 'DumbbellRows',
  props: {
    category: { type: String, required: true }, items: { type: Array, required: true },
    quantityKey: { type: String, required: true }, weightKey: { type: String, required: true },
    mode: { type: String, default: 'weight' }, saving: { type: Boolean, default: false },
  },
  emits: ['changed'],
  setup(props, { emit }) {
    function addRow() {
      emit('changed', [...props.items, createDraftItem({category:props.category,
        name:t('equipment.category_' + props.category),count:'',weight_kg:'',
        resistance_min_kg:'',resistance_max_kg:'',weight_min_kg:'',weight_max_kg:'',weight_step_kg:''})])
    }
    function remove(row) { emit('changed', props.items.filter(item=>item.id!==row.id)) }
    return { t, addRow, remove }
  },
  template: `
    <div class="dumbbell-rows" :data-category="category" role="group" :aria-label="t('equipment.category_' + category)">
      <div class="dumbbell-rows__columns" aria-hidden="true">
        <span>{{ t(quantityKey) }}</span><span>{{ t(weightKey) }}</span><span></span>
      </div>
      <div v-for="(row, index) in items" :key="row.id" class="dumbbell-row">
        <input class="form-input" type="number" min="1" step="1" required v-model.number="row.count"
          :aria-label="t(quantityKey) + ' — ' + t('equipment.inventory_row', { number: index + 1 })" :disabled="saving" />
        <div v-if="mode === 'band'" class="inventory-range">
          <input class="form-input" type="number" min="0.01" step="any" required v-model.number="row.resistance_min_kg" :disabled="saving" :aria-label="t('equipment.resistance_min_kg')" />
          <span>→</span>
          <input class="form-input" type="number" min="0.01" step="any" required v-model.number="row.resistance_max_kg" :disabled="saving" :aria-label="t('equipment.resistance_max_kg')" />
        </div>
        <div v-else-if="mode === 'adjustable'" class="inventory-range inventory-range--adjustable">
          <input class="form-input" type="number" min="0.01" step="any" required v-model.number="row.weight_min_kg" :disabled="saving" :aria-label="t('equipment.weight_min_kg')" />
          <span>→</span>
          <input class="form-input" type="number" min="0.01" step="any" required v-model.number="row.weight_max_kg" :disabled="saving" :aria-label="t('equipment.weight_max_kg')" />
          <input class="form-input" type="number" min="0.01" step="any" required v-model.number="row.weight_step_kg" :disabled="saving" :aria-label="t('equipment.weight_step_kg')" :title="t('equipment.weight_step_kg')" />
        </div>
        <input v-else class="form-input" type="number" min="0.01" step="any" required v-model.number="row.weight_kg"
          :aria-label="t(weightKey) + ' — ' + t('equipment.inventory_row', { number: index + 1 })" :disabled="saving" />
        <div class="dumbbell-row__actions">
          <button type="button" class="icon-btn icon-btn--danger" :disabled="saving" @click="remove(row)"
            :aria-label="t('common.delete') + ' — ' + t('equipment.inventory_row', { number: index + 1 })">×</button>
        </div>
      </div>
      <button type="button" class="btn btn--secondary dumbbell-rows__add" :disabled="saving" @click="addRow()">+ {{ t('equipment.inventory_add_row') }}</button>
    </div>
  `,
}
