import { t } from '../../i18n.js'

export default {
  name: 'EquipmentItemRow',
  props: { item: { type: Object, required: true } },
  emits: ['edit','delete'],
  setup() { return { t } },
  template: `
    <div class="equipment-row">
      <div class="equipment-row__info">
        <span class="equipment-row__name">{{ item.name }}</span>
        <span class="equipment-row__detail">
          <template v-if="item.weight_kg">{{ item.weight_kg }} kg</template>
          <template v-if="item.count > 1"> × {{ item.count }}</template>
          <template v-if="item.weight_min_kg">
            {{ item.weight_min_kg }}–{{ item.weight_max_kg }} kg
            (pas {{ item.weight_step_kg }} kg)
          </template>
        </span>
      </div>
      <div class="equipment-row__actions">
        <button class="icon-btn" @click.stop="$emit('edit')">✏️</button>
        <button class="icon-btn icon-btn--danger" @click.stop="$emit('delete')">🗑</button>
      </div>
    </div>
  `
}
