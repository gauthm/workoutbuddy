import { computed } from '/vendor/vue.esm-browser.prod.js'
import { appUpdates, updateSaver, saveAndApplyUpdate, canApplyUpdate } from '../../appUpdates.js'
import { store } from '../../store.js'
import { t } from '../../i18n.js'

export default {
  name: 'AppUpdateBanner',
  setup() {
    const needsSave = computed(() => !!updateSaver.value?.dirty())
    const blocked = computed(() => !!store.activeSession || (!updateSaver.value && !canApplyUpdate()))
    const busy = computed(() => appUpdates.saving || store.pendingRequests > 0 || !!updateSaver.value?.busy())
    return { appUpdates, needsSave, blocked, busy, saveAndApplyUpdate, t }
  },
  template: `
    <div v-if="appUpdates.ready" class="app-update" role="region" :aria-label="t('updates.available')" :aria-busy="appUpdates.saving">
      <span role="status">{{ t(appUpdates.error ? 'updates.save_failed' : appUpdates.saving ? 'updates.saving' : blocked ? 'updates.finish' : needsSave ? 'updates.will_save' : 'updates.available') }}</span>
      <button class="btn btn--primary" :disabled="busy || blocked" @click="saveAndApplyUpdate">{{ t(appUpdates.saving ? 'updates.saving' : needsSave ? 'updates.save_apply' : 'updates.apply') }}</button>
    </div>
  `
}
