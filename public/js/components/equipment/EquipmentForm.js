import { reactive, watch, inject } from '/vendor/vue.esm-browser.prod.js'
import { equipment as api } from '../../api.js'
import { t } from '../../i18n.js'
import { ALL_EQUIPMENT_CATEGORIES } from './inventoryCatalog.js'

const CATEGORIES = ALL_EQUIPMENT_CATEGORIES

export default {
  name: 'EquipmentForm',
  props: {
    draft: { type: Boolean, default: false },
    custom: { type: Boolean, default: false },
    item: { type: Object, default: null }  // null = create, object = edit
  },
  emits: ['saved','cancel'],

  setup(props, { emit }) {
    const store = inject('store')

    const blank = () => ({
      category: props.custom ? 'other' : 'barbell', name: '', weight_kg: '',
      count: 1, weight_min_kg: '', weight_max_kg: '',
      weight_step_kg: '', resistance_min_kg: '', resistance_max_kg: '', notes: ''
    })

    const form = reactive(props.item ? {
      category:          props.item.category,
      name:              props.item.name,
      weight_kg:         props.item.weight_kg ?? '',
      count:             props.item.count ?? 1,
      weight_min_kg:     props.item.weight_min_kg ?? '',
      weight_max_kg:     props.item.weight_max_kg ?? '',
      weight_step_kg:    props.item.weight_step_kg ?? '',
      resistance_min_kg: props.item.resistance_min_kg ?? '',
      resistance_max_kg: props.item.resistance_max_kg ?? '',
      notes:             props.item.notes ?? '',
    } : blank())

    const saving = reactive({ value: false })

    async function save() {
      if (!form.name.trim()) {
        store.showToast(t('equipment.name_required'), 'error')
        return
      }

      // Validate even count for plate and dumbbell_plate
      if (['plate'].includes(form.category)) {
        const n = parseInt(form.count) || 0
        if (n < 2 || n % 2 !== 0) {
          store.showToast(t('equipment.plate_count_even_error'), 'error')
          return
        }
      }


      // Validate adjustable dumbbell
      if (form.category === 'dumbbell_adjustable') {
        if (!form.weight_min_kg || !form.weight_max_kg || !form.weight_step_kg) {
          store.showToast(t('equipment.adjustable_fields_error'), 'error')
          return
        }
        if (parseFloat(form.weight_min_kg) >= parseFloat(form.weight_max_kg)) {
          store.showToast(t('equipment.weight_range_error'), 'error')
          return
        }
      }

      saving.value = true
      try {
        // Normalize empty fields → null
        const body = {}
        for (const [k, v] of Object.entries(form)) {
          body[k] = (v === '' ? null : v)
        }
        const item = props.draft ? { ...body, ...(props.item ? {id:props.item.id} : {}) } : props.item ? await api.update(props.item.id, body) : await api.create(body)
        emit('saved', item)
      } catch (err) {
        store.showToast(err.message, 'error')
      } finally {
        saving.value = false
      }
    }

    // Show fields according to the category
    const showWeight       = () => ['barbell','ez_bar','dumbbell_loadable','kettlebell'].includes(form.category)
    const showCount        = () => ['plate','kettlebell','dumbbell_loadable'].includes(form.category)
    const countMustBePair  = () => ['plate'].includes(form.category)
    const showAdjustable   = () => form.category === 'dumbbell_adjustable'
    const showResistance   = () => form.category === 'resistance_band'
    const showNoNumericFields = () =>
      ['bench','bench_adjustable','rack','pullup_bar','roman_chair', 'dip_station', 'gym_mat', 'ab_wheel', 'leg_press', 'leg_extension', 'leg_curl', 'lat_pulldown', 'seated_row', 'chest_press', 'shoulder_press', 'pec_deck', 'treadmill', 'stationary_bike', 'elliptical', 'rowing_machine','smith_machine','other'].includes(form.category)

    return {
      form, saving, save, t,
      CATEGORIES,
      showWeight, showCount, countMustBePair,
      showAdjustable, showResistance, showNoNumericFields,
      isEdit: !!props.item,
    }
  },

  template: `
    <form @submit.prevent="save">
      <div v-if="!custom" class="form-group">
        <label class="form-label" for="EquipmentForm-form-category">{{ t('equipment.category') }}</label>
        <select id="EquipmentForm-form-category" class="form-select" v-model="form.category">
          <option v-for="c in CATEGORIES" :key="c" :value="c">{{ t('equipment.category_' + c) }}</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label" for="EquipmentForm-form-name">{{ t('equipment.name') }}</label>
        <input id="EquipmentForm-form-name" class="form-input" v-model="form.name" required />
      </div>

      <!-- Weight -->
      <div v-if="showWeight()" class="form-group">
        <label class="form-label">
          {{ t('equipment.weight_kg') }}
          <span v-if="form.category === 'dumbbell_loadable'"
            style="font-size:0.75rem;color:var(--color-text-muted)">
            — {{ t('equipment.handle_weight_hint') }}
          </span>
        </label>
        <input class="form-input" type="number" step="0.5" min="0"
          v-model="form.weight_kg" placeholder="ex: 2.0" />
      </div>

      <!-- Standard quantity -->
      <div v-if="showCount()" class="form-group">
        <label class="form-label">
          {{ t('equipment.count_total') }}
          <span v-if="countMustBePair()"
            style="font-size:0.75rem;color:var(--color-text-muted)">
            — {{ t('equipment.count_pair_hint') }}
          </span>
        </label>
        <input class="form-input" type="number"
          :min="countMustBePair() ? 2 : 1"
          :step="countMustBePair() ? 2 : 1"
          v-model="form.count" />
      </div>

      <!-- Adjustable dumbbell -->
      <template v-if="showAdjustable()">
        <div class="form-group">
          <label class="form-label" for="EquipmentForm-form-weight_min_kg">{{ t('equipment.weight_min_kg') }}</label>
          <input id="EquipmentForm-form-weight_min_kg" class="form-input" type="number" step="0.5" min="0" v-model="form.weight_min_kg" />
        </div>
        <div class="form-group">
          <label class="form-label" for="EquipmentForm-form-weight_max_kg">{{ t('equipment.weight_max_kg') }}</label>
          <input id="EquipmentForm-form-weight_max_kg" class="form-input" type="number" step="0.5" min="0" v-model="form.weight_max_kg" />
        </div>
        <div class="form-group">
          <label class="form-label" for="EquipmentForm-form-weight_step_kg">{{ t('equipment.weight_step_kg') }}</label>
          <input id="EquipmentForm-form-weight_step_kg" class="form-input" type="number" step="0.5" min="0.5"
            v-model="form.weight_step_kg" placeholder="ex: 2.5" />
        </div>
      </template>

      <!-- Resistance band -->
      <template v-if="showResistance()">
        <div class="form-group">
          <label class="form-label" for="EquipmentForm-form-resistance_min_kg">{{ t('equipment.resistance_min_kg') }}</label>
          <input id="EquipmentForm-form-resistance_min_kg" class="form-input" type="number" step="0.5" min="0" v-model="form.resistance_min_kg" />
        </div>
        <div class="form-group">
          <label class="form-label" for="EquipmentForm-form-resistance_max_kg">{{ t('equipment.resistance_max_kg') }}</label>
          <input id="EquipmentForm-form-resistance_max_kg" class="form-input" type="number" step="0.5" min="0" v-model="form.resistance_max_kg" />
        </div>
      </template>

      <!-- Bench, rack, etc.: show explanatory text -->
      <div v-if="!custom && showNoNumericFields()" class="form-group">
        <p style="font-size:0.85rem;color:var(--color-text-muted)">
          <template v-if="form.category === 'bench_adjustable'">
            ✅ {{ t('equipment.bench_adjustable_hint') }}
          </template>
          <template v-else>
            {{ t('equipment.no_numeric_fields_hint') }}
          </template>
        </p>
      </div>

      <div class="modal__actions">
        <button type="button" class="btn btn--secondary" @click="$emit('cancel')">
          {{ t('common.cancel') }}
        </button>
        <button type="submit" class="btn btn--primary" :disabled="saving.value">
          {{ saving.value ? t('common.loading') : t('common.save') }}
        </button>
      </div>
    </form>
  `
}
