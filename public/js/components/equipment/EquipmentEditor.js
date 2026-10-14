import { reactive, ref, onMounted, inject, computed } from '/vendor/vue.esm-browser.prod.js'
import { equipment as api } from '../../api.js'
import { t, i18n } from '../../i18n.js'
import DumbbellInventory from './DumbbellInventory.js'
import DumbbellRows from './DumbbellRows.js'
import EquipmentForm from './EquipmentForm.js'
import { SIMPLE_CATEGORIES, EQUIPMENT_FAMILIES } from './inventoryCatalog.js'
import ModalDialog from '../common/ModalDialog.js'
import ConfirmModal from '../common/ConfirmModal.js'
import LoadingSpinner from '../common/LoadingSpinner.js'
import ErrorBanner from '../common/ErrorBanner.js'

const groups = [
  { category: 'barbell' }, { category: 'ez_bar' }, { category: 'plate' },
  { category: 'dumbbell_adjustable', mode: 'adjustable' },
  { category: 'kettlebell' }, { category: 'resistance_band', mode: 'band' },
]
const simpleCategories = SIMPLE_CATEGORIES
const managed = ['dumbbell_fixed','dumbbell_loadable','dumbbell_plate', ...groups.map(g => g.category), ...simpleCategories]

export default {
  name: 'EquipmentEditor',
  components: { DumbbellInventory, DumbbellRows, EquipmentForm, ModalDialog, ConfirmModal, LoadingSpinner, ErrorBanner },
  setup() {
    const store = inject('store'), dumbbells = ref(null), rowEditors = ref([])
    const state = reactive({items: [], loading: true, error: null, saving: false, pending: {}, search: '', expanded: {}, form: false, editItem: null, deleteTarget: null})
    async function load() {
      state.loading = true; state.error = null
      try { state.items = (await api.list()).items }
      catch (error) { state.error = error.message }
      finally { state.loading = false }
    }
    function saved(item) {
      const index = state.items.findIndex(i => i.id === item.id)
      if (index < 0) state.items.push(item)
      else state.items[index] = item
    }
    function deleted(id) { state.items = state.items.filter(i => i.id !== id) }
    const itemsFor = category => state.items.filter(i => i.category === category)
    async function toggle(category, checked) {
      if (state.pending[category]) return
      state.pending[category] = true
      try {
        if (checked) saved(await api.create({category, name: t('equipment.category_' + category), count: 1}))
        else { for (const item of itemsFor(category)) { await api.delete(item.id); deleted(item.id) } }
      } catch (error) { store.showToast(error.detail || error.message, 'error') }
      finally { state.pending[category] = false }
    }
    async function save() {
      if (state.saving) return
      state.saving = true
      try {
        for (const editor of dumbbells.value || []) if (!await editor.saveAll()) return
        for (const editor of rowEditors.value) if (!await editor.saveAll()) return
        store.showToast(t('equipment.inventory_saved'), 'success')
      } finally { state.saving = false }
    }
    async function formSaved(item) {
      state.form = false; state.editItem = null
      saved(item)
      state.search = ''; state.expanded.custom = true
      store.showToast(t('equipment.inventory_saved'), 'success')
    }
    async function removeOther() {
      const target = state.deleteTarget
      if (!target) return
      try { await api.delete(target.id); deleted(target.id); state.deleteTarget = null }
      catch(error) { store.showToast(error.message, 'error') }
    }
    const normalize = text => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
    const matches = text => normalize(text).includes(normalize(state.search))
    const categoryVisible = (category, family) => !state.search || matches(t('equipment.category_' + category)) || matches(t('equipment.family_' + family.id))
    const otherItems = () => state.items.filter(i => !managed.includes(i.category))
    const families = computed(() => EQUIPMENT_FAMILIES.map(family => ({ ...family,
      simple: family.categories.filter(c => simpleCategories.includes(c)).sort((a,b)=>t('equipment.category_'+a).localeCompare(t('equipment.category_'+b),i18n.locale)),
      rows: groups.filter(g => family.categories.includes(g.category)),
    })))
    const familyVisible = family => !state.search || matches(t('equipment.family_' + family.id)) || family.categories.some(c => matches(t('equipment.category_' + c))) || (family.id === 'custom' && otherItems().some(i => matches(i.name)))
    const familyCount = family => new Set(state.items.filter(i => family.categories.includes(i.category)).map(i => i.category === 'other' ? 'other:' + i.id : i.category)).size
    onMounted(load)
    return {state, t, groups, families, categoryVisible, familyVisible, familyCount, matches, dumbbells, rowEditors, itemsFor, saved, deleted, toggle, save, load, formSaved, removeOther,
      otherItems}
  },
  template: `
    <div class="equipment-editor">
      <LoadingSpinner v-if="state.loading" />
      <ErrorBanner v-else-if="state.error" :message="state.error" :retry="load" />
      <template v-else>
        <div class="catalog-search"><input class="form-input" type="search" v-model="state.search" :placeholder="t('equipment.search')" :aria-label="t('equipment.search')" /></div>
        <p v-if="!families.some(familyVisible)" class="inventory-hint">{{ t('equipment.no_search_results') }}</p>
        <details v-for="family in families" :key="family.id" :data-family="family.id" class="inventory-family"
          v-show="familyVisible(family)" :open="!!state.search || !!state.expanded[family.id]"
          @toggle="!state.search && (state.expanded[family.id] = $event.target.open)">
          <summary><span>{{ t('equipment.family_' + family.id) }}<small>{{ familyCount(family) === 1 ? t('equipment.family_one') : familyCount(family) ? t('equipment.family_count', { count: familyCount(family) }) : t('equipment.family_empty') }}</small></span></summary>
          <div class="inventory-family__content">
            <DumbbellInventory v-if="family.id === 'free_weights'" v-show="!state.search || ['dumbbell_fixed','dumbbell_loadable','dumbbell_plate'].some(c => categoryVisible(c, family))"
              ref="dumbbells" :items="state.items" @saved="saved" @deleted="deleted" />
            <section v-for="group in family.rows" :key="group.category" v-show="categoryVisible(group.category, family)" class="dumbbell-section inventory-section">
              <h2 class="dumbbell-section__title">{{ t('equipment.category_' + group.category) }}</h2>
              <p v-if="group.mode === 'band'" class="inventory-hint">{{ t('equipment.band_range_hint') }}</p>
              <DumbbellRows ref="rowEditors" :category="group.category" :items="itemsFor(group.category)" :mode="group.mode || 'weight'"
                quantity-key="equipment.count" :weight-key="group.mode === 'band' ? 'equipment.resistance_range' : group.mode === 'adjustable' ? 'equipment.adjustable_range' : 'equipment.weight_kg'"
                @saved="saved" @deleted="deleted" />
            </section>
            <div class="inventory-choices inventory-choices--flat">
              <label v-for="category in family.simple" :key="category" v-show="categoryVisible(category, family)" class="inventory-checkbox">
                <span>{{ t('equipment.category_' + category) }}</span>
                <input type="checkbox" class="setting-row__switch" :checked="itemsFor(category).length > 0"
                  :disabled="state.pending[category]" @change="toggle(category, $event.target.checked)" />
              </label>
              <template v-if="family.id === 'custom'">
                <label v-for="item in otherItems()" :key="item.id" v-show="!state.search || matches(item.name) || matches(t('equipment.family_custom'))" class="inventory-checkbox">
                  <span>{{ item.name }}</span>
                  <input type="checkbox" class="setting-row__switch" checked @change="$event.target.checked = true; state.deleteTarget = item" />
                </label>
              </template>
            </div>
          </div>
        </details>
        <button type="button" class="btn btn--secondary dumbbell-rows__add" @click="state.editItem = null; state.form = true">{{ t('equipment.add_other') }}</button>
        <button type="button" class="btn btn--primary btn--full equipment-settings__save" :disabled="state.saving" @click="save()">
          {{ state.saving ? t('common.loading') : t('settings.equipment_save') }}
        </button>
      </template>
      <ModalDialog v-if="state.form" :title="state.editItem ? t('common.edit') : t('equipment.add_other')" @close="state.form = false">
        <EquipmentForm :custom="true" :item="state.editItem" @saved="formSaved" @cancel="state.form = false" />
      </ModalDialog>
      <ConfirmModal v-if="state.deleteTarget" :title="t('equipment.delete_confirm')" :body="state.deleteTarget.name" :danger="true"
        @confirm="removeOther()" @cancel="state.deleteTarget = null" />
    </div>
  `,
}
