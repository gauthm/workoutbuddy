import {test,beforeEach} from 'node:test'
import assert from 'node:assert/strict'
import request from '../helpers/in-process-request.js'
process.env.DB_PATH=':memory:'
process.env.TZ='Europe/Paris'
const {getDb}=await import('../../src/db/database.js'),db=getDb()
const {migrate}=await import('../../src/db/migrate.js')
const {seedExercises}=await import('../../src/seed/seed.js')
migrate(db);seedExercises(db)
const {app}=await import('../../server.js'),api=request(app)
const {reviewProgramWeek}=await import('../../src/services/programReview.js')
const params={goal:'general_fitness',level:'beginner',days_per_week:2,session_duration_min:30,duration_weeks:null,priority_muscles:[],language:'fr'}
async function call(method,path,data,status=200){const res=await api[method]('/api/v1'+path).send(data);assert.equal(res.status,status,`${method} ${path}: ${res.text}`);return res.body}
const post=(path,data,status)=>call('post',path,data,status)
const get=path=>call('get',path)
let program,tpl,slot
beforeEach(async()=>{
 await post('/reset-all')
 await post('/equipment',{category:'dumbbell_adjustable',name:'Pair',count:2,weight_min_kg:1,weight_max_kg:100,weight_step_kg:1},201)
 await post('/equipment',{category:'bench',name:'Bench',count:1},201)
 const made=await post('/programs/generate',params,201)
 program=await get(`/programs/${made.id}`);tpl=program.templates[0];slot=tpl.exercises[0]
 db.prepare('UPDATE template_exercise SET target_sets=1,target_reps_min=8,target_reps_max=12 WHERE id=?').run(slot.id)
})
async function start(){const s=await post(`/sessions/from-template/${tpl.id}`,{scheduled_date:'2026-10-15'},201);await post(`/sessions/${s.id}/start`);return {session:s,se:s.exercises[0]}}
async function train(weight){const run=await start();run.set=await post(`/session-exercises/${run.se.id}/sets`,{set_number:1,weight_kg:weight,reps:12,is_completed:true},201);await post(`/sessions/${run.session.id}/complete`);return run}
const learned=()=>db.prepare('SELECT * FROM exercise_progression WHERE exercise_id=?').get(slot.exercise_id)

test('répéter une série après réponse perdue ne crée pas de doublon, même avec deux requêtes',async()=>{
 const {se}=await start(),body={set_number:1,weight_kg:10,reps:12,is_completed:true}
 const result=await Promise.all([post(`/session-exercises/${se.id}/sets`,body,201),post(`/session-exercises/${se.id}/sets`,body,201)])
 assert.equal(result[0].id,result[1].id)
 assert.equal((await get(`/session-exercises/${se.id}/sets`)).sets.length,1)
 await post(`/session-exercises/${se.id}/sets`,{...body,weight_kg:20},409)
})

test('corriger ou supprimer une série historique recalcule aussi la progression apprise',async()=>{
 const one=await train(10),two=await train(20)
 assert.equal(learned().current_weight_kg,21)
 await call('put',`/sets/${two.set.id}`,{weight_kg:5})
 assert.equal(learned().current_weight_kg,6)
 await call('delete',`/sets/${two.set.id}`,undefined,204)
 assert.equal(learned().last_session_id,one.session.id)
 assert.equal(learned().current_weight_kg,11)
 assert.equal(db.prepare('SELECT last_session_id FROM progression_state WHERE template_exercise_id=?').get(slot.id).last_session_id,one.session.id)
})

test('une séance terminée refuse une nouvelle série arrivée en retard',async()=>{
 const run=await train(10),before=learned()
 await post(`/session-exercises/${run.se.id}/sets`,{set_number:2,weight_kg:99,reps:12,is_completed:true},409)
 assert.deepEqual(learned(),before)
})

test('suppression historique : invalider le bilan de la semaine concernée',async()=>{
 const run=await train(10)
 db.prepare("UPDATE session SET completed_at='2026-10-15 12:00:00' WHERE id=?").run(run.session.id)
 const review=reviewProgramWeek(db,program.id,new Date('2026-10-19T12:00:00Z'))
 assert.ok(review)
 await call('delete',`/sessions/${run.session.id}`,undefined,204)
 assert.equal(db.prepare('SELECT COUNT(*) n FROM program_weekly_review WHERE program_id=?').get(program.id).n,0)
})

test('le bilan change de semaine à minuit local, même lorsque la date UTC est encore dimanche',async()=>{
 const run=await train(10)
 db.prepare("UPDATE session SET completed_at='2026-10-15 12:00:00' WHERE id=?").run(run.session.id)
 const review=reviewProgramWeek(db,program.id,new Date('2026-10-18T22:30:00Z'))
 assert.ok(review)
 assert.equal(review.week_start,'2026-10-12')
})

test('dates impossibles ou champs de séance mal typés sont refusés sans écriture',async()=>{
 const before=db.prepare('SELECT COUNT(*) n FROM session').get().n
 for(const scheduled_date of ['2026-02-30','not-a-date',{},123])await post(`/sessions/from-template/${tpl.id}`,{scheduled_date},400)
 assert.equal(db.prepare('SELECT COUNT(*) n FROM session').get().n,before)
 const run=await start()
 await call('put',`/sessions/${run.session.id}`,{name:42},400)
})

test('douze semaines : 24 séances, reprise, export/import, suppression et recréation gardent des acquis cohérents',async()=>{
 // The API and all calculations are real. Only historical timestamps are fixtures:
 // SQLite's wall clock cannot be advanced without altering the host machine.
 const {invalidateSessionReview}=await import('../../src/services/trainingHistory.js')
 const {localIsoDate}=await import('../../src/services/date.js')
 const end=new Date();end.setHours(12,0,0,0);end.setDate(end.getDate()-((end.getDay()+6)%7)-84)
 db.prepare('UPDATE program SET deload_auto_enabled=0,started_on=? WHERE id=?').run(localIsoDate(end),program.id)
 const runs=[]
 for(let week=0;week<12;week++){
  for(let day=0;day<2;day++){
   tpl=program.templates[day];slot=tpl.exercises[0]
   db.prepare('UPDATE template_exercise SET target_sets=1,target_reps_min=8,target_reps_max=12 WHERE id=?').run(slot.id)
   const active=await start()
   if((week+day)%3===0){
    const resumed=await post(`/sessions/${active.session.id}/start`)
    assert.equal(resumed.started_at,(await get(`/sessions/${active.session.id}`)).started_at)
   }
   const weight=10+week*2+day
   await post(`/session-exercises/${active.se.id}/sets`,{set_number:1,weight_kg:weight,reps:12,rpe:7,is_completed:true},201)
   const completed=await post(`/sessions/${active.session.id}/complete`)
   await post(`/sessions/${active.session.id}/complete`,undefined,409)
   assert.equal(completed.total_volume_kg,weight*12)
   assert.equal(learned().current_weight_kg,weight+1)
   const date=new Date(end);date.setDate(date.getDate()+week*7+day*3)
   const dateIso=localIsoDate(date)
   db.prepare('UPDATE session SET scheduled_date=?,original_scheduled_date=?,completed_at=? WHERE id=?').run(dateIso,dateIso,dateIso+' 12:00:00',active.session.id)
   invalidateSessionReview(db,db.prepare('SELECT * FROM session WHERE id=?').get(active.session.id))
   runs.push({...active,weight,exerciseId:slot.exercise_id})
  }
  const now=new Date(end);now.setDate(now.getDate()+(week+1)*7)
  const review=reviewProgramWeek(db,program.id,now)
  assert.equal(review.evidence.completed_sessions,2)
  assert.equal(review.decision,'maintain')
  const storedBefore=db.prepare('SELECT * FROM program_weekly_review WHERE program_id=? ORDER BY id').all(program.id)
  const cached=reviewProgramWeek(db,program.id,now)
  assert.equal(cached.decision,review.decision)
  assert.deepEqual(cached.evidence,review.evidence)
  assert.deepEqual(db.prepare('SELECT * FROM program_weekly_review WHERE program_id=? ORDER BY id').all(program.id),storedBefore)
 }
 const backup=await get('/export')
 assert.equal(backup.data.sessions.filter(s=>s.status==='completed').length,24)
 assert.equal(backup.data.set_logs.length,24)
 await post('/import',backup)
 assert.deepEqual((await get('/export')).data,backup.data)
 const last=runs.at(-1)
 await call('delete',`/sessions/${last.session.id}`,undefined,204)
 const previous=runs.slice(0,-1).findLast(run=>run.exerciseId===last.exerciseId)
 assert.ok(previous)
 assert.equal(learned().current_weight_kg,previous.weight+1)
 assert.equal(learned().last_session_id,previous.session.id)
 assert.equal(db.prepare('PRAGMA foreign_key_check').all().length,0)
 const preserved=db.prepare('SELECT * FROM exercise_progression ORDER BY exercise_id').all()
 await call('delete',`/programs/${program.id}`,undefined,204)
 const again=await post('/programs/generate',params,201)
 assert.deepEqual(db.prepare('SELECT * FROM exercise_progression ORDER BY exercise_id').all(),preserved)
 assert.equal(db.prepare("SELECT COUNT(*) n FROM session WHERE status='completed'").get().n,23)
 assert.equal(db.prepare('SELECT COUNT(*) n FROM set_log').get().n,23)
 assert.ok((await get(`/programs/${again.id}`)).templates.length===2)
})

test('une erreur pendant le recalcul historique annule aussi la modification de série et des records',async()=>{
 const run=await train(10),before=(await get('/export')).data
 db.exec("CREATE TRIGGER fail_history_rebuild BEFORE INSERT ON exercise_progression BEGIN SELECT RAISE(ABORT,'TEST_HISTORY_REBUILD'); END")
 try{
  await call('put',`/sets/${run.set.id}`,{weight_kg:30},500)
  assert.deepEqual((await get('/export')).data,before)
 }finally{db.exec('DROP TRIGGER fail_history_rebuild')}
})

test('les imports incohérents échouent sans altérer les données existantes',async()=>{
 await train(10)
 const valid=await get('/export')
 const cases=[
  data=>{data.set_logs[0].weight_kg=-1},
  data=>{data.set_logs[0].reps=1.5},
  data=>{data.sessions[0].scheduled_date='2026-02-30'},
  data=>{data.programs.push({...data.programs[0],id:999,is_active:1});data.programs[0].is_active=1},
  data=>{data.sessions[0].status='in_progress';data.sessions.push({...data.sessions[0],id:999})},
  data=>{data.body_weights.push({id:1,date:'2026-02-30',weight_kg:75})},
 ]
 for(const change of cases){const invalid=structuredClone(valid);change(invalid.data);await post('/import',invalid,400);assert.deepEqual((await get('/export')).data,valid.data)}
})


test('doubles clics de démarrage et de fin : une seule séance active et un seul calcul de progression',async()=>{
 const planned=await post(`/sessions/from-template/${tpl.id}`,{scheduled_date:'2026-10-15'},201)
 const started=await Promise.all([post(`/sessions/${planned.id}/start`),post(`/sessions/${planned.id}/start`)])
 assert.equal(started[0].started_at,started[1].started_at)
 const another=await post(`/sessions/from-template/${tpl.id}`,{scheduled_date:'2026-10-16'},201)
 await post(`/sessions/${another.id}/start`,undefined,409)
 await post(`/session-exercises/${planned.exercises[0].id}/sets`,{set_number:1,weight_kg:10,reps:12,is_completed:true},201)
 const finished=await Promise.all([api.post(`/api/v1/sessions/${planned.id}/complete`),api.post(`/api/v1/sessions/${planned.id}/complete`)])
 assert.deepEqual(finished.map(r=>r.status).sort(),[200,409])
 assert.equal(learned().current_weight_kg,11)
 assert.equal(db.prepare('SELECT COUNT(*) n FROM exercise_progression_event').get().n,1)
})

test('annuler puis revalider une série historique, et supprimer son exercice, restaure les bons acquis',async()=>{
 const one=await train(10),two=await train(20)
 await call('put',`/sets/${two.set.id}`,{is_completed:false})
 assert.equal(learned().last_session_id,one.session.id)
 await call('put',`/sets/${two.set.id}`,{is_completed:true})
 assert.equal(learned().current_weight_kg,21)
 await call('delete',`/session-exercises/${two.se.id}`,undefined,204)
 assert.equal(learned().last_session_id,one.session.id)
 assert.equal(learned().current_weight_kg,11)
 assert.equal((await get(`/sessions/${two.session.id}`)).total_volume_kg,0)
})

test('fatigue répétée : semaine allégée sans effacer les acquis, puis sortie au septième jour local',async()=>{
 const {localIsoDate}=await import('../../src/services/date.js')
 const {expireProgramDeload}=await import('../../src/services/programReview.js')
 for(const date of ['2026-10-20','2026-10-23']){
  const run=await start()
  await post(`/session-exercises/${run.se.id}/sets`,{set_number:1,weight_kg:10,reps:12,rpe:10,is_completed:true},201)
  await post(`/sessions/${run.session.id}/complete`)
  db.prepare('UPDATE session SET completed_at=? WHERE id=?').run(date+' 12:00:00',run.session.id)
 }
 const before=learned()
 const now=new Date('2026-10-25T23:30:00Z') // Monday after the DST change in Paris.
 assert.equal(localIsoDate(now),'2026-10-26')
 const review=reviewProgramWeek(db,program.id,now)
 assert.equal(review.decision,'deload')
 assert.equal(review.evidence.high_effort_sessions,2)
 assert.equal(db.prepare('SELECT last_deload_date FROM program WHERE id=?').get(program.id).last_deload_date,'2026-10-26')
 // Starting uses the real host clock; keep the simulated lighter week active for this API call.
 db.prepare('UPDATE program SET last_deload_date=? WHERE id=?').run(localIsoDate(),program.id)
 const light=await start()
 assert.equal((await get(`/sessions/${light.session.id}`)).is_deload,1)
 await post(`/session-exercises/${light.se.id}/sets`,{set_number:1,weight_kg:5,reps:8,is_completed:true},201)
 await post(`/sessions/${light.session.id}/complete`)
 assert.deepEqual(learned(),before)
 db.prepare('UPDATE program SET last_deload_date=? WHERE id=?').run('2026-10-26',program.id)
 expireProgramDeload(db,program.id,new Date('2026-11-01T22:30:00Z'))
 assert.equal(db.prepare('SELECT is_in_deload FROM program WHERE id=?').get(program.id).is_in_deload,1)
 expireProgramDeload(db,program.id,new Date('2026-11-01T23:30:00Z'))
 assert.equal(db.prepare('SELECT is_in_deload FROM program WHERE id=?').get(program.id).is_in_deload,0)
 assert.deepEqual(learned(),before)
})
