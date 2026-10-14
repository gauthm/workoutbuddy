import { beforeEach,test } from 'node:test'
import assert from 'node:assert/strict'
import request from '../helpers/in-process-request.js'
process.env.DB_PATH=':memory:'
const {getDb}=await import('../../src/db/database.js')
const db=getDb()
const {migrate}=await import('../../src/db/migrate.js')
const {seedExercises}=await import('../../src/seed/seed.js')
migrate(db);seedExercises(db)
const {app}=await import('../../server.js')
const {localIsoDate}=await import('../../src/services/date.js')
const {scheduleWeeks}=await import('../../src/services/sessionScheduler.js')
const {PROGRAM_MUSCLES}=await import('../../public/js/utils/programMuscles.js')
const {isEquipmentAvailable}=await import('../../src/services/rotationEngine.js')
const api=request(app),today=localIsoDate()
const params={goal:'hypertrophy',level:'intermediate',days_per_week:2,training_days:[0,3],session_duration_min:45,duration_weeks:8,priority_muscles:[],language:'fr'}
async function call(method,path,body,status=200) {
 const req=api[method]('/api/v1'+path),res=await(body===undefined?req:req.send(body))
 assert.equal(res.status,status,`${method} ${path}: ${res.text}`);return res.body
}
const get=path=>call('get',path)
const post=(path,body,status=200)=>call('post',path,body,status)
const calendar=async()=>(await get('/sessions?active_program=1&limit=200')).sessions
beforeEach(async()=>{await post('/reset-all')})
async function program(overrides={}) {
 const made=await post('/programs/generate',{...params,...overrides},201)
 await post(`/programs/${made.id}/activate`)
 return get(`/programs/${made.id}`)
}

test('all upper and lower priorities are accepted and retained, duplicates and unknown muscles are rejected',async()=>{
 const p=await program({priority_muscles:PROGRAM_MUSCLES})
 assert.deepEqual(p.plan.parameters.priority_muscles,PROGRAM_MUSCLES)
 for(const priority_muscles of [['chest','chest'],['unknown']]) await post('/programs/preview',{...params,priority_muscles},400)
})
test('45 and 60 minute previews have different volumes and estimates without exceeding the time budget',async()=>{
 for(const inventory of [[],[{category:'dumbbell_adjustable',name:'Pair',count:2,weight_min_kg:2,weight_max_kg:40,weight_step_kg:2},{category:'bench_adjustable',name:'Bench',count:1}]]) {
  await call('put','/equipment/inventory',{items:inventory})
  const shorter=await post('/programs/preview',{...params,goal:'general_fitness',level:'beginner',session_duration_min:45})
  const longer=await post('/programs/preview',{...params,goal:'general_fitness',level:'beginner',session_duration_min:60})
  shorter.templates.forEach((tpl,i)=>{
   assert.ok(tpl.estimated_duration_min>35&&tpl.estimated_duration_min<=45)
   assert.ok(longer.templates[i].estimated_duration_min>tpl.estimated_duration_min&&longer.templates[i].estimated_duration_min<=60)
   assert.ok(longer.templates[i].exercises.reduce((n,ex)=>n+ex.target_sets,0)>tpl.exercises.reduce((n,ex)=>n+ex.target_sets,0))
   assert.ok(longer.templates[i].exercises.every(ex=>ex.target_sets<=3))
  })
 }
})
test('adjustable bench satisfies flat bench requirements through the shared availability engine',()=>{
 assert.equal(isEquipmentAvailable(['bench'],[{category:'bench_adjustable',count:1}]),true)
 assert.equal(isEquipmentAvailable(['bench_adjustable'],[{category:'bench',count:1}]),false)
})
test('lower performed weight and missed repetitions adjust the next targets, repeated failures reduce the weight',async()=>{
 await call('put','/equipment/inventory',{items:[{category:'dumbbell_adjustable',name:'Pair',count:2,weight_min_kg:2,weight_max_kg:40,weight_step_kg:2},{category:'bench_adjustable',name:'Bench',count:1}]})
 const p=await program(),catalog=(await get('/exercises')).exercises
 const template=p.templates.find(t=>t.exercises.some(slot=>catalog.find(ex=>ex.id===slot.exercise_id).equipment_required.some(c=>c.startsWith('dumbbell'))))
 const slot=template.exercises.find(slot=>catalog.find(ex=>ex.id===slot.exercise_id).equipment_required.some(c=>c.startsWith('dumbbell')))
 async function perform(weight,reps) {
  const session=await post(`/sessions/from-template/${template.id}`,{scheduled_date:today},201)
  await post(`/sessions/${session.id}/start`)
  const detail=await get(`/sessions/${session.id}`),se=detail.exercises.find(ex=>ex.exercise_id===slot.exercise_id)
  for(let n=1;n<=slot.target_sets;n++)await post(`/session-exercises/${se.id}/sets`,{set_number:n,weight_kg:weight,reps,is_completed:true},201)
  await post(`/sessions/${session.id}/complete`)
 }
 await perform(20,slot.target_reps_max)
 const initial=(await get('/export')).data.exercise_progressions.find(row=>row.exercise_id===slot.exercise_id)
 assert.ok(initial.current_weight_kg>20)
 await perform(16,slot.target_reps_min-2)
 let learned=(await get('/export')).data.exercise_progressions.find(row=>row.exercise_id===slot.exercise_id)
 assert.equal(learned.current_weight_kg,16);assert.equal(learned.consecutive_failures,1)
 await perform(16,slot.target_reps_min-2)
 learned=(await get('/export')).data.exercise_progressions.find(row=>row.exercise_id===slot.exercise_id)
 assert.ok(learned.current_weight_kg<16);assert.equal(learned.consecutive_failures,0)
})
test('deleting a completed future fixture does not recreate it in history or calendar, including after import and scheduler restart',async()=>{
 const p=await program(),before=await calendar()
 const future=before.find(s=>s.scheduled_date>today);assert.ok(future)
 // Reproduce the old completed-in-the-future test fixture exactly.
 db.prepare("UPDATE session SET status='completed',completed_at=datetime('now') WHERE id=?").run(future.id)
 assert.ok((await get('/sessions?status=completed')).sessions.some(s=>s.id===future.id))
 await call('delete',`/sessions/${future.id}`,undefined,204)
 for(let n=0;n<3;n++) {
  scheduleWeeks(db,p.id,{throwOnError:true})
  assert.equal((await calendar()).some(s=>s.scheduled_date===future.scheduled_date),false)
  assert.equal((await get('/sessions?status=completed')).sessions.some(s=>s.id===future.id),false)
 }
 const snapshot=await get('/export')
 assert.ok(snapshot.data.session_schedule_exclusions.some(s=>s.scheduled_date===future.scheduled_date))
 await post('/import',snapshot)
 scheduleWeeks(db,p.id,{throwOnError:true})
 assert.equal((await calendar()).some(s=>s.scheduled_date===future.scheduled_date),false)
 await call('delete',`/sessions/${future.id}`,undefined,404)
 assert.deepEqual((await get('/export')).data,snapshot.data)
})
test('deleting an early completed workout reserves its actual and original dates, keeping other sessions intact',async()=>{
 const p=await program(),before=await calendar(),future=before.find(s=>s.scheduled_date>today)
 await post(`/sessions/${future.id}/start`);await post(`/sessions/${future.id}/complete`)
 await call('delete',`/sessions/${future.id}`,undefined,204)
 const after=await calendar()
 assert.deepEqual(after,before.filter(s=>s.id!==future.id))
 const suppressed=(await get('/export')).data.session_schedule_exclusions
 assert.ok(suppressed.some(s=>s.scheduled_date===today))
 assert.ok(suppressed.some(s=>s.scheduled_date===future.scheduled_date))
 await post('/reset-stats')
 assert.deepEqual((await get('/export')).data.session_schedule_exclusions,[])
})
