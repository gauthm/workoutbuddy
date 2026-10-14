import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readSeedCatalog } from '../../src/seed/seed.js'
import { generateProgram,estimateSessionMinutes } from '../../src/services/programGenerator.js'
import { generationCandidate } from '../../src/services/programExerciseCatalog.js'
import { calculateAchievableLoads } from '../../src/services/equipmentCalc.js'
import { suggestFirstTime } from '../../src/services/firstTimeSuggestion.js'
import { computeNextState } from '../../src/services/progressionEngine.js'
import { shouldDeload,computeDeloadTargets } from '../../src/services/deloadEngine.js'

const catalog=readSeedCatalog(), byId=new Map(catalog.map(e=>[e.id,e]))
const params={goal:'general_fitness',level:'beginner',days_per_week:2,session_duration_min:60,duration_weeks:8}
const home=[{category:'dumbbell_loadable',weight_kg:2,count:2},{category:'dumbbell_plate',weight_kg:1,count:8},
 {category:'dumbbell_plate',weight_kg:2,count:8},{category:'bench_adjustable',count:1}]
const template={target_sets:3,target_reps_min:8,target_reps_max:12,progression_model:'double_progression'}
const state={current_weight_kg:10,current_target_reps:12,consecutive_failures:0}

test('home equipment covers press, row, squat/lunge and hinge in both sessions, with mostly loaded exercises',()=>{
  const draft=generateProgram(params,catalog,home)
  for(const session of draft.templates){
    const ex=session.exercises.map(e=>byId.get(e.exercise_id))
    for(const patterns of [['push_horizontal'],['pull_horizontal','pull_vertical'],['squat','lunge'],['hinge']]) {
      assert.ok(ex.some(e=>patterns.includes(e.movement_pattern)),patterns.join('/'))
    }
    assert.ok(ex.filter(e=>e.equipment_required.includes('dumbbell_fixed')).length >= Math.ceil(ex.length*.6))
    assert.ok(session.exercises.every(e=>e.target_sets<=3))
    assert.ok(session.estimated_duration_min<=60)
    assert.ok(ex.every(e=>calculateAchievableLoads(home,e).loads_kg.length>0))
  }
  assert.ok(draft.templates[0].exercises.some(e=>e.exercise_id==='dumbbell_bench_press'))
  assert.ok(draft.templates[1].exercises.some(e=>e.exercise_id==='incline_dumbbell_press'))
  assert.ok(draft.templates.some(t=>t.exercises.some(e=>byId.get(e.exercise_id).equipment_required.length===0)))
})

test('kettlebell-only equipment selects the source goblet squat without requiring dumbbells',()=>{
 const inventory=[{category:'kettlebell',count:1,weight_kg:8}]
 const e=generationCandidate(byId.get('goblet_squat'),'beginner')
 assert.deepEqual(e.equipment_required,['kettlebell'])
 assert.deepEqual(calculateAchievableLoads(inventory,e).loads_kg,[8])
 const draft=generateProgram(params,catalog,inventory)
 assert.ok(draft.templates.some(t=>t.exercises.some(e=>e.exercise_id==='goblet_squat')))
 for (const id of ['one_arm_kettlebell_row','one_arm_kettlebell_military_press_to_the_side','one_arm_kettlebell_floor_press']) {
   assert.ok(draft.templates.some(t=>t.exercises.some(e=>e.exercise_id===id)),id)
 }
})

test('custom movements and zero-quantity equipment cannot enter a program or replacement pool',()=>{
 assert.equal(generationCandidate({...byId.get('dumbbell_squat'),is_custom:1},'beginner'),null)
 assert.deepEqual(calculateAchievableLoads([{category:'bench_adjustable',count:0}],byId.get('crunches')).loads_kg,[])
 assert.deepEqual(calculateAchievableLoads([{category:'kettlebell',count:0,weight_kg:8}],byId.get('goblet_squat')).loads_kg,[])
 const empty=generateProgram(params,catalog,[])
 assert.ok(empty.templates.flatMap(t=>t.exercises).every(e=>byId.get(e.exercise_id).equipment_required.length===0))
})

test('first dumbbell suggestion logs weight per hand and keeps unilateral loads separate',()=>{
 const weights=[2,4,6,8,10,12,16,20].map(weight_kg=>({category:'dumbbell_fixed',count:2,weight_kg}))
 const profile={weight_kg:80,fitness_level:'beginner',primary_goal:'hypertrophy'}
 assert.equal(suggestFirstTime(byId.get('dumbbell_bench_press'),profile,template,[...weights,{category:'bench',count:1}]).weight_kg,10)
 assert.equal(suggestFirstTime(byId.get('one_arm_dumbbell_row'),profile,template,[...weights,{category:'bench',count:1}]).weight_kg,20)
})

test('beginner strength starts with moderate reps, a maximum of three sets and double progression',()=>{
 const draft=generateProgram({...params,goal:'strength'},catalog,home)
 assert.equal(draft.progression_model,'double_progression')
 assert.ok(draft.templates.flatMap(t=>t.exercises).every(e=>e.target_sets<=3 && e.target_reps_min>=8))
})

test('unilateral execution contributes both sides to the session time estimate',()=>{
 const exercise={target_sets:3,target_reps_max:10,rest_seconds:90}
 assert.ok(estimateSessionMinutes([{...exercise,is_unilateral:1}])>estimateSessionMinutes([exercise]))
})

test('sparse weights do not trigger an automatic 10-to-20 kg jump; small available increments still work',()=>{
 for(const model of ['linear','double_progression']){
  const te={...template,progression_model:model}
  const sets=Array.from({length:3},()=>({reps:12,rpe:8,rir:2}))
  const result=computeNextState(state,sets,te,{},[10,20],{})
  assert.equal(result.current_weight_kg,10)
  assert.equal(result.consecutive_failures,0)
  assert.equal(computeNextState(state,sets,te,{},[10,11,20],{}).current_weight_kg,11)
 }
})

test('high effort holds the load, while an incomplete low-RPE workout never increases it',()=>{
 const hard=Array.from({length:3},()=>({reps:12,rpe:10,rir:0}))
 assert.equal(computeNextState(state,hard,template,{},[10,11],{}).current_weight_kg,10)
 const partial=computeNextState(state,[{reps:12,rpe:5}],{...template,progression_model:'rpe_based',rpe_target:8},{},[10,11],{})
 assert.equal(partial.current_weight_kg,10)
})

test('failure reductions and deloads can never raise a manually lowered load below the equipment minimum',()=>{
 const failed=computeNextState({...state,current_weight_kg:5,consecutive_failures:1},[{reps:3}],template,{},[10,20],{})
 assert.equal(failed.current_weight_kg,5)
 assert.ok(computeDeloadTargets(template,{current_weight_kg:5},{},{},[10,20]).weight_kg<=5)
})

test('scheduled deload counts from activation rather than the old program creation date',()=>{
 const db={prepare:()=>({all:()=>[]})}
 const result=shouldDeload({id:1,deload_auto_enabled:1,deload_frequency_weeks:6,created_at:'2026-01-01',started_on:'2026-10-12'},{},db,new Date('2026-10-14T12:00:00Z'))
 assert.equal(result.should,false)
})
