import { reactive, onMounted, inject } from '/vendor/vue.esm-browser.prod.js'
import { settings as settingsApi } from '../../api.js'
import { t, i18n } from '../../i18n.js'
import PageHeader       from '../layout/PageHeader.js'
import LoadingSpinner   from '../common/LoadingSpinner.js'
import ErrorBanner      from '../common/ErrorBanner.js'
import SettingsSection  from './SettingsSection.js'
import AIProviderForm   from './AIProviderForm.js'
import ExportImport     from './ExportImport.js'

export default {
  name: 'SettingsView',
  components: {
    PageHeader, LoadingSpinner, ErrorBanner,
    SettingsSection, AIProviderForm, ExportImport,
  },

  setup() {
    const store = inject('store')

    const state = reactive({
      loading:  false,
      error:    null,
      settings: null,
      saving:   {},    // { key: bool } — indique quelle clé est en cours de sauvegarde
      networkChanged: false,
    })

    // ── Chargement ───────────────────────────────────────────
    async function load() {
      state.loading = true; state.error = null
      try {
        state.settings = await settingsApi.get()
        store.setSettings(state.settings)
      } catch (err) {
        state.error = err.message
      } finally {
        state.loading = false
      }
    }

    // ── Sauvegarde d'un paramètre ────────────────────────────
    async function saveSetting(key, value) {
      state.saving[key] = true
      try {
        const res = await settingsApi.update({ [key]: value })
        state.settings = { ...state.settings, ...res }
        store.setSettings(state.settings)
        store.showToast(t('settings.saved'), 'success')

        // Appliquer immédiatement les changements UI
        if (key === 'theme') {
          document.documentElement.setAttribute('data-theme', value)
        }
        if (key === 'language') {
          await i18n.setLocale(value)
        }
        if (res.restart_required) {
          state.networkChanged = true
        }
      } catch (err) {
        store.showToast(err.message, 'error')
      } finally {
        state.saving[key] = false
      }
    }

    // ── Sauvegarde depuis AIProviderForm ─────────────────────
    async function onAiSaved(changes) {
      const res = await settingsApi.get()
      state.settings = res
      store.setSettings(res)
    }

    onMounted(load)
    return { state, load, saveSetting, onAiSaved, t }
  },

  template: `
    <div class="view">
      <PageHeader :title="t('settings.title')" />

      <div class="view__content">
        <LoadingSpinner v-if="state.loading" />
        <ErrorBanner v-else-if="state.error" :message="state.error" :retry="load" />

        <template v-else-if="state.settings">

          <!-- ① Général ───────────────────────────────────── -->
          <SettingsSection :title="t('settings.section_general')" :default-open="true">
            <div class="setting-row">
              <label class="setting-row__label">{{ t('settings.unit') }}</label>
              <select class="form-select setting-row__control"
                :value="state.settings.unit"
                @change="saveSetting('unit', $event.target.value)">
                <option value="kg">{{ t('settings.unit_kg') }}</option>
                <option value="lb">{{ t('settings.unit_lb') }}</option>
              </select>
            </div>
            <div class="setting-row">
              <label class="setting-row__label">{{ t('settings.rm_formula') }}</label>
              <select class="form-select setting-row__control"
                :value="state.settings.rm_formula"
                @change="saveSetting('rm_formula', $event.target.value)">
                <option value="epley">Epley</option>
                <option value="brzycki">Brzycki</option>
                <option value="lander">Lander</option>
                <option value="oconner">O'Conner</option>
                <option value="lombardi">Lombardi</option>
              </select>
            </div>
            <div class="setting-row">
              <label class="setting-row__label">{{ t('settings.theme') }}</label>
              <select class="form-select setting-row__control"
                :value="state.settings.theme"
                @change="saveSetting('theme', $event.target.value)">
                <option value="dark">{{ t('settings.theme_dark') }}</option>
                <option value="light">{{ t('settings.theme_light') }}</option>
              </select>
            </div>
            <div class="setting-row">
              <label class="setting-row__label">{{ t('settings.language') }}</label>
              <select class="form-select setting-row__control"
                :value="state.settings.language"
                @change="saveSetting('language', $event.target.value)">
                <option value="fr">{{ t('settings.language_fr') }}</option>
                <option value="en">{{ t('settings.language_en') }}</option>
              </select>
            </div>
          </SettingsSection>

          <!-- ② Entraînement ──────────────────────────────── -->
          <SettingsSection :title="t('settings.section_training')">
            <div class="setting-row">
              <label class="setting-row__label">{{ t('settings.default_rest') }}</label>
              <input class="form-input setting-row__control setting-row__control--sm"
                type="number" min="10" max="600" step="10"
                :value="state.settings.default_rest_seconds"
                @change="saveSetting('default_rest_seconds', parseInt($event.target.value))" />
            </div>
            <div class="setting-row">
              <label class="setting-row__label">{{ t('settings.linear_increment') }}</label>
              <input class="form-input setting-row__control setting-row__control--sm"
                type="number" min="0.5" max="10" step="0.5"
                :value="state.settings.linear_increment_kg"
                @change="saveSetting('linear_increment_kg', parseFloat($event.target.value))" />
            </div>
            <div class="setting-row">
              <label class="setting-row__label">{{ t('settings.dumbbell_increment') }}</label>
              <input class="form-input setting-row__control setting-row__control--sm"
                type="number" min="0.5" max="5" step="0.5"
                :value="state.settings.linear_dumbbell_increment_kg"
                @change="saveSetting('linear_dumbbell_increment_kg', parseFloat($event.target.value))" />
            </div>
            <div class="setting-row">
              <label class="setting-row__label">{{ t('settings.warmup_sets') }}</label>
              <select class="form-select setting-row__control"
                :value="state.settings.warmup_sets_count"
                @change="saveSetting('warmup_sets_count', parseInt($event.target.value))">
                <option value="0">0</option>
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
              </select>
            </div>
            <div class="setting-row setting-row--switch">
              <label class="setting-row__label">{{ t('settings.show_rpe') }}</label>
              <input type="checkbox" class="setting-row__switch"
                :checked="state.settings.show_rpe_field"
                @change="saveSetting('show_rpe_field', $event.target.checked)" />
            </div>
            <div class="setting-row setting-row--switch">
              <label class="setting-row__label">{{ t('settings.show_rir') }}</label>
              <input type="checkbox" class="setting-row__switch"
                :checked="state.settings.show_rir_field"
                @change="saveSetting('show_rir_field', $event.target.checked)" />
            </div>
            <div class="setting-row setting-row--switch">
              <label class="setting-row__label">{{ t('settings.timer_sound') }}</label>
              <input type="checkbox" class="setting-row__switch"
                :checked="state.settings.timer_sound_enabled"
                @change="saveSetting('timer_sound_enabled', $event.target.checked)" />
            </div>
            <div class="setting-row setting-row--switch">
              <label class="setting-row__label">{{ t('settings.timer_vibration') }}</label>
              <input type="checkbox" class="setting-row__switch"
                :checked="state.settings.timer_vibration_enabled"
                @change="saveSetting('timer_vibration_enabled', $event.target.checked)" />
            </div>
            <div class="setting-row">
              <label class="setting-row__label">{{ t('settings.bodyweight_days') }}</label>
              <input class="form-input setting-row__control setting-row__control--sm"
                type="number" min="30" max="730" step="30"
                :value="state.settings.bodyweight_display_days"
                @change="saveSetting('bodyweight_display_days', parseInt($event.target.value))" />
            </div>
          </SettingsSection>

          <!-- ③ Progression ───────────────────────────────── -->
          <SettingsSection :title="t('settings.section_progression')">
            <div class="setting-row">
              <label class="setting-row__label">{{ t('settings.failure_threshold') }}</label>
              <select class="form-select setting-row__control"
                :value="state.settings.progression_failure_threshold"
                @change="saveSetting('progression_failure_threshold', parseInt($event.target.value))">
                <option v-for="n in [1,2,3,4,5]" :key="n" :value="n">{{ n }}</option>
              </select>
            </div>
            <div class="setting-row">
              <label class="setting-row__label">{{ t('settings.weight_reduction') }}</label>
              <input class="form-input setting-row__control setting-row__control--sm"
                type="number" min="5" max="30" step="5"
                :value="state.settings.progression_weight_reduction_pct"
                @change="saveSetting('progression_weight_reduction_pct', parseInt($event.target.value))" />
            </div>
            <div class="setting-row">
              <label class="setting-row__label">{{ t('settings.plateau_sessions') }}</label>
              <input class="form-input setting-row__control setting-row__control--sm"
                type="number" min="3" max="8" step="1"
                :value="state.settings.plateau_detection_sessions"
                @change="saveSetting('plateau_detection_sessions', parseInt($event.target.value))" />
            </div>
          </SettingsSection>

          <!-- ④ Deload ─────────────────────────────────────── -->
          <SettingsSection :title="t('settings.section_deload')">
            <div class="setting-row setting-row--switch">
              <label class="setting-row__label">{{ t('settings.deload_auto') }}</label>
              <input type="checkbox" class="setting-row__switch"
                :checked="state.settings.deload_auto_enabled"
                @change="saveSetting('deload_auto_enabled', $event.target.checked)" />
            </div>
            <div class="setting-row">
              <label class="setting-row__label">{{ t('settings.deload_freq') }}</label>
              <input class="form-input setting-row__control setting-row__control--sm"
                type="number" min="2" max="16" step="1"
                :value="state.settings.deload_frequency_weeks"
                @change="saveSetting('deload_frequency_weeks', parseInt($event.target.value))" />
            </div>
            <div class="setting-row">
              <label class="setting-row__label">{{ t('settings.deload_load_reduction') }}</label>
              <input class="form-input setting-row__control setting-row__control--sm"
                type="number" min="10" max="40" step="5"
                :value="state.settings.deload_load_reduction_pct"
                @change="saveSetting('deload_load_reduction_pct', parseInt($event.target.value))" />
            </div>
            <div class="setting-row">
              <label class="setting-row__label">{{ t('settings.deload_volume_reduction') }}</label>
              <input class="form-input setting-row__control setting-row__control--sm"
                type="number" min="20" max="60" step="10"
                :value="state.settings.deload_volume_reduction_pct"
                @change="saveSetting('deload_volume_reduction_pct', parseInt($event.target.value))" />
            </div>
            <div class="setting-row">
              <label class="setting-row__label">{{ t('settings.deload_min_sets') }}</label>
              <select class="form-select setting-row__control"
                :value="state.settings.deload_min_sets"
                @change="saveSetting('deload_min_sets', parseInt($event.target.value))">
                <option v-for="n in [1,2,3,4]" :key="n" :value="n">{{ n }}</option>
              </select>
            </div>
          </SettingsSection>

          <!-- ⑤ Signaux matériel ───────────────────────────── -->
          <SettingsSection :title="t('settings.section_signals')">
            <div class="setting-row">
              <label class="setting-row__label">{{ t('settings.advice_cooldown') }}</label>
              <input class="form-input setting-row__control setting-row__control--sm"
                type="number" min="1" max="90" step="1"
                :value="state.settings.equipment_advice_cooldown_days"
                @change="saveSetting('equipment_advice_cooldown_days', parseInt($event.target.value))" />
            </div>
            <div class="setting-row">
              <label class="setting-row__label">{{ t('settings.advice_max_load_sessions') }}</label>
              <select class="form-select setting-row__control"
                :value="state.settings.equipment_advice_max_load_sessions"
                @change="saveSetting('equipment_advice_max_load_sessions', parseInt($event.target.value))">
                <option v-for="n in [1,2,3,4,5]" :key="n" :value="n">{{ n }}</option>
              </select>
            </div>
            <div class="setting-row">
              <label class="setting-row__label">{{ t('settings.advice_min_incr_pct') }}</label>
              <input class="form-input setting-row__control setting-row__control--sm"
                type="number" min="1" max="20" step="1"
                :value="state.settings.equipment_advice_min_increment_pct"
                @change="saveSetting('equipment_advice_min_increment_pct', parseInt($event.target.value))" />
            </div>
            <div class="setting-row">
              <label class="setting-row__label">{{ t('settings.advice_plateau_sessions') }}</label>
              <input class="form-input setting-row__control setting-row__control--sm"
                type="number" min="3" max="10" step="1"
                :value="state.settings.equipment_advice_plateau_sessions"
                @change="saveSetting('equipment_advice_plateau_sessions', parseInt($event.target.value))" />
            </div>
          </SettingsSection>

          <!-- ⑥ Coach IA ─────────────────────────────────── -->
          <SettingsSection :title="t('settings.section_ai')">
            <AIProviderForm
              :current-settings="state.settings"
              @saved="onAiSaved"
            />
          </SettingsSection>

          <!-- ⑦ Réseau ─────────────────────────────────────── -->
          <SettingsSection :title="t('settings.section_network')">
            <div class="setting-row">
              <label class="setting-row__label">{{ t('settings.network_host') }}</label>
              <select class="form-select setting-row__control"
                :value="state.settings.network_host"
                @change="saveSetting('network_host', $event.target.value)">
                <option value="127.0.0.1">{{ t('settings.network_host_local') }}</option>
                <option value="0.0.0.0">{{ t('settings.network_host_lan') }}</option>
              </select>
            </div>
            <div class="setting-row">
              <label class="setting-row__label">{{ t('settings.network_port') }}</label>
              <input class="form-input setting-row__control setting-row__control--sm"
                type="number" min="1024" max="65535" step="1"
                :value="state.settings.network_port"
                @change="saveSetting('network_port', parseInt($event.target.value))" />
            </div>
            <div v-if="state.networkChanged"
              class="settings-notice settings-notice--warning">
              {{ t('settings.network_restart') }}
            </div>
          </SettingsSection>

          <!-- ⑧ Données ──────────────────────────────────── -->
          <SettingsSection :title="t('settings.section_data')">
            <ExportImport />
          </SettingsSection>

        </template>
      </div>
    </div>
  `
}
