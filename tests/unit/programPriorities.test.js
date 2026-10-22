import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readSeedCatalog} from '../../src/seed/seed.js'
import {generateProgram} from '../../src/services/programGenerator.js'
import {PROGRAM_MUSCLE_GROUPS,PROGRAM_MUSCLES} from '../../public/js/utils/programMuscles.js'

const catalog=readSeedCatalog(),byId=new Map(catalog.map(ex=>[ex.id,ex]))
const equipment=[{category:'dumbbell_adjustable',count:2,weight_min_kg:2,weight_max_kg:30,weight_step_kg:1},{category:'bench_adjustable',count:1}]
const params={goal:'general_fitness',level:'beginner',days_per_week:2,session_duration_min:30,duration_weeks:8,priority_muscles:PROGRAM_MUSCLE_GROUPS[0].muscles}
const exercises=draft=>draft.templates.flatMap(t=>t.exercises.map(item=>({...byId.get(item.exercise_id),...item})))
const direct=(draft,muscle)=>exercises(draft).filter(ex=>ex.primary_muscles.includes(muscle)).reduce((sum,ex)=>sum+ex.target_sets,0)

test('short weeks retain pushing, pulling, quadriceps and posterior chain regardless of focus',()=>{
 for(const goal of ['general_fitness','strength','hypertrophy','endurance','weight_loss'])
 for(const level of ['beginner','intermediate','advanced'])
 for(const days_per_week of [2,3,4,5,6])
 for(const session_duration_min of [20,30])
 for(const priority_muscles of [PROGRAM_MUSCLE_GROUPS[0].muscles,PROGRAM_MUSCLE_GROUPS[1].muscles,['biceps'],PROGRAM_MUSCLES]){
  const input={...params,goal,level,days_per_week,session_duration_min,priority_muscles}
  const draft=generateProgram(input,catalog,equipment),label=JSON.stringify(input)
  for(const muscle of ['chest','back','quads'])assert.ok(direct(draft,muscle)>=2,label+' '+muscle)
  assert.ok(direct(draft,'hamstrings')+direct(draft,'glutes')>=2,label+' posterior')
  assert.equal(draft.templates.length,days_per_week)
  assert.ok(draft.templates.every(t=>t.estimated_duration_min<=session_duration_min),label)
  assert.ok(!draft.warnings.some(w=>w.code==='balance_limited'),label)
 }
})

test('a single priority benefits from remaining time without excluding the other body region',()=>{
 const short=generateProgram({...params,session_duration_min:20,priority_muscles:['biceps']},catalog,equipment)
 assert.ok(direct(short,'biceps')>=4)
 assert.ok(direct(short,'chest')>=2)
 assert.ok(direct(short,'back')>=2)
 assert.ok(direct(short,'quads')>=2)
 assert.ok(direct(short,'hamstrings')>=2)
})

test('multiple priorities: distribute accessories between both workouts instead of always sacrificing the last muscle',()=>{
 const draft=generateProgram(params,catalog,equipment)
 for(const muscle of ['biceps','triceps','core'])assert.ok(direct(draft,muscle)>0,muscle)
 const short=generateProgram({...params,session_duration_min:20},catalog,equipment)
 assert.ok(short.priority_coverage.some(p=>p.status==='indirect'))
 assert.ok(short.warnings.some(w=>w.code==='priority_tradeoff'))
 assert.ok(short.warnings.every(w=>w.code!=='priority_not_covered'))
})

test('indirect work is described separately without counting the same muscle twice within a set',()=>{
 const draft=generateProgram({...params,session_duration_min:20},catalog,equipment)
 for(const coverage of draft.priority_coverage){
  const items=exercises(draft)
  const expectedIndirect=items.filter(ex=>!ex.primary_muscles.includes(coverage.muscle)&&ex.secondary_muscles.includes(coverage.muscle)).reduce((sum,ex)=>sum+ex.target_sets,0)
  assert.equal(coverage.direct_sets,direct(draft,coverage.muscle))
  assert.equal(coverage.indirect_sets,expectedIndirect)
  if(coverage.status==='indirect'){
   assert.equal(coverage.direct_sets,0)
   assert.ok(coverage.indirect_sets>0)
   assert.ok(draft.warnings.some(w=>w.muscle===coverage.muscle&&w.code==='priority_indirect'))
  }
 }
})

test('more time covers priorities without adding workouts or artificially reducing rest',()=>{
 const draft=generateProgram({...params,session_duration_min:60},catalog,equipment)
 assert.equal(draft.templates.length,2)
 assert.ok(draft.priority_coverage.every(p=>p.status==='direct'))
 assert.ok(!draft.warnings.some(w=>w.code.startsWith('priority_')))
 const short=generateProgram({...params,goal:'strength',session_duration_min:20},catalog,equipment)
 assert.ok(short.templates.flatMap(t=>t.exercises).filter(ex=>byId.get(ex.exercise_id).mechanic==='compound').every(ex=>ex.rest_seconds===180))
})

test('real constraints: do not invent direct work and report impossible balance',()=>{
 const noBack=catalog.map(ex=>({...ex,is_excluded:ex.primary_muscles.includes('back')}))
 const draft=generateProgram({...params,priority_muscles:['back','biceps']},noBack,[])
 assert.equal(draft.priority_coverage.find(p=>p.muscle==='back').direct_available,false)
 assert.ok(draft.warnings.some(w=>w.code==='priority_unavailable'&&w.muscle==='back'))
 assert.ok(draft.warnings.some(w=>w.code==='balance_limited'&&w.muscle==='back'))
 assert.ok(exercises(draft).every(ex=>!ex.primary_muscles.includes('back')))
 const excluded=catalog.map(ex=>({...ex,is_excluded:ex.primary_muscles.includes('core')}))
 const core=generateProgram({...params,priority_muscles:['core']},excluded,equipment)
 assert.ok(core.warnings.some(w=>w.code==='priority_unavailable'&&w.muscle==='core'))
 const painful=generateProgram({...params,priority_muscles:['quads']},catalog,equipment,['quads'])
 assert.ok(exercises(painful).every(ex=>![...ex.primary_muscles,...ex.secondary_muscles].includes('quads')))
 assert.ok(painful.warnings.some(w=>w.code==='balance_limited'&&w.muscle==='quads'))
})

test('priorities and counters remain reproducible regardless of catalog and checked-priority order',()=>{
 const first=generateProgram(params,catalog,equipment)
 assert.deepEqual(first,generateProgram(params,[...catalog].reverse(),equipment))
 const reversed=generateProgram({...params,priority_muscles:[...params.priority_muscles].reverse()},catalog,equipment)
 assert.deepEqual(first.templates,reversed.templates)
})
