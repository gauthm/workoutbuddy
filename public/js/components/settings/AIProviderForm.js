import { reactive, inject, computed } from '/vendor/vue.esm-browser.prod.js'
import { settings as settingsApi } from '../../api.js'
import { t } from '../../i18n.js'

export default {
  name: 'AIProviderForm',
  props: {
    currentSettings: { type: Object, required: true }
    // { ai_base_url, ai_model, ai_api_key_set }
  },

  setup(props, { expose }) {
    const store = inject('store')

    const state = reactive({
      base_url:    props.currentSettings.ai_base_url || '',
      model:       props.currentSettings.ai_model    || '',
      api_key:     '',       // always empty when displayed
      models:      [],
      testing:     false,
      testResult:  null,     // { ok: bool, message: string }
      listingModels: false,
      baseline: { base_url:props.currentSettings.ai_base_url || '', model:props.currentSettings.ai_model || '' },
    })

    function draft() {
      const body = { ai_base_url: state.base_url.trim(), ai_model: state.model.trim() }
      if (state.api_key.trim()) body.ai_api_key = state.api_key.trim()
      return body
    }
    const dirty = computed(() => state.base_url !== state.baseline.base_url || state.model !== state.baseline.model || state.api_key !== '')
    const busy = computed(() => state.testing || state.listingModels)
    const valid = computed(() => !!state.base_url.trim() && !!state.model.trim())
    function getPatch() {
      const patch = {}
      if (state.base_url !== state.baseline.base_url) patch.ai_base_url = state.base_url.trim()
      if (state.model !== state.baseline.model) patch.ai_model = state.model.trim()
      if (state.api_key.trim()) patch.ai_api_key = state.api_key.trim()
      return patch
    }
    function acceptSaved(settings) {
      state.base_url = settings.ai_base_url || ''
      state.model = settings.ai_model || ''
      state.api_key = ''
      state.baseline = { base_url:state.base_url, model:state.model }
    }
    function reset() { state.base_url = state.baseline.base_url; state.model = state.baseline.model; state.api_key = ''; state.models = []; state.testResult = null }
    expose({ dirty, busy, valid, getPatch, acceptSaved, reset })

    async function testConnection() {
      state.testing    = true
      state.testResult = null
      try {
        const res = await settingsApi.testAI(draft())
        state.testResult = {
          ok:      true,
          message: t('settings.ai_test_ok', { ms: res.latency_ms }),
        }
      } catch (err) {
        state.testResult = {
          ok:      false,
          message: t('settings.ai_test_fail', { error: err.message }),
        }
      } finally {
        state.testing = false
      }
    }

    async function listModels() {
      state.listingModels = true
      state.models        = []
      try {
        const res    = await settingsApi.listModels(draft())
        state.models = res.models
        if (state.models.length === 0) {
          store.showToast(t('settings.ai_no_models'), 'info')
        }
      } catch (err) {
        store.showToast(err.message, 'error')
      } finally {
        state.listingModels = false
      }
    }

    function selectModel(modelId) {
      state.model  = modelId
      state.testResult = null
      state.models = []   // close the dropdown after selection
    }

    return {
      state, dirty, valid, testConnection, listModels, selectModel, t,
    }
  },

  template: `
    <div class="ai-form">
      <!-- Base URL -->
      <div class="form-group">
        <label class="form-label" for="ai-provider-url">{{ t('settings.ai_base_url') }}</label>
        <div style="display:flex;gap:0.5rem">
          <input
            class="form-input"
            id="ai-provider-url" type="url"
            v-model="state.base_url"
            :placeholder="t('settings.ai_url_hint')"
            @input="state.testResult = null; state.models = []"
          />
        </div>
        <div style="font-size:0.75rem;color:var(--color-text-muted);margin-top:0.25rem">
          {{ t('settings.ai_url_hint') }}
        </div>
      </div>

      <!-- Model -->
      <div class="form-group">
        <label class="form-label" for="ai-provider-model">{{ t('settings.ai_model') }}</label>
        <div style="display:flex;gap:0.5rem">
          <input
            class="form-input"
            id="ai-provider-model" type="text"
            v-model="state.model"
            placeholder="gpt-4o-mini"
            @input="state.testResult = null"
            style="flex:1"
          />
          <button class="btn btn--secondary"
            style="flex-shrink:0;padding:0.6rem 0.75rem;font-size:0.8rem"
            :disabled="!state.base_url.trim() || state.listingModels || state.testing"
            @click="listModels()">
            {{ state.listingModels ? '…' : t('settings.ai_list_models') }}
          </button>
        </div>

        <!-- Available models -->
        <div v-if="state.models.length" class="ai-models-list">
          <button
            v-for="m in state.models" :key="m.id"
            class="ai-model-item"
            :class="{ 'ai-model-item--active': state.model === m.id }"
            @click="selectModel(m.id)">
            {{ m.name || m.id }}
          </button>
        </div>
      </div>

      <!-- API key -->
      <div class="form-group">
        <label class="form-label" for="ai-provider-key">{{ t('settings.ai_api_key') }}</label>
        <div style="display:flex;gap:0.5rem;align-items:center">
          <input
            class="form-input"
            id="ai-provider-key" type="password" @input="state.testResult = null"
            autocomplete="off"
            v-model="state.api_key"
            :placeholder="currentSettings.ai_api_key_set
              ? t('settings.ai_api_key_mask')
              : 'sk-...'"
            style="flex:1"
          />
        </div>
        <div style="font-size:0.75rem;margin-top:0.25rem"
          :style="{ color: currentSettings.ai_api_key_set
            ? 'var(--color-success)' : 'var(--color-text-muted)' }">
          {{ currentSettings.ai_api_key_set
            ? t('settings.ai_api_key_set')
            : t('settings.ai_api_key_not_set') }}
        </div>
      </div>

      <div class="ai-form__actions">
        <button type="button" class="btn btn--secondary"
          :disabled="!state.base_url.trim() || !state.model.trim() || state.testing || state.listingModels"
          @click="testConnection()">
          {{ state.testing ? t('settings.ai_testing') : t('settings.ai_test') }}
        </button>
      </div>

      <p v-if="dirty && !valid" class="settings-notice settings-notice--warning">{{ t('settings.ai_fields_required') }}</p>

      <!-- Test result -->
      <div v-if="state.testResult" class="ai-test-result"
        :class="state.testResult.ok ? 'ai-test-result--ok' : 'ai-test-result--fail'">
        {{ state.testResult.message }}
      </div>
    </div>
  `
}
