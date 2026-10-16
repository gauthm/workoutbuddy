import { reactive, onMounted, inject, ref, computed } from '/vendor/vue.esm-browser.prod.js'
import { settings as settingsApi, authentication } from '../../api.js'
import { t, i18n } from '../../i18n.js'
import PageHeader       from '../layout/PageHeader.js'
import LoadingSpinner   from '../common/LoadingSpinner.js'
import ErrorBanner      from '../common/ErrorBanner.js'
import SettingsSection  from './SettingsSection.js'
import AIProviderForm   from './AIProviderForm.js'
import ExportImport     from './ExportImport.js'
import ProfileSettings  from './ProfileSettings.js'
import ConfirmModal from '../common/ConfirmModal.js'

export default {
  name: 'SettingsView',
  components: {
    PageHeader, LoadingSpinner, ErrorBanner,
    SettingsSection, AIProviderForm, ExportImport, ProfileSettings, ConfirmModal,
  },

  setup() {
    const store = inject('store'), profile = ref(null), ai = ref(null)
    const canLogout = ref(authentication.logoutAvailable), showLogout = ref(false)

    const state = reactive({
      loading:  false,
      error:    null,
      settings: null,
      baseline: {}, saving: false,
      networkChanged: false,
      loggingOut: false,
    })

    // ── Chargement ───────────────────────────────────────────
    async function load() {
      state.loading = true; state.error = null
      try {
        state.settings = await settingsApi.get()
        canLogout.value = authentication.logoutAvailable
        state.baseline = JSON.parse(JSON.stringify(state.settings))
        store.setSettings(state.settings)
      } catch (err) {
        state.error = err.message
      } finally {
        state.loading = false
      }
    }

    const settingChanges = computed(() => Object.fromEntries(Object.entries(state.settings || {}).filter(([key,value]) => JSON.stringify(value) !== JSON.stringify(state.baseline[key]))))
    const dirty = computed(() => Object.keys(settingChanges.value).length > 0 || !!profile.value?.dirty || !!ai.value?.dirty)
    const busy = computed(() => state.saving || state.loggingOut || !!ai.value?.busy)
    function logout() {
      if (busy.value || store.pendingRequests > 0) return
      state.loggingOut = true
      authentication.logout()
    }
    function updateSetting(key, value) { state.settings[key] = value }
    function discard() {
      state.settings = JSON.parse(JSON.stringify(state.baseline))
      profile.value?.reset()
      ai.value?.reset()
    }
    async function saveAll() {
      if (!dirty.value || busy.value) return
      if (ai.value?.dirty && !ai.value.valid) { store.showToast(t('settings.ai_fields_required'), 'error'); return }
      const body = { settings: { ...settingChanges.value, ...(ai.value?.getPatch() || {}) } }
      if (profile.value?.dirty) body.profile = profile.value.getDraft()
      state.saving = true
      try {
        const result = await settingsApi.save(body)
        state.settings = JSON.parse(JSON.stringify(result.settings))
        state.baseline = JSON.parse(JSON.stringify(result.settings))
        store.setSettings(result.settings)
        ai.value?.acceptSaved(result.settings)
        if (body.profile) profile.value?.acceptSaved(result.profile)
        if (result.restart_required) state.networkChanged = true
        document.documentElement.setAttribute('data-theme', result.settings.theme)
        await i18n.setLocale(result.settings.language)
        store.showToast(t('settings.saved'), 'success')
      } catch (err) { store.showToast(err.details?.join('; ') || err.detail?.join?.('; ') || err.message, 'error') }
      finally { state.saving = false }
    }

    onMounted(load)
    return { state, store, profile, ai, dirty, busy, canLogout, showLogout, logout, load, updateSetting, saveAll, discard, t }
  },

  template: `
    <div class="view settings-view" :class="{ 'settings-view--pending': dirty }">
      <PageHeader :title="t('settings.title')" />

      <div class="view__content">
        <LoadingSpinner v-if="state.loading" />
        <ErrorBanner v-else-if="state.error" :message="state.error" :retry="load" />

        <template v-else-if="state.settings">
          <fieldset class="settings-fields" :disabled="state.saving">

          <!-- ① Général ───────────────────────────────────── -->
          <SettingsSection :title="t('settings.section_general')">
            <div class="setting-row">
              <label class="setting-row__label" for="SettingsView-state-settings-unit">{{ t('settings.bodyweight_unit') }}</label>
              <select id="SettingsView-state-settings-unit" class="form-select setting-row__control"
                :value="state.settings.unit"
                @change="updateSetting('unit', $event.target.value)">
                <option value="kg">{{ t('settings.unit_kg') }}</option>
                <option value="lb">{{ t('settings.unit_lb') }}</option>
              </select>
            </div>
            <div class="setting-row">
              <label class="setting-row__label" for="SettingsView-state-settings-theme">{{ t('settings.theme') }}</label>
              <select id="SettingsView-state-settings-theme" class="form-select setting-row__control"
                :value="state.settings.theme"
                @change="updateSetting('theme', $event.target.value)">
                <option value="dark">{{ t('settings.theme_dark') }}</option>
                <option value="light">{{ t('settings.theme_light') }}</option>
              </select>
            </div>
            <div class="setting-row">
              <label class="setting-row__label" for="SettingsView-state-settings-language">{{ t('settings.language') }}</label>
              <select id="SettingsView-state-settings-language" class="form-select setting-row__control"
                :value="state.settings.language"
                @change="updateSetting('language', $event.target.value)">
                <option value="fr">{{ t('settings.language_fr') }}</option>
                <option value="en">{{ t('settings.language_en') }}</option>
              </select>
            </div>
          </SettingsSection>

          <!-- ⑤b Mon profil ─────────────────────────────────── -->
          <SettingsSection :title="t('settings.section_profile')">
            <ProfileSettings ref="profile" />
          </SettingsSection>

          <SettingsSection :title="t('settings.section_session')">
            <p class="settings-notice">{{ t('settings.session_automatic') }}</p>
            <div class="setting-row setting-row--switch">
              <label class="setting-row__label" for="setting-show-rpe">{{ t('settings.show_rpe') }}<small class="setting-row__hint">{{ t('settings.rpe_help') }}</small></label>
              <input id="setting-show-rpe" type="checkbox" class="setting-row__switch"
                :checked="state.settings.show_rpe_field"
                @change="updateSetting('show_rpe_field', $event.target.checked)" />
            </div>
            <div class="setting-row setting-row--switch">
              <label class="setting-row__label" for="setting-timer-sound">{{ t('settings.timer_sound') }}</label>
              <input id="setting-timer-sound" type="checkbox" class="setting-row__switch"
                :checked="state.settings.timer_sound_enabled"
                @change="updateSetting('timer_sound_enabled', $event.target.checked)" />
            </div>
            <div class="setting-row setting-row--switch">
              <label class="setting-row__label" for="setting-timer-vibration">{{ t('settings.timer_vibration') }}<small class="setting-row__hint">{{ t('settings.vibration_help') }}</small></label>
              <input id="setting-timer-vibration" type="checkbox" class="setting-row__switch"
                :checked="state.settings.timer_vibration_enabled"
                @change="updateSetting('timer_vibration_enabled', $event.target.checked)" />
            </div>
          </SettingsSection>



          <!-- ⑥ Coach IA ─────────────────────────────────── -->
          <SettingsSection :title="t('settings.section_ai')">
            <p class="settings-notice">{{ t('settings.advisor_optional') }}</p>
            <AIProviderForm ref="ai"
              :current-settings="state.settings"
            />
          </SettingsSection>

          <SettingsSection :title="t('settings.section_advanced')">
            <section class="settings-advanced-card">
            <h3>{{ t('settings.performance_calculation') }}</h3>
            <div class="setting-row setting-row--rm">
              <label class="setting-row__label" for="SettingsView-state-settings-rm_formula">{{ t('settings.rm_formula') }}</label>
              <select id="SettingsView-state-settings-rm_formula" class="form-select setting-row__control"
                :value="state.settings.rm_formula"
                @change="updateSetting('rm_formula', $event.target.value)">
                <option value="epley">Epley</option>
                <option value="brzycki">Brzycki</option>
                <option value="lander">Lander</option>
                <option value="oconner">O'Conner</option>
                <option value="lombardi">Lombardi</option>
              </select>
              <details class="rm-formula-help">
              <summary>{{ t('settings.rm_help_title') }}</summary>
              <p>{{ t('settings.advanced_help') }}</p>
              <p>{{ t('settings.rm_help_definition') }}</p>
              <p>{{ t('settings.rm_help_choice') }}</p>
              <dl>
                <template v-for="formula in ['epley','brzycki','lander','oconner','lombardi']" :key="formula">
                  <dt>{{ t('settings.rm_name_' + formula) }}</dt><dd>{{ t('settings.rm_description_' + formula) }}</dd>
                </template>
              </dl>
              <p>{{ t('settings.rm_help_10rm') }}</p>
              <p>{{ t('settings.rm_help_limits') }}</p>
              </details>
            </div>
            </section>
            <section class="settings-advanced-card">
            <h3>{{ t('settings.section_network') }}</h3>
            <div class="setting-row">
              <label class="setting-row__label" for="SettingsView-state-settings-network_host">{{ t('settings.network_host') }}</label>
              <select id="SettingsView-state-settings-network_host" class="form-select setting-row__control"
                :value="state.settings.network_host"
                @change="updateSetting('network_host', $event.target.value)">
                <option value="127.0.0.1">{{ t('settings.network_host_local') }}</option>
                <option value="0.0.0.0">{{ t('settings.network_host_lan') }}</option>
              </select>
            </div>
            <div class="setting-row">
              <label class="setting-row__label" for="SettingsView-state-settings-network_port">{{ t('settings.network_port') }}</label>
              <input id="SettingsView-state-settings-network_port" class="form-input setting-row__control setting-row__control--sm"
                type="number" min="1024" max="65535" step="1"
                :value="state.settings.network_port"
                @input="updateSetting('network_port', parseInt($event.target.value))" />
            </div>
            <div v-if="state.networkChanged"
              class="settings-notice settings-notice--warning">
              {{ t('settings.network_restart') }}
            </div>
            </section>
            <section class="settings-advanced-card">
            <h3>{{ t('settings.section_data') }}</h3>
            <ExportImport />
            </section>

          </SettingsSection>

          </fieldset>
        </template>
        <section v-if="canLogout" class="settings-account" :aria-label="t('settings.logout')">
          <button type="button" class="btn btn--secondary" :disabled="busy || store.pendingRequests > 0"
            @click="showLogout = true">{{ t('settings.logout') }}</button>
        </section>
      </div>
      <ConfirmModal v-if="showLogout" :title="t('settings.logout')" :body="t('settings.logout_confirm')"
        :confirm-text="t('settings.logout')" :busy="busy || store.pendingRequests > 0"
        @confirm="logout" @cancel="showLogout = false">
        <p v-if="dirty" class="settings-notice settings-notice--warning">{{ t('settings.logout_unsaved') }}</p>
      </ConfirmModal>
      <div v-if="dirty" class="settings-save-dock" role="region" :aria-label="t('settings.pending_changes')">
        <span class="settings-save-dock__message" role="status">{{ t('settings.pending_changes') }}</span>
        <button type="button" class="btn btn--secondary" :disabled="busy" @click="discard()">{{ t('common.cancel') }}</button>
        <button type="button" class="btn btn--primary" :disabled="busy" @click="saveAll()">{{ state.saving ? t('common.loading') : t('common.save') }}</button>
      </div>
    </div>
  `
}
