import {test} from 'node:test'
import assert from 'node:assert/strict'
import request from '../helpers/in-process-request.js'
process.env.DB_PATH=':memory:'
const {getDb}=await import('../../src/db/database.js'),db=getDb()
const {migrate}=await import('../../src/db/migrate.js')
const {seedExercises}=await import('../../src/seed/seed.js')
migrate(db);seedExercises(db)
const {app}=await import('../../server.js')
const params={goal:'general_fitness',level:'beginner',days_per_week:2,session_duration_min:30,duration_weeks:8,priority_muscles:[],weight_kg:75,height_cm:175,language:'fr'}

test('deleting creation weight then exporting/importing preserves program settings and initial targets',async()=>{
 db.prepare("INSERT INTO equipment_item(category,name,count,weight_min_kg,weight_max_kg,weight_step_kg) VALUES ('dumbbell_adjustable','Pair',2,1,40,1)").run()
 db.prepare("INSERT INTO equipment_item(category,name,count) VALUES ('bench_adjustable','Bench',1)").run()
 const made=await request(app).post('/api/v1/programs/generate').send(params)
 assert.equal(made.status,201)
 const detail=(await request(app).get(`/api/v1/programs/${made.body.id}`)).body
 const tpl=detail.templates[0],exercise=tpl.exercises.find(e=>e.exercise_id==='dumbbell_bench_press')
 assert.ok(exercise)
 const session=await request(app).post(`/api/v1/sessions/from-template/${tpl.id}`).send({scheduled_date:'2026-10-15'})
 assert.equal(session.status,201)
 const path=`/api/v1/sessions/${session.body.id}/target/${exercise.id}`
 const before=await request(app).get(path)
 assert.equal(before.status,200)
 const weights=(await request(app).get('/api/v1/bodyweight')).body.entries
 assert.equal(weights.length,1);assert.equal(weights[0].weight_kg,75)
 assert.equal((await request(app).delete(`/api/v1/bodyweight/${weights[0].id}`)).status,204)
 db.prepare('UPDATE user_profile SET weight_kg=150').run()
 assert.deepEqual((await request(app).get(path)).body,before.body)
 const backup=await request(app).get('/api/v1/export')
 assert.equal(backup.body.data.body_weights.length,0)
 assert.equal(backup.body.data.program_plans[0].parameters.weight_kg,75)
 assert.equal((await request(app).post('/api/v1/import').send(backup.body)).status,200)
 assert.equal((await request(app).get('/api/v1/bodyweight')).body.entries.length,0)
 assert.deepEqual((await request(app).get(path)).body,before.body)
})
