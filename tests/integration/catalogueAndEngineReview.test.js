import { test } from 'node:test'
import assert from 'node:assert/strict'
import request from '../helpers/in-process-request.js'
process.env.DB_PATH=':memory:'
const {getDb}=await import('../../src/db/database.js'),db=getDb()
const {migrate}=await import('../../src/db/migrate.js')
const {seedExercises}=await import('../../src/seed/seed.js')
migrate(db);seedExercises(db)
const {app}=await import('../../server.js')
const api=request(app)

test('restoring a legacy JSON maps custom curls to the catalogue and preserves session sets and latest progress',async()=>{
 db.exec(`INSERT INTO exercise(id,name_fr,name_en,category,movement_pattern,primary_muscles,is_custom) VALUES
   ('hammer_curl','Curl marteau','Hammer Curl','strength','pull_vertical','["biceps"]',1);
   INSERT INTO session(id,name,scheduled_date,status,completed_at) VALUES (1,'Legacy','2026-10-01','completed','2026-10-01 12:00:00');
   INSERT INTO session_exercise(id,session_id,exercise_id) VALUES (1,1,'hammer_curl');
   INSERT INTO set_log(id,session_exercise_id,set_number,weight_kg,reps,is_completed) VALUES (1,1,1,8,12,1);
   INSERT INTO exercise_progression(exercise_id,current_weight_kg,current_target_reps,last_session_id) VALUES ('hammer_curl',9,8,1);`)
 const backup=(await api.get('/api/v1/export')).body
 const restore=await api.post('/api/v1/import').send(backup)
 assert.equal(restore.status,200,restore.text)
 assert.equal(db.prepare('SELECT COUNT(*) n FROM exercise WHERE is_custom=1').get().n,0)
 assert.equal(db.prepare('SELECT exercise_id FROM session_exercise WHERE id=1').get().exercise_id,'hammer_curls')
 assert.equal(db.prepare('SELECT weight_kg FROM set_log WHERE id=1').get().weight_kg,8)
 assert.equal(db.prepare("SELECT current_weight_kg FROM exercise_progression WHERE exercise_id='hammer_curls'").get().current_weight_kg,9)
 const after=(await api.get('/api/v1/export')).body
 assert.deepEqual(after.data.exercises,[])
 assert.equal((await api.post('/api/v1/import').send(after)).status,200)
 const list=(await api.get('/api/v1/exercises')).body.exercises
 assert.ok(list.every(e=>!e.is_custom))
 assert.equal((await api.put('/api/v1/exercises/hammer_curls').send({name_fr:'Fake'})).status,403)
})

test('unknown custom backups are rejected before deleting any current data',async()=>{
 const before=(await api.get('/api/v1/export')).body
 const invalid=structuredClone(before)
 invalid.data.exercises=[{id:'unknown_custom',name_en:'Unknown exercise'}]
 const result=await api.post('/api/v1/import').send(invalid)
 assert.equal(result.status,400)
 assert.equal(result.body.error,'UNSUPPORTED_CUSTOM_EXERCISE')
 assert.deepEqual((await api.get('/api/v1/export')).body.data,before.data)
})

test('current inventory clamps both starting adjustments and targets without discarding historical progress',async()=>{
 await api.post('/api/v1/reset-all')
 db.exec(`INSERT INTO equipment_item(category,name,count,weight_kg) VALUES ('dumbbell_fixed','Pair',2,8);
 INSERT INTO program(id,name,goal,level,days_per_week,is_active,started_on,created_at)
   VALUES (1,'A','general_fitness','beginner',2,1,date('now','localtime'),date('now','-60 days'));
 INSERT INTO workout_template(id,program_id,name) VALUES (1,1,'A');
 INSERT INTO template_exercise(id,workout_template_id,exercise_id) VALUES (1,1,'dumbbell_bicep_curl');
 INSERT INTO progression_state(template_exercise_id,current_weight_kg,current_target_reps,last_session_id) VALUES (1,15,8,99);
 INSERT INTO exercise_progression(exercise_id,current_weight_kg,current_target_reps,last_session_id)
   VALUES ('dumbbell_bicep_curl',15,8,99);`)
 const created=await api.post('/api/v1/sessions/from-template/1').send({scheduled_date:new Date().toISOString().slice(0,10)})
 assert.equal(created.status,201,created.text)
 const id=created.body.id
 const start=await api.post(`/api/v1/sessions/${id}/start`)
 assert.equal(start.status,200,start.text)
 assert.equal(start.body.adjustments.find(a=>a.template_exercise_id===1).target_weight_kg,8)
 const target=await api.get(`/api/v1/sessions/${id}/target/1`)
 assert.equal(target.status,200)
 assert.equal(target.body.weight_kg,8)
 assert.equal(db.prepare('SELECT current_weight_kg FROM exercise_progression').get().current_weight_kg,15)
 const detail=(await api.get(`/api/v1/sessions/${id}`)).body
 const log=await api.post(`/api/v1/session-exercises/${detail.exercises[0].id}/sets`).send({set_number:1,weight_kg:8,reps:8,is_completed:true})
 assert.equal(log.status,201)
 db.exec("CREATE TRIGGER fail_progression BEFORE INSERT ON exercise_progression_event BEGIN SELECT RAISE(ABORT,'simulated progression failure'); END;")
 const snapshot=()=>Object.fromEntries(['session','progression_state','exercise_progression','exercise_progression_event'].map(table=>[table,db.prepare(`SELECT * FROM ${table}`).all()]))
 const before=snapshot()
 const failed=await api.post(`/api/v1/sessions/${id}/complete`)
 assert.equal(failed.status,500)
 assert.deepEqual(snapshot(),before,'a progression failure must roll back completion and all learned states')
 db.exec('DROP TRIGGER fail_progression')
 assert.equal((await api.post(`/api/v1/sessions/${id}/complete`)).status,200)
 assert.equal(db.prepare('SELECT current_week FROM program WHERE id=1').get().current_week,1)
})
