import { computed, inject, defineAsyncComponent, h, resolveComponent }
  from '/vendor/vue.esm-browser.prod.js'
import { t } from '../../i18n.js'
import BottomNav from './BottomNav.js'
import PageHeader from './PageHeader.js'
import Toast from '../common/Toast.js'
import AppUpdateBanner from '../common/AppUpdateBanner.js'

// Statically import all views
// (views not yet implemented use a placeholder)
import DashboardView        from '../../views/DashboardView.js'
import ExerciseListView     from '../exercises/ExerciseListView.js'
import ExerciseDetailView   from '../exercises/ExerciseDetailView.js'
import EquipmentView        from '../equipment/EquipmentView.js'
import ProgramListView      from '../programs/ProgramListView.js'
import ProgramDetailView    from '../programs/ProgramDetailView.js'
import ProgramGenerator     from '../programs/ProgramGenerator.js'
import SessionActiveView    from '../session/SessionActiveView.js'
import SessionHistoryView   from '../session/SessionHistoryView.js'
import SessionDetailView    from '../session/SessionDetailView.js'
import CalendarView         from '../calendar/CalendarView.js'
import BodyWeightView       from '../stats/BodyWeightView.js'
import StatsDashboardView   from '../stats/StatsDashboardView.js'
import ExerciseProgressView from '../stats/ExerciseProgressView.js'
import CoachView            from '../coach/CoachView.js'
import SettingsView         from '../settings/SettingsView.js'

// Placeholder for views not yet implemented
const Placeholder = (name) => ({
  name,
  setup: () => ({ t, viewName: name }),
  template: `<div style="padding:1.5rem;color:var(--color-text-muted);text-align:center">
    <p>{{ t('app.view_not_implemented', { name: viewName }) }}</p>
  </div>`
})

const VIEW_MAP = {
  DashboardView,
  ExerciseListView,
  ExerciseDetailView,
  EquipmentView,
  // Upcoming milestones: placeholders for now
  ProgramListView,
  ProgramDetailView,
  ProgramGenerator,
  SessionActiveView,
  SessionHistoryView,
  SessionDetailView,
  CalendarView,
  StatsDashboardView,
  ExerciseProgressView,
  BodyWeightView,
  CoachView,
  SettingsView,
}

export default {
  name: 'AppShell',
  components: { BottomNav, PageHeader, Toast, AppUpdateBanner },

  setup() {
    const router = inject('router')
    const store  = inject('store')

    const currentView = computed(() => {
      const name = router.currentRoute.name
      return VIEW_MAP[name] || Placeholder(name)
    })

    // Routes that hide BottomNav
    const HIDE_NAV = []
    const showNav = computed(() => !HIDE_NAV.includes(router.currentRoute.name))

    return { currentView, showNav, store, router }
  },

  template: `
    <div class="app-shell">
      <KeepAlive include="CoachView">
        <component
          :is="currentView"
          :key="router.currentRoute.name + (router.currentRoute.name === 'ExerciseListView' ? '' : JSON.stringify(router.currentRoute.params))"
          v-bind="router.currentRoute.params"
        />
      </KeepAlive>
      <AppUpdateBanner />
      <BottomNav v-if="showNav" />
      <Toast v-if="store.toast" :toast="store.toast" @dismiss="store.dismissToast()" />
    </div>
  `
}
