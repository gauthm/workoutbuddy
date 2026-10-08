import { inject } from '/vendor/vue.esm-browser.prod.js'
import { t } from '../../i18n.js'

export default {
  name: 'OnboardingBanner',
  emits: ['start', 'skip'],
  setup(_, { emit }) {
    const router = inject('router')
    return { t, emit, router }
  },
  template: `
    <div class="onboarding-banner">
      <div class="onboarding-banner__icon">🏋️</div>
      <div class="onboarding-banner__content">
        <h2 class="onboarding-banner__title">{{ t('coach.onboarding_title') }}</h2>
        <p class="onboarding-banner__subtitle">{{ t('coach.onboarding_subtitle') }}</p>
        <div class="onboarding-banner__actions">
          <button class="btn btn--primary" @click="emit('start')">
            🤖 {{ t('coach.onboarding_start') }}
          </button>
          <button class="btn btn--secondary" @click="router.push('#/settings')">
            {{ t('coach.onboarding_skip') }}
          </button>
        </div>
      </div>
    </div>
  `
}
