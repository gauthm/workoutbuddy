import { reactive, onMounted, inject, computed } from '/vendor/vue.esm-browser.prod.js'
import {
  sessions as sessionsApi,
  exercises as exercisesApi,
  programs as programsApi
} from '../../api.js'
import { t } from '../../i18n.js'
import PageHeader    from '../layout/PageHeader.js'
import LoadingSpinner from '../common/LoadingSpinner.js'
import EmptyState    from '../common/EmptyState.js'
import ErrorBanner   from '../common/ErrorBanner.js'
import ConfirmModal  from '../common/ConfirmModal.js'
import ExerciseBlock from './ExerciseBlock.js'
import SessionTimer  from './SessionTimer.js'
import RestTimer from './RestTimer.js'
import { getTimerWorker } from '../../timer-worker-singleton.js'
import SessionAdjustmentBanner from './SessionAdjustmentBanner.js'

export default {
  name: 'SessionActiveView',
  components: {
    PageHeader, LoadingSpinner, EmptyState, ErrorBanner,
    ConfirmModal, ExerciseBlock, SessionTimer, RestTimer, SessionAdjustmentBanner
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
      activeProgram: null, selectedExerciseId: null, restSequence: 0,
    })

    async function load() {
      state.loading = true; state.error = null
      try {
        // Charger le programme actif
        try {
          const progData = await programsApi.list()
          state.activeProgram = progData.programs.find(p => p.is_active) || null
        } catch { state.activeProgram = null }

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
          let target = { weight_kg: 0, reps_min: se.target_reps_min || 8, reps_max: se.target_reps_max || 12, explanation: '' }
          if (se.template_exercise_id) {
            try {
              target = await sessionsApi.target(session.id, se.template_exercise_id)
            } catch (_) { /* pas de cible si non rattaché à un template */ }
          }
          enriched.push({
            sessionExercise: se,
            exerciseDetail:  detail,
            history:         history.history,
            target, plannedSets: se.target_sets || Math.max(3,se.sets.filter(s=>!s.is_warmup).length),
          })
        }
        state.exercises = enriched
        state.selectedExerciseId = (enriched.find(item=>doneCount(item)<item.plannedSets)||enriched[0])?.sessionExercise.id ?? null
      } catch (err) {
        state.error = err.message
      } finally {
        state.loading = false
      }
    }

    const doneCount = item => item.sessionExercise.sets.filter(set=>set.is_completed && !set.is_warmup).length
    const progress = computed(() => ({done:state.exercises.reduce((n,item)=>n+doneCount(item),0), total:state.exercises.reduce((n,item)=>n+item.plannedSets,0)}))
    const remainingSets = computed(() => Math.max(0,progress.value.total-progress.value.done))
    const activeRest = computed(()=>store.activeRest?.sessionId === state.session?.id ? store.activeRest : null)
    function setsChanged(item,data) {item.sessionExercise.sets=data.sets;item.plannedSets=data.planned}
    function startRest(item,data) {
      const {seconds,setId}=data
      state.restSequence++
      store.activeRestExerciseId=item.sessionExercise.id
      store.activeRest={setId,sessionId:state.session.id,exerciseName:item.sessionExercise.name_fr,duration:seconds,deadline:Date.now()+seconds*1000}
    }
    function setReverted(item,set) {
      if(store.activeRestExerciseId === item.sessionExercise.id && (!store.activeRest?.setId || store.activeRest.setId === set.id)) {
        getTimerWorker().postMessage({type:'STOP_REST'})
        clearRest()
      }
    }
    function adjustRest(data) {
      if (store.activeRest) {store.activeRest.duration=Math.max(1,store.activeRest.duration+data.seconds);store.activeRest.deadline=Date.now()+data.remaining*1000}
    }
    function clearRest() {store.activeRest=null;store.activeRestExerciseId=null}
    function nextExercise(item) {
      const index=state.exercises.indexOf(item)
      const next=[...state.exercises.slice(index+1),...state.exercises.slice(0,index+1)].find(ex=>doneCount(ex)<ex.plannedSets)
      if(next)state.selectedExerciseId=next.sessionExercise.id
      else state.showCompleteConfirm=true
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

    return { store, state, load, completeSession, router, t, progress, remainingSets, activeRest, setsChanged, startRest, setReverted, adjustRest, clearRest, nextExercise }
  },

  template: `
    <div class="view session-active" :class="{'session-active--resting':activeRest}">
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
          :message="state.activeProgram ? t('session.no_active') : t('session.no_program')">
          <button v-if="state.activeProgram" class="btn btn--primary" style="margin-top:1rem"
            @click="router.push('#/programs/' + state.activeProgram.id)">
            {{ t('session.go_program') }}
          </button>
          <button v-else class="btn btn--primary" style="margin-top:1rem"
            @click="router.push('#/coach')">
            {{ t('programs.new') }}
          </button>
        </EmptyState>
        <!-- Séance active -->
        <template v-else>
          <div class="session-progress">
            <div class="session-progress__labels"><strong>{{ t('session.workout_progress',{done:progress.done,total:progress.total}) }}</strong><span>{{ t('session.exercise_count',{n:state.exercises.length}) }}</span></div>
            <div class="session-progress__track" role="progressbar" :aria-label="t('session.progress_label')" :aria-valuenow="progress.done" :aria-valuemax="progress.total" aria-valuemin="0">
              <div :style="{width: (progress.total ? Math.min(100,progress.done/progress.total*100) : 0)+'%'}"></div>
            </div>
          </div>
          <ExerciseBlock
            v-for="(item,index) in state.exercises"
            :key="item.sessionExercise.id"
            :session-exercise="item.sessionExercise"
            :target-weight="item.target.weight_kg"
            :target-reps-min="item.target.reps_min"
            :target-reps-max="item.target.reps_max"
            :rest-seconds="item.sessionExercise.rest_seconds || 90"
            :exercise-detail="item.exerciseDetail"
            :history="item.history"
            :target="item.target"
            :index="index+1" :total="state.exercises.length" :expanded="state.selectedExerciseId === item.sessionExercise.id"
            @toggle="state.selectedExerciseId = state.selectedExerciseId === item.sessionExercise.id ? null : item.sessionExercise.id"
            @sets-changed="setsChanged(item,$event)" @rest-start="startRest(item,$event)" @set-reverted="setReverted(item,$event)" @next="nextExercise(item)"
          />
        </template>

      </div>

      <div v-if="activeRest && state.session" class="session-rest-dock">
        <div class="session-rest-dock__heading"><strong>{{ t('session.rest_title') }}</strong><span>{{activeRest.exerciseName}}</span></div>
        <RestTimer :key="state.restSequence" :duration="activeRest.duration" :deadline="activeRest.deadline" :active="true"
          :sound-enabled="store.getSetting('timer_sound_enabled',true)" :vibr-enabled="store.getSetting('timer_vibration_enabled',true)"
          @adjust="adjustRest" @complete="clearRest" @skip="clearRest" />
      </div>
      <!-- Confirmation terminer -->
      <ConfirmModal
        v-if="state.showCompleteConfirm"
        :title="t('session.complete_confirm')"
        :body="remainingSets > 0 ? t('session.finish_remaining',{n:remainingSets}) : t('session.all_logged')"
        :confirm-text="t('session.complete')"
        @confirm="completeSession()"
        @cancel="state.showCompleteConfirm = false"
      />
    </div>
  `
}
