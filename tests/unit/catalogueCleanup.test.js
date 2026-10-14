import { test } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { migrate } from '../../src/db/migrate.js'
import { seedExercises } from '../../src/seed/seed.js'
import { mergeCatalogueAliases } from '../../src/services/catalogueCleanup.js'

test('catalogue migration merges legacy curls while preserving history, latest progress, exclusions and replay context',()=>{
  const db=new Database(':memory:');db.pragma('foreign_keys=ON');migrate(db);seedExercises(db)
  db.exec(`INSERT INTO exercise(id,name_fr,name_en,category,movement_pattern,primary_muscles,is_custom,is_excluded,exclusion_reason)
    VALUES ('hammer_curl','Curl marteau','Hammer Curl','strength','pull_vertical','["biceps"]',1,1,'Exclude'),
      ('hammer_curl_2','Curl marteau','Hammer Curl','strength','pull_vertical','["biceps"]',1,0,NULL);
    INSERT INTO program(id,name,goal,level,days_per_week) VALUES (1,'Legacy','hypertrophy','beginner',2);
    INSERT INTO workout_template(id,program_id,name) VALUES (1,1,'A');
    INSERT INTO template_exercise(id,workout_template_id,exercise_id,rotation_group) VALUES (1,1,'hammer_curl','["hammer_curl_2","dumbbell_bicep_curl"]');
    INSERT INTO progression_state(template_exercise_id,current_weight_kg,current_target_reps) VALUES (1,8,10);
    INSERT INTO session(id,name,scheduled_date,status,completed_at) VALUES (1,'Historical','2026-10-01','completed','2026-10-01 12:00:00');
    INSERT INTO session_exercise(id,session_id,exercise_id,template_exercise_id) VALUES (1,1,'hammer_curl_2',1);
    INSERT INTO set_log(id,session_exercise_id,set_number,weight_kg,reps,is_completed) VALUES (1,1,1,8,10,1);
    INSERT INTO personal_record(exercise_id,reps,weight_kg,estimated_1rm_kg,achieved_date,set_log_id) VALUES ('hammer_curl_2',10,8,10.67,'2026-10-01',1);
    INSERT INTO exercise_progression(exercise_id,current_weight_kg,last_session_id,last_updated) VALUES
      ('hammer_curls',6,1,'2026-09-01'),('hammer_curl',8,1,'2026-10-01'),('hammer_curl_2',10,2,'2026-10-02');
    INSERT INTO equipment_advice(signal_type,exercise_id,muscle_group,signal_data) VALUES
      ('max_load_reached','hammer_curl','biceps','{}'),('max_load_reached','hammer_curls','biceps','{}');
    INSERT INTO exercise_progression_event(session_exercise_id,context) VALUES (1,'{"template":{"exercise_id":"hammer_curl_2"},"loads":[8,10]}');
    DELETE FROM schema_version WHERE version=16;`)
  migrate(db)
  assert.equal(db.prepare('SELECT COUNT(*) n FROM exercise WHERE is_custom=1').get().n,0)
  for(const table of ['template_exercise','session_exercise','personal_record','equipment_advice']) {
    assert.ok(db.prepare(`SELECT exercise_id FROM ${table}`).all().every(r=>r.exercise_id==='hammer_curls'),table)
  }
  assert.equal(db.prepare('SELECT weight_kg FROM set_log WHERE id=1').get().weight_kg,8)
  assert.equal(db.prepare('SELECT current_weight_kg FROM progression_state WHERE template_exercise_id=1').get().current_weight_kg,8)
  assert.equal(db.prepare("SELECT current_weight_kg FROM exercise_progression WHERE exercise_id='hammer_curls'").get().current_weight_kg,10)
  assert.equal(db.prepare('SELECT COUNT(*) n FROM exercise_progression').get().n,1)
  assert.equal(db.prepare("SELECT is_excluded FROM exercise WHERE id='hammer_curls'").get().is_excluded,1)
  const event=JSON.parse(db.prepare('SELECT context FROM exercise_progression_event').get().context)
  assert.equal(event.template.exercise_id,'hammer_curls');assert.deepEqual(event.loads,[8,10])
  assert.deepEqual(JSON.parse(db.prepare('SELECT rotation_group FROM template_exercise').get().rotation_group),['hammer_curls','dumbbell_bicep_curl'])
  assert.deepEqual(db.pragma('foreign_key_check'),[])
  assert.doesNotThrow(()=>mergeCatalogueAliases(db))
  db.close()
})
