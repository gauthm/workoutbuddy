import { ref } from '/vendor/vue.esm-browser.prod.js'
import { appUpdates, applyAppUpdate, canApplyUpdate } from '../../appUpdates.js'
import { store } from '../../store.js'
import { t } from '../../i18n.js'
import ConfirmModal from './ConfirmModal.js'

export default {
  name: 'AppUpdateBanner',
  components: { ConfirmModal },
  setup() {
    const confirm = ref(false)
    function update() {
      if (canApplyUpdate()) applyAppUpdate()
      else confirm.value = true
    }
    return { appUpdates, store, confirm, update, applyAppUpdate, t }
  },
  template: `
    <div v-if="appUpdates.ready" class="app-update" role="region" :aria-label="t('updates.available')">
      <span role="status">{{ t('updates.available') }}</span>
      <button class="btn btn--primary" :disabled="store.pendingRequests > 0" @click="update">{{ t('updates.apply') }}</button>
    </div>
      <ConfirmModal v-if="appUpdates.ready && confirm" :title="t('updates.available')" :body="t('updates.unsaved')"
        :confirm-text="t('updates.apply')" :busy="store.pendingRequests > 0"
        @confirm="applyAppUpdate" @cancel="confirm = false" />
  `
}
