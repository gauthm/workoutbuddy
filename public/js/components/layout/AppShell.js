import { computed, inject, defineAsyncComponent, h, resolveComponent }
  from '/vendor/vue.esm-browser.prod.js'
import BottomNav from './BottomNav.js'
import PageHeader from './PageHeader.js'
import Toast from '../common/Toast.js'

// Import statique de toutes les vues
// (les vues non encore implémentées utilisent un placeholder)
import DashboardView        from '../../views/DashboardView.js'
import ExerciseListView     from '../exercises/ExerciseListView.js'
import ExerciseDetailView   from '../exercises/ExerciseDetailView.js'
import ExerciseFormView     from '../exercises/ExerciseForm.js'
import EquipmentView        from '../equipment/EquipmentView.js'

// Placeholder pour les vues non encore implémentées
const Placeholder = (name) => ({
  name,
  template: `<div style="padding:1.5rem;color:var(--color-text-muted);text-align:center">
    <p>Vue « ${name} » — à implémenter</p>
  </div>`
})

const VIEW_MAP = {
  DashboardView,
  ExerciseListView,
  ExerciseDetailView,
  ExerciseFormView,
  ExerciseEditView:      ExerciseFormView,
  EquipmentView,
  // Jalons suivants — placeholders pour l'instant :
  ProgramListView:       Placeholder('ProgramListView'),
  ProgramCreateView:     Placeholder('ProgramCreateView'),
  ProgramDetailView:     Placeholder('ProgramDetailView'),
  ProgramEditView:       Placeholder('ProgramEditView'),
  SessionActiveView:     Placeholder('SessionActiveView'),
  SessionHistoryView:    Placeholder('SessionHistoryView'),
  SessionDetailView:     Placeholder('SessionDetailView'),
  CalendarView:          Placeholder('CalendarView'),
  StatsDashboardView:    Placeholder('StatsDashboardView'),
  ExerciseProgressView:  Placeholder('ExerciseProgressView'),
  BodyWeightView:        Placeholder('BodyWeightView'),
  CoachView:             Placeholder('CoachView'),
  SettingsView:          Placeholder('SettingsView'),
}

export default {
  name: 'AppShell',
  components: { BottomNav, PageHeader, Toast },

  setup() {
    const router = inject('router')
    const store  = inject('store')

    const currentView = computed(() => {
      const name = router.currentRoute.name
      return VIEW_MAP[name] || Placeholder(name)
    })

    // Routes qui N'affichent PAS la BottomNav (séance active)
    const HIDE_NAV = ['SessionActiveView']
    const showNav = computed(() => !HIDE_NAV.includes(router.currentRoute.name))

    return { currentView, showNav, store, router }
  },

  template: `
    <div class="app-shell">
      <component
        :is="currentView"
        :key="router.currentRoute.name + JSON.stringify(router.currentRoute.params)"
        v-bind="router.currentRoute.params"
      />
      <BottomNav v-if="showNav" />
      <Toast v-if="store.toast" :toast="store.toast" @dismiss="store.dismissToast()" />
    </div>
  `
}
