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
const {generateProgram}=await import('../../src/services/programGenerator.js')
const {localIsoDate}=await import('../../src/services/date.js')
const api=request(app),today=localIsoDate()
const params={goal:'hypertrophy',level:'beginner',days_per_week:2,session_duration_min:60,duration_weeks:8,priority_muscles:[],language:'fr'}
const home=[{category:'dumbbell_loadable',name:'Handles',count:2,weight_kg:2},{category:'dumbbell_plate',name:'Plates',count:8,weight_kg:2.5},{category:'bench_adjustable',name:'Bench',count:1}]
beforeEach(async()=>{await api.post('/api/v1/reset-all')})
async function preview(items=home) {
 assert.equal((await api.put('/api/v1/equipment/inventory').send({items})).status,200)
 const res=await api.post('/api/v1/programs/preview').send(params)
 assert.equal(res.status,200,res.text);return res.body
}
test('home equipment supplies flat press A, incline press B and weighted leg work, with some bodyweight retained',async()=>{
 const draft=await preview(),[a,b]=draft.templates
 assert.equal(a.exercises[0].exercise_id,'dumbbell_bench_press')
 assert.equal(b.exercises[0].exercise_id,'incline_dumbbell_press')
 assert.ok(a.exercises.some(ex=>['dumbbell_squat','dumbbell_lunges','dumbbell_rear_lunge'].includes(ex.exercise_id)))
 assert.ok(b.exercises.some(ex=>['dumbbell_squat','dumbbell_lunges','dumbbell_rear_lunge'].includes(ex.exercise_id)))
 assert.ok(draft.templates.flatMap(t=>t.exercises).some(ex=>['crunches','bent_knee_hip_raise','butt_lift_bridge'].includes(ex.exercise_id)))
 for(const template of draft.templates)assert.ok(template.estimated_duration_min<=60)
 const raw=db.prepare('SELECT * FROM exercise').all().map(ex=>({...ex,primary_muscles:JSON.parse(ex.primary_muscles),secondary_muscles:JSON.parse(ex.secondary_muscles),equipment_required:JSON.parse(ex.equipment_required)}))
 assert.deepEqual(generateProgram(params,raw,home),generateProgram(params,[...raw].reverse(),home))
})
test('flat-only bench does not allow incline work, and absent equipment keeps bodyweight fallbacks',async()=>{
 const flat=await preview(home.map(item=>item.category==='bench_adjustable'?{...item,category:'bench'}:item))
 assert.equal(flat.templates.flatMap(t=>t.exercises).some(ex=>ex.exercise_id==='incline_dumbbell_press'),false)
 const none=await preview([])
 for(const ex of none.templates.flatMap(t=>t.exercises))assert.deepEqual(JSON.parse(db.prepare('SELECT equipment_required FROM exercise WHERE id=?').get(ex.exercise_id).equipment_required),[])
})
test('excluding a preferred equipment exercise keeps the replacement compatible',async()=>{
 // Use the normal versioned endpoint; retain explicit status assertions.
 const excluded=await api.put('/api/v1/exercises/incline_dumbbell_press/toggle-exclusion').send({is_excluded:true})
 assert.equal(excluded.status,200)
 const draft=await preview()
 assert.equal(draft.templates.flatMap(t=>t.exercises).some(ex=>ex.exercise_id==='incline_dumbbell_press'),false)
})
test('calendar includes completed discovery sessions outside the active program but excludes inactive plans',async()=>{
 const a=(await api.post('/api/v1/programs/generate').send(params)).body.id
 const b=(await api.post('/api/v1/programs/generate').send(params)).body.id
 await api.post(`/api/v1/programs/${b}/activate`)
 const insert=db.prepare('INSERT INTO session(name,scheduled_date,program_id,status) VALUES (?,?,?,?)')
 const orphan=Number(insert.run('Séance découverte',today,null,'completed').lastInsertRowid)
 const oldDone=Number(insert.run('Previous completion',today,a,'completed').lastInsertRowid)
 const oldPlan=Number(insert.run('Inactive plan',today,a,'planned').lastInsertRowid)
 const response=await api.get(`/api/v1/sessions?calendar=1&from=${today}&to=${today}`)
 assert.equal(response.status,200)
 assert.ok(response.body.sessions.some(s=>s.id===orphan&&s.status==='completed'))
 assert.ok(response.body.sessions.some(s=>s.id===oldDone))
 assert.equal(response.body.sessions.some(s=>s.id===oldPlan),false)
 await api.delete(`/api/v1/programs/${b}`)
 const noProgram=(await api.get('/api/v1/sessions?calendar=1')).body.sessions
 assert.ok(noProgram.some(s=>s.id===orphan))
 assert.equal(noProgram.some(s=>s.status==='planned'),false)
})
