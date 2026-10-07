import { reactive, watch, inject } from '/vendor/vue.esm-browser.prod.js'
import { equipment as api } from '../../api.js'
import { t } from '../../i18n.js'

const CATEGORIES = [
  'barbell','ez_bar','plate','dumbbell_fixed','dumbbell_adjustable',
  'kettlebell','resistance_band','bench','rack','pullup_bar',
  'cable_machine','smith_machine','other'
]

const CATEGORY_LABELS = {
  barbell:'Barre droite', ez_bar:'Barre EZ', plate:'Disque',
  dumbbell_fixed:'Haltère fixe', dumbbell_adjustable:'Haltère réglable',
  kettlebell:'Kettlebell', resistance_band:'Élastique',
  bench:'Banc', rack:'Rack/Cage', pullup_bar:'Barre de traction',
  cable_machine:'Machine câble / poulie', smith_machine:'Smith machine',
  other:'Autre'
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
        store.showToast('Le nom est obligatoire.', 'error')
        return
      }
      // Validation plaques
      if (form.category === 'plate' && form.count % 2 !== 0) {
        store.showToast('Les disques doivent être en quantité paire.', 'error')
        return
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
    const showWeight       = () => ['barbell','ez_bar','dumbbell_fixed','kettlebell'].includes(form.category)
    const showCount        = () => ['plate','dumbbell_fixed','kettlebell'].includes(form.category)
    const showAdjustable   = () => form.category === 'dumbbell_adjustable'
    const showResistance   = () => form.category === 'resistance_band'

    return {
      form, saving, save, t,
      CATEGORIES, CATEGORY_LABELS,
      showWeight, showCount, showAdjustable, showResistance,
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
      <div v-if="showWeight()" class="form-group">
        <label class="form-label">Poids (kg)</label>
        <input class="form-input" type="number" step="0.5" min="0" v-model="form.weight_kg" />
      </div>
      <div v-if="showCount()" class="form-group">
        <label class="form-label">
          {{ t('equipment.count') }}
          <span v-if="form.category === 'plate'" style="color:var(--color-text-muted);font-size:0.8rem">
            (nombre total, doit être pair)
          </span>
        </label>
        <input class="form-input" type="number" min="1" v-model="form.count" />
      </div>
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
          <input class="form-input" type="number" step="0.5" min="0.5" v-model="form.weight_step_kg" />
        </div>
      </template>
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
