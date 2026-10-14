import { reactive, inject, onMounted, computed } from '/vendor/vue.esm-browser.prod.js'
import { i18n, t, exerciseName } from '../../i18n.js'
import { estimate10RM } from '../../utils/rm.js'
import SetRow from './SetRow.js'
import ExerciseHelp from './ExerciseHelp.js'
import ModalDialog from '../common/ModalDialog.js'
import { formatDate } from '../../utils/date.js'
import { warmupLoads } from '../../utils/warmup.js'

export default {
  name: 'ExerciseBlock', components: {SetRow, ExerciseHelp, ModalDialog},
  props: {
    sessionExercise: {type:Object,required:true}, targetWeight:{type:Number,default:0},
    targetRepsMin:{type:Number,default:8}, targetRepsMax:{type:Number,default:12}, restSeconds:{type:Number,default:90},
    exerciseDetail:{type:Object,default:null}, history:{type:Array,default:()=>[]}, target:{type:Object,default:null},
    expanded:{type:Boolean,default:true}, index:{type:Number,default:1}, total:{type:Number,default:1},
  },
  emits:['set-validated','sets-changed','rest-start','set-reverted','toggle','next'],
  setup(props,{emit}) {
    const store=inject('store')
    let sequence=0
    const rows=(props.sessionExercise.sets||[]).map(set=>({key:++sequence,set:{...set}}))
    const planned=props.sessionExercise.target_sets || Math.max(3,rows.filter(r=>!r.set.is_warmup).length)
    const usedNumbers=new Set(rows.map(r=>r.set.set_number))
    let number=1
    while(rows.filter(r=>!r.set.is_warmup).length<planned) {
      while(usedNumbers.has(number))number++
      rows.push({key:++sequence,set:{set_number:number,is_warmup:0}});usedNumbers.add(number)
    }
    rows.sort((a,b)=>Number(!!b.set.is_warmup)-Number(!!a.set.is_warmup) || a.set.set_number-b.set.set_number)
    const state=reactive({rows,showHelp:false,showWarmup:false})
    const workRows=computed(()=>state.rows.filter(r=>!r.set.is_warmup))
    const completed=computed(()=>workRows.value.filter(r=>r.set.is_completed).length)
    const currentKey=computed(()=>workRows.value.find(r=>!r.set.is_completed)?.key)
    const previousSession=computed(()=>props.history.find(h=>h.sets?.some(s=>s.is_completed && !s.is_warmup)) || null)
    const previousSets=computed(()=>(previousSession.value?.sets || []).filter(s=>s.is_completed && !s.is_warmup)
      .slice().sort((a,b)=>(a.set_number || 0)-(b.set_number || 0)))
    const rmApplicable=computed(()=>!props.exerciseDetail?.equipment_required?.includes('resistance_band'))
    const previousRM=set=>rmApplicable.value ? estimate10RM(Number(set.weight_kg),Number(set.reps),store.getSetting('rm_formula','epley')) || '—' : '—'
    const previousDate=computed(()=>formatDate(previousSession.value?.scheduled_date,i18n.locale === 'en' ? 'en-GB' : 'fr-FR'))
    const lastCompleted=computed(()=>workRows.value.filter(r=>r.set.is_completed).at(-1)?.set)
    const nextWeight=()=>lastCompleted.value?.weight_kg ?? props.targetWeight
    const nextReps=()=>lastCompleted.value?.reps ?? props.targetRepsMin
    const publish=()=>emit('sets-changed',{sets:state.rows.map(r=>r.set).filter(s=>s.id),planned:workRows.value.length})
    function onValidated(row,set) {row.set={...set};publish();emit('set-validated',set)}
    function onReverted(row,set) {row.set={...set};publish();emit('set-reverted',set)}
    const preparationLoads=computed(()=>warmupLoads(props.targetWeight,props.target?.achievable_loads_kg||[],props.exerciseDetail?.equipment_required||[]))
    const warmupMovement=()=>{
      if(props.exerciseDetail?.equipment_required?.includes('resistance_band'))return 'session.warmup_band'
      const pattern=props.exerciseDetail?.movement_pattern
      if(pattern==='squat'||pattern==='lunge')return 'session.warmup_lower'
      if(pattern==='hinge')return 'session.warmup_hinge'
      if(pattern?.startsWith('push'))return 'session.warmup_push'
      if(pattern?.startsWith('pull'))return 'session.warmup_pull'
      return 'session.warmup_generic'
    }
    const explanation=()=>props.target?.is_first_time ? props.target.first_time_suggestion?.reasoning : props.target?.explanation
    onMounted(publish)
    return {state,t,exerciseName,workRows,completed,currentKey,previousSession,previousSets,previousRM,previousDate,rmApplicable,nextWeight,nextReps,lastCompleted,onValidated,onReverted,preparationLoads,warmupMovement,explanation,
      rowNumber:row=>row.set.is_warmup ? null : workRows.value.findIndex(r=>r.key===row.key)+1,
      showRpe:()=>store.getSetting('show_rpe_field',false),formula:()=>store.getSetting('rm_formula','epley')}
  },
  template:`
    <section class="exercise-block" :class="{'exercise-block--active':expanded,'exercise-block--complete':completed >= workRows.length}" :data-exercise-id="sessionExercise.id">
      <div class="exercise-block__header">
        <button class="exercise-block__toggle" :aria-expanded="expanded" :aria-controls="'exercise-content-'+sessionExercise.id" @click="$emit('toggle')">
          <span class="exercise-block__index">{{ completed >= workRows.length ? '✓' : index }}</span>
          <span class="exercise-block__heading"><span class="exercise-block__name">{{exerciseName(sessionExercise)}}</span>
            <span class="exercise-block__subtitle">{{ t('session.exercise_progress',{done:completed,total:workRows.length}) }}</span>
          </span><span class="exercise-block__chevron" aria-hidden="true">{{expanded?'⌃':'⌄'}}</span>
        </button>
        <button class="icon-btn" :aria-label="t('session.help')" @click="state.showHelp=true">ⓘ</button>
      </div>
      <div v-show="expanded" :id="'exercise-content-'+sessionExercise.id">
        <div class="exercise-block__target">
          <span class="exercise-block__target-label">{{t('session.today_target')}}</span>
          <strong>{{targetWeight}} kg × {{targetRepsMin}}<template v-if="targetRepsMax > targetRepsMin">–{{targetRepsMax}}</template></strong>
          <span>{{t('session.rest_duration',{seconds:restSeconds})}}</span>
        </div>
        <details v-if="explanation()" class="exercise-block__explanation">
          <summary>{{t('session.why_target')}}</summary><p>{{explanation()}}</p>
        </details>
        <div class="set-row-header"><span>{{t('session.col_set')}}</span><span>{{t('session.col_kg')}}</span><span>{{t('session.col_reps')}}</span><span :title="t('session.10rm_hint')">{{t('session.10rm_label')}}</span><span>{{t('session.col_done')}}</span></div>
        <SetRow v-for="row in state.rows" :key="row.key" :set="row.set" :session-exercise-id="sessionExercise.id"
          :target-weight="row.set.is_warmup ? 0 : nextWeight()" :target-reps="row.set.is_warmup ? 8 : nextReps()"
          :set-number="row.set.set_number" :display-number="rowNumber(row)" :is-new="!row.set.id" :is-warmup="!!row.set.is_warmup"
          :rm-applicable="rmApplicable" :is-current="row.key === currentKey" :rest-seconds="restSeconds"
          @validated="onValidated(row,$event)" @reverted="onReverted(row,$event)" @rest-start="$emit('rest-start',$event)" />
        <div class="exercise-block__tools">
          <button type="button" class="btn btn--secondary btn--sm" @click="state.showWarmup=true">{{t('session.warmup')}}</button>
        </div>
        <table v-if="previousSets.length" class="exercise-previous">
          <caption>{{ t('session.previous_session') }} <span>{{ previousDate }}</span></caption>
          <thead><tr><th scope="col">{{t('session.col_set')}}</th><th scope="col">{{t('session.col_kg')}}</th><th scope="col">{{t('session.col_reps')}}</th><th scope="col" :title="t('session.10rm_hint')">{{t('session.10rm_label')}}</th></tr></thead>
          <tbody><tr v-for="(set,index) in previousSets" :key="set.set_id || set.id || index">
            <th scope="row">{{set.set_number || index + 1}}</th><td>{{set.weight_kg}}</td><td>{{set.reps}}</td><td>{{previousRM(set)}}</td>
          </tr></tbody>
        </table>
        <p v-else class="exercise-previous__empty">{{t('session.no_previous_sets')}}</p>
        <button v-if="completed >= workRows.length" class="btn btn--primary exercise-block__next" @click="$emit('next')">
          {{ index < total ? t('session.next_exercise') : t('session.complete') }}
        </button>
      </div>
      <ModalDialog v-if="state.showWarmup" :title="t('session.warmup_title',{exercise:exerciseName(sessionExercise)})" @close="state.showWarmup=false">
        <ol class="warmup-instructions">
          <li>{{t('session.warmup_general')}}</li>
          <li>{{t(warmupMovement())}}</li>
          <li v-for="weight in preparationLoads" :key="weight">{{t('session.warmup_load',{weight})}}</li>
        </ol>
        <p class="modal__body">{{t('session.warmup_easy')}}</p>
        <button type="button" class="btn btn--primary btn--full" @click="state.showWarmup=false">{{t('common.close')}}</button>
      </ModalDialog>
      <ExerciseHelp v-if="state.showHelp && exerciseDetail" :exercise="exerciseDetail" :last-weight="nextWeight()" :last-reps="nextReps()"
        :formula="formula()" :history="history" @close="state.showHelp=false" />
    </section>`,
}
