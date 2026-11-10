import {beforeEach,test} from 'node:test'
import assert from 'node:assert/strict'
import request from '../helpers/in-process-request.js'
process.env.DB_PATH=':memory:'
const {getDb}=await import('../../src/db/database.js')
const db=getDb()
const {migrate}=await import('../../src/db/migrate.js')
const {seedExercises}=await import('../../src/seed/seed.js')
migrate(db);seedExercises(db)
const {app}=await import('../../server.js')
const {suggestFirstTimeWithHistory}=await import('../../src/services/firstTimeSuggestion.js')
const api=request(app)
const inventory=[{category:'dumbbell_adjustable',name:'Pair',count:2,weight_min_kg:2,weight_max_kg:50,weight_step_kg:2},{category:'bench_adjustable',name:'Bench',count:1}]
async function call(method,path,body,status=200) {
  const req=api[method]('/api/v1'+path),res=await(body===undefined?req:req.send(body))
  assert.equal(res.status,status,`${method} ${path}: ${res.text}`)
  return res.body
}
const post=(path,body,status=200)=>call('post',path,body,status)
const get=path=>call('get',path)
beforeEach(async()=>{
  await post('/reset-all')
  await call('put','/equipment/inventory',{items:inventory})
})
async function plan(exercise,repsMin=8,repsMax=12) {
  const p=db.prepare("INSERT INTO program(name,goal,level,days_per_week) VALUES ('Program','hypertrophy','intermediate',2)").run().lastInsertRowid
  const tpl=await post(`/programs/${p}/templates`,{name:'Workout'},201)
  const te=await post(`/templates/${tpl.id}/exercises`,{exercise_id:exercise,target_sets:2,target_reps_min:repsMin,target_reps_max:repsMax},201)
  const session=await post(`/sessions/from-template/${tpl.id}`,{scheduled_date:'2026-11-10'},201)
  return {session,te,tpl}
}
async function complete(plan,weight,reps) {
  await post(`/sessions/${plan.session.id}/start`)
  const se=(await get(`/sessions/${plan.session.id}`)).exercises[0]
  for(let n=1;n<=2;n++)await post(`/session-exercises/${se.id}/sets`,{set_number:n,weight_kg:weight,reps,is_completed:true},201)
  await post(`/sessions/${plan.session.id}/complete`)
}

test('same exercise in pre-existing programs takes global progress at start, with rep-range conversion',async()=>{
  const a=await plan('dumbbell_bench_press'),b=await plan('dumbbell_bench_press'),c=await plan('dumbbell_bench_press',12,15)
  await complete(a,20,12)
  const learned=db.prepare('SELECT * FROM exercise_progression WHERE exercise_id=?').get('dumbbell_bench_press')
  assert.ok(learned.current_weight_kg>20)
  await post(`/sessions/${b.session.id}/start`)
  const target=await get(`/sessions/${b.session.id}/target/${b.te.id}`)
  assert.equal(target.weight_kg,learned.current_weight_kg)
  assert.equal(target.reps_min,learned.current_target_reps)
  assert.equal(target.is_first_time,false)
  await post(`/sessions/${b.session.id}/complete`)
  await post(`/sessions/${c.session.id}/start`)
  const converted=await get(`/sessions/${c.session.id}/target/${c.te.id}`)
  assert.equal(converted.reps_min,12)
  assert.ok(converted.weight_kg<=learned.current_weight_kg)
})

test('new variation uses actual completed performance across programs consistently in start and target responses',async()=>{
  const old=await plan('dumbbell_bench_press'),next=await plan('incline_dumbbell_press',12,15)
  await complete(old,30,8)
  const started=await post(`/sessions/${next.session.id}/start`)
  const target=await get(`/sessions/${next.session.id}/target/${next.te.id}`)
  // 30 * (1 + 8/30) / (1 + 12/30) * 0.8 = 21.71, rounded down to 20.
  assert.equal(target.weight_kg,20)
  assert.equal(target.reps_min,12)
  assert.equal(target.is_first_time,true)
  assert.match(target.first_time_suggestion.reasoning,/20 %/)
  assert.equal(started.adjustments[0].target_weight_kg,target.weight_kg)
  assert.equal(started.adjustments[0].target_reps,target.reps_min)
  assert.equal(db.prepare('SELECT * FROM exercise_progression WHERE exercise_id=?').get('incline_dumbbell_press'),undefined)
})

test('unconfirmed, warm-up, deload and active-session sets cannot seed a variation',async()=>{
  const old=await plan('dumbbell_bench_press')
  await complete(old,30,8)
  const suggest=()=>suggestFirstTimeWithHistory(db,{id:'incline_dumbbell_press',equipment_required:['dumbbell_fixed','bench_adjustable'],mechanic:'compound'},null,{target_reps_min:12},inventory)
  for(const [sql,excluded,previous] of [
    ['UPDATE set_log SET is_completed=?',0,1],['UPDATE set_log SET is_warmup=?',1,0],
    ['UPDATE session SET is_deload=?',1,0],['UPDATE session SET status=?','in_progress','completed'],
  ]) {
    db.prepare(sql).run(excluded)
    assert.doesNotMatch(suggest().reasoning,/20 %/,sql)
    db.prepare(sql).run(previous)
  }
})

test('incompatible load conventions and movements keep the profile fallback',async()=>{
  const old=await plan('dumbbell_bench_press')
  await complete(old,30,8)
  for(const id of ['barbell_bench_press_medium_grip','arnold_dumbbell_press']) {
    const ex=db.prepare('SELECT * FROM exercise WHERE id=?').get(id)
    const result=suggestFirstTimeWithHistory(db,{...ex,equipment_required:JSON.parse(ex.equipment_required)},null,{target_reps_min:8},inventory)
    assert.doesNotMatch(result.reasoning,/20 %/)
  }
})

test('combined free-weight and band or machine resistance never transfers loads',async()=>{
  const old=await plan('dumbbell_bench_press')
  await complete(old,30,8)
  const target='incline_dumbbell_press',source='dumbbell_bench_press'
  const suggest=()=>suggestFirstTimeWithHistory(db,{id:target,equipment_required:['dumbbell_fixed','bench_adjustable'],mechanic:'compound'},null,{target_reps_min:12},inventory)
  const update=db.prepare('UPDATE exercise SET equipment_required=? WHERE id=?')
  for(const id of [target,source]) {
    const original=db.prepare('SELECT equipment_required FROM exercise WHERE id=?').get(id).equipment_required
    for(const extra of ['resistance_band','cable_machine','chains','kettlebell']) {
      update.run(JSON.stringify([...JSON.parse(original),extra]),id)
      assert.doesNotMatch(suggest().reasoning,/20 %/,`${id} with ${extra}`)
    }
    update.run(original,id)
  }
})
