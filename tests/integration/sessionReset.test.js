import {test,beforeEach} from 'node:test'
import assert from 'node:assert/strict'
import request from '../helpers/in-process-request.js'
process.env.DB_PATH=':memory:'
const {getDb}=await import('../../src/db/database.js'),db=getDb()
const {migrate}=await import('../../src/db/migrate.js')
const {seedExercises}=await import('../../src/seed/seed.js')
migrate(db);seedExercises(db)
const {app}=await import('../../server.js'),api=request(app)
const {localIsoDate}=await import('../../src/services/date.js')
const {scheduleWeeks}=await import('../../src/services/sessionScheduler.js')
async function call(method,path,body,status=200){
 const res=await api[method]('/api/v1'+path).send(body)
 assert.equal(res.status,status,`${method} ${path}: ${res.text}`);return res.body
}
beforeEach(async()=>{await call('post','/reset-all')})
async function fixture(){
 await call('post','/equipment',{category:'dumbbell_adjustable',name:'Pair',count:2,weight_min_kg:2,weight_max_kg:30,weight_step_kg:1},201)
 await call('post','/equipment',{category:'bench_adjustable',name:'Bench',count:1},201)
 const p=await call('post','/programs/generate',{goal:'general_fitness',level:'beginner',days_per_week:2,training_days:[0,3],session_duration_min:20,duration_weeks:8,priority_muscles:[],language:'fr'},201)
 await call('post',`/programs/${p.id}/activate`)
 const plan=await call('get',`/programs/${p.id}`)
 return plan
}
function future(offset){const d=new Date();d.setDate(d.getDate()+offset);return localIsoDate(d)}
const DATE_A=future(3),DATE_B=future(10)
async function start(p,date=DATE_A){
 const made=await call('post',`/sessions/from-template/${p.templates[0].id}`,{scheduled_date:date},201)
 await call('post',`/sessions/${made.id}/start`)
 return call('get',`/sessions/${made.id}`)
}
async function log(session,weight=10,complete=true){
 const se=session.exercises[0]
 for(let i=1;i<=se.target_sets;i++)await call('post',`/session-exercises/${se.id}/sets`,{set_number:i,weight_kg:weight,reps:se.target_reps_max,is_completed:true},201)
 if(complete)await call('post',`/sessions/${session.id}/complete`)
 return se
}
const snapshot=()=>Object.fromEntries(['session','session_exercise','set_log','personal_record','exercise_progression','progression_state','exercise_progression_event'].map(t=>[t,db.prepare(`SELECT * FROM ${t} ORDER BY 1`).all()]))

test('discarding an active attempt restores its original schedule, retires old set IDs and creates no duplicate',async()=>{
 const p=await fixture(),session=await start(p),se=await log(session,10,false)
 const oldSet=db.prepare('SELECT id FROM set_log WHERE session_exercise_id=? LIMIT 1').get(se.id)
 const result=await call('post',`/sessions/${session.id}/reset`,{expected_status:'in_progress'})
 assert.equal(result.status,'planned');assert.equal(result.scheduled_date,DATE_A)
 for(const key of ['original_scheduled_date','started_at','completed_at','duration_seconds','total_volume_kg','rpe_avg'])assert.equal(result[key],null,key)
 assert.equal(db.prepare('SELECT COUNT(*) n FROM set_log').get().n,0)
 assert.equal(db.prepare('SELECT COUNT(*) n FROM personal_record').get().n,0)
 assert.equal(db.prepare('SELECT COUNT(*) n FROM exercise_progression').get().n,0)
 const detail=await call('get',`/sessions/${session.id}`)
 assert.equal(detail.exercises.length,session.exercises.length)
 assert.ok(detail.exercises.every(e=>e.id!==se.id && !e.sets.length))
 await call('post',`/session-exercises/${se.id}/sets`,{set_number:1,weight_kg:99,reps:9,is_completed:true},404)
 await call('put',`/sets/${oldSet.id}`,{is_completed:true},404)
 scheduleWeeks(db,p.id)
 assert.equal(db.prepare('SELECT COUNT(*) n FROM session WHERE id=?').get(session.id).n,1)
 await call('post',`/sessions/${session.id}/start`)
 assert.equal((await call('get',`/sessions/${session.id}`)).status,'in_progress')
})

test('resetting a completion restores the preceding learned state and records while retaining other sessions',async()=>{
 const p=await fixture(),first=await start(p,DATE_A),se=await log(first,10)
 const previous=db.prepare('SELECT * FROM exercise_progression WHERE exercise_id=?').get(se.exercise_id)
 const firstSnapshot=await call('get',`/sessions/${first.id}`)
 const second=await start(p,DATE_B);await log(second,12)
 assert.equal(db.prepare('SELECT current_weight_kg FROM exercise_progression WHERE exercise_id=?').get(se.exercise_id).current_weight_kg,13)
 const monday=new Date(localIsoDate()+'T12:00:00Z');monday.setUTCDate(monday.getUTCDate()-(monday.getUTCDay()+6)%7)
 db.prepare("INSERT INTO program_weekly_review(program_id,week_start,decision,evidence) VALUES (?,?,'maintain','{}')").run(p.id,monday.toISOString().slice(0,10))
 await call('post',`/sessions/${second.id}/reset`,{expected_status:'completed'})
 const learned=db.prepare('SELECT * FROM exercise_progression WHERE exercise_id=?').get(se.exercise_id)
 assert.equal(learned.current_weight_kg,previous.current_weight_kg);assert.equal(learned.last_session_id,first.id)
 assert.equal(db.prepare('SELECT MAX(weight_kg) weight FROM personal_record WHERE exercise_id=?').get(se.exercise_id).weight,10)
 assert.deepEqual(await call('get',`/sessions/${first.id}`),firstSnapshot)
 assert.equal(db.prepare('SELECT COUNT(*) n FROM exercise_progression_event WHERE session_exercise_id=?').get(second.exercises[0].id).n,0)
 assert.equal(db.prepare('SELECT COUNT(*) n FROM program_weekly_review WHERE program_id=?').get(p.id).n,0)
 assert.deepEqual(db.pragma('foreign_key_check'),[])
})

test('resetting the only completion clears learned performance and all active copies of its targets',async()=>{
 const p=await fixture(),session=await start(p),se=await log(session)
 await call('post',`/sessions/${session.id}/reset`,{expected_status:'completed'})
 assert.equal(db.prepare('SELECT COUNT(*) n FROM exercise_progression').get().n,0)
 assert.equal(db.prepare('SELECT COUNT(*) n FROM personal_record').get().n,0)
 for(const state of db.prepare(`SELECT ps.* FROM progression_state ps JOIN template_exercise te ON te.id=ps.template_exercise_id WHERE te.exercise_id=?`).all(se.exercise_id)){
  assert.equal(state.current_weight_kg,0);assert.equal(state.last_session_id,null)
 }
 await call('post',`/sessions/${session.id}/reset`,{expected_status:'completed'},409)
})

test('a reset cannot erase a changed status or an unrelated active workout',async()=>{
 const p=await fixture(),first=await start(p),se=await log(first)
 const second=await start(p,DATE_B);await log(second,8,false)
 const active=await call('get',`/sessions/${second.id}`)
 await call('post',`/sessions/${first.id}/reset`,{expected_status:'in_progress'},409)
 await call('post',`/sessions/${first.id}/reset`,{expected_status:'completed'})
 assert.deepEqual(await call('get',`/sessions/${second.id}`),active)
 assert.equal(db.prepare('SELECT MAX(weight_kg) w FROM personal_record WHERE exercise_id=?').get(se.exercise_id).w,8)
})

test('a recalculation failure rolls back the reset and leaves the completed workout intact',async()=>{
 const p=await fixture(),session=await start(p);await log(session)
 db.exec("CREATE TRIGGER fail_reset BEFORE UPDATE ON progression_state BEGIN SELECT RAISE(ABORT,'test failure'); END;")
 const before=snapshot()
 await call('post',`/sessions/${session.id}/reset`,{expected_status:'completed'},500)
 assert.deepEqual(snapshot(),before)
 db.exec('DROP TRIGGER fail_reset')
 await call('post',`/sessions/${session.id}/reset`,{expected_status:'completed'})
})

test('invalid reset requests are rejected without writes',async()=>{
 const before=snapshot()
 await call('post','/sessions/999999/reset',{expected_status:'completed'},404)
 for(const expected_status of ['planned','skipped',null])await call('post','/sessions/999999/reset',{expected_status},400)
 assert.deepEqual(snapshot(),before)
})

test('an archived workout without a surviving program can also be reset and restarted',async()=>{
 const id=Number(db.prepare("INSERT INTO session(name,scheduled_date,status,completed_at) VALUES ('Archive',?,'completed',datetime('now'))").run(localIsoDate()).lastInsertRowid)
 const se=Number(db.prepare("INSERT INTO session_exercise(session_id,exercise_id) VALUES (?,'bodyweight_squat')").run(id).lastInsertRowid)
 db.prepare('INSERT INTO set_log(session_exercise_id,set_number,reps,is_completed) VALUES (?,1,12,1)').run(se)
 await call('post',`/sessions/${id}/reset`,{expected_status:'completed'})
 const detail=await call('get',`/sessions/${id}`)
 assert.equal(detail.status,'planned');assert.equal(detail.exercises.length,1)
 assert.equal(detail.exercises[0].sets.length,0)
 await call('post',`/sessions/${id}/start`)
 assert.equal((await call('get',`/sessions/${id}`)).status,'in_progress')
})
