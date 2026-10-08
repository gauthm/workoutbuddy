import { reactive, onMounted, inject } from '/vendor/vue.esm-browser.prod.js'
import {
  sessions as sessionsApi,
  exercises as exercisesApi
} from '../../api.js'
import { t } from '../../i18n.js'
import PageHeader    from '../layout/PageHeader.js'
import LoadingSpinner from '../common/LoadingSpinner.js'
import EmptyState    from '../common/EmptyState.js'
import ErrorBanner   from '../common/ErrorBanner.js'
import ConfirmModal  from '../common/ConfirmModal.js'
import ExerciseBlock from './ExerciseBlock.js'
import SessionTimer  from './SessionTimer.js'
import SessionAdjustmentBanner from './SessionAdjustmentBanner.js'

export default {
  name: 'SessionActiveView',
  components: {
    PageHeader, LoadingSpinner, EmptyState, ErrorBanner,
    ConfirmModal, ExerciseBlock, SessionTimer, SessionAdjustmentBanner
  },

  setup() {
    const router = inject('router')
    const store  = inject('store')

    const state = reactive({
      loading: true, error: null,
      session: null,
      exercises: [],    // [{ sessionExercise, exerciseDetail, history, target }]
      showCompleteConfirm: false,
      completing: false,
      adjustments: [],      // ajustements retournés par POST /start
      showAdjustments: true,
    })

    async function load() {
      state.loading = true; state.error = null
      try {
        // Chercher une séance in_progress
        const data = await sessionsApi.list({ status: 'in_progress', limit: 1 })
        if (!data.sessions.length) {
          state.session = null; state.loading = false; return
        }
        const session = await sessionsApi.get(data.sessions[0].id)
        state.session = session
        store.setActiveSession(session)

        // Pour chaque exercise, charger le détail + l'historique + la cible
        const enriched = []
        for (const se of session.exercises) {
          const [detail, history] = await Promise.all([
            exercisesApi.get(se.exercise_id),
            exercisesApi.history(se.exercise_id, { limit: 5 }),
          ])
          let target = { weight_kg: 0, reps_min: 8, reps_max: 12, explanation: '' }
          if (se.template_exercise_id) {
            try {
              target = await sessionsApi.target(session.id, se.template_exercise_id)
            } catch (_) { /* pas de cible si non rattaché à un template */ }
          }
          enriched.push({
            sessionExercise: se,
            exerciseDetail:  detail,
            history:         history.history,
            target,
          })
        }
        state.exercises = enriched
      } catch (err) {
        state.error = err.message
      } finally {
        state.loading = false
      }
    }

    async function completeSession() {
      if (!state.session) return
      state.completing = true
      try {
        await sessionsApi.complete(state.session.id)
        store.clearActiveSession()
        store.showToast(t('session.completed_toast'), 'success')
        router.push('#/session/history')
      } catch (err) {
        store.showToast(err.message, 'error')
      } finally {
        state.completing = false
        state.showCompleteConfirm = false
      }
    }

    onMounted(() => {
      // Les ajustements coach arrivent de POST /sessions/:id/start (store, non persistant)
      state.adjustments = store.pendingAdjustments || []
      store.clearPendingAdjustments()
      load()
    })

    return { state, load, completeSession, router, t }
  },

  template: `
    <div class="view">
      <!-- Header avec chronomètre -->
      <header class="page-header">
        <h1 class="page-header__title">
          {{ state.session?.name || t('session.title') }}
        </h1>
        <SessionTimer
          v-if="state.session?.started_at"
          :started-at="state.session.started_at"
        />
        <button
          v-if="state.session"
          class="btn btn--primary"
          style="padding:0.35rem 0.75rem;font-size:0.8rem"
          @click="state.showCompleteConfirm = true">
          {{ t('session.complete') }}
        </button>
      </header>

      <div class="view__content">
        <SessionAdjustmentBanner
          v-if="state.adjustments.length && state.showAdjustments"
          :adjustments="state.adjustments"
          @dismiss="state.showAdjustments = false"
        />

        <LoadingSpinner v-if="state.loading" />
        <ErrorBanner   v-else-if="state.error" :message="state.error" :retry="load" />

        <!-- Aucune séance active -->
        <EmptyState
          v-else-if="!state.session"
          icon="🏋️"
          :message="t('session.no_active')">
          <button class="btn btn--primary" style="margin-top:1rem"
            @click="router.push('#/programs')">
            {{ t('session.start_button') }}
          </button>
        </EmptyState>

        <!-- Séance active -->
        <template v-else>
          <ExerciseBlock
            v-for="item in state.exercises"
            :key="item.sessionExercise.id"
            :session-exercise="item.sessionExercise"
            :target-weight="item.target.weight_kg"
            :target-reps-min="item.target.reps_min"
            :target-reps-max="item.target.reps_max"
            :rest-seconds="item.sessionExercise.rest_seconds || 90"
            :exercise-detail="item.exerciseDetail"
            :history="item.history"
            :target="item.target"
            @set-validated="() => {}"
          />
        </template>
      </div>

      <!-- Confirmation terminer -->
      <ConfirmModal
        v-if="state.showCompleteConfirm"
        :title="t('session.complete_confirm')"
        :confirm-text="t('session.complete')"
        @confirm="completeSession()"
        @cancel="state.showCompleteConfirm = false"
      />
    </div>
  `
}
