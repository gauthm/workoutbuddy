import { reactive, watch, inject } from '/vendor/vue.esm-browser.prod.js'
import { equipment as api } from '../../api.js'
import { t } from '../../i18n.js'

const CATEGORIES = [
  'barbell', 'ez_bar',
  'plate', 'dumbbell_plate',
  'dumbbell_fixed', 'dumbbell_adjustable', 'dumbbell_loadable',
  'kettlebell',
  'resistance_band',
  'bench', 'bench_adjustable',
  'rack', 'pullup_bar', 'cable_machine', 'smith_machine', 'other',
]

const CATEGORY_LABELS = {
  barbell:             'Barre droite',
  ez_bar:              'Barre EZ',
  plate:               'Disque (compatible barre)',
  dumbbell_plate:      'Disque (spécifique haltère)',
  dumbbell_fixed:      'Haltère fixe',
  dumbbell_adjustable: 'Haltère réglable (sélecteur)',
  dumbbell_loadable:   'Haltère à disques (poignée)',
  kettlebell:          'Kettlebell',
  resistance_band:     'Élastique',
  bench:               'Banc plat',
  bench_adjustable:    'Banc inclinable / réglable',
  rack:                'Rack / Cage de squat',
  pullup_bar:          'Barre de traction',
  cable_machine:       'Machine câble / Poulie',
  smith_machine:       'Smith machine',
  other:               'Autre',
}

export default {
  name: 'EquipmentForm',
  props: {
    item: { type: Object, default: null }  // null = création, objet = édition
  },
  emits: ['saved','cancel'],

  setup(props, { emit }) {
    const store = inject('store')

    const blank = () => ({
      category: 'barbell', name: '', weight_kg: '',
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

      // Validation count pair pour plate et dumbbell_plate
      if (['plate','dumbbell_plate'].includes(form.category)) {
        const n = parseInt(form.count) || 0
        if (n < 2 || n % 2 !== 0) {
          store.showToast(t('equipment.plate_count_even_error'), 'error')
          return
        }
      }

      // Forcer count=2 pour dumbbell_loadable
      if (form.category === 'dumbbell_loadable') {
        form.count = 2
      }

      // Validation haltère réglable
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
        // Nettoyer les champs vides → null
        const body = {}
        for (const [k, v] of Object.entries(form)) {
          body[k] = (v === '' ? null : v)
        }
        if (props.item) {
          await api.update(props.item.id, body)
        } else {
          await api.create(body)
        }
        emit('saved')
      } catch (err) {
        store.showToast(err.message, 'error')
      } finally {
        saving.value = false
      }
    }

    // Afficher les champs selon la catégorie
    const showWeight       = () => ['barbell','ez_bar','dumbbell_fixed','dumbbell_loadable','kettlebell'].includes(form.category)
    const showCount        = () => ['plate','dumbbell_plate','dumbbell_fixed','kettlebell'].includes(form.category)
    const countMustBePair  = () => ['plate','dumbbell_plate'].includes(form.category)
    const countIsLocked    = () => form.category === 'dumbbell_loadable'
    const showAdjustable   = () => form.category === 'dumbbell_adjustable'
    const showResistance   = () => form.category === 'resistance_band'
    const showNoNumericFields = () =>
      ['bench','bench_adjustable','rack','pullup_bar','smith_machine','other'].includes(form.category)

    return {
      form, saving, save, t,
      CATEGORIES, CATEGORY_LABELS,
      showWeight, showCount, countMustBePair, countIsLocked,
      showAdjustable, showResistance, showNoNumericFields,
      isEdit: !!props.item,
    }
  },

  template: `
    <form @submit.prevent="save">
      <h2 class="modal__title">
        {{ isEdit ? t('common.edit') : t('equipment.add') }}
      </h2>
      <div class="form-group">
        <label class="form-label">{{ t('equipment.category') }}</label>
        <select class="form-select" v-model="form.category">
          <option v-for="c in CATEGORIES" :key="c" :value="c">{{ CATEGORY_LABELS[c] }}</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">{{ t('equipment.name') }}</label>
        <input class="form-input" v-model="form.name" required />
      </div>

      <!-- Poids -->
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

      <!-- Quantité normale -->
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

      <!-- Quantité verrouillée pour dumbbell_loadable -->
      <div v-if="countIsLocked()" class="form-group">
        <label class="form-label">{{ t('equipment.count') }}</label>
        <div style="padding:0.6rem 0.75rem;background:var(--color-surface-2);
          border-radius:var(--radius-sm);color:var(--color-text-muted);font-size:0.9rem">
          {{ t('equipment.handle_count_locked') }}
        </div>
      </div>

      <!-- Haltère réglable -->
      <template v-if="showAdjustable()">
        <div class="form-group">
          <label class="form-label">Poids minimum (kg)</label>
          <input class="form-input" type="number" step="0.5" min="0" v-model="form.weight_min_kg" />
        </div>
        <div class="form-group">
          <label class="form-label">Poids maximum (kg)</label>
          <input class="form-input" type="number" step="0.5" min="0" v-model="form.weight_max_kg" />
        </div>
        <div class="form-group">
          <label class="form-label">Incrément (kg)</label>
          <input class="form-input" type="number" step="0.5" min="0.5"
            v-model="form.weight_step_kg" placeholder="ex: 2.5" />
        </div>
      </template>

      <!-- Élastique -->
      <template v-if="showResistance()">
        <div class="form-group">
          <label class="form-label">Résistance min (kg équiv.)</label>
          <input class="form-input" type="number" step="0.5" min="0" v-model="form.resistance_min_kg" />
        </div>
        <div class="form-group">
          <label class="form-label">Résistance max (kg équiv.)</label>
          <input class="form-input" type="number" step="0.5" min="0" v-model="form.resistance_max_kg" />
        </div>
      </template>

      <!-- Banc, rack, etc. : afficher un texte explicatif -->
      <div v-if="showNoNumericFields()" class="form-group">
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
