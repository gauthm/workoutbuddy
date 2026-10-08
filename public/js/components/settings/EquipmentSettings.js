import { reactive, onMounted, inject } from '/vendor/vue.esm-browser.prod.js'
import { equipment as api } from '../../api.js'
import { t } from '../../i18n.js'
import { EQUIPMENT_CATALOG } from './equipmentCatalog.js'
import ConfirmModal from '../common/ConfirmModal.js'

// Tag stocké dans equipment_item.notes pour réconcilier la checklist avec la DB
const TAG_PREFIX = 'catalog:'

const NUM_FIELDS = ['weight_kg', 'count', 'weight_min_kg', 'weight_max_kg',
  'weight_step_kg', 'resistance_min_kg', 'resistance_max_kg']

function toVal(v) { return v === null || v === undefined ? '' : v }
function num(v) {
  if (v === '' || v === null || v === undefined || isNaN(Number(v))) return null
  return Number(v)
}

function instanceKeyOf(itemKey, n) { return n ? `${itemKey}#${n}` : itemKey }

function makeRow(group, item, instanceNum, dbItem) {
  const row = {
    instanceKey: instanceKeyOf(item.key, instanceNum),
    groupKey:    group.key,
    itemKey:     item.key,
    instanceNum: instanceNum || null,
    category:    item.category,
    name:        item.name,
    fields:      item.fields,
    perPair:     !!item.perPair,
    repeatable:  !!item.repeatable,
    checked:     !!dbItem,
    id:          dbItem ? dbItem.id : null,
    weight_kg: '', count: '',
    weight_min_kg: '', weight_max_kg: '', weight_step_kg: '',
    resistance_min_kg: '', resistance_max_kg: '',
    orig: null,
  }
  if (dbItem) {
    for (const k of NUM_FIELDS) row[k] = toVal(dbItem[k])
    row.orig = {}
    for (const k of NUM_FIELDS) row.orig[k] = num(dbItem[k])
  } else {
    for (const k of NUM_FIELDS) row[k] = toVal(item.defaults[k])
  }
  return row
}

export default {
  name: 'EquipmentSettings',
  components: { ConfirmModal },

  directives: {
    indeterminate: {
      mounted(el, binding) { el.indeterminate = binding.value },
      updated(el, binding) { el.indeterminate = binding.value },
    },
  },

  setup() {
    const store  = inject('store')
    const router = inject('router')

    const state = reactive({
      loading: true, error: null, saving: false,
      rows: {},          // instanceKey → ligne d'édition
      untagged: [],      // items sans tag catalog: (coach / vue complète)
      collapsed: {},     // groupKey → bool
      confirmDelete: null,
    })

    function displayName(row) {
      return row.instanceNum ? `${row.name} (${row.instanceNum})` : row.name
    }

    function hasField(row, f) { return row.fields.includes(f) }

    // ── Chargement + réconciliation ───────────────────────────
    async function load() {
      state.loading = true; state.error = null
      try {
        const { items } = await api.list()
        const tagged = new Map()
        state.untagged = []
        for (const it of items) {
          const notes = it.notes || ''
          if (notes.startsWith(TAG_PREFIX)) tagged.set(notes.slice(TAG_PREFIX.length), it)
          else state.untagged.push(it)
        }
        const hasTags = tagged.size > 0

        const rows = {}
        for (const g of EQUIPMENT_CATALOG) {
          for (const item of g.items) {
            rows[item.key] = makeRow(g, item, null, tagged.get(item.key) || null)
            if (item.repeatable) {
              for (const [key, it] of tagged) {
                const m = key.match(/^(.+)#(\d+)$/)
                if (m && m[1] === item.key) {
                  rows[key] = makeRow(g, item, parseInt(m[2]), it)
                }
              }
            }
          }
        }
        // Première configuration de cette UI : TOUT coché par défaut
        if (!hasTags) {
          for (const r of Object.values(rows)) r.checked = true
        }
        state.rows = rows
      } catch (err) {
        state.error = err.message
      } finally {
        state.loading = false
      }
    }

    // ── Rendu groupé ──────────────────────────────────────────
    function rowsForItem(group, item) {
      return Object.values(state.rows).filter(r => r.itemKey === item.key)
    }
    function rowsForGroup(groupKey) {
      return Object.values(state.rows).filter(r => r.groupKey === groupKey)
    }
    function groupAllChecked(groupKey) {
      const rows = rowsForGroup(groupKey)
      return rows.length > 0 && rows.every(r => r.checked)
    }
    function groupPartial(groupKey) {
      const rows = rowsForGroup(groupKey)
      return rows.some(r => r.checked) && !rows.every(r => r.checked)
    }
    function setGroupChecked(groupKey, value) {
      for (const r of rowsForGroup(groupKey)) r.checked = value
    }

    function isPlateCategory(category) {
      return category === 'plate' || category === 'dumbbell_plate'
    }

    // ── Instances répétables (paires d'haltères fixes) ───────
    function addPair(group, item) {
      let max = 1
      for (const r of Object.values(state.rows)) {
        if (r.itemKey === item.key && r.instanceNum && r.instanceNum > max) max = r.instanceNum
      }
      const n = max + 1
      const row = makeRow(group, item, n, null)
      row.checked = true
      state.rows[instanceKeyOf(item.key, n)] = row
    }

    async function removeInstance(key) {
      const row = state.rows[key]
      if (!row || state.saving) return
      if (row.id) {
        state.saving = true
        try {
          await api.delete(row.id)
          await load()
        } catch (err) {
          store.showToast(err.message, 'error')
        } finally { state.saving = false }
      } else {
        delete state.rows[key]
      }
    }

    // ── Sync catalogue → equipment_item ───────────────────────
    function buildPayload(row) {
      const payload = {
        category: row.category,
        name:     displayName(row),
        notes:    TAG_PREFIX + row.instanceKey,
      }
      if (hasField(row, 'weight')) payload.weight_kg = num(row.weight_kg)
      if (hasField(row, 'count'))  payload.count = num(row.count) ?? 1
      if (hasField(row, 'range')) {
        if (row.category === 'dumbbell_adjustable') {
          payload.weight_min_kg  = num(row.weight_min_kg)
          payload.weight_max_kg  = num(row.weight_max_kg)
          payload.weight_step_kg = num(row.weight_step_kg)
        } else {
          payload.resistance_min_kg = num(row.resistance_min_kg)
          payload.resistance_max_kg = num(row.resistance_max_kg)
        }
      }
      return payload
    }

    function isChanged(row, payload) {
      if (!row.orig) return true
      for (const k of NUM_FIELDS) {
        if (payload[k] !== undefined && num(payload[k]) !== row.orig[k]) return true
      }
      return false
    }

    async function save() {
      state.saving = true
      let created = 0, updated = 0, deleted = 0
      try {
        for (const row of Object.values(state.rows)) {
          const payload = buildPayload(row)
          if (row.checked && !row.id) {
            await api.create(payload); created++
          } else if (row.checked && row.id) {
            if (isChanged(row, payload)) { await api.update(row.id, payload); updated++ }
          } else if (!row.checked && row.id) {
            await api.delete(row.id); deleted++
          }
        }
        store.showToast(t('settings.equipment_saved', { c: created, u: updated, d: deleted }), 'success')
        await load()
      } catch (err) {
        store.showToast(err.detail || err.message, 'error')
        await load()   // resynchroniser l'état depuis la DB
      } finally { state.saving = false }
    }

    // ── Items sans tag (coach) — suppression seule, jamais modifiés
    async function deleteUntagged() {
      const item = state.confirmDelete
      state.confirmDelete = null
      if (!item) return
      try {
        await api.delete(item.id)
        await load()
      } catch (err) {
        store.showToast(err.message, 'error')
      }
    }

    onMounted(load)
    return {
      state, t, router, catalog: EQUIPMENT_CATALOG,
      load, save, addPair, removeInstance, deleteUntagged,
      displayName, hasField, isPlateCategory,
      rowsForItem, groupAllChecked, groupPartial, setGroupChecked,
    }
  },

  template: `
    <div class="equipment-settings">

      <div class="settings-notice equipment-settings__notice">
        {{ t('settings.equipment_notice') }}
      </div>

      <div v-if="state.loading" class="profile-settings__loading">
        {{ t('common.loading') }}
      </div>

      <div v-else-if="state.error" class="settings-notice settings-notice--warning">
        {{ state.error }}
        <button class="btn btn--secondary" @click="load()">{{ t('common.retry') }}</button>
      </div>

      <template v-else>

        <div v-for="group in catalog" :key="group.key" class="equip-group">
          <div class="equip-group__header">
            <button class="equip-group__toggle"
              @click="state.collapsed[group.key] = !state.collapsed[group.key]">
              <span class="equip-group__chevron">{{ state.collapsed[group.key] ? '▼' : '▲' }}</span>
              <span class="equip-group__title">{{ t(group.labelKey) }}</span>
            </button>
            <input type="checkbox" class="setting-row__switch"
              v-indeterminate="groupPartial(group.key)"
              :checked="groupAllChecked(group.key)"
              :disabled="state.saving"
              @change="setGroupChecked(group.key, $event.target.checked)" />
          </div>

          <div v-show="!state.collapsed[group.key]" class="equip-group__body">
            <template v-for="item in group.items" :key="item.key">
              <div v-for="row in rowsForItem(group, item)" :key="row.instanceKey"
                class="equip-row" :class="{ 'equip-row--off': !row.checked }">
                <input type="checkbox" class="setting-row__switch"
                  v-model="row.checked" :disabled="state.saving" />
                <span class="equip-row__name">{{ displayName(row) }}</span>
                <button v-if="row.instanceNum" class="equip-row__remove"
                  :disabled="state.saving" @click="removeInstance(row.instanceKey)">×</button>

                <span v-if="hasField(row, 'weight')" class="equip-row__field">
                  <input class="form-input equip-row__input" type="number"
                    min="0" step="0.25" v-model="row.weight_kg"
                    :disabled="!row.checked || state.saving"
                    :title="row.perPair ? t('equipment.handle_weight_hint') : t('equipment.weight_kg')"
                    :aria-label="row.perPair ? t('equipment.handle_weight_hint') : t('equipment.weight_kg')" />
                  <span class="equip-row__unit">kg</span>
                </span>

                <span v-if="hasField(row, 'range')" class="equip-row__field">
                  <template v-if="row.category === 'dumbbell_adjustable'">
                    <input class="form-input equip-row__input" type="number"
                      min="0" step="0.5" v-model="row.weight_min_kg"
                      :disabled="!row.checked || state.saving"
                      title="min (kg)" aria-label="min (kg)" />
                    <span class="equip-row__unit">→</span>
                    <input class="form-input equip-row__input" type="number"
                      min="0" step="0.5" v-model="row.weight_max_kg"
                      :disabled="!row.checked || state.saving"
                      title="max (kg)" aria-label="max (kg)" />
                    <span class="equip-row__unit">kg</span>
                    <span class="equip-row__unit equip-row__unit--label">{{ t('settings.equip_step') }}</span>
                    <input class="form-input equip-row__input" type="number"
                      min="0.5" step="0.5" v-model="row.weight_step_kg"
                      :disabled="!row.checked || state.saving"
                      title="step (kg)" aria-label="step (kg)" />
                  </template>
                  <template v-else>
                    <input class="form-input equip-row__input" type="number"
                      min="0" step="0.5" v-model="row.resistance_min_kg"
                      :disabled="!row.checked || state.saving"
                      title="min (kg)" aria-label="min (kg)" />
                    <span class="equip-row__unit">→</span>
                    <input class="form-input equip-row__input" type="number"
                      min="0" step="0.5" v-model="row.resistance_max_kg"
                      :disabled="!row.checked || state.saving"
                      title="max (kg)" aria-label="max (kg)" />
                    <span class="equip-row__unit">kg</span>
                  </template>
                </span>

                <span v-if="hasField(row, 'count')" class="equip-row__field">
                  <span class="equip-row__unit">×</span>
                  <input v-if="row.category !== 'dumbbell_loadable'"
                    class="form-input equip-row__input" type="number"
                    :min="isPlateCategory(row.category) ? 2 : 1"
                    :step="isPlateCategory(row.category) ? 2 : 1"
                    v-model="row.count"
                    :disabled="!row.checked || state.saving"
                    :title="isPlateCategory(row.category) ? t('equipment.count_pair_hint') : t('equipment.count')"
                    :aria-label="t('equipment.count')" />
                  <input v-else class="form-input equip-row__input" type="number"
                    :value="2" disabled
                    :title="t('equipment.handle_count_locked')"
                    :aria-label="t('equipment.handle_count_locked')" />
                </span>
              </div>

              <button v-if="item.repeatable" class="btn btn--secondary equip-group__add"
                :disabled="state.saving" @click="addPair(group, item)">
                {{ t('settings.equipment_add_pair') }}
              </button>
            </template>
          </div>
        </div>

        <button class="btn btn--primary btn--full equipment-settings__save"
          :disabled="state.saving" @click="save()">
          {{ state.saving ? t('common.loading') : t('settings.equipment_save') }}
        </button>

        <button class="btn btn--secondary btn--full"
          @click="router.push('#/equipment')">
          {{ t('settings.equipment_open_full') }}
        </button>

        <template v-if="state.untagged.length">
          <h3 class="equipment-settings__untagged-title">
            {{ t('settings.equipment_coach_items') }}
          </h3>
          <div v-for="item in state.untagged" :key="item.id" class="equipment-row">
            <div class="equipment-row__info">
              <span class="equipment-row__name">{{ item.name }}</span>
            </div>
            <div class="equipment-row__actions">
              <button class="btn btn--secondary" :disabled="state.saving"
                :aria-label="t('common.delete')"
                @click="state.confirmDelete = item">🗑</button>
            </div>
          </div>
        </template>

        <ConfirmModal v-if="state.confirmDelete"
          :title="t('equipment.delete_confirm')" danger
          :confirm-text="t('common.delete')"
          @confirm="deleteUntagged()"
          @cancel="state.confirmDelete = null" />
      </template>
    </div>
  `
}
