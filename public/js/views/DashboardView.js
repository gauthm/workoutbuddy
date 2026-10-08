import { reactive, onMounted, inject } from '/vendor/vue.esm-browser.prod.js'
import { programs as api } from '../api.js'
import { t } from '../i18n.js'

export default {
  name: 'DashboardView',
  setup() {
    const router = inject('router')
    const state = reactive({ loading: true, activeProgram: null })

    // Un seul programme actif : on l'affiche directement (pas de liste, pas de sélecteur)
    async function load() {
      state.loading = true
      try {
        const data = await api.list()
        state.activeProgram = data.programs.find(p => p.is_active) || null
      } catch {
        state.activeProgram = null
      } finally {
        state.loading = false
      }
    }

    onMounted(load)
    return { state, router, t }
  },
  template: `
    <div class="view">
      <header class="page-header">
        <h1 class="page-header__title">WorkoutBuddy</h1>
      </header>
      <main class="view__content">
        <div v-if="state.activeProgram" class="exercise-card"
          @click="router.push('#/programs/' + state.activeProgram.id)">
          <div class="exercise-card__main">
            <span class="exercise-card__name">{{ state.activeProgram.name }}</span>
            <span class="badge badge--custom">{{ t('dashboard.active_program') }}</span>
          </div>
        </div>
        <div v-else-if="!state.loading" class="program-list-notice"
          @click="router.push('#/coach')" style="cursor:pointer">
          ℹ️ {{ t('dashboard.no_program') }}
        </div>
        <p style="padding:1.5rem;text-align:center;color:var(--color-text-muted)">
          {{ t('dashboard.welcome') }}
        </p>
      </main>
    </div>
  `
}
