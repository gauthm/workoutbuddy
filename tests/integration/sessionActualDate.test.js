import { beforeEach, test } from 'node:test'
import assert from 'node:assert/strict'
import request from '../helpers/in-process-request.js'
process.env.DB_PATH=':memory:'
const {getDb,getDbPath}=await import('../../src/db/database.js')
assert.equal(getDbPath(),':memory:')
const db=getDb()
const {migrate}=await import('../../src/db/migrate.js')
const {seedExercises}=await import('../../src/seed/seed.js')
migrate(db);seedExercises(db)
const {app}=await import('../../server.js')
const {localIsoDate}=await import('../../src/services/date.js')
const api=request(app)
const today=localIsoDate()
function dateAfter(days) {const d=new Date(today+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10)}
function weekday(date) {return (new Date(date+'T12:00:00Z').getUTCDay()+6)%7}
async function call(method,path,body,status=200) {
 const req=api[method]('/api/v1'+path),res=await(body===undefined?req:req.send(body))
 assert.equal(res.status,status,`${method} ${path}: ${res.text}`)
 return res.body
}
const get=path=>call('get',path)
const post=(path,body,status=200)=>call('post',path,body,status)
const calendar=async()=>(await get('/sessions?active_program=1&limit=200')).sessions
beforeEach(async()=>{await post('/reset-all')})
async function program(days=[weekday(dateAfter(1)),weekday(dateAfter(3))]) {
 const made=await post('/programs/generate',{goal:'general_fitness',level:'beginner',days_per_week:2,training_days:days,session_duration_min:45,duration_weeks:8,priority_muscles:[],language:'fr'},201)
 await post(`/programs/${made.id}/activate`)
 return get(`/programs/${made.id}`)
}

test('starting the next planned workout early moves the same session to today and keeps every other plan',async()=>{
 const p=await program(),before=await calendar()
 const next=await get(`/programs/${p.id}/next-session`)
 assert.equal(next.suggested_date,dateAfter(1))
 const started=await post(`/sessions/${next.session_id}/start`)
 assert.equal(started.scheduled_date,today)
 assert.equal(started.original_scheduled_date,dateAfter(1))
 assert.equal(started.status,'in_progress')
 assert.ok(started.started_at)
 const after=await calendar()
 assert.equal(after.length,before.length,'Scheduler must not refill the original date')
 assert.deepEqual(after.filter(s=>s.id!==started.id),before.filter(s=>s.id!==started.id))
 assert.equal(after.some(s=>s.scheduled_date===dateAfter(1)),false)
 const detail=await get(`/sessions/${started.id}`),exercise=detail.exercises[0]
 for(let n=1;n<=exercise.target_sets;n++) await post(`/session-exercises/${exercise.id}/sets`,{set_number:n,weight_kg:10,reps:exercise.target_reps_max,is_completed:true},201)
 await post(`/sessions/${started.id}/complete`)
 const completed=await get(`/sessions/${started.id}`)
 assert.equal(completed.scheduled_date,today)
 assert.equal(completed.original_scheduled_date,dateAfter(1))
 assert.equal((await get('/stats/overview')).last_session_date,today)
 assert.equal((await get(`/stats/exercises/${exercise.exercise_id}/progress`)).data[0].date,today)
 const data=(await get('/export')).data
 assert.equal(data.exercise_progressions.find(row=>row.exercise_id===exercise.exercise_id).last_session_id,started.id)
 assert.equal((await calendar()).length,before.length)
 assert.equal((await get(`/programs/${p.id}/next-session`)).session_id,
  before.filter(s=>s.status==='planned'&&s.id!==started.id).sort((a,b)=>a.scheduled_date.localeCompare(b.scheduled_date))[0].id)
})

test('starting early across a week boundary still reserves its original slot',async()=>{
 await program([weekday(today),weekday(dateAfter(2))])
 const before=await calendar(),planned=before.find(s=>s.scheduled_date===dateAfter(7))
 assert.ok(planned)
 await post(`/sessions/${planned.id}/start`)
 await post(`/sessions/${planned.id}/complete`)
 const after=await calendar()
 assert.equal(after.length,before.length)
 assert.deepEqual(after.filter(s=>s.id!==planned.id),before.filter(s=>s.id!==planned.id))
 assert.equal(after.some(s=>s.scheduled_date===dateAfter(7)),false)
 assert.equal(after.find(s=>s.id===planned.id).original_scheduled_date,dateAfter(7))
})

test('a late workout keeps its former date and a resumed workout never changes either date or timestamp',async()=>{
 const p=await program()
 const session=await post(`/sessions/from-template/${p.templates[0].id}`,{scheduled_date:dateAfter(-2)},201)
 const started=await post(`/sessions/${session.id}/start`)
 assert.equal(started.scheduled_date,today)
 assert.equal(started.original_scheduled_date,dateAfter(-2))
 const resumed=await post(`/sessions/${session.id}/start`)
 assert.equal(resumed.scheduled_date,started.scheduled_date)
 assert.equal(resumed.original_scheduled_date,started.original_scheduled_date)
 assert.equal(resumed.started_at,started.started_at)
})

test('a rejected start leaves its planned date unchanged',async()=>{
 await program()
 const planned=(await calendar()).filter(s=>s.status==='planned')
 await post(`/sessions/${planned[0].id}/start`)
 const before=await get(`/sessions/${planned[1].id}`)
 await post(`/sessions/${planned[1].id}/start`,undefined,409)
 assert.deepEqual(await get(`/sessions/${planned[1].id}`),before)
})

test('JSON round trip preserves actual and original dates and does not recreate the moved plan',async()=>{
 const p=await program(),next=await get(`/programs/${p.id}/next-session`)
 await post(`/sessions/${next.session_id}/start`)
 await post(`/sessions/${next.session_id}/complete`)
 const snapshot=await get('/export')
 await post('/import',snapshot)
 assert.deepEqual((await get('/export')).data,snapshot.data)
 const restored=await get(`/sessions/${next.session_id}`)
 assert.equal(restored.scheduled_date,today)
 assert.equal(restored.original_scheduled_date,dateAfter(1))
 assert.equal((await calendar()).some(s=>s.scheduled_date===dateAfter(1)),false)
})

test('old exports without an original date remain importable',async()=>{
 await program()
 const snapshot=await get('/export')
 for (const session of snapshot.data.sessions) delete session.original_scheduled_date
 await post('/import',snapshot)
 for (const session of await calendar()) assert.equal(session.original_scheduled_date,session.scheduled_date)
})
