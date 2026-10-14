import { reactive } from '/vendor/vue.esm-browser.prod.js'

// Toutes les routes définies — ordre important : spécifiques avant génériques
const ROUTE_DEFS = [
  { re: /^#\/?$/,                          name: 'DashboardView',         params: [] },
  { re: /^#\/exercises\/new$/,             name: 'ExerciseFormView',      params: [] },
  { re: /^#\/exercises\/([^/]+)\/edit$/,   name: 'ExerciseEditView',      params: ['id'] },
  { re: /^#\/exercises\/material$/, name: 'ExerciseListView', params: [], defaults: { tab: 'material' } },
  { re: /^#\/exercises\/pain$/, name: 'ExerciseListView', params: [], defaults: { tab: 'pain' } },
  { re: /^#\/exercises\/([^/]+)$/,         name: 'ExerciseDetailView',    params: ['id'] },
  { re: /^#\/exercises$/,                  name: 'ExerciseListView',      params: [] },
  { re: /^#\/equipment$/,                  name: 'ExerciseListView', params: [], defaults: { tab: 'material' } },
  { re: /^#\/programs\/new$/,               name: 'ProgramGenerator',      params: [] },
  { re: /^#\/programs\/generate$/,           name: 'ProgramGenerator',      params: [] },
  { re: /^#\/programs\/([^/]+)$/,           name: 'ProgramDetailView',     params: ['id'] },
  { re: /^#\/programs$/,                   name: 'ProgramListView',       params: [] },
  { re: /^#\/session\/history$/,           name: 'SessionHistoryView',    params: [] },
  { re: /^#\/session\/([^/]+)$/,           name: 'SessionDetailView',     params: ['id'] },
  { re: /^#\/session$/,                    name: 'SessionActiveView',     params: [] },
  { re: /^#\/calendar$/,                   name: 'CalendarView',          params: [] },
  { re: /^#\/stats\/exercise\/([^/]+)$/,   name: 'ExerciseProgressView',  params: ['id'] },
  { re: /^#\/stats\/bodyweight$/,          name: 'BodyWeightView',        params: [] },
  { re: /^#\/stats$/,                      name: 'StatsDashboardView',    params: [] },
  { re: /^#\/coach$/,                      name: 'CoachView',             params: [] },
  { re: /^#\/settings$/,                   name: 'SettingsView',          params: [] },
]

function matchRoute(hash) {
  const h = (!hash || hash === '' || hash === '#') ? '#/' : hash
  for (const def of ROUTE_DEFS) {
    const m = h.match(def.re)
    if (m) {
      const params = { ...def.defaults }
      def.params.forEach((name, i) => { params[name] = decodeURIComponent(m[i + 1] || '') })
      return { name: def.name, params }
    }
  }
  return { name: 'DashboardView', params: {} }  // fallback
}

export const router = reactive({
  currentRoute: { name: 'DashboardView', params: {} },

  push(hash) {
    window.location.hash = hash
  },

  back() {
    window.history.back()
  },

  replace(hash) {
    // Remplace sans ajouter d'entrée dans l'historique
    const url = window.location.href.split('#')[0] + hash
    window.history.replaceState(null, '', url)
    this._update()
  },

  _update() {
    const route = matchRoute(window.location.hash)
    this.currentRoute.name   = route.name
    this.currentRoute.params = route.params
    window.scrollTo(0, 0)
  },

  init() {
    window.addEventListener('hashchange', () => this._update())
    this._update()
  }
})
