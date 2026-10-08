import { reactive, onMounted, inject, ref } from '/vendor/vue.esm-browser.prod.js'
import { equipment as api } from '../../api.js'
import { t } from '../../i18n.js'
import PageHeader       from '../layout/PageHeader.js'
import LoadingSpinner   from '../common/LoadingSpinner.js'
import ErrorBanner      from '../common/ErrorBanner.js'
import EmptyState       from '../common/EmptyState.js'
import EquipmentItemRow from './EquipmentItemRow.js'
import EquipmentForm    from './EquipmentForm.js'
import ConfirmModal     from '../common/ConfirmModal.js'

const DUMBELL_FIXED_CAT = 'dumbbell_fixed'
const DUMBELL_PLATE_CAT = 'dumbbell_plate'

export default {
  name: 'EquipmentView',
  components: {
    PageHeader, LoadingSpinner, ErrorBanner, EmptyState,
    EquipmentItemRow, EquipmentForm, ConfirmModal
  },

  setup() {
    const store = inject('store')

    const state = reactive({
      loading: false, error: null, items: [],
      showForm: false, editItem: null,
      deleteTarget: null,
      // Fixed dumbbell inline form
      fixedForm: { name: '', weight_kg: '', count: 1 },
      showFixedForm: false,
      // Disc set inline form
      discForm: { name: '', count: '', weight_kg: '' },
      showDiscForm: false,
      // Inline edit
      editingId: null,
      editFixed: { name: '', weight_kg: '', count: 1 },
      editDisc: { name: '', count: '', weight_kg: '' },
    })

    async function load() {
      state.loading = true; state.error = null
      try {
        const data = await api.list()
        state.items = data.items
      } catch (err) {
        state.error = err.message
      } finally {
        state.loading = false
      }
    }

    // ── Computed splits ─────────────────────────────────────
    const fixedDumbbells = () => state.items.filter(i => i.category === 'dumbbell_fixed')
    const discSets       = () => state.items.filter(i => i.category === 'dumbbell_plate')
    const otherItems     = () => state.items.filter(i => i.category !== DUMBELL_FIXED_CAT && i.category !== DUMBELL_PLATE_CAT)

    // ── Fixed dumbbell add ──────────────────────────────────
    async function addFixedDumbbell() {
      if (!state.fixedForm.name.trim() || !state.fixedForm.weight_kg) {
        store.showToast(t('equipment.name_required'), 'error')
        return
      }
      try {
        await api.create({
          category: 'dumbbell_fixed',
          name: state.fixedForm.name.trim(),
          weight_kg: parseFloat(state.fixedForm.weight_kg),
          count: parseInt(state.fixedForm.count) || 1,
        })
        state.fixedForm = { name: '', weight_kg: '', count: 1 }
        state.showFixedForm = false
        await load()
        store.showToast('Haltère ajouté.', 'success')
      } catch (err) {
        store.showToast(err.message, 'error')
      }
    }

    // ── Disc set add ────────────────────────────────────────
    async function addDiscSet() {
      if (!state.discForm.count || !state.discForm.weight_kg) {
        store.showToast(t('equipment.name_required'), 'error')
        return
      }
      const count = parseInt(state.discForm.count)
      if (count < 2 || count % 2 !== 0) {
        store.showToast(t('equipment.plate_count_even_error'), 'error')
        return
      }
      try {
        const name = state.discForm.name.trim() || `${count} × ${state.discForm.weight_kg}kg`
        await api.create({
          category: 'dumbbell_plate',
          name,
          weight_kg: parseFloat(state.discForm.weight_kg),
          count,
        })
        state.discForm = { name: '', count: '', weight_kg: '' }
        state.showDiscForm = false
        await load()
        store.showToast('Set de disques ajouté.', 'success')
      } catch (err) {
        store.showToast(err.message, 'error')
      }
    }

    // ── Inline edit ────────────────────────────────────────
    function startEdit(item) {
      state.editingId = item.id
      if (item.category === 'dumbbell_fixed') {
        state.editFixed = { name: item.name, weight_kg: item.weight_kg, count: item.count }
      } else if (item.category === 'dumbbell_plate') {
        state.editDisc = { name: item.name, weight_kg: item.weight_kg, count: item.count }
      }
    }

    function cancelEdit() {
      state.editingId = null
    }

    async function saveEdit(item) {
      try {
        const body = {}
        if (item.category === 'dumbbell_fixed') {
          body.name = state.editFixed.name.trim()
          body.weight_kg = parseFloat(state.editFixed.weight_kg)
          body.count = parseInt(state.editFixed.count) || 1
        } else if (item.category === 'dumbbell_plate') {
          const count = parseInt(state.editDisc.count)
          if (count < 2 || count % 2 !== 0) {
            store.showToast(t('equipment.plate_count_even_error'), 'error')
            return
          }
          body.name = state.editDisc.name.trim()
          body.weight_kg = parseFloat(state.editDisc.weight_kg)
          body.count = count
        }
        await api.update(item.id, body)
        state.editingId = null
        await load()
        store.showToast('Modifié.', 'success')
      } catch (err) {
        store.showToast(err.message, 'error')
      }
    }

    // ── Delete ──────────────────────────────────────────────
    function confirmDelete(item) { state.deleteTarget = item }

    async function doDelete() {
      if (!state.deleteTarget) return
      try {
        await api.delete(state.deleteTarget.id)
        store.showToast('Supprimé.', 'success')
        state.deleteTarget = null
        await load()
      } catch (err) {
        store.showToast(err.message, 'error')
      }
    }

    // ── Other equipment (modal form) ────────────────────────
    function openAdd()       { state.editItem = null; state.showForm = true }
    function openEdit(item)  { state.editItem = item; state.showForm = true }
    function closeForm()     { state.showForm = false; state.editItem = null }

    async function onSaved() {
      closeForm()
      await load()
      store.showToast('Équipement sauvegardé.', 'success')
    }

    onMounted(load)

    return {
      state, load, t,
      fixedDumbbells, discSets, otherItems,
      addFixedDumbbell, addDiscSet,
      startEdit, cancelEdit, saveEdit,
      confirmDelete, doDelete,
      openAdd, openEdit, closeForm, onSaved,
    }
  },

  template: `
    <div class="view">
      <PageHeader :title="t('equipment.title')">
        <template #actions>
          <button class="btn btn--primary" style="padding:0.4rem 0.75rem;font-size:0.85rem"
            @click="openAdd()">+</button>
        </template>
      </PageHeader>

      <div class="view__content">
        <LoadingSpinner v-if="state.loading" />
        <ErrorBanner   v-else-if="state.error" :message="state.error" :retry="load" />

        <template v-else>
          <!-- ═══ Haltères (fixes) ═══ -->
          <section class="equip-section">
            <div class="equip-section__header">
              <h2 class="equip-section__title">🏋️ {{ t('equipment.dumbbells_fixed') }}</h2>
              <button class="btn btn--secondary btn--sm" v-if="!state.showFixedForm"
                @click="state.showFixedForm = true">+ {{ t('equipment.add_fixed') }}</button>
            </div>

            <div v-if="state.showFixedForm" class="equip-inline-form">
              <input class="form-input" type="text" v-model="state.fixedForm.name"
                :placeholder="t('equipment.label')" />
              <div class="equip-inline-form__row">
                <input class="form-input" type="number" step="0.5" min="0"
                  v-model="state.fixedForm.weight_kg" :placeholder="t('equipment.weight_kg')" />
                <input class="form-input" type="number" min="1"
                  v-model="state.fixedForm.count" :placeholder="t('equipment.quantity')" />
              </div>
              <div class="equip-inline-form__actions">
                <button class="btn btn--secondary btn--sm" @click="state.showFixedForm = false">{{ t('common.cancel') }}</button>
                <button class="btn btn--primary btn--sm" @click="addFixedDumbbell()">{{ t('common.add') }}</button>
              </div>
            </div>

            <div v-if="!fixedDumbbells().length" class="equip-empty">
              {{ t('equipment.no_fixed') }}
            </div>
            <div v-for="item in fixedDumbbells()" :key="item.id" class="equip-row">
              <template v-if="state.editingId === item.id">
                <div class="equip-row__edit">
                  <input class="form-input" type="text" v-model="state.editFixed.name" :placeholder="t('equipment.label')" />
                  <input class="form-input" type="number" step="0.5" min="0" v-model="state.editFixed.weight_kg" :placeholder="t('equipment.weight_kg')" />
                  <input class="form-input" type="number" min="1" v-model="state.editFixed.count" :placeholder="t('equipment.quantity')" />
                </div>
                <div class="equip-row__actions">
                  <button class="btn btn--secondary btn--sm" @click="cancelEdit()">{{ t('common.cancel') }}</button>
                  <button class="btn btn--primary btn--sm" @click="saveEdit(item)">{{ t('common.save') }}</button>
                </div>
              </template>
              <template v-else>
                <div class="equip-row__info">
                  <span class="equip-row__name">{{ item.name }}</span>
                  <span class="equip-row__detail">{{ item.count }} × {{ item.weight_kg }} kg</span>
                </div>
                <div class="equip-row__actions">
                  <button class="icon-btn" @click="startEdit(item)">✏️</button>
                  <button class="icon-btn icon-btn--danger" @click="confirmDelete(item)">🗑</button>
                </div>
              </template>
            </div>
          </section>

          <!-- ═══ Haltères (disques) ═══ -->
          <section class="equip-section">
            <div class="equip-section__header">
              <h2 class="equip-section__title">💿 {{ t('equipment.dumbbells_plates') }}</h2>
              <button class="btn btn--secondary btn--sm" v-if="!state.showDiscForm"
                @click="state.showDiscForm = true">+ {{ t('equipment.add_disc_set') }}</button>
            </div>

            <div v-if="state.showDiscForm" class="equip-inline-form">
              <input class="form-input" type="text" v-model="state.discForm.name"
                :placeholder="t('equipment.label') + ' (optionnel)'" />
              <div class="equip-inline-form__row">
                <input class="form-input" type="number" min="2" step="2"
                  v-model="state.discForm.count" :placeholder="t('equipment.disc_count')" />
                <input class="form-input" type="number" step="0.5" min="0"
                  v-model="state.discForm.weight_kg" :placeholder="t('equipment.disc_weight')" />
              </div>
              <div class="equip-inline-form__actions">
                <button class="btn btn--secondary btn--sm" @click="state.showDiscForm = false">{{ t('common.cancel') }}</button>
                <button class="btn btn--primary btn--sm" @click="addDiscSet()">{{ t('common.add') }}</button>
              </div>
            </div>

            <div v-if="!discSets().length" class="equip-empty">
              {{ t('equipment.no_discs') }}
            </div>
            <div v-for="item in discSets()" :key="item.id" class="equip-row">
              <template v-if="state.editingId === item.id">
                <div class="equip-row__edit">
                  <input class="form-input" type="text" v-model="state.editDisc.name" :placeholder="t('equipment.label')" />
                  <input class="form-input" type="number" min="2" step="2" v-model="state.editDisc.count" :placeholder="t('equipment.disc_count')" />
                  <input class="form-input" type="number" step="0.5" min="0" v-model="state.editDisc.weight_kg" :placeholder="t('equipment.disc_weight')" />
                </div>
                <div class="equip-row__actions">
                  <button class="btn btn--secondary btn--sm" @click="cancelEdit()">{{ t('common.cancel') }}</button>
                  <button class="btn btn--primary btn--sm" @click="saveEdit(item)">{{ t('common.save') }}</button>
                </div>
              </template>
              <template v-else>
                <div class="equip-row__info">
                  <span class="equip-row__name">{{ item.name }}</span>
                  <span class="equip-row__detail">{{ item.count }} {{ t('equipment.disc_unit') }} de {{ item.weight_kg }} kg</span>
                </div>
                <div class="equip-row__actions">
                  <button class="icon-btn" @click="startEdit(item)">✏️</button>
                  <button class="icon-btn icon-btn--danger" @click="confirmDelete(item)">🗑</button>
                </div>
              </template>
            </div>
          </section>

          <!-- ═══ Autre matériel ═══ -->
          <section v-if="otherItems().length" class="equip-section">
            <div class="equip-section__header">
              <h2 class="equip-section__title">{{ t('equipment.other_equipment') }}</h2>
            </div>
            <EquipmentItemRow
              v-for="item in otherItems()" :key="item.id"
              :item="item"
              @edit="openEdit(item)"
              @delete="confirmDelete(item)"
            />
          </section>

          <!-- Empty state for everything -->
          <EmptyState v-if="!state.items.length"
            icon="🏋️" :message="t('equipment.no_equipment')">
            <button class="btn btn--primary" style="margin-top:1rem" @click="openAdd()">
              {{ t('equipment.add') }}
            </button>
          </EmptyState>
        </template>
      </div>

      <!-- Formulaire ajout/édition autre matériel (bottom sheet) -->
      <div v-if="state.showForm" class="modal-overlay" @click.self="closeForm()">
        <div class="modal">
          <EquipmentForm
            :item="state.editItem"
            @saved="onSaved"
            @cancel="closeForm()"
          />
        </div>
      </div>

      <!-- Confirmation suppression -->
      <ConfirmModal
        v-if="state.deleteTarget"
        :title="t('equipment.delete_confirm')"
        :body="state.deleteTarget.name"
        :danger="true"
        @confirm="doDelete()"
        @cancel="state.deleteTarget = null"
      />
    </div>
  `
}
