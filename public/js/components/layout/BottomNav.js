import { inject } from '/vendor/vue.esm-browser.prod.js'
import { t } from '../../i18n.js'

export default {
  name: 'BottomNav',
  setup() {
    const router = inject('router')
    const store  = inject('store')

    const tabs = [
      { hash: '#/',        icon: '🏠', labelKey: 'nav.home',      routes: ['DashboardView'] },
      { hash: '#/session', icon: '🏋️', labelKey: 'nav.session',   routes: ['SessionActiveView','SessionHistoryView','SessionDetailView'] },
      { hash: '#/exercises', icon: '📖', labelKey: 'nav.exercises', routes: ['ExerciseListView','ExerciseDetailView','ExerciseFormView','ExerciseEditView'] },
      { hash: '#/stats',   icon: '📊', labelKey: 'nav.stats',     routes: ['StatsDashboardView','ExerciseProgressView','BodyWeightView'] },
      { hash: '#/coach',   icon: '🤖', labelKey: 'nav.coach',     routes: ['CoachView'] },
      { hash: '#/settings',icon: '⚙️', labelKey: 'nav.settings',  routes: ['SettingsView'] },
    ]

    function isActive(tab) {
      return tab.routes.includes(router.currentRoute.name)
    }

    return { tabs, isActive, router, t }
  },

  template: `
    <nav class="bottom-nav">
      <button
        v-for="tab in tabs"
        :key="tab.hash"
        class="bottom-nav__tab"
        :class="{ 'bottom-nav__tab--active': isActive(tab) }"
        @click="router.push(tab.hash)"
      >
        <span class="bottom-nav__icon">{{ tab.icon }}</span>
        <span class="bottom-nav__label">{{ t(tab.labelKey) }}</span>
      </button>
    </nav>
  `
}
