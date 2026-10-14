import { inject } from '/vendor/vue.esm-browser.prod.js'
import { t } from '../../i18n.js'

export default {
  name: 'BottomNav',
  setup() {
    const router = inject('router')
    const store  = inject('store')

    const tabs = [
      { hash: '#/',        icon: '🏠', labelKey: 'nav.home',      routes: ['DashboardView','ProgramListView','ProgramDetailView','ProgramForm','ProgramGenerator','SessionHistoryView','SessionDetailView','CalendarView'] },
      { hash: '#/session', icon: '🏋️', labelKey: 'nav.session',   routes: ['SessionActiveView'] },
      { hash: '#/exercises', icon: '📖', labelKey: 'nav.exercises', secondLineKey: 'nav.equipment_line', routes: ['ExerciseListView','ExerciseDetailView','ExerciseFormView','ExerciseEditView'] },
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
        :aria-label="t(tab.labelKey) + (tab.secondLineKey ? ' ' + t(tab.secondLineKey) : '')"
        :aria-current="isActive(tab) ? 'page' : undefined"
        @click="router.push(tab.hash)"
      >
        <span class="bottom-nav__icon" aria-hidden="true">{{ tab.icon }}</span>
        <span class="bottom-nav__label" :class="{ 'bottom-nav__label--two-lines': tab.secondLineKey }"><span>{{ t(tab.labelKey) }}</span><span v-if="tab.secondLineKey">{{ t(tab.secondLineKey) }}</span></span>
      </button>
    </nav>
  `
}
