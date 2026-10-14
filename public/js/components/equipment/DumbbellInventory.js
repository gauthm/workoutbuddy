import { ref } from '/vendor/vue.esm-browser.prod.js'
import { t } from '../../i18n.js'
import DumbbellRows from './DumbbellRows.js'

export const DUMBBELL_CATEGORIES = ['dumbbell_fixed', 'dumbbell_loadable', 'dumbbell_plate']

export default {
  name: 'DumbbellInventory',
  components: { DumbbellRows },
  props: { items: { type: Array, required: true } },
  emits: ['saved', 'deleted'],
  setup(props, { expose }) {
    const fixedRows = ref(null), handleRows = ref(null), plateRows = ref(null)
    expose({ async saveAll() {
      for (const rows of [fixedRows, handleRows, plateRows]) if (!await rows.value.saveAll()) return false
      return true
    } })
    return { t, fixedRows, handleRows, plateRows, itemsFor: category => props.items.filter(item => item.category === category) }
  },
  template: `
    <div class="dumbbell-inventory">
      <section class="dumbbell-section">
        <h2 class="dumbbell-section__title">{{ t('equipment.dumbbells_fixed') }}</h2>
        <DumbbellRows ref="fixedRows" category="dumbbell_fixed" :items="itemsFor('dumbbell_fixed')"
          quantity-key="equipment.inventory_dumbbell_count" weight-key="equipment.inventory_dumbbell_weight"
          @saved="$emit('saved', $event)" @deleted="$emit('deleted', $event)" />
      </section>
      <section class="dumbbell-section">
        <h2 class="dumbbell-section__title">{{ t('equipment.dumbbells_plates') }}</h2>
        <h3 class="dumbbell-section__subtitle">{{ t('equipment.inventory_handles') }}</h3>
        <DumbbellRows ref="handleRows" category="dumbbell_loadable" :items="itemsFor('dumbbell_loadable')"
          quantity-key="equipment.inventory_handle_count" weight-key="equipment.inventory_handle_weight"
          @saved="$emit('saved', $event)" @deleted="$emit('deleted', $event)" />
        <h3 class="dumbbell-section__subtitle">{{ t('equipment.inventory_plates') }}</h3>
        <DumbbellRows ref="plateRows" category="dumbbell_plate" :items="itemsFor('dumbbell_plate')"
          quantity-key="equipment.inventory_plate_count" weight-key="equipment.inventory_plate_weight"
          @saved="$emit('saved', $event)" @deleted="$emit('deleted', $event)" />
      </section>
    </div>
  `,
}
