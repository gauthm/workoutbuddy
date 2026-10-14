import { getPainfulMuscles } from './exerciseConstraints.js'
import { initializeTemplateProgression } from './exerciseProgression.js'
import { generateProgram, validateProgramParams } from './programGenerator.js'

export function previewProgram(db, params) {
  const errors = validateProgramParams(params)
  if (errors.length) { const error = new Error('INVALID_PROGRAM_PARAMETERS'); error.details = errors; throw error }
  const exercises = db.prepare('SELECT * FROM exercise ORDER BY id').all().map(ex => ({ ...ex,
    primary_muscles: JSON.parse(ex.primary_muscles), secondary_muscles: JSON.parse(ex.secondary_muscles),
    equipment_required: JSON.parse(ex.equipment_required) }))
  const draft = generateProgram(params, exercises, db.prepare('SELECT * FROM equipment_item').all(),getPainfulMuscles(db))
  const names = new Map(exercises.map(ex => [ex.id,ex]))
  draft.templates.forEach(t => t.exercises.forEach(ex => {
    ex.name_fr = names.get(ex.exercise_id).name_fr
    ex.name_en = names.get(ex.exercise_id).name_en
  }))
  return draft
}

export function createPlannedProgram(db, params) {
  const draft = previewProgram(db, params)
  return db.transaction(() => {
    const result = db.prepare(`INSERT INTO program (name,goal,level,days_per_week,duration_weeks,
      progression_model,use_exercise_rotation,deload_auto_enabled) VALUES (?,?,?,?,?,?,0,1)`)
      .run(draft.name,draft.goal,draft.level,draft.days_per_week,draft.duration_weeks,draft.progression_model)
    const id = Number(result.lastInsertRowid)
    draft.templates.forEach((template,ti) => {
      const tid = db.prepare('INSERT INTO workout_template (program_id,name,order_index,day_of_week) VALUES (?,?,?,?)').run(id,template.name,ti,template.day_of_week).lastInsertRowid
      template.exercises.forEach((ex,ei) => {
        const teid = db.prepare(`INSERT INTO template_exercise (workout_template_id,exercise_id,order_index,
          target_sets,target_reps_min,target_reps_max,rest_seconds,progression_model,rir_target)
          VALUES (?,?,?,?,?,?,?,'inherit',?)`).run(tid,ex.exercise_id,ei,ex.target_sets,ex.target_reps_min,ex.target_reps_max,ex.rest_seconds,ex.rir_target).lastInsertRowid
        initializeTemplateProgression(db,teid)
      })
    })
    db.prepare('INSERT INTO program_plan (program_id,parameters,warnings) VALUES (?,?,?)').run(id,JSON.stringify(params),JSON.stringify(draft.warnings))
    return { id, ...draft }
  })()
}
