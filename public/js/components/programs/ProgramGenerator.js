import { PROGRAM_MUSCLE_GROUPS } from '../../utils/programMuscles.js'
import { reactive, ref, onMounted, inject, nextTick, watch } from '/vendor/vue.esm-browser.prod.js'
import { programs as api, equipment, userProfile } from '../../api.js'
import { t, i18n, exerciseName } from '../../i18n.js'
import PageHeader from '../layout/PageHeader.js'
import LoadingSpinner from '../common/LoadingSpinner.js'
import ModalDialog from '../common/ModalDialog.js'
import EquipmentEditor from '../equipment/EquipmentEditor.js'

const GOALS = ['strength','hypertrophy','endurance','weight_loss','general_fitness']
const LEVELS = ['beginner','intermediate','advanced']
const QUESTIONS = ['goal','level','days','duration','measurements','priorities','equipment','block','review']

export default {
  name: 'ProgramGenerator', components: { PageHeader, LoadingSpinner, ModalDialog, EquipmentEditor },
  setup() {
    const router = inject('router'), store = inject('store'), heading = ref(null)
    const state = reactive({ loading:true, step:0, busy:false, error:null, preview:null, items:[], equipmentOpen:false,
      form:{ goal:'general_fitness', level:'beginner', days_per_week:3, session_duration_min:45, training_days:[0,2,4], duration_weeks:8, priority_muscles:[], weight_kg:null, height_cm:null } })
    const WEEKDAYS = [0,1,2,3,4,5,6]
    watch(() => state.form.training_days, days => { state.form.days_per_week = days.length }, { deep:true })
    const labelGoal = g => t('programs.goal_' + (g === 'general_fitness' ? 'general' : g))
    async function load() {
      state.loading = true; state.error = null
      try {
        const [profile, inventory, active] = await Promise.all([userProfile.get(),equipment.list(),api.list({active:1})])
        state.items = inventory.items
        if (active.programs?.length) {
          const current = await api.get(active.programs[0].id)
          const previous = {goal:current.goal,level:current.level,days_per_week:current.days_per_week,...(current.plan?.parameters || {})}
          for (const key of Object.keys(state.form)) if (previous[key] !== undefined) state.form[key] = previous[key]
          if (!previous.training_days) state.form.training_days = ({2:[0,3],3:[0,2,4],4:[0,1,3,4],5:[0,1,2,3,4],6:[0,1,2,3,4,5]})[state.form.days_per_week] || [0,2,4]
        }
      } catch (err) { state.error = t('planner.load_error') }
      finally { state.loading = false }
    }
    function toggleMuscle(muscle) {
      const index = state.form.priority_muscles.indexOf(muscle)
      if (index >= 0) state.form.priority_muscles.splice(index,1)
      else state.form.priority_muscles.push(muscle)
    }
    const groupChecked = group => group.muscles.every(m=>state.form.priority_muscles.includes(m))
    const groupPartial = group => !groupChecked(group) && group.muscles.some(m=>state.form.priority_muscles.includes(m))
    function toggleGroup(group,checked) {
      state.form.priority_muscles = checked ? [...new Set([...state.form.priority_muscles,...group.muscles])]
        : state.form.priority_muscles.filter(m=>!group.muscles.includes(m))
    }
    async function focusQuestion() { await nextTick(); heading.value?.focus(); window.scrollTo(0,0) }
    async function next() {
      if (state.busy) return
      state.error = null
      if (state.step === 2 && (state.form.training_days.length < 2 || state.form.training_days.length > 6)) { state.error = t('planner.training_days_hint'); return }
      if (state.step === 4 && [ ['weight_kg',20,500],['height_cm',50,280] ].some(([key,min,max]) => state.form[key] !== null && state.form[key] !== '' && (typeof state.form[key] !== 'number' || state.form[key] < min || state.form[key] > max))) {
        state.error=t('planner.measurements_invalid'); return
      }
      if (state.step === 7) {
        state.busy = true
        try { state.preview = await api.preview({ ...state.form, weight_kg:state.form.weight_kg || null, height_cm:state.form.height_cm || null, language:i18n.locale }); state.step++ }
        catch (err) { state.error = t(err.message === 'NO_AVAILABLE_EXERCISES' ? 'planner.no_exercises' : 'planner.preview_error') }
        finally { state.busy = false }
      } else state.step++
      await focusQuestion()
    }
    async function back() { if (state.busy) return; state.error = null; state.step--; await focusQuestion() }
    async function closeEquipment() {
      state.equipmentOpen = false
      try { state.items = (await equipment.list()).items }
      catch (_) { state.error = t('planner.load_error') }
    }
    async function create() {
      if (state.busy) return
      state.busy = true; state.error = null
      try {
        const program = await api.generate({ ...state.form, weight_kg:state.form.weight_kg || null, height_cm:state.form.height_cm || null, language:i18n.locale })
        store.showToast(t('programs.generated'),'success')
        router.replace('#/programs/' + program.id)
      } catch (err) { state.error = t(err.message === 'NO_AVAILABLE_EXERCISES' ? 'planner.no_exercises' : 'planner.create_error') }
      finally { state.busy = false }
    }
    onMounted(load)
    return { state, heading, load, next, back, create, toggleMuscle, groupChecked, groupPartial, toggleGroup, closeEquipment, labelGoal, t, i18n, exerciseName, GOALS, LEVELS, PROGRAM_MUSCLE_GROUPS, QUESTIONS, WEEKDAYS, durationOptions: () => [...new Set([4,6,8,12,state.form.duration_weeks,null])] }
  },
  template: `
    <div class="view">
      <PageHeader :title="t('programs.new')" :show-back="true" />
      <div class="view__content program-wizard">
        <LoadingSpinner v-if="state.loading" />
        <template v-else>
          <p class="program-wizard__step">{{ t('planner.step', { current:state.step + 1, total:QUESTIONS.length }) }}</p>
          <progress class="program-wizard__progress" :value="state.step + 1" :max="QUESTIONS.length" :aria-label="t('planner.progress')"></progress>
          <h2 ref="heading" tabindex="-1" class="program-wizard__question">{{ t('planner.question_' + QUESTIONS[state.step]) }}</h2>
          <p class="program-wizard__help">{{ t('planner.help_' + QUESTIONS[state.step]) }}</p>
          <div v-if="state.error" class="settings-notice settings-notice--warning" role="alert">
            {{ state.error }}
            <button v-if="!state.preview && state.step === 0" class="btn btn--secondary" @click="load()">{{ t('common.retry') }}</button>
          </div>
          <div v-if="state.step < 4 || state.step === 7" class="program-wizard__choices" role="radiogroup" :aria-label="t('planner.question_' + QUESTIONS[state.step])">
            <template v-if="state.step === 0">
              <label v-for="g in GOALS" :key="g" class="program-choice" :class="{ 'program-choice--selected':state.form.goal === g }">
                <input type="radio" name="goal" :value="g" v-model="state.form.goal" /><span>{{ labelGoal(g) }}<small>{{ t('planner.goal_description_' + g) }}</small></span>
              </label>
            </template>
            <template v-if="state.step === 1">
              <label v-for="level in LEVELS" :key="level" class="program-choice" :class="{ 'program-choice--selected':state.form.level === level }">
                <input type="radio" name="level" :value="level" v-model="state.form.level" /><span>{{ t('programs.level_' + level) }}<small>{{ t('planner.level_' + level) }}</small></span>
              </label>
            </template>
            <template v-if="state.step === 2">
              <label v-for="day in WEEKDAYS" :key="day" class="program-choice" :class="{ 'program-choice--selected':state.form.training_days.includes(day) }">
                <input type="checkbox" :value="day" v-model="state.form.training_days" :disabled="state.form.training_days.length >= 6 && !state.form.training_days.includes(day)" /><span>{{ t('planner.weekday_' + day) }}</span>
              </label>
            </template>
            <template v-if="state.step === 3">
              <label v-for="duration in [20,30,45,60,90]" :key="duration" class="program-choice" :class="{ 'program-choice--selected':state.form.session_duration_min === duration }">
                <input type="radio" name="duration" :value="duration" v-model="state.form.session_duration_min" /><span>{{ t('planner.minutes', { count:duration }) }}</span>
              </label>
            </template>
            <template v-if="state.step === 7">
              <label v-for="weeks in durationOptions()" :key="weeks === null ? 'unlimited' : weeks" class="program-choice" :class="{ 'program-choice--selected':state.form.duration_weeks === weeks }">
                <input type="radio" name="block" :value="weeks" v-model="state.form.duration_weeks" /><span>{{ weeks === null ? t('planner.unlimited') : t('planner.weeks', { count:weeks }) }}</span>
              </label>
            </template>
          </div>
          <p v-if="state.step === 2" class="settings-notice">{{ t('planner.training_days_hint') }}</p>
          <p v-if="state.step === 7" class="settings-notice">{{ t('planner.unlimited_help') }}</p>
          <p v-if="state.step === 0" class="settings-notice">{{ t('planner.goal_advice') }}</p>
          <div v-if="state.step === 4" class="program-wizard__measurements">
            <div class="form-group"><label class="form-label" for="program-weight">{{ t('settings.profile_weight') }}</label>
              <input id="program-weight" class="form-input" type="number" min="20" max="500" step="0.5" v-model.number="state.form.weight_kg" /></div>
            <div class="form-group"><label class="form-label" for="program-height">{{ t('settings.profile_height') }}</label>
              <input id="program-height" class="form-input" type="number" min="50" max="280" step="1" v-model.number="state.form.height_cm" /></div>
            <p class="program-wizard__help">{{ t('planner.measurements_optional') }}</p>
          </div>
          <div v-if="state.step === 5" class="program-wizard__choices">
            <button type="button" class="program-choice" :class="{ 'program-choice--selected':!state.form.priority_muscles.length }" :aria-pressed="!state.form.priority_muscles.length" @click="state.form.priority_muscles = []">{{ t('planner.balanced') }}</button>
            <section v-for="group in PROGRAM_MUSCLE_GROUPS" :key="group.id" class="program-muscle-group">
              <label class="program-choice program-muscle-group__all">
                <input type="checkbox" :checked="groupChecked(group)" :indeterminate.prop="groupPartial(group)" @change="toggleGroup(group,$event.target.checked)" />
                <span>{{ t('planner.muscle_group_' + group.id) }}</span>
              </label>
              <div class="program-wizard__choices">
                <label v-for="muscle in group.muscles" :key="muscle" class="program-choice" :class="{ 'program-choice--selected':state.form.priority_muscles.includes(muscle) }">
                  <input type="checkbox" :checked="state.form.priority_muscles.includes(muscle)" @change="toggleMuscle(muscle)" /><span>{{ t('muscles.' + muscle) }}</span>
                </label>
              </div>
            </section>
          </div>
          <div v-if="state.step === 6" class="program-wizard__equipment">
            <p v-if="!state.items.length">{{ t('planner.bodyweight') }}</p>
            <ul v-else><li v-for="item in state.items" :key="item.id">{{ item.count }} × {{ item.name }}<span v-if="item.weight_kg"> · {{ item.weight_kg }} {{ t('bodyweight.unit_kg') }}</span></li></ul>
            <button class="btn btn--secondary btn--full" @click="state.equipmentOpen = true">{{ t('planner.equipment_edit') }}</button>
            <p class="program-wizard__help">{{ t('planner.exclusions') }}</p>
          </div>
          <div v-if="state.step === 8 && state.preview" class="program-wizard__review">
            <p>{{ labelGoal(state.form.goal) }} · {{ t('programs.level_' + state.form.level) }} · {{ t('planner.days', { count:state.form.days_per_week }) }} · {{ t('planner.minutes', { count:state.form.session_duration_min }) }} · {{ state.form.duration_weeks === null ? t('planner.unlimited') : t('planner.weeks', { count:state.form.duration_weeks }) }}</p>
            <p>{{ state.form.training_days.slice().sort((a,b)=>a-b).map(day => t('planner.weekday_' + day)).join(', ') }}</p>
            <p class="settings-notice">{{ t('planner.stability') }}</p>
            <p v-for="warning in state.preview.warnings" :key="warning.code + warning.muscle" class="settings-notice settings-notice--warning">{{ t('planner.warning_' + warning.code, { muscle:warning.muscle ? t('muscles.' + warning.muscle) : '' }) }}</p>
            <article v-for="template in state.preview.templates" :key="template.name" class="program-wizard__session">
              <h3>{{ template.name }} <small>{{ t('planner.estimated', { count:template.estimated_duration_min }) }}</small></h3>
              <ul><li v-for="ex in template.exercises" :key="ex.exercise_id">{{ exerciseName(ex) }} <strong>{{ ex.target_sets }} × {{ ex.target_reps_min }}–{{ ex.target_reps_max }}</strong></li></ul>
            </article>
          </div>
          <div class="program-wizard__actions">
            <button v-if="state.step > 0" class="btn btn--secondary" :disabled="state.busy" @click="back()">{{ t('common.back') }}</button>
            <button v-if="state.step < 8" class="btn btn--primary" :disabled="state.busy" @click="next()">{{ state.busy ? t('common.loading') : t('planner.next') }}</button>
            <button v-else class="btn btn--primary" :disabled="state.busy" @click="create()">{{ state.busy ? t('common.loading') : t('planner.create') }}</button>
          </div>
        </template>
      </div>
      <ModalDialog v-if="state.equipmentOpen" :title="t('equipment.title')" @close="closeEquipment()"><EquipmentEditor /></ModalDialog>
    </div>`
}
