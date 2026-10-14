import { test } from 'node:test'
import assert from 'node:assert/strict'
import request from '../helpers/in-process-request.js'
process.env.DB_PATH=':memory:'
const { getDb }=await import('../../src/db/database.js')
const db=getDb()
const { migrate }=await import('../../src/db/migrate.js')
const { seedExercises }=await import('../../src/seed/seed.js')
migrate(db); seedExercises(db)
const { app }=await import('../../server.js')
const params={goal:'hypertrophy',level:'intermediate',days_per_week:3,session_duration_min:45,duration_weeks:8,priority_muscles:[],language:'fr'}

test('questionnaire creation, activation, recovery targets, and export/import work without AI',async()=>{
  const preview=await request(app).post('/api/v1/programs/preview').send(params)
  assert.equal(preview.status,200)
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM program').get().n,0)
  const created=await request(app).post('/api/v1/programs/generate').send(params)
  assert.equal(created.status,201)
  const id=created.body.id
  const detail=await request(app).get(`/api/v1/programs/${id}`)
  assert.equal(detail.body.plan.parameters.session_duration_min,45)
  assert.equal(detail.body.templates.length,3)
  assert.equal(detail.body.use_exercise_rotation,false)
  const activated=await request(app).post(`/api/v1/programs/${id}/activate`)
  assert.equal(activated.status,200)
  assert.ok(activated.body.sessions_scheduled>0)
  const template=detail.body.templates[0]
  db.prepare("UPDATE program SET is_in_deload=1,last_deload_date=date('now') WHERE id=?").run(id)
  const session=await request(app).post(`/api/v1/sessions/from-template/${template.id}`).send({scheduled_date:new Date().toISOString().slice(0,10)})
  assert.equal(session.status,201)
  const started=await request(app).post(`/api/v1/sessions/${session.body.id}/start`)
  assert.equal(started.status,200)
  assert.equal(started.body.is_deload,1)
  const exercise=template.exercises[0]
  const stateBefore=db.prepare('SELECT * FROM progression_state WHERE template_exercise_id=?').get(exercise.id)
  const target=await request(app).get(`/api/v1/sessions/${session.body.id}/target/${exercise.id}`)
  assert.equal(target.status,200)
  assert.equal(target.body.reps_min,target.body.reps_max)
  assert.ok(target.body.explanation.includes('allégée'))
  const sessionDetail=await request(app).get(`/api/v1/sessions/${session.body.id}`)
  assert.ok(sessionDetail.body.exercises[0].target_sets <= exercise.target_sets)
  const se=sessionDetail.body.exercises[0]
  const logged=await request(app).post(`/api/v1/session-exercises/${se.id}/sets`).send({set_number:1,weight_kg:target.body.weight_kg,reps:target.body.reps_min,is_completed:true})
  assert.equal(logged.status,201)
  const completed=await request(app).post(`/api/v1/sessions/${session.body.id}/complete`)
  assert.equal(completed.status,200)
  assert.deepEqual(db.prepare('SELECT * FROM progression_state WHERE template_exercise_id=?').get(exercise.id),stateBefore)
  const exported=await request(app).get('/api/v1/export')
  assert.equal(exported.body.data.program_plans.length,1)
  const imported=await request(app).post('/api/v1/import').send(exported.body)
  assert.equal(imported.status,200)
  assert.deepEqual(JSON.parse(db.prepare('SELECT parameters FROM program_plan WHERE program_id=?').get(id).parameters),params)
})

test('invalid or LLM-authored targets cannot override the engine',async()=>{
  const invalid=await request(app).post('/api/v1/programs/generate').send({...params,days_per_week:7})
  assert.equal(invalid.status,400)
  const preview=await request(app).post('/api/v1/programs/preview').send({...params,templates:[{name:'Injected',exercises:[{exercise_id:'not_real',target_sets:999}]}],use_exercise_rotation:true})
  assert.equal(preview.status,200)
  assert.ok(preview.body.templates.every(t=>t.name!=='Injected'))
  assert.equal(preview.body.use_exercise_rotation,0)
})

test('deleting and rebuilding a program preserves per-exercise progress and all workout history',async()=>{
  await request(app).post('/api/v1/reset-all')
  db.prepare("INSERT INTO equipment_item(category,name,count,weight_kg) VALUES ('dumbbell_fixed','10 kg',2,10),('dumbbell_fixed','12 kg',2,12),('bench','Bench',1,NULL)").run()
  const created=await request(app).post('/api/v1/programs/generate').send(params)
  const id=created.body.id
  const detail=await request(app).get(`/api/v1/programs/${id}`)
  const template=detail.body.templates.find(t=>t.exercises.some(e=>e.exercise_id==='dumbbell_bench_press'))
  assert.ok(template,'A familiar dumbbell chest exercise is selected')
  const exercise=template.exercises.find(e=>e.exercise_id==='dumbbell_bench_press')
  const session=await request(app).post(`/api/v1/sessions/from-template/${template.id}`).send({scheduled_date:'2026-10-14'})
  await request(app).post(`/api/v1/sessions/${session.body.id}/start`)
  const loaded=await request(app).get(`/api/v1/sessions/${session.body.id}`)
  const se=loaded.body.exercises.find(e=>e.exercise_id===exercise.exercise_id)
  for(let i=0;i<exercise.target_sets;i++){
    const result=await request(app).post(`/api/v1/session-exercises/${se.id}/sets`).send({set_number:i+1,weight_kg:10,reps:exercise.target_reps_max,is_completed:true})
    assert.equal(result.status,201)
  }
  const complete=await request(app).post(`/api/v1/sessions/${session.body.id}/complete`)
  assert.equal(complete.status,200)
  const learned=db.prepare('SELECT * FROM exercise_progression WHERE exercise_id=?').get(exercise.exercise_id)
  assert.ok(learned.current_weight_kg>=10,'Progression starts from the performed load, not the initial zero')
  const removed=await request(app).delete(`/api/v1/programs/${id}`)
  assert.equal(removed.status,204)
  assert.deepEqual(db.prepare('SELECT * FROM exercise_progression WHERE exercise_id=?').get(exercise.exercise_id),learned)
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM set_log WHERE session_exercise_id=?').get(se.id).n,exercise.target_sets)
  const recreated=await request(app).post('/api/v1/programs/generate').send({...params,priority_muscles:['chest']})
  assert.equal(recreated.status,201)
  const replacement=db.prepare(`SELECT ps.* FROM progression_state ps JOIN template_exercise te ON te.id=ps.template_exercise_id
    JOIN workout_template wt ON wt.id=te.workout_template_id WHERE wt.program_id=? AND te.exercise_id=?`).get(recreated.body.id,exercise.exercise_id)
  assert.equal(replacement.current_weight_kg,learned.current_weight_kg)
  assert.equal(replacement.current_target_reps,learned.current_target_reps)
  assert.equal(replacement.last_session_id,session.body.id)
  const exported=await request(app).get('/api/v1/export')
  const imported=await request(app).post('/api/v1/import').send(exported.body)
  assert.equal(imported.status,200)
  assert.deepEqual(db.prepare('SELECT * FROM exercise_progression WHERE exercise_id=?').get(exercise.exercise_id),learned)
  const history=await request(app).get(`/api/v1/exercises/${exercise.exercise_id}/history`)
  assert.equal(history.status,200)
  assert.ok(history.body.history.length>0)
})

test('reset scopes match the UI: personal profile, activity, then all user data',async()=>{
  db.prepare("UPDATE user_profile SET display_name='Alex',sex='male',date_of_birth='1990-01-10'").run()
  const programsBefore=db.prepare('SELECT COUNT(*) AS n FROM program').get().n
  const progressionBefore=db.prepare('SELECT COUNT(*) AS n FROM exercise_progression').get().n
  assert.ok(progressionBefore>0)
  const profileReset=await request(app).delete('/api/v1/user-profile')
  assert.equal(profileReset.status,200)
  assert.equal(profileReset.body.date_of_birth,null)
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM exercise_progression').get().n,progressionBefore)
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM program').get().n,programsBefore)
  db.prepare("UPDATE user_profile SET display_name='Kept'").run()
  const planBefore=db.prepare('SELECT * FROM program_plan').all()
  const activityReset=await request(app).post('/api/v1/reset-stats')
  assert.equal(activityReset.status,200)
  for(const table of ['session','set_log','personal_record','exercise_progression','program_weekly_review'])assert.equal(db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n,0)
  assert.deepEqual(db.prepare('SELECT * FROM program_plan').all(),planBefore)
  assert.equal(db.prepare('SELECT display_name FROM user_profile').get().display_name,'Kept')
  assert.ok(db.prepare('SELECT COUNT(*) AS n FROM equipment_item').get().n>0)
  const settingsBefore=db.prepare('SELECT * FROM settings').all()
  db.prepare("INSERT INTO coach_conversation(title) VALUES ('Test')").run()
  const allReset=await request(app).post('/api/v1/reset-all')
  assert.equal(allReset.status,200)
  for(const table of ['program','program_plan','equipment_item','coach_conversation','exercise_progression'])assert.equal(db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n,0)
  assert.equal(db.prepare('SELECT display_name FROM user_profile').get().display_name,null)
  assert.deepEqual(db.prepare('SELECT * FROM settings').all(),settingsBefore)
  assert.ok(db.prepare('SELECT COUNT(*) AS n FROM exercise WHERE is_custom=0').get().n>0)
})

test('birth dates are validated, and creating a program cannot rewrite personal identity',async()=>{
  for(const date_of_birth of ['2026-02-30','2099-01-01','not-a-date']) {
    const result=await request(app).put('/api/v1/user-profile').send({date_of_birth})
    assert.equal(result.status,400)
  }
  const saved=await request(app).put('/api/v1/user-profile').send({display_name:'Alex',sex:'male',date_of_birth:'1990-02-01'})
  assert.equal(saved.status,200)
  const identity=db.prepare('SELECT * FROM user_profile').get()
  const result=await request(app).post('/api/v1/programs/generate').send({...params,weight_kg:80,height_cm:180})
  assert.equal(result.status,201)
  assert.deepEqual(db.prepare('SELECT * FROM user_profile').get(),identity)
  const detail=await request(app).get(`/api/v1/programs/${result.body.id}`)
  assert.equal(detail.body.plan.parameters.weight_kg,80)
  assert.equal(detail.body.plan.parameters.height_cm,180)
})

test('unlimited duration is accepted, exported and scheduled without an end date',async()=>{
  const input={...params,duration_weeks:null}
  const preview=await request(app).post('/api/v1/programs/preview').send(input)
  assert.equal(preview.status,200)
  assert.equal(preview.body.duration_weeks,null)
  const created=await request(app).post('/api/v1/programs/generate').send(input)
  assert.equal(created.status,201)
  const id=created.body.id
  const detail=await request(app).get(`/api/v1/programs/${id}`)
  assert.equal(detail.body.duration_weeks,null)
  assert.equal(detail.body.plan.parameters.duration_weeks,null)
  const activate=await request(app).post(`/api/v1/programs/${id}/activate`)
  assert.equal(activate.status,200)
  assert.ok(activate.body.sessions_scheduled>0)
  const exported=await request(app).get('/api/v1/export')
  assert.equal(exported.body.data.programs.find(p=>p.id===id).duration_weeks,null)
})

test('duration editing updates both records and preserves exercises, progression, sessions and training choices',async()=>{
  const created=await request(app).post('/api/v1/programs/generate').send(params)
  const id=created.body.id
  const before=(await request(app).get(`/api/v1/programs/${id}`)).body
  const snapshot=()=>({progression:db.prepare('SELECT * FROM progression_state ORDER BY id').all(),sessions:db.prepare('SELECT * FROM session ORDER BY id').all()})
  const dataBefore=snapshot()
  for(const weeks of [16,null,6]){
    const result=await request(app).put(`/api/v1/programs/${id}`).send({duration_weeks:weeks})
    assert.equal(result.status,200)
    const after=(await request(app).get(`/api/v1/programs/${id}`)).body
    assert.equal(after.duration_weeks,weeks)
    const reused=await request(app).post('/api/v1/programs/preview').send(after.plan.parameters)
    assert.equal(reused.status,200)
    assert.equal(reused.body.duration_weeks,weeks)
    assert.deepEqual(after.plan.parameters,{...before.plan.parameters,duration_weeks:weeks})
    assert.deepEqual(after.templates,before.templates)
    for(const key of ['name','goal','level','days_per_week','progression_model'])assert.equal(after[key],before[key])
    assert.deepEqual(snapshot(),dataBefore)
  }
  for(const key of ['goal','level','days_per_week','session_duration_min','name','templates']){
    const result=await request(app).put(`/api/v1/programs/${id}`).send({duration_weeks:12,[key]:'changed'})
    assert.equal(result.status,403)
    assert.equal(db.prepare('SELECT duration_weeks FROM program WHERE id=?').get(id).duration_weeks,6)
  }
  for(const duration_weeks of [0,-1,2.5,'8',true]){
    const result=await request(app).put(`/api/v1/programs/${id}`).send({duration_weeks})
    assert.equal(result.status,400)
  }
  assert.equal((await request(app).put('/api/v1/programs/9999999').send({duration_weeks:8})).status,404)
})

test('chosen weekdays persist and schedule exactly those days, including Sunday',async()=>{
 const input={...params,days_per_week:2,training_days:[6,1]}
 const created=await request(app).post('/api/v1/programs/generate').send(input)
 assert.equal(created.status,201)
 const id=created.body.id
 const detail=(await request(app).get(`/api/v1/programs/${id}`)).body
 assert.deepEqual(detail.plan.parameters.training_days,[6,1])
 assert.deepEqual(detail.templates.map(t=>t.day_of_week),[1,6])
 await request(app).post(`/api/v1/programs/${id}/activate`)
 const planned=(await request(app).get('/api/v1/sessions?active_program=1')).body.sessions
 assert.ok(planned.length>=2)
 for(const session of planned){
  assert.equal(session.program_id,id)
  const weekday=(new Date(session.scheduled_date+'T12:00:00Z').getUTCDay()+6)%7
  assert.ok([1,6].includes(weekday))
  assert.equal(detail.templates.find(t=>t.id===session.workout_template_id).day_of_week,weekday)
 }
 const {scheduleWeeks}=await import('../../src/services/sessionScheduler.js')
 assert.equal(scheduleWeeks(db,id),0)
 const upcoming=(await request(app).get(`/api/v1/programs/${id}/next-session`)).body
 assert.ok(upcoming.session_id)
 assert.equal(upcoming.suggested_date,planned.map(s=>s.scheduled_date).sort()[0])
 const rowsBefore=db.prepare('SELECT COUNT(*) AS n FROM session WHERE program_id=?').get(id).n
 assert.equal((await request(app).post(`/api/v1/sessions/${upcoming.session_id}/start`)).status,200)
 const prepared=(await request(app).get(`/api/v1/sessions/${upcoming.session_id}`)).body
 assert.equal(prepared.exercises.length,detail.templates.find(t=>t.id===upcoming.template_id).exercises.length)
 assert.ok(prepared.exercises.length>0)
 await request(app).post(`/api/v1/sessions/${upcoming.session_id}/start`)
 assert.equal(db.prepare('SELECT COUNT(*) AS n FROM session_exercise WHERE session_id=?').get(upcoming.session_id).n,prepared.exercises.length)
 assert.equal(db.prepare('SELECT COUNT(*) AS n FROM session WHERE program_id=?').get(id).n,rowsBefore)
 db.prepare("UPDATE session SET status='skipped' WHERE id=?").run(upcoming.session_id)
 for(const training_days of [[1,1],[1,7],[],[1],['1',6]]){
  const result=await request(app).post('/api/v1/programs/generate').send({...input,training_days})
  assert.equal(result.status,400)
 }
})

test('calendar shows only the active program and deletion removes plans while retaining historical sessions',async()=>{
 const make=async()=> (await request(app).post('/api/v1/programs/generate').send(params)).body.id
 const a=await make(), b=await make()
 const insert=(id,status)=>Number(db.prepare('INSERT INTO session (name,scheduled_date,program_id,status) VALUES (?,?,?,?)').run('Calendar test','2026-10-14',id,status).lastInsertRowid)
 const aCompleted=insert(a,'completed'),aSkipped=insert(a,'skipped'),aPlanned=insert(a,'planned')
 const orphan=insert(null,'planned')
 await request(app).post(`/api/v1/programs/${a}/activate`)
 let calendar=(await request(app).get('/api/v1/sessions?active_program=1')).body.sessions
 assert.ok(calendar.every(s=>s.program_id===a))
 for(const status of ['completed','in_progress','planned','skipped'])insert(b,status)
 await request(app).post(`/api/v1/programs/${b}/activate`)
 calendar=(await request(app).get('/api/v1/sessions?active_program=1')).body.sessions
 assert.ok(calendar.every(s=>s.program_id===b))
 assert.deepEqual(new Set(calendar.map(s=>s.status)),new Set(['completed','in_progress','planned','skipped']))
 assert.ok(!calendar.some(s=>[aCompleted,aSkipped,aPlanned,orphan].includes(s.id)))
 assert.equal(db.prepare('SELECT COUNT(*) AS n FROM program WHERE is_active=1').get().n,1)
 const deleted=await request(app).delete(`/api/v1/programs/${a}`)
 assert.equal(deleted.status,204)
 assert.equal(db.prepare('SELECT id FROM session WHERE id=?').get(aPlanned),undefined)
 assert.equal(db.prepare('SELECT program_id FROM session WHERE id=?').get(aCompleted).program_id,null)
 assert.equal(db.prepare('SELECT program_id FROM session WHERE id=?').get(aSkipped).program_id,null)
 const history=(await request(app).get('/api/v1/sessions?status=completed&limit=200')).body.sessions
 assert.ok(history.some(s=>s.id===aCompleted))
 db.prepare("UPDATE session SET status='completed' WHERE program_id=? AND status='in_progress'").run(b)
 assert.equal((await request(app).delete(`/api/v1/programs/${b}`)).status,204)
 assert.deepEqual((await request(app).get('/api/v1/sessions?active_program=1')).body.sessions,[])
})

test('editing program weekdays keeps the original frequency and refreshes only future planned sessions',async()=>{
 const input={...params,training_days:[0,2,4]}
 const created=await request(app).post('/api/v1/programs/generate').send(input)
 const id=created.body.id
 await request(app).post(`/api/v1/programs/${id}/activate`)
 const {localIsoDate}=await import('../../src/services/date.js')
 const today=localIsoDate()
 for(const status of ['completed','in_progress','skipped'])db.prepare('INSERT INTO session(name,program_id,scheduled_date,status) VALUES (?,?,?,?)').run('Preserve',id,today,status)
 const before=(await request(app).get(`/api/v1/programs/${id}`)).body
 const history=db.prepare("SELECT * FROM session WHERE program_id=? AND status!='planned' ORDER BY id").all(id)
 const progression=db.prepare('SELECT * FROM progression_state ORDER BY id').all()
 const edited=await request(app).put(`/api/v1/programs/${id}`).send({duration_weeks:null,training_days:[6,1,3]})
 assert.equal(edited.status,200)
 assert.equal(edited.body.days_per_week,3)
 assert.deepEqual(edited.body.plan.parameters.training_days,[1,3,6])
 const after=(await request(app).get(`/api/v1/programs/${id}`)).body
 assert.equal(after.duration_weeks,null)
 assert.equal(after.plan.parameters.session_duration_min,before.plan.parameters.session_duration_min)
 assert.deepEqual(after.templates.map(t=>({...t,day_of_week:null})),before.templates.map(t=>({...t,day_of_week:null})))
 assert.deepEqual(after.templates.map(t=>t.day_of_week),[1,3,6])
 assert.deepEqual(db.prepare("SELECT * FROM session WHERE program_id=? AND status!='planned' ORDER BY id").all(id),history)
 assert.deepEqual(db.prepare('SELECT * FROM progression_state ORDER BY id').all(),progression)
 const future=db.prepare("SELECT * FROM session WHERE program_id=? AND status='planned' AND scheduled_date>=?").all(id,today)
 assert.ok(future.length>0)
 assert.ok(future.every(s=>[1,3,6].includes((new Date(s.scheduled_date+'T12:00:00Z').getUTCDay()+6)%7)))
 const snapshot=JSON.stringify(db.prepare('SELECT * FROM session WHERE program_id=? ORDER BY id').all(id))
 await request(app).put(`/api/v1/programs/${id}`).send({training_days:[1,3,6]})
 assert.equal(JSON.stringify(db.prepare('SELECT * FROM session WHERE program_id=? ORDER BY id').all(id)),snapshot)
 for(const training_days of [[],[1,3],[0,1,2,3],[1,1,3],[1,3,7],null]){
  const rejected=await request(app).put(`/api/v1/programs/${id}`).send({duration_weeks:12,training_days})
  assert.equal(rejected.status,400)
  assert.equal(rejected.body.required_days,3)
  assert.equal(db.prepare('SELECT duration_weeks FROM program WHERE id=?').get(id).duration_weeks,null)
 }
 assert.equal((await request(app).put(`/api/v1/programs/${id}`).send({days_per_week:2,training_days:[1,3]})).status,403)
 const legacy=Number(db.prepare("INSERT INTO program(name,goal,level,days_per_week) VALUES ('Legacy','hypertrophy','intermediate',2)").run().lastInsertRowid)
 const legacyEdit=await request(app).put(`/api/v1/programs/${legacy}`).send({training_days:[2,5]})
 assert.equal(legacyEdit.status,200)
 assert.equal(legacyEdit.body.goal,'hypertrophy')
 assert.deepEqual(legacyEdit.body.plan.parameters.training_days,[2,5])
 assert.equal(legacyEdit.body.plan.parameters.session_duration_min,undefined)
 db.prepare("UPDATE session SET status='skipped' WHERE program_id=? AND status='in_progress'").run(id)
})

test('failed rescheduling rolls back program parameters and existing planned sessions',async()=>{
 const input={...params,name:'Rollback scheduling test',training_days:[0,2,4]}
 const created=await request(app).post('/api/v1/programs/generate').send(input)
 const id=created.body.id
 await request(app).post(`/api/v1/programs/${id}/activate`)
 const snapshot=()=>({program:db.prepare('SELECT * FROM program WHERE id=?').get(id),plan:db.prepare('SELECT * FROM program_plan WHERE program_id=?').get(id),templates:db.prepare('SELECT * FROM workout_template WHERE program_id=? ORDER BY id').all(id),sessions:db.prepare('SELECT * FROM session WHERE program_id=? ORDER BY id').all(id)})
 const before=snapshot()
 db.exec("CREATE TEMP TRIGGER reject_new_schedule BEFORE INSERT ON session WHEN NEW.program_id=(SELECT id FROM program WHERE name='Rollback scheduling test') BEGIN SELECT RAISE(ABORT,'Simulated scheduling failure'); END")
 try {
  const result=await request(app).put(`/api/v1/programs/${id}`).send({training_days:[1,3,6],duration_weeks:null})
  assert.equal(result.status,500)
  assert.deepEqual(snapshot(),before)
 } finally {db.exec('DROP TRIGGER reject_new_schedule')}
})

async function replacementFixture(){
 db.prepare("INSERT INTO equipment_item(category,name,count,weight_kg) VALUES ('barbell','Bar',1,20),('plate','Plate',4,10),('bench','Bench',1,NULL),('dumbbell_fixed','Dumbbells',2,12)").run()
 const program=Number(db.prepare("INSERT INTO program(name,goal,level,days_per_week,duration_weeks) VALUES ('Replacement test','general_fitness','intermediate',2,8)").run().lastInsertRowid)
 const template=Number(db.prepare("INSERT INTO workout_template(program_id,name,order_index) VALUES (?,'Workout A',0)").run(program).lastInsertRowid)
 const added=await request(app).post(`/api/v1/templates/${template}/exercises`).send({exercise_id:'barbell_bench_press_medium_grip',target_sets:3,target_reps_min:8,target_reps_max:12,rest_seconds:90})
 assert.equal(added.status,201)
 return {program,template,exercise:added.body}
}

test('program exercise replacement updates plans and restores each exercise own progress while preserving history',async()=>{
 const f=await replacementFixture(), old='barbell_bench_press_medium_grip', next='dumbbell_bench_press'
 const historical=await request(app).post(`/api/v1/sessions/from-template/${f.template}`).send({scheduled_date:'2026-10-01'})
 const historicalSe=historical.body.exercises[0].id
 await request(app).post(`/api/v1/session-exercises/${historicalSe}/sets`).send({set_number:1,weight_kg:40,reps:10,is_completed:true})
 db.prepare("UPDATE session SET status='completed',completed_at='2026-10-01 12:00:00' WHERE id=?").run(historical.body.id)
 const otherHistory=Number(db.prepare("INSERT INTO session(name,scheduled_date,status,completed_at) VALUES ('Prior dumbbells','2026-10-02','completed','2026-10-02 12:00:00')").run().lastInsertRowid)
 for(const [id,weight,session] of [[old,40,historical.body.id],[next,12,otherHistory]])db.prepare(`INSERT INTO exercise_progression(exercise_id,current_weight_kg,current_target_reps,consecutive_failures,target_reps_min,target_reps_max,last_session_id)
   VALUES (?,?,10,1,8,12,?) ON CONFLICT(exercise_id) DO UPDATE SET current_weight_kg=excluded.current_weight_kg,current_target_reps=10,target_reps_min=8,target_reps_max=12,last_session_id=excluded.last_session_id`).run(id,weight,session)
 db.prepare('UPDATE progression_state SET current_weight_kg=40,current_target_reps=10 WHERE template_exercise_id=?').run(f.exercise.id)
 const today=(await import('../../src/services/date.js')).localIsoDate()
 const planned=await request(app).post(`/api/v1/sessions/from-template/${f.template}`).send({scheduled_date:today})
 const plannedSe=planned.body.exercises[0].id
 const records=db.prepare('SELECT * FROM set_log WHERE session_exercise_id=?').all(historicalSe)
 const oldProgress=db.prepare('SELECT * FROM exercise_progression WHERE exercise_id=?').get(old)
 const alternatives=await request(app).get(`/api/v1/template-exercises/${f.exercise.id}/alternatives`)
 assert.equal(alternatives.status,200)
 assert.ok(alternatives.body.alternatives.find(ex=>ex.id===next)?.has_history)
 const result=await request(app).post(`/api/v1/template-exercises/${f.exercise.id}/replace`).send({exercise_id:next,expected_exercise_id:old})
 assert.equal(result.status,200)
 assert.equal(result.body.exercise_id,next)
 for(const key of ['target_sets','target_reps_min','target_reps_max','rest_seconds','order_index'])assert.equal(result.body[key],f.exercise[key])
 assert.equal(db.prepare('SELECT exercise_id FROM session_exercise WHERE id=?').get(plannedSe).exercise_id,next)
 const historic=db.prepare('SELECT * FROM session_exercise WHERE id=?').get(historicalSe)
 assert.equal(historic.exercise_id,old);assert.equal(historic.template_exercise_id,null)
 assert.deepEqual(db.prepare('SELECT * FROM set_log WHERE session_exercise_id=?').all(historicalSe),records)
 assert.deepEqual(db.prepare('SELECT * FROM exercise_progression WHERE exercise_id=?').get(old),oldProgress)
 const restored=db.prepare('SELECT * FROM progression_state WHERE template_exercise_id=?').get(f.exercise.id)
 assert.equal(restored.current_weight_kg,12);assert.equal(restored.last_session_id,otherHistory)
 const back=await request(app).post(`/api/v1/template-exercises/${f.exercise.id}/replace`).send({exercise_id:old,expected_exercise_id:next})
 assert.equal(back.status,200)
 assert.equal(db.prepare('SELECT current_weight_kg FROM progression_state WHERE template_exercise_id=?').get(f.exercise.id).current_weight_kg,40)
})

test('replacement revalidates availability, duplicates and stale selections before mutating the program',async()=>{
 const f=await replacementFixture(),old=f.exercise.exercise_id,next='dumbbell_bench_press'
 const duplicate=await request(app).post(`/api/v1/templates/${f.template}/exercises`).send({exercise_id:next})
 const alternatives=await request(app).get(`/api/v1/template-exercises/${f.exercise.id}/alternatives`)
 assert.ok(!alternatives.body.alternatives.some(ex=>ex.id===next))
 assert.equal((await request(app).post(`/api/v1/template-exercises/${f.exercise.id}/replace`).send({exercise_id:next,expected_exercise_id:old})).status,400)
 await request(app).delete(`/api/v1/template-exercises/${duplicate.body.id}`)
 assert.equal((await request(app).post(`/api/v1/template-exercises/${f.exercise.id}/replace`).send({exercise_id:next,expected_exercise_id:'stale'})).status,409)
 const equipment=db.prepare("SELECT id,count FROM equipment_item WHERE category IN ('dumbbell_fixed','dumbbell_adjustable','dumbbell_loadable')").all()
 try {
  db.prepare("UPDATE equipment_item SET count=0 WHERE category IN ('dumbbell_fixed','dumbbell_adjustable','dumbbell_loadable')").run()
  assert.equal((await request(app).post(`/api/v1/template-exercises/${f.exercise.id}/replace`).send({exercise_id:next,expected_exercise_id:old})).status,400)
 } finally {for(const item of equipment)db.prepare('UPDATE equipment_item SET count=? WHERE id=?').run(item.count,item.id)}
 assert.equal((await request(app).post(`/api/v1/template-exercises/${f.exercise.id}/replace`).send({exercise_id:'bodyweight_squat',expected_exercise_id:old})).status,400)
 assert.equal((await request(app).post(`/api/v1/template-exercises/${f.exercise.id}/replace`).send({exercise_id:next,expected_exercise_id:old,target_sets:99})).status,400)
 assert.equal(db.prepare('SELECT exercise_id FROM template_exercise WHERE id=?').get(f.exercise.id).exercise_id,old)
 assert.equal((await request(app).get('/api/v1/template-exercises/99999999/alternatives')).status,404)
})

test('ongoing workouts and already logged plans cannot be altered via exercise replacement',async()=>{
 const f=await replacementFixture(),old=f.exercise.exercise_id,next='dumbbell_bench_press'
 const started=Number(db.prepare("INSERT INTO session(name,program_id,workout_template_id,scheduled_date,status) VALUES ('Ongoing',?,?,'2026-10-14','in_progress')").run(f.program,f.template).lastInsertRowid)
 assert.equal((await request(app).get(`/api/v1/template-exercises/${f.exercise.id}/alternatives`)).status,409)
 assert.equal((await request(app).post(`/api/v1/template-exercises/${f.exercise.id}/replace`).send({exercise_id:next,expected_exercise_id:old})).status,409)
 db.prepare("UPDATE session SET status='skipped' WHERE id=?").run(started)
 const today=(await import('../../src/services/date.js')).localIsoDate()
 const planned=await request(app).post(`/api/v1/sessions/from-template/${f.template}`).send({scheduled_date:today})
 await request(app).post(`/api/v1/session-exercises/${planned.body.exercises[0].id}/sets`).send({set_number:1,weight_kg:40,reps:10,is_completed:true})
 const blocked=await request(app).post(`/api/v1/template-exercises/${f.exercise.id}/replace`).send({exercise_id:next,expected_exercise_id:old})
 assert.equal(blocked.status,409);assert.equal(blocked.body.error,'PLANNED_SESSION_HAS_LOGS')
 assert.equal(db.prepare('SELECT exercise_id FROM template_exercise WHERE id=?').get(f.exercise.id).exercise_id,old)
})
