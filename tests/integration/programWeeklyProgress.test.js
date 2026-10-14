import { beforeEach, test } from 'node:test'
import assert from 'node:assert/strict'
import request from '../helpers/in-process-request.js'
process.env.DB_PATH=':memory:'
const {getDb}=await import('../../src/db/database.js')
const db=getDb()
const {migrate}=await import('../../src/db/migrate.js')
const {seedExercises}=await import('../../src/seed/seed.js')
migrate(db);seedExercises(db)
const {app}=await import('../../server.js')
const {programWeeklyProgress}=await import('../../src/services/programWeeklyProgress.js')
const {localIsoDate}=await import('../../src/services/date.js')
const api=request(app)
async function call(method,path,body,status=200) {
 const req=api[method]('/api/v1'+path),res=await(body===undefined?req:req.send(body))
 assert.equal(res.status,status,res.text);return res.body
}
const get=path=>call('get',path)
const post=(path,body,status=200)=>call('post',path,body,status)
beforeEach(async()=>{await post('/reset-all')})
async function makeProgram() {
 const made=await post('/programs/generate',{goal:'general_fitness',level:'beginner',days_per_week:2,session_duration_min:45,duration_weeks:8,priority_muscles:[],language:'fr'},201)
 await post(`/programs/${made.id}/activate`)
 return get(`/programs/${made.id}`)
}
async function start(p) {
 const made=await post(`/sessions/from-template/${p.templates[0].id}`,{scheduled_date:localIsoDate()},201)
 await post(`/sessions/${made.id}/start`)
 return made.id
}
test('weekly completion counts completed workouts only and updates after deletion',async()=>{
 const p=await makeProgram()
 assert.equal(p.weekly_progress.is_complete,false)
 const first=await start(p)
 assert.equal((await get(`/programs/${p.id}`)).weekly_progress.completed_sessions,0)
 await post(`/sessions/${first}/complete`)
 assert.equal((await get(`/programs/${p.id}`)).weekly_progress.is_complete,false)
 const second=await start(p)
 await post(`/sessions/${second}/complete`)
 const progress=(await get(`/programs/${p.id}`)).weekly_progress
 assert.equal(progress.completed_sessions,2);assert.equal(progress.target_sessions,2);assert.equal(progress.is_complete,true)
 assert.deepEqual((await get('/programs')).programs.find(row=>row.id===p.id).weekly_progress,progress)
 await call('delete',`/sessions/${second}`,undefined,204)
 assert.equal((await get(`/programs/${p.id}`)).weekly_progress.is_complete,false)
})
test('Monday through Sunday boundaries exclude other weeks, programs and incomplete statuses',async()=>{
 const p=await makeProgram(),other=await makeProgram()
 const insert=db.prepare('INSERT INTO session(program_id,name,scheduled_date,status) VALUES (?,?,?,?)')
 for(const [date,status] of [['2025-12-28','completed'],['2025-12-29','completed'],['2026-01-04','completed'],['2026-01-05','completed'],['2025-12-30','skipped'],['2025-12-31','in_progress'],['2026-01-01','planned']]) insert.run(p.id,'Fixture',date,status)
 insert.run(other.id,'Other','2026-01-01','completed')
 for(const today of ['2025-12-29','2026-01-04']) {
  const progress=programWeeklyProgress(db,p,today)
  assert.equal(progress.week_start,'2025-12-29');assert.equal(progress.week_end,'2026-01-04')
  assert.equal(progress.completed_sessions,2);assert.equal(progress.is_complete,true)
 }
 assert.equal(programWeeklyProgress(db,p,'2026-01-05').completed_sessions,1)
 assert.equal(programWeeklyProgress(db,p,'2026-01-05').is_complete,false)
 assert.equal(programWeeklyProgress(db,other,'2026-01-01').completed_sessions,1)
})
test('leaving an unfinished workout preserves validated sets and blocks another workout without updating progression',async()=>{
 const p=await makeProgram(),id=await start(p)
 const detail=await get(`/sessions/${id}`),se=detail.exercises[0]
 await post(`/session-exercises/${se.id}/sets`,{set_number:1,weight_kg:10,reps:8,is_completed:true},201)
 const original=(await get('/export')).data.progression_states
 const resumed=(await get('/sessions?status=in_progress&limit=1')).sessions[0]
 assert.equal(resumed.id,id)
 const restored=await get(`/sessions/${resumed.id}`)
 assert.equal(restored.exercises[0].sets[0].weight_kg,10)
 assert.equal(restored.exercises[0].sets[0].reps,8)
 assert.equal(restored.exercises[0].sets[0].is_completed,1)
 const retry=await post(`/sessions/${id}/start`)
 assert.equal(retry.started_at,detail.started_at)
 const next=await post(`/sessions/from-template/${p.templates[1].id}`,{scheduled_date:localIsoDate()},201)
 await post(`/sessions/${next.id}/start`,undefined,409)
 assert.deepEqual((await get('/export')).data.progression_states,original)
 assert.equal((await get(`/programs/${p.id}`)).weekly_progress.completed_sessions,0)
})
