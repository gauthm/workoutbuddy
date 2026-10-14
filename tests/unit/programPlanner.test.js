import { test } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { migrate } from '../../src/db/migrate.js'
import { seedExercises } from '../../src/seed/seed.js'
import { previewProgram, createPlannedProgram } from '../../src/services/programPlanner.js'
import { generateProgram, estimateSessionMinutes } from '../../src/services/programGenerator.js'
import { isEquipmentAvailable } from '../../src/services/rotationEngine.js'
import { reviewProgramWeek, expireProgramDeload } from '../../src/services/programReview.js'

function database() {
  const db = new Database(':memory:'); db.pragma('foreign_keys=ON'); migrate(db); seedExercises(db)
  return db
}
const params = {goal:'general_fitness',level:'beginner',days_per_week:3,session_duration_min:45,duration_weeks:8,priority_muscles:[],language:'fr'}

test('creation deterministic, duration bounded, stable exercises for every supported training choice', () => {
  const db = database()
  const exercises = db.prepare('SELECT * FROM exercise').all().map(ex => ({ ...ex,primary_muscles:JSON.parse(ex.primary_muscles),equipment_required:JSON.parse(ex.equipment_required) }))
  const equipment = [{category:'dumbbell_fixed',count:2,weight_kg:10},{category:'bench',count:1},{category:'pullup_bar',count:1}]
  for (const goal of ['strength','hypertrophy','endurance','weight_loss','general_fitness'])
    for (const level of ['beginner','intermediate','advanced'])
      for (const days_per_week of [2,3,4,5,6])
        for (const session_duration_min of [20,30,45,60,90]) {
          const input={...params,goal,level,days_per_week,session_duration_min}
          const draft=generateProgram(input,exercises,equipment)
          assert.deepEqual(draft,generateProgram(input,[...exercises].reverse(),equipment))
          assert.equal(draft.templates.length,days_per_week)
          assert.equal(draft.use_exercise_rotation,0)
          for (const template of draft.templates) {
            assert.ok(template.exercises.length > 0)
            assert.ok(estimateSessionMinutes(template.exercises) <= session_duration_min)
            const ids=template.exercises.map(ex => ex.exercise_id)
            assert.equal(new Set(ids).size,ids.length)
            for (const id of ids) {
              const exercise=exercises.find(e=>e.id===id)
              assert.equal(exercise.category,'strength')
              assert.ok(isEquipmentAvailable(exercise.equipment_required,equipment))
            }
          }
        }
  db.close()
})

test('preview never writes, creation persists all templates and keeps private profile fields', () => {
  const db=database()
  db.prepare("UPDATE user_profile SET injury_notes='Existing limitations', medical_notes='Private',display_name='Alex',age=31").run()
  const preview=previewProgram(db,params)
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM program').get().n,0)
  const result=createPlannedProgram(db,params)
  assert.equal(result.name,preview.name)
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM workout_template WHERE program_id=?').get(result.id).n,3)
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM progression_state').get().n,preview.templates.flatMap(t=>t.exercises).length)
  assert.equal(db.prepare('SELECT is_active FROM program WHERE id=?').get(result.id).is_active,0)
  const profile=db.prepare('SELECT * FROM user_profile').get()
  assert.equal(profile.injury_notes,'Existing limitations'); assert.equal(profile.medical_notes,'Private'); assert.equal(profile.age,31)
  assert.equal(JSON.parse(db.prepare('SELECT parameters FROM program_plan WHERE program_id=?').get(result.id).parameters).session_duration_min,45)
  db.close()
})

test('excluded exercises, single dumbbell quantities and unavailable priorities are respected', () => {
  const db=database()
  db.prepare('UPDATE exercise SET is_excluded=1 WHERE equipment_required=\'[]\'').run()
  db.prepare("INSERT INTO equipment_item(category,name,count,weight_kg) VALUES ('dumbbell_fixed','One dumbbell',1,10)").run()
  const draft=previewProgram(db,{...params,priority_muscles:['chest']})
  const selected=draft.templates.flatMap(t=>t.exercises)
  for (const item of selected) {
    const ex=db.prepare('SELECT * FROM exercise WHERE id=?').get(item.exercise_id)
    assert.equal(ex.is_excluded,0)
    assert.equal(ex.is_unilateral,1)
  }
  assert.ok(draft.warnings.length > 0)
  db.close()
})

test('invalid questionnaire inputs and empty candidates cannot leave a partial program', () => {
  const db=database()
  for (const input of [{days_per_week:7},{duration_weeks:0},{session_duration_min:0},{goal:'unknown'},{priority_muscles:['chest','back','quads']}])
    assert.throws(()=>createPlannedProgram(db,{...params,...input}),/INVALID_PROGRAM_PARAMETERS/)
  db.prepare('UPDATE exercise SET is_excluded=1').run()
  assert.throws(()=>createPlannedProgram(db,params),/NO_AVAILABLE_EXERCISES/)
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM program').get().n,0)
  db.close()
})

function logWeek(db,id,efforts) {
  const template=db.prepare('SELECT id FROM workout_template WHERE program_id=? LIMIT 1').get(id)
  const ex=db.prepare('SELECT * FROM template_exercise WHERE workout_template_id=? LIMIT 1').get(template.id)
  efforts.forEach((rpe,i)=>{
    const session=db.prepare("INSERT INTO session(program_id,workout_template_id,name,scheduled_date,status,completed_at) VALUES (?,?,'Test',?,'completed',?)")
      .run(id,template.id,`2026-10-${String(5+i).padStart(2,'0')}`,`2026-10-${String(5+i).padStart(2,'0')} 12:00:00`).lastInsertRowid
    const se=db.prepare('INSERT INTO session_exercise(session_id,exercise_id,template_exercise_id,order_index) VALUES (?,?,?,0)').run(session,ex.exercise_id,ex.id).lastInsertRowid
    db.prepare('INSERT INTO set_log(session_exercise_id,set_number,weight_kg,reps,rpe,is_completed,is_warmup) VALUES (?,1,10,10,?,1,0)').run(se,rpe)
  })
}

test('weekly review is idempotent, preserves exercises and progression, and ends recovery after seven days', () => {
  const db=database(), {id}=createPlannedProgram(db,params)
  logWeek(db,id,[10,10,8])
  const templates=db.prepare('SELECT * FROM template_exercise').all(),states=db.prepare('SELECT * FROM progression_state').all()
  const now=new Date('2026-10-14T12:00:00Z')
  const review=reviewProgramWeek(db,id,now)
  assert.equal(review.decision,'deload')
  reviewProgramWeek(db,id,now)
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM program_weekly_review').get().n,1)
  assert.deepEqual(db.prepare('SELECT * FROM template_exercise').all(),templates)
  assert.deepEqual(db.prepare('SELECT * FROM progression_state').all(),states)
  expireProgramDeload(db,id,new Date('2026-10-20T12:00:00Z'))
  assert.equal(db.prepare('SELECT is_in_deload FROM program WHERE id=?').get(id).is_in_deload,1)
  expireProgramDeload(db,id,new Date('2026-10-21T12:00:00Z'))
  assert.equal(db.prepare('SELECT is_in_deload FROM program WHERE id=?').get(id).is_in_deload,0)
  db.close()
})

test('one difficult workout or missing effort does not trigger a fatigue decision', () => {
  for (const [efforts,decision] of [[[10],'insufficient_data'],[[10,null],'maintain'],[[7,8],'maintain']]) {
    const db=database(), {id}=createPlannedProgram(db,params)
    logWeek(db,id,efforts)
    assert.equal(reviewProgramWeek(db,id,new Date('2026-10-14T12:00:00Z')).decision,decision)
    db.close()
  }
})

test('unlimited program duration stays null in preview, persisted program and stored parameters', () => {
  const db=database()
  try {
    const input={...params,duration_weeks:null}
    const preview=previewProgram(db,input)
    assert.equal(preview.duration_weeks,null)
    const created=createPlannedProgram(db,input)
    assert.equal(created.duration_weeks,null)
    assert.equal(db.prepare('SELECT duration_weeks FROM program WHERE id=?').get(created.id).duration_weeks,null)
    assert.equal(JSON.parse(db.prepare('SELECT parameters FROM program_plan WHERE program_id=?').get(created.id).parameters).duration_weeks,null)
    assert.deepEqual(preview.templates,previewProgram(db,params).templates)
  } finally { db.close() }
})
