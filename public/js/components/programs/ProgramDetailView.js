import { reactive, onMounted, onBeforeUnmount, inject, computed } from '/vendor/vue.esm-browser.prod.js'
import { programs as api, sessions as sessionsApi, programExercises } from '../../api.js'
import { t, tm, exerciseName } from '../../i18n.js'
import PageHeader     from '../layout/PageHeader.js'
import LoadingSpinner from '../common/LoadingSpinner.js'
import ErrorBanner    from '../common/ErrorBanner.js'
import ConfirmModal   from '../common/ConfirmModal.js'
import ModalDialog from '../common/ModalDialog.js'

export default {
  name: 'ProgramDetailView',
  props: { id: { type: String, required: true } },
  components: { PageHeader, LoadingSpinner, ErrorBanner, ConfirmModal, ModalDialog },

  setup(props) {
    const router = inject('router')
    const store  = inject('store')
    const state = reactive({
      loading: false, error: null, program: null,
      activating: false, showDeleteConfirm: false,
      editingDuration: false, savingDuration: false, durationUnlimited: false, durationWeeks: 8, trainingDays: [],
      replaceTarget:null, alternatives:[], loadingAlternatives:false, replacing:false, replacementError:null, replacementSearch:'', selectedReplacement:null,
    })

    async function load() {
      state.loading = true; state.error = null
      try { state.program = await api.get(props.id) }
      catch (err) { state.error = err.message }
      finally { state.loading = false }
    }

    function editDuration() {
      state.durationUnlimited = state.program.duration_weeks === null
      state.durationWeeks = state.program.duration_weeks ?? 8
      const previous = state.program.plan?.parameters.training_days
      state.trainingDays = previous ? [...previous] : ({1:[0],2:[0,3],3:[0,2,4],4:[0,1,3,4],5:[0,1,2,3,4],6:[0,1,2,3,4,5],7:[0,1,2,3,4,5,6]})[state.program.days_per_week] || []
      state.editingDuration = true
    }
    function durationValid() {
      return (state.durationUnlimited || (Number.isSafeInteger(state.durationWeeks) && state.durationWeeks > 0)) && state.trainingDays.length === state.program.days_per_week && new Set(state.trainingDays).size === state.trainingDays.length
    }
    async function saveDuration() {
      if (state.savingDuration || !durationValid()) return
      state.savingDuration = true
      try {
        const weeks = state.durationUnlimited ? null : state.durationWeeks
        const updated = await api.update(props.id, { duration_weeks: weeks, training_days:[...state.trainingDays].sort((a,b)=>a-b) })
        Object.assign(state.program, updated)
        if (state.program.plan) state.program.plan.parameters.duration_weeks = updated.duration_weeks
        state.editingDuration = false
        store.showToast(t('programs.edit_saved'), 'success')
      } catch (err) { store.showToast(t('programs.edit_save_error'), 'error') }
      finally { state.savingDuration = false }
    }

    let replacementVersion=0
    const nameFor = ex => exerciseName(ex) || ex.exercise_id || ex.id
    const normalize = text => text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim()
    const visibleAlternatives = computed(() => state.alternatives.filter(ex => ex.id===state.selectedReplacement || normalize(nameFor(ex)).includes(normalize(state.replacementSearch))))
    function replacementMessage(error) {
      const code=error.message
      return t(code==='WORKOUT_IN_PROGRESS' ? 'programs.replacement_locked' : code==='EXERCISE_CHANGED' ? 'programs.replacement_stale' : code==='PLANNED_SESSION_HAS_LOGS' ? 'programs.replacement_logged' : 'programs.replacement_error')
    }
    async function openReplacement(template,exercise) {
      const version=++replacementVersion
      state.replaceTarget={template,exercise}
      state.alternatives=[];state.selectedReplacement=null;state.replacementSearch='';state.replacementError=null;state.loadingAlternatives=true
      try {
        const data=await programExercises.alternatives(exercise.id)
        if(version!==replacementVersion)return
        if(data.exercise_id!==exercise.exercise_id)throw new Error('EXERCISE_CHANGED')
        state.alternatives=data.alternatives
      } catch(error) { if(version===replacementVersion)state.replacementError=replacementMessage(error) }
      finally { if(version===replacementVersion)state.loadingAlternatives=false }
    }
    function closeReplacement() {
      if(state.replacing)return
      ++replacementVersion;state.replaceTarget=null;state.loadingAlternatives=false
    }
    function retryAlternatives() { if(state.replaceTarget)openReplacement(state.replaceTarget.template,state.replaceTarget.exercise) }
    async function applyReplacement() {
      if(state.replacing || !state.selectedReplacement || !state.replaceTarget)return
      state.replacing=true;state.replacementError=null
      const target=state.replaceTarget
      try {
        const updated=await programExercises.replace(target.exercise.id,{exercise_id:state.selectedReplacement,expected_exercise_id:target.exercise.exercise_id})
        Object.assign(target.exercise,updated)
        ++replacementVersion;state.replaceTarget=null
        store.showToast(t('programs.replacement_saved'),'success')
      } catch(error) { state.replacementError=replacementMessage(error) }
      finally { state.replacing=false }
    }
    onBeforeUnmount(()=>{++replacementVersion})

    async function activate() {
      state.activating = true
      try {
        await api.activate(props.id)
        store.showToast(t('programs.activated'), 'success')
        await load()
      } catch (err) { store.showToast(err.message, 'error') }
      finally { state.activating = false }
    }

    async function startNextSession() {
      try {
        const next = await api.nextSession(props.id)
        const sessionRes = next.session_id ? { id:next.session_id } : await sessionsApi.fromTemplate(next.template_id, {
          scheduled_date: next.suggested_date
        })
        const startRes   = await sessionsApi.start(sessionRes.id)
        store.setActiveSession(startRes)
        store.setPendingAdjustments(startRes.adjustments || [])
        router.push('#/session')
      } catch (err) { store.showToast(err.message, 'error') }
    }

    async function doDelete() {
      try {
        await api.delete(props.id)
        store.showToast(t('programs.deleted'), 'success')
        router.replace('#/programs')
      } catch (err) {
        store.showToast(err.message, 'error')
        state.showDeleteConfirm = false
      }
    }

    onMounted(load)
    return { state, load, activate, startNextSession, doDelete, editDuration, saveDuration, durationValid, openReplacement, closeReplacement, retryAlternatives, applyReplacement, visibleAlternatives, nameFor, router, t, tm }
  },

  template: `
    <div class="view">
      <PageHeader :title="state.program ? t('programs.goal_' + (state.program.goal === 'general_fitness' ? 'general' : state.program.goal)) : '…'" :show-back="true" />
      <div class="view__content" style="padding:1rem">
        <LoadingSpinner v-if="state.loading" />
        <ErrorBanner v-else-if="state.error" :message="state.error" :retry="load" />

        <template v-else-if="state.program">
          <!-- Information -->
          <div class="detail-section">
            <div class="program-summary-tags">
              <span class="program-tag">{{ t('programs.goal_' + (state.program.goal === 'general_fitness' ? 'general' : state.program.goal)) }}</span>
              <span class="program-tag">{{ t('programs.level_' + state.program.level) }}</span>
              <span class="program-tag">{{ state.program.days_per_week }}{{ t('programs.days_short') }}</span>
              <span v-if="state.program.is_active" class="program-tag program-tag--active">
                {{ t(state.program.is_finished ? 'programs.finished_badge' : 'programs.active_badge') }}
              </span>
            </div>
          </div>

          <div v-if="state.program.plan" class="program-summary-tags">
            <span v-if="state.program.plan.parameters.session_duration_min" class="program-tag">{{ t('planner.minutes', { count:state.program.plan.parameters.session_duration_min }) }}</span>
            <span class="program-tag">{{ state.program.duration_weeks === null ? t('planner.unlimited') : t('planner.weeks', { count:state.program.duration_weeks }) }}</span>
          </div>
          <div v-if="!state.program.plan" class="program-summary-tags">
            <span class="program-tag">{{ state.program.duration_weeks === null ? t('planner.unlimited') : t('planner.weeks', { count:state.program.duration_weeks }) }}</span>
          </div>
          <p v-if="state.program.plan?.parameters.training_days" class="program-training-days">{{ state.program.plan.parameters.training_days.slice().sort((a,b)=>a-b).map(day => t('planner.weekday_' + day)).join(', ') }}</p>
          <p v-if="state.program.plan" class="settings-notice">{{ t('planner.stability') }}</p>
          <p v-if="state.program.weekly_review" class="settings-notice">
            {{ t('planner.review_' + state.program.weekly_review.decision) }}
          </p>
          <p v-if="state.program.ends_on" class="settings-notice">{{ t('programs.ends_on', {date:state.program.ends_on}) }}</p>
          <p v-if="state.program.is_finished" class="settings-notice">{{ t('programs.finished_help') }}</p>
          <p v-if="state.program.is_active && !state.program.is_finished && state.program.weekly_progress?.is_complete"
            class="weekly-complete" role="status">✓ {{ t('programs.week_complete') }}</p>
          <p class="program-activation-hint">{{ t('programs.single_active_hint') }}</p>
          <!-- Actions -->
          <div style="display:flex;flex-direction:column;gap:0.75rem;margin-bottom:1.5rem">
            <button v-if="state.program.is_active" class="btn btn--primary btn--full"
              :disabled="state.program.is_finished" @click="startNextSession()">
              {{ t('programs.start_session') }}
            </button>
            <button v-else class="btn btn--secondary btn--full"
              :disabled="state.activating" @click="activate()">
              {{ state.activating ? t('common.loading') : t('programs.activate') }}
            </button>
            <button class="btn btn--secondary btn--full" @click="editDuration()">{{ t('programs.edit_program') }}</button>
          </div>

          <!-- Templates -->
          <div class="detail-section">
            <h3 class="detail-section__title">{{ t('programs.templates') }}</h3>
            <div v-for="tpl in state.program.templates" :key="tpl.id"
              class="template-block">
              <div class="template-block__name">{{ tpl.name }}</div>
              <p v-if="tpl.is_in_progress" class="inventory-hint">{{ t('programs.replacement_locked') }}</p>
              <div v-for="ex in tpl.exercises" :key="ex.id" class="template-block__exercise template-block__exercise--editable">
                <span>{{ nameFor(ex) }} — {{ ex.target_sets }}×{{ ex.target_reps_min }}<template v-if="ex.target_reps_max !== ex.target_reps_min">–{{ ex.target_reps_max }}</template></span>
                <button type="button" class="btn btn--secondary program-replace-btn" :disabled="tpl.is_in_progress"
                  :aria-label="t('programs.replace_named', {name:nameFor(ex)})" @click="openReplacement(tpl,ex)">{{ t('programs.replace') }}</button>
              </div>
            </div>
          </div>

          <!-- Delete -->
          <button class="btn btn--danger btn--full" style="margin-top:2rem"
            @click="state.showDeleteConfirm = true">
            {{ t('common.delete') }}
          </button>
        </template>
      </div>

      <ModalDialog v-if="state.replaceTarget" :title="t('programs.replace_named', {name:nameFor(state.replaceTarget.exercise)})" @close="closeReplacement()">
        <p class="program-replacement__notice">{{ t('programs.replacement_notice') }}</p>
        <LoadingSpinner v-if="state.loadingAlternatives" />
        <ErrorBanner v-if="state.replacementError" :message="state.replacementError" :retry="retryAlternatives" />
        <template v-if="!state.loadingAlternatives">
          <div v-if="state.alternatives.length" class="catalog-search">
            <input class="form-input" type="search" v-model="state.replacementSearch" :placeholder="t('exercises.search')" :aria-label="t('exercises.search')" :disabled="state.replacing" />
          </div>
          <p v-if="!state.alternatives.length && !state.replacementError" class="inventory-hint">{{ t('programs.replacement_empty') }}</p>
          <p v-else-if="state.alternatives.length && !visibleAlternatives.length" class="inventory-hint">{{ t('exercises.no_results') }}</p>
          <div class="program-replacement__list">
            <label v-for="ex in visibleAlternatives" :key="ex.id" class="program-choice program-replacement__choice" :class="{ 'program-choice--selected':state.selectedReplacement===ex.id }">
              <input type="radio" name="replacement-exercise" :value="ex.id" v-model="state.selectedReplacement" :disabled="state.replacing" />
              <span><span>{{ nameFor(ex) }}</span>
                <small>{{ ex.primary_muscles.map(tm).join(', ') }} · {{ ex.equipment_required.length ? ex.equipment_required.map(c=>t('equipment.category_' + c)).join(', ') : t('exercises.bodyweight') }}</small>
                <small v-if="ex.has_history">{{ t('programs.replacement_has_history') }}</small>
              </span>
            </label>
          </div>
        </template>
        <div class="modal__actions">
          <button type="button" class="btn btn--secondary" :disabled="state.replacing" @click="closeReplacement()">{{ t('common.cancel') }}</button>
          <button type="button" class="btn btn--primary" :disabled="state.replacing || state.loadingAlternatives || !state.selectedReplacement" @click="applyReplacement()">{{ state.replacing ? t('common.loading') : t('programs.replace') }}</button>
        </div>
      </ModalDialog>
      <ModalDialog v-if="state.editingDuration" :title="t('programs.edit_program')" @close="!state.savingDuration && (state.editingDuration = false)">
        <form class="program-duration-form" @submit.prevent="saveDuration()">
          <label class="exercise-filter__available">
            <input type="checkbox" v-model="state.durationUnlimited" :disabled="state.savingDuration" />
            <span>{{ t('planner.unlimited') }}</span>
          </label>
          <div v-if="!state.durationUnlimited" class="form-group">
            <label class="form-label" for="program-duration-weeks">{{ t('programs.duration_weeks_label') }}</label>
            <input id="program-duration-weeks" class="form-input" type="number" min="1" step="1" required
              v-model.number="state.durationWeeks" :disabled="state.savingDuration" />
          </div>
          <div class="form-group">
            <p class="form-label">{{ t('planner.question_days') }}</p>
            <p class="program-edit-days__hint" :class="{ 'program-edit-days__hint--invalid': state.trainingDays.length !== state.program.days_per_week }">{{ t('programs.required_training_days', {count:state.program.days_per_week}) }} · {{ state.trainingDays.length }}/{{ state.program.days_per_week }}</p>
            <div class="program-edit-days">
              <label v-for="day in [0,1,2,3,4,5,6]" :key="day" class="program-choice" :class="{ 'program-choice--selected':state.trainingDays.includes(day) }">
                <input type="checkbox" :value="day" v-model="state.trainingDays" :disabled="state.savingDuration" /><span>{{ t('planner.weekday_' + day) }}</span>
              </label>
            </div>
          </div>
          <div class="modal__actions">
            <button type="button" class="btn btn--secondary" :disabled="state.savingDuration" @click="state.editingDuration = false">{{ t('common.cancel') }}</button>
            <button type="submit" class="btn btn--primary" :disabled="state.savingDuration || !durationValid()">{{ state.savingDuration ? t('common.loading') : t('common.save') }}</button>
          </div>
        </form>
      </ModalDialog>
      <ConfirmModal
        v-if="state.showDeleteConfirm"
        :title="t('programs.delete_confirm')"
        :danger="true"
        @confirm="doDelete()"
        @cancel="state.showDeleteConfirm = false"
      />
    </div>
  `
}
