import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import request from '../helpers/in-process-request.js'
import { createBackup } from '../../src/db/backup.js'
import { calculateAchievableLoads } from '../../src/services/equipmentCalc.js'
import { estimate1RM } from '../../src/services/rmCalculator.js'
import { scheduleWeeks } from '../../src/services/sessionScheduler.js'

process.env.DB_PATH = ':memory:'
const { getDb, getDbPath } = await import('../../src/db/database.js')
const { migrate } = await import('../../src/db/migrate.js')
const db = getDb()
migrate(db)
const { app } = await import('../../server.js')
db.prepare("INSERT INTO exercise (id,name_fr,name_en,category,movement_pattern,primary_muscles,is_custom) VALUES ('audit_ex','Audit','Audit','strength','core','[]',1)").run()
const today = new Date().toISOString().slice(0,10)
beforeEach(() => {
  db.transaction(() => {
    for (const table of ['personal_record','set_log','session_exercise','session','progression_state','template_exercise','workout_template','program']) db.prepare(`DELETE FROM ${table}`).run()
    db.prepare("UPDATE exercise SET is_excluded=0, exclusion_reason=NULL WHERE id='audit_ex'").run()
    db.prepare("UPDATE user_profile SET display_name=NULL, secondary_goals='[]' WHERE id=1").run()
    db.prepare("UPDATE settings SET value='\"epley\"' WHERE key='rm_formula'").run()
    db.prepare("UPDATE settings SET value='\"dark\"' WHERE key='theme'").run()
  })()
})
function session(status = 'in_progress') {
  const id = db.prepare("INSERT INTO session (name,scheduled_date,status,started_at) VALUES ('Audit',?,?,datetime('now'))").run(today,status).lastInsertRowid
  const se = db.prepare("INSERT INTO session_exercise (session_id,exercise_id) VALUES (?,'audit_ex')").run(id).lastInsertRowid
  return {id,se}
}
async function set(se,weight,reps=8) {
  const res = await request(app).post(`/api/v1/session-exercises/${se}/sets`).send({set_number:1,weight_kg:weight,reps,is_completed:true})
  assert.equal(res.status,201)
  return res.body
}

test('la base de régression utilise réellement :memory:',()=>assert.equal(getDbPath(),':memory:'))

test('un import incomplet ne supprime aucune donnée',async()=>{
  const count=db.prepare('SELECT COUNT(*) AS n FROM exercise').get().n
  const result=await request(app).post('/api/v1/import').send({version:1,app:'workoutbuddy',data:{}})
  assert.equal(result.status,400)
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM exercise').get().n,count)
})

test('export/import conserve profil, exclusions et clé API locale',async()=>{
  db.prepare("UPDATE user_profile SET display_name='Audit', secondary_goals='[\"strength\"]' WHERE id=1").run()
  db.prepare("UPDATE exercise SET is_excluded=1,exclusion_reason='Audit' WHERE id='audit_ex'").run()
  db.prepare("INSERT OR REPLACE INTO settings(key,value) VALUES ('ai_api_key','\"secret-test\"')").run()
  const exp=await request(app).get('/api/v1/export')
  assert.equal(exp.body.data.user_profile.display_name,'Audit')
  assert.equal(exp.body.data.settings.ai_api_key,undefined)
  const imp=await request(app).post('/api/v1/import').send(exp.body)
  assert.equal(imp.status,200)
  assert.equal(db.prepare('SELECT display_name FROM user_profile WHERE id=1').get().display_name,'Audit')
  assert.equal(db.prepare("SELECT is_excluded FROM exercise WHERE id='audit_ex'").get().is_excluded,1)
  assert.equal(JSON.parse(db.prepare("SELECT value FROM settings WHERE key='ai_api_key'").get().value),'secret-test')
})

test('une sauvegarde SQLite contient les dernières écritures, même sans checkpoint',()=>{
  db.prepare("UPDATE user_profile SET display_name='Audit' WHERE id=1").run()
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'wb-backup-audit-'))
  try {
    const file=createBackup(db,path.join(dir,'source.db'),{force:true})
    db.prepare('ATTACH DATABASE ? AS snapshot').run(file)
    try {assert.equal(db.prepare('SELECT display_name FROM snapshot.user_profile WHERE id=1').get().display_name,'Audit')}
    finally {db.exec('DETACH DATABASE snapshot')}
  } finally {fs.rmSync(dir,{recursive:true,force:true})}
})

test('validation booléenne d’une série existante et formule Lombardi',async()=>{
  db.prepare("UPDATE settings SET value='\"lombardi\"' WHERE key='rm_formula'").run()
  const {se}=session()
  const created=await request(app).post(`/api/v1/session-exercises/${se}/sets`).send({set_number:1,weight_kg:50,reps:8})
  const updated=await request(app).put(`/api/v1/sets/${created.body.id}`).send({is_completed:true})
  assert.equal(updated.status,200)
  assert.equal(updated.body.is_completed,1)
  assert.equal(updated.body._estimated_1rm,estimate1RM(50,8,'lombardi'))
})

test('modifier ou supprimer un record restaure la meilleure série restante',async()=>{
  const {se}=session()
  const first=await set(se,55)
  const best=await set(se,65)
  assert.equal((await request(app).put(`/api/v1/sets/${best.id}`).send({weight_kg:45})).status,200)
  assert.equal(db.prepare("SELECT weight_kg FROM personal_record WHERE exercise_id='audit_ex' AND reps=8").get().weight_kg,55)
  assert.equal((await request(app).delete(`/api/v1/sets/${first.id}`)).status,204)
  assert.equal(db.prepare("SELECT weight_kg FROM personal_record WHERE exercise_id='audit_ex' AND reps=8").get().weight_kg,45)
})

test('supprimer une séance avec un record respecte les clés étrangères',async()=>{
  const {id,se}=session('completed')
  await set(se,80)
  assert.equal((await request(app).delete(`/api/v1/sessions/${id}`)).status,204)
  assert.equal(db.prepare('SELECT COUNT(*) n FROM session WHERE id=?').get(id).n,0)
  assert.equal(db.prepare('PRAGMA foreign_key_check').all().length,0)
})

test('un second démarrage conserve le début ; une séance planifiée ne peut pas être terminée',async()=>{
  const {id}=session()
  const before=db.prepare('SELECT started_at FROM session WHERE id=?').get(id).started_at
  assert.equal((await request(app).post(`/api/v1/sessions/${id}/start`)).status,200)
  assert.equal(db.prepare('SELECT started_at FROM session WHERE id=?').get(id).started_at,before)
  const planned=session('planned')
  assert.equal((await request(app).post(`/api/v1/sessions/${planned.id}/complete`)).status,409)
})

test('la progression journalière n’invente pas une série en combinant les MAX',async()=>{
  db.prepare("UPDATE settings SET value='\"epley\"' WHERE key='rm_formula'").run()
  const {se}=session('completed')
  await set(se,100,3)
  await set(se,40,20)
  const res=await request(app).get('/api/v1/stats/exercises/audit_ex/progress')
  assert.equal(res.status,200)
  const row=res.body.data.find(x=>x.date===today)
  assert.equal(row.weight_kg,100)
  assert.equal(row.reps,3)
  assert.equal(row.estimated_1rm_kg,110)
})

test('modifier une série historique recalcule aussi le volume de sa séance',async()=>{
  const {id,se}=session('completed')
  const created=await set(se,50,8)
  assert.equal(db.prepare('SELECT total_volume_kg FROM session WHERE id=?').get(id).total_volume_kg,400)
  assert.equal((await request(app).put(`/api/v1/sets/${created.id}`).send({weight_kg:40})).status,200)
  assert.equal(db.prepare('SELECT total_volume_kg FROM session WHERE id=?').get(id).total_volume_kg,320)
})

test('les entrées de poids et paramètres invalides sont refusés',async()=>{
  for (const weight of ['abc',null,-5]) {
    assert.equal((await request(app).post('/api/v1/bodyweight').send({date:today,weight_kg:weight})).status,400)
  }
  assert.equal((await request(app).post('/api/v1/bodyweight').send({date:'2026-02-30',weight_kg:75})).status,400)
  assert.equal((await request(app).put('/api/v1/settings').send({network_port:'3000abc'})).status,400)
})

test('un pas d’haltère invalide ne bloque pas le moteur de charges',()=>{
  const exercise={equipment_required:['dumbbell_adjustable']}
  for(const step of [0,-1,NaN,0.001]) {
    const result=calculateAchievableLoads([{category:'dumbbell_adjustable',weight_min_kg:2,weight_max_kg:30,weight_step_kg:step}],exercise)
    assert.deepEqual(result.loads_kg,[])
  }
})

test('les actions IA en lot sont refusées sans modification',async()=>{
  const before=db.prepare("SELECT value FROM settings WHERE key='theme'").get().value
  const result=await request(app).post('/api/v1/ai/apply-actions').send({actions:[
    {action:'update_settings',explanation:'Audit',data:{theme:'light'}},
    {action:'update_settings',explanation:'Audit',data:{network_port:-1}},
  ]})
  assert.equal(result.status,403)
  assert.equal(db.prepare("SELECT value FROM settings WHERE key='theme'").get().value,before)
})

test('les rendez-vous sautés ou terminés ne sont pas recréés par le scheduler',()=>{
  const p=db.prepare("INSERT INTO program(name,goal,level,days_per_week,is_active) VALUES ('Audit','strength','beginner',3,1)").run().lastInsertRowid
  db.prepare("INSERT INTO workout_template(program_id,name) VALUES (?,'Audit')").run(p)
  assert.ok(scheduleWeeks(db,p)>0)
  db.prepare("UPDATE session SET status='skipped' WHERE program_id=?").run(p)
  assert.equal(scheduleWeeks(db,p),0)
})

test('supprimer un programme conserve l’historique des séances',async()=>{
  const p=db.prepare("INSERT INTO program(name,goal,level,days_per_week,is_active) VALUES ('Audit','strength','beginner',3,1)").run().lastInsertRowid
  db.prepare("INSERT INTO workout_template(program_id,name) VALUES (?,'Audit')").run(p)
  scheduleWeeks(db,p)
  db.prepare("UPDATE session SET status='skipped' WHERE program_id=?").run(p)
  const count=db.prepare('SELECT COUNT(*) n FROM session WHERE program_id=?').get(p).n
  assert.equal((await request(app).delete(`/api/v1/programs/${p}`)).status,204)
  assert.equal(db.prepare("SELECT COUNT(*) n FROM session WHERE program_id IS NULL AND status='skipped'").get().n,count)
  assert.equal(db.prepare('PRAGMA foreign_key_check').all().length,0)
})

test('un export supérieur à 100 ko peut être réimporté',async()=>{
  const exp=await request(app).get('/api/v1/export')
  exp.body.data.settings.ai_model='x'.repeat(150000)
  const result=await request(app).post('/api/v1/import').send(exp.body)
  assert.equal(result.status,200)
})

test('annuler puis revalider une série conserve ses valeurs et recalcule records et volume',async()=>{
  const {id,se}=session('completed')
  const created=await set(se,50,8)
  const undone=await request(app).put(`/api/v1/sets/${created.id}`).send({is_completed:false})
  assert.equal(undone.status,200)
  assert.equal(undone.body.is_completed,0)
  assert.equal(undone.body.weight_kg,50)
  assert.equal(undone.body.reps,8)
  assert.equal(db.prepare('SELECT total_volume_kg FROM session WHERE id=?').get(id).total_volume_kg,0)
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM personal_record WHERE set_log_id=?').get(created.id).n,0)
  const restored=await request(app).put(`/api/v1/sets/${created.id}`).send({is_completed:true})
  assert.equal(restored.status,200)
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM set_log WHERE session_exercise_id=?').get(se).n,1)
  assert.equal(db.prepare('SELECT total_volume_kg FROM session WHERE id=?').get(id).total_volume_kg,400)
})
