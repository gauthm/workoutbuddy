import { test } from 'node:test'
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
const {programDates}=await import('../../src/services/programLifecycle.js')
const {scheduleWeeks}=await import('../../src/services/sessionScheduler.js')
const {findSimilarExercises}=await import('../../src/services/exerciseReplacement.js')
const {isExerciseRestricted}=await import('../../src/services/exerciseConstraints.js')
const {calculateAchievableLoads}=await import('../../src/services/equipmentCalc.js')
const params={goal:'general_fitness',level:'beginner',days_per_week:2,session_duration_min:45,duration_weeks:8,priority_muscles:[],language:'fr'}
const api=request(app)
function clean() {
 db.prepare('DELETE FROM session').run();db.prepare('DELETE FROM program').run()
 db.prepare('DELETE FROM exercise_progression').run();db.prepare('DELETE FROM equipment_item').run()
 db.prepare("UPDATE settings SET value='[]' WHERE key='painful_muscles'").run()
}
async function program() {
 const made=await api.post('/api/v1/programs/generate').send(params);assert.equal(made.status,201)
 return (await api.get(`/api/v1/programs/${made.body.id}`)).body
}
function daysAgo(n) {const d=new Date(localIsoDate()+'T12:00:00Z');d.setUTCDate(d.getUTCDate()-n);return d.toISOString().slice(0,10)}

test('finite program stops scheduling and starting at its boundary, extension resumes without resetting activation',async()=>{
 clean();const p=await program()
 assert.equal(p.started_on,null)
 await api.post(`/api/v1/programs/${p.id}/activate`)
 const first=db.prepare('SELECT started_on FROM program WHERE id=?').get(p.id).started_on
 assert.equal(first,localIsoDate())
 await api.post(`/api/v1/programs/${p.id}/activate`)
 assert.equal(db.prepare('SELECT started_on FROM program WHERE id=?').get(p.id).started_on,first)
 db.prepare('UPDATE program SET started_on=?,duration_weeks=1 WHERE id=?').run(daysAgo(6),p.id)
 scheduleWeeks(db,p.id)
 assert.equal(programDates(db.prepare('SELECT * FROM program WHERE id=?').get(p.id)).is_finished,false)
 assert.ok(db.prepare("SELECT * FROM session WHERE program_id=? AND status='planned'").all(p.id).every(s=>s.scheduled_date<=localIsoDate()))
 const planned=db.prepare("INSERT INTO session(program_id,workout_template_id,name,scheduled_date,status) VALUES (?,?,?,?,'planned')").run(p.id,p.templates[0].id,'Old',localIsoDate()).lastInsertRowid
 const completed=db.prepare("INSERT INTO session(program_id,name,scheduled_date,status) VALUES (?,?,?,'completed')").run(p.id,'History',daysAgo(7)).lastInsertRowid
 db.prepare('UPDATE program SET started_on=? WHERE id=?').run(daysAgo(7),p.id)
 assert.equal((await api.post(`/api/v1/sessions/${planned}/start`)).body.error,'PROGRAM_FINISHED')
 assert.equal((await api.post(`/api/v1/sessions/from-template/${p.templates[0].id}`).send({scheduled_date:localIsoDate()})).body.error,'PROGRAM_FINISHED')
 assert.equal((await api.get(`/api/v1/programs/${p.id}/next-session`)).body.error,'PROGRAM_FINISHED')
 assert.equal(db.prepare("SELECT COUNT(*) n FROM session WHERE program_id=? AND status='planned'").get(p.id).n,0)
 assert.ok(db.prepare('SELECT id FROM session WHERE id=?').get(completed))
 assert.equal((await api.get(`/api/v1/programs/${p.id}`)).body.is_finished,true)
 const extended=await api.put(`/api/v1/programs/${p.id}`).send({duration_weeks:3});assert.equal(extended.status,200);assert.equal(extended.body.is_finished,false)
 assert.ok(db.prepare("SELECT COUNT(*) n FROM session WHERE program_id=? AND status='planned'").get(p.id).n>0)
 const unlimited=await api.put(`/api/v1/programs/${p.id}`).send({duration_weeks:null});assert.equal(unlimited.body.ends_on,null)
 const data=(await api.get('/api/v1/export')).body
 assert.equal((await api.post('/api/v1/import').send(data)).status,200)
 assert.equal(db.prepare('SELECT started_on FROM program WHERE id=?').get(p.id).started_on,daysAgo(7))
})

test('deleting performances recalculates learned progression and all live templates, including after program removal',async()=>{
 clean();const p=await program();const template=p.templates[0],te=template.exercises[0]
 db.prepare("UPDATE template_exercise SET target_sets=1,target_reps_min=8,target_reps_max=12,progression_model='double_progression' WHERE id=?").run(te.id)
 async function perform(weight,reps,templateId=template.id) {
  const made=await api.post(`/api/v1/sessions/from-template/${templateId}`).send({scheduled_date:localIsoDate()});assert.equal(made.status,201)
  assert.equal((await api.post(`/api/v1/sessions/${made.body.id}/start`)).status,200)
  const se=db.prepare('SELECT id FROM session_exercise WHERE session_id=? AND exercise_id=?').get(made.body.id,te.exercise_id)
  assert.equal((await api.post(`/api/v1/session-exercises/${se.id}/sets`).send({set_number:1,weight_kg:weight,reps,is_completed:true})).status,201)
  assert.equal((await api.post(`/api/v1/sessions/${made.body.id}/complete`)).status,200)
  return made.body.id
 }
 const one=await perform(10,9),two=await perform(20,11)
 assert.equal(db.prepare('SELECT current_weight_kg FROM exercise_progression WHERE exercise_id=?').get(te.exercise_id).current_weight_kg,20)
 const exported=(await api.get('/api/v1/export')).body
 assert.equal(exported.data.exercise_progression_events.length,2)
 assert.equal((await api.post('/api/v1/import').send(exported)).status,200)
 assert.equal((await api.delete(`/api/v1/sessions/${two}`)).status,204)
 let learned=db.prepare('SELECT * FROM exercise_progression WHERE exercise_id=?').get(te.exercise_id)
 assert.equal(learned.current_weight_kg,10);assert.equal(learned.current_target_reps,10);assert.equal(learned.last_session_id,one)
 assert.equal(db.prepare('SELECT last_session_id FROM progression_state WHERE template_exercise_id=?').get(te.id).last_session_id,one)
 const three=await perform(30,10)
 // Exercise history remains even after its original program and templates are removed.
 assert.equal((await api.delete(`/api/v1/programs/${p.id}`)).status,204)
 const p2=await program();const live=db.prepare('SELECT id FROM template_exercise WHERE exercise_id=?').all(te.exercise_id)
 assert.ok(live.length)
 assert.equal((await api.delete(`/api/v1/sessions/${one}`)).status,204)
 learned=db.prepare('SELECT * FROM exercise_progression WHERE exercise_id=?').get(te.exercise_id)
 assert.equal(learned.last_session_id,three);assert.equal(learned.current_weight_kg,30)
 assert.equal((await api.delete(`/api/v1/sessions/${three}`)).status,204)
 assert.equal(db.prepare('SELECT * FROM exercise_progression WHERE exercise_id=?').get(te.exercise_id),undefined)
 for (const slot of live) {const state=db.prepare('SELECT * FROM progression_state WHERE template_exercise_id=?').get(slot.id);assert.equal(state.last_session_id,null);assert.equal(state.current_weight_kg,0);assert.equal(state.consecutive_failures,0)}
 assert.equal(db.prepare('SELECT COUNT(*) n FROM exercise_progression_event').get().n,0)
})

test('pain restrictions persist, validate, filter primary and secondary muscles in generation and replacements',async()=>{
 clean()
 assert.equal((await api.put('/api/v1/settings').send({painful_muscles:['shoulders','shoulders']})).status,400)
 assert.equal((await api.put('/api/v1/settings').send({painful_muscles:['unknown']})).status,400)
 assert.equal((await api.put('/api/v1/settings').send({painful_muscles:'shoulders'})).status,400)
 const saved=await api.put('/api/v1/settings').send({painful_muscles:['shoulders']});assert.equal(saved.status,200)
 assert.deepEqual((await api.get('/api/v1/settings')).body.painful_muscles,['shoulders'])
 const preview=await api.post('/api/v1/programs/preview').send({...params,painful_muscles:[]});assert.equal(preview.status,200)
 for (const tpl of preview.body.templates) for (const slot of tpl.exercises) {
  const ex=db.prepare('SELECT * FROM exercise WHERE id=?').get(slot.exercise_id)
  assert.equal(isExerciseRestricted(ex,['shoulders']),false)
 }
 const base={id:'base',name_fr:'Base',category:'strength',primary_muscles:['chest'],movement_pattern:'push_horizontal',equipment_required:[]}
 const alternatives=[{...base,id:'primary',primary_muscles:['chest','shoulders']},{...base,id:'secondary',secondary_muscles:'["shoulders"]'},{...base,id:'safe',secondary_muscles:[]}]
 assert.deepEqual(findSimilarExercises(base,alternatives,[],[],['shoulders']).map(ex=>ex.id),['safe'])
 const data=(await api.get('/api/v1/export')).body;assert.deepEqual(data.data.settings.painful_muscles,['shoulders'])
 assert.equal((await api.post('/api/v1/import').send(data)).status,200)
 assert.deepEqual((await api.get('/api/v1/settings')).body.painful_muscles,['shoulders'])
 assert.equal((await api.post('/api/v1/reset-stats')).status,200)
 assert.deepEqual((await api.get('/api/v1/settings')).body.painful_muscles,['shoulders'])
 assert.equal((await api.post('/api/v1/reset-all')).status,200)
 assert.deepEqual((await api.get('/api/v1/settings')).body.painful_muscles,[])
})

test('one adjustable dumbbell permits unilateral work only, consistently across load calculation',()=>{
 const item={category:'dumbbell_adjustable',count:1,weight_min_kg:2,weight_max_kg:10,weight_step_kg:2}
 const exercise={equipment_required:['dumbbell_fixed'],is_unilateral:0}
 assert.deepEqual(calculateAchievableLoads([item],exercise).loads_kg,[])
 assert.deepEqual(calculateAchievableLoads([item],{...exercise,is_unilateral:1}).loads_kg,[2,4,6,8,10])
 assert.deepEqual(calculateAchievableLoads([{...item,count:2}],exercise).loads_kg,[2,4,6,8,10])
 assert.deepEqual(calculateAchievableLoads([{...item,count:0}],{...exercise,is_unilateral:1}).loads_kg,[])
})
