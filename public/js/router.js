import { reactive } from '/vendor/vue.esm-browser.prod.js'

// All routes: specific routes must precede generic routes
const ROUTE_DEFS = [
  { re: /^#\/?$/,                          name: 'DashboardView',         params: [] },
  { re: /^#\/exercises\/new$/,             name: 'ExerciseListView',      params: [] },
  { re: /^#\/exercises\/([^/]+)\/edit$/,   name: 'ExerciseDetailView',      params: ['id'] },
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
  previousRoute: null, previousScrollY: 0,

  push(hash) {
    window.location.hash = hash
  },

  back() {
    window.history.back()
  },

  replace(hash) {
    // Replace without adding a history entry
    const url = window.location.href.split('#')[0] + hash
    window.history.replaceState(null, '', url)
    this._update()
  },

  _update() {
    this.previousRoute = {name:this.currentRoute.name,params:{...this.currentRoute.params}}
    this.previousScrollY = window.scrollY
    const route = matchRoute(window.location.hash)
    this.currentRoute.name   = route.name
    this.currentRoute.params = route.params
    window.scrollTo(0, 0)
  },

  init() {
    window.history.scrollRestoration = 'manual'
    window.addEventListener('hashchange', () => this._update())
    this._update()
  }
})
