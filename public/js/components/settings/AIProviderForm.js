import { reactive, inject } from '/vendor/vue.esm-browser.prod.js'
import { settings as settingsApi } from '../../api.js'
import { t } from '../../i18n.js'

export default {
  name: 'AIProviderForm',
  props: {
    currentSettings: { type: Object, required: true }
    // { ai_base_url, ai_model, ai_api_key_set }
  },
  emits: ['saved'],

  setup(props, { emit }) {
    const store = inject('store')

    const state = reactive({
      base_url:    props.currentSettings.ai_base_url || '',
      model:       props.currentSettings.ai_model    || '',
      api_key:     '',       // toujours vide en affichage
      models:      [],
      testing:     false,
      testResult:  null,     // { ok: bool, message: string }
      listingModels: false,
      savingUrl:   false,
      savingModel: false,
      savingKey:   false,
    })

    async function saveField(key, value) {
      if (!value && key !== 'ai_api_key') return
      try {
        await settingsApi.update({ [key]: value })
        emit('saved', { [key]: value })
        if (key === 'ai_api_key') {
          state.api_key = ''
          store.showToast(
            value ? t('settings.ai_api_key_set') : t('settings.ai_api_key_not_set'),
            'success'
          )
        } else {
          store.showToast(t('settings.saved'), 'success')
        }
      } catch (err) {
        store.showToast(err.message, 'error')
      }
    }

    async function testConnection() {
      state.testing    = true
      state.testResult = null
      try {
        const res = await settingsApi.testAI()
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
        const res    = await settingsApi.listModels()
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
      state.model = modelId
      saveField('ai_model', modelId)
    }

    return {
      state, saveField, testConnection, listModels, selectModel, t,
    }
  },

  template: `
    <div class="ai-form">
      <!-- Base URL -->
      <div class="form-group">
        <label class="form-label">{{ t('settings.ai_base_url') }}</label>
        <div style="display:flex;gap:0.5rem">
          <input
            class="form-input"
            type="url"
            v-model="state.base_url"
            :placeholder="t('settings.ai_url_hint')"
            @blur="saveField('ai_base_url', state.base_url)"
          />
        </div>
        <div style="font-size:0.75rem;color:var(--color-text-muted);margin-top:0.25rem">
          {{ t('settings.ai_url_hint') }}
        </div>
      </div>

      <!-- Modèle -->
      <div class="form-group">
        <label class="form-label">{{ t('settings.ai_model') }}</label>
        <div style="display:flex;gap:0.5rem">
          <input
            class="form-input"
            type="text"
            v-model="state.model"
            placeholder="gpt-4o-mini"
            @blur="saveField('ai_model', state.model)"
            style="flex:1"
          />
          <button class="btn btn--secondary"
            style="flex-shrink:0;padding:0.6rem 0.75rem;font-size:0.8rem"
            :disabled="!state.base_url || state.listingModels"
            @click="listModels()">
            {{ state.listingModels ? '…' : t('settings.ai_list_models') }}
          </button>
        </div>

        <!-- Liste des modèles disponibles -->
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

      <!-- Clé API -->
      <div class="form-group">
        <label class="form-label">{{ t('settings.ai_api_key') }}</label>
        <div style="display:flex;gap:0.5rem;align-items:center">
          <input
            class="form-input"
            type="password"
            autocomplete="off"
            v-model="state.api_key"
            :placeholder="currentSettings.ai_api_key_set
              ? t('settings.ai_api_key_set')
              : 'sk-...'"
            style="flex:1"
          />
          <button class="btn btn--secondary"
            style="flex-shrink:0;padding:0.6rem 0.75rem;font-size:0.8rem"
            :disabled="!state.api_key"
            @click="saveField('ai_api_key', state.api_key)">
            {{ t('common.save') }}
          </button>
        </div>
        <div style="font-size:0.75rem;margin-top:0.25rem"
          :style="{ color: currentSettings.ai_api_key_set
            ? 'var(--color-success)' : 'var(--color-text-muted)' }">
          {{ currentSettings.ai_api_key_set
            ? t('settings.ai_api_key_set')
            : t('settings.ai_api_key_not_set') }}
        </div>
      </div>

      <!-- Test de connexion -->
      <button class="btn btn--primary btn--full"
        :disabled="!state.base_url || !state.model || state.testing"
        @click="testConnection()">
        {{ state.testing ? t('settings.ai_testing') : t('settings.ai_test') }}
      </button>

      <!-- Résultat du test -->
      <div v-if="state.testResult" class="ai-test-result"
        :class="state.testResult.ok ? 'ai-test-result--ok' : 'ai-test-result--fail'">
        {{ state.testResult.message }}
      </div>
    </div>
  `
}
