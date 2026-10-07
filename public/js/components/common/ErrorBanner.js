import { t } from '../../i18n.js'
export default {
  name: 'ErrorBanner',
  props: {
    message: { type: String, default: '' },
    retry:   { type: Function, default: null },
  },
  setup() { return { t } },
  template: `
    <div class="error-banner" role="alert">
      <span class="error-banner__icon">⚠️</span>
      <span class="error-banner__message">{{ message || t('error.generic') }}</span>
      <button v-if="retry" class="error-banner__retry" @click="retry()">
        {{ t('common.retry') }}
      </button>
    </div>
  `
}
