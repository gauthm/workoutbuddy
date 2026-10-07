import { t } from '../i18n.js'
export default {
  name: 'DashboardView',
  setup() { return { t } },
  template: `
    <div class="view">
      <header class="page-header">
        <h1 class="page-header__title">WorkoutBuddy</h1>
      </header>
      <main class="view__content" style="padding:1.5rem;text-align:center;color:var(--color-text-muted)">
        <p>{{ t('dashboard.welcome') }}</p>
      </main>
    </div>
  `
}
