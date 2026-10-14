import { t } from '../../i18n.js'
import DumbbellRows from './DumbbellRows.js'

export const DUMBBELL_CATEGORIES = ['dumbbell_fixed', 'dumbbell_loadable', 'dumbbell_plate']

export default {
  name: 'DumbbellInventory',
  components: { DumbbellRows },
  props: { items: { type: Array, required: true }, saving: { type: Boolean, default: false } },
  emits: ['changed'],
  setup(props) {
    return { t, itemsFor: category => props.items.filter(item => item.category === category) }
  },
  template: `
    <div class="dumbbell-inventory">
      <section class="dumbbell-section">
        <h2 class="dumbbell-section__title">{{ t('equipment.dumbbells_fixed') }}</h2>
        <DumbbellRows category="dumbbell_fixed" :items="itemsFor('dumbbell_fixed')"
          quantity-key="equipment.inventory_dumbbell_count" weight-key="equipment.inventory_dumbbell_weight"
          :saving="saving" @changed="$emit('changed', {category:'dumbbell_fixed',items:$event})" />
      </section>
      <section class="dumbbell-section">
        <h2 class="dumbbell-section__title">{{ t('equipment.dumbbells_plates') }}</h2>
        <h3 class="dumbbell-section__subtitle">{{ t('equipment.inventory_handles') }}</h3>
        <DumbbellRows category="dumbbell_loadable" :items="itemsFor('dumbbell_loadable')"
          quantity-key="equipment.inventory_handle_count" weight-key="equipment.inventory_handle_weight"
          :saving="saving" @changed="$emit('changed', {category:'dumbbell_loadable',items:$event})" />
        <h3 class="dumbbell-section__subtitle">{{ t('equipment.inventory_plates') }}</h3>
        <DumbbellRows category="dumbbell_plate" :items="itemsFor('dumbbell_plate')"
          quantity-key="equipment.inventory_plate_count" weight-key="equipment.inventory_plate_weight"
          :saving="saving" @changed="$emit('changed', {category:'dumbbell_plate',items:$event})" />
      </section>
    </div>
  `,
}
