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

    function openAdd()       { state.editItem = null; state.showForm = true }
    function openEdit(item)  { state.editItem = item; state.showForm = true }
    function closeForm()     { state.showForm = false; state.editItem = null }

    async function onSaved() {
      closeForm()
      await load()
      store.showToast('Équipement sauvegardé.', 'success')
    }

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

    onMounted(load)

    return {
      state, load, t,
      openAdd, openEdit, closeForm, onSaved,
      confirmDelete, doDelete,
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
        <EmptyState    v-else-if="!state.items.length"
          icon="🏋️" :message="t('equipment.no_equipment')">
          <button class="btn btn--primary" style="margin-top:1rem" @click="openAdd()">
            {{ t('equipment.add') }}
          </button>
        </EmptyState>
        <div v-else>
          <EquipmentItemRow
            v-for="item in state.items" :key="item.id"
            :item="item"
            @edit="openEdit(item)"
            @delete="confirmDelete(item)"
          />
        </div>
      </div>

      <!-- Formulaire ajout/édition (bottom sheet) -->
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
