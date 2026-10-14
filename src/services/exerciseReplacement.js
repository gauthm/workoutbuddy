import { getPainfulMuscles, isExerciseRestricted } from './exerciseConstraints.js'
import { calculateAchievableLoads } from './equipmentCalc.js'
import { initialExerciseState, initializeTemplateProgression } from './exerciseProgression.js'
import { localIsoDate } from './date.js'

function fail(code, status=400) { const error=new Error(code);error.status=status;throw error }
function parse(row) {
  return {...row,primary_muscles:JSON.parse(row.primary_muscles || '[]'),equipment_required:JSON.parse(row.equipment_required || '[]')}
}

export function findSimilarExercises(base, exercises, inventory, usedIds=[], painfulMuscles=[]) {
  const used=new Set(usedIds),loads=new Map()
  const candidates=exercises.filter(ex => {
    if(ex.id===base.id || used.has(ex.id) || ex.is_excluded || isExerciseRestricted(ex,painfulMuscles) || ex.category!==base.category || ex.movement_pattern!==base.movement_pattern) return false
    if(!base.primary_muscles.length || !ex.primary_muscles.includes(base.primary_muscles[0])) return false
    if(base.mechanic && ex.mechanic && base.mechanic!==ex.mechanic) return false
    if(base.force && ex.force && base.force!==ex.force) return false
    const key=JSON.stringify([ex.equipment_required,!!ex.is_unilateral])
    if(!loads.has(key)) {
      loads.set(key,calculateAchievableLoads(inventory,ex).loads_kg.length>0)
    }
    return loads.get(key)
  })
  const score=ex => base.primary_muscles.filter(m=>ex.primary_muscles.includes(m)).length*4 +
    (base.mechanic===ex.mechanic ? 2 : 0) + (base.is_unilateral===ex.is_unilateral ? 1 : 0)
  return candidates.sort((a,b)=>score(b)-score(a) || a.name_fr.localeCompare(b.name_fr,'fr') || a.id.localeCompare(b.id))
}

function context(db,id) {
  const template=db.prepare(`SELECT te.*,wt.program_id FROM template_exercise te
    JOIN workout_template wt ON wt.id=te.workout_template_id WHERE te.id=?`).get(id)
  if(!template)fail('TEMPLATE_EXERCISE_NOT_FOUND',404)
  if(db.prepare("SELECT id FROM session WHERE workout_template_id=? AND status='in_progress' LIMIT 1").get(template.workout_template_id))fail('WORKOUT_IN_PROGRESS',409)
  const exercises=db.prepare('SELECT * FROM exercise ORDER BY id').all().map(parse)
  const base=exercises.find(ex=>ex.id===template.exercise_id)
  const inventory=db.prepare('SELECT * FROM equipment_item WHERE count>0').all()
  const used=db.prepare('SELECT exercise_id FROM template_exercise WHERE workout_template_id=?').all(template.workout_template_id).map(row=>row.exercise_id)
  return {template,inventory,candidates:findSimilarExercises(base,exercises,inventory,used,getPainfulMuscles(db))}
}

export function getExerciseAlternatives(db,id) {
  const {template,candidates}=context(db,id)
  const history=new Set(db.prepare(`SELECT exercise_id FROM exercise_progression WHERE last_session_id IS NOT NULL
    UNION SELECT se.exercise_id FROM session_exercise se JOIN session s ON s.id=se.session_id
    JOIN set_log sl ON sl.session_exercise_id=se.id WHERE s.status='completed' AND sl.is_completed=1 AND sl.is_warmup=0`).all().map(row=>row.exercise_id))
  return {template_exercise_id:template.id,exercise_id:template.exercise_id,alternatives:candidates.map(ex=>({
    id:ex.id,name_fr:ex.name_fr,name_en:ex.name_en,primary_muscles:ex.primary_muscles,
    equipment_required:ex.equipment_required,movement_pattern:ex.movement_pattern,has_history:history.has(ex.id)
  }))}
}

export function replaceTemplateExercise(db,id,exerciseId,expectedId) {
  return db.transaction(()=>{
    const {template,inventory,candidates}=context(db,id)
    if(template.exercise_id!==expectedId)fail('EXERCISE_CHANGED',409)
    const replacement=candidates.find(ex=>ex.id===exerciseId)
    if(!replacement)fail('INVALID_REPLACEMENT')
    const today=localIsoDate()
    const logged=db.prepare(`SELECT sl.id FROM set_log sl JOIN session_exercise se ON se.id=sl.session_exercise_id
      JOIN session s ON s.id=se.session_id WHERE se.template_exercise_id=? AND s.status='planned' AND s.scheduled_date>=? LIMIT 1`).get(id,today)
    if(logged)fail('PLANNED_SESSION_HAS_LOGS',409)
    // History keeps its actual exercise and sets, independent of the updated template.
    db.prepare(`UPDATE session_exercise SET template_exercise_id=NULL WHERE template_exercise_id=?
      AND session_id IN (SELECT id FROM session WHERE status!='planned' OR scheduled_date<?)`).run(id,today)
    const updatedPlans=db.prepare(`UPDATE session_exercise SET exercise_id=? WHERE template_exercise_id=?
      AND session_id IN (SELECT id FROM session WHERE status='planned' AND scheduled_date>=?)`).run(exerciseId,id,today).changes
    db.prepare('UPDATE template_exercise SET exercise_id=?,rotation_group=NULL,current_rotation_index=0 WHERE id=?').run(exerciseId,id)
    const updated=db.prepare('SELECT * FROM template_exercise WHERE id=?').get(id)
    if(db.prepare('SELECT id FROM progression_state WHERE template_exercise_id=?').get(id)){
      const state=initialExerciseState(db,exerciseId,updated,inventory)
      db.prepare(`UPDATE progression_state SET current_weight_kg=?,current_target_reps=?,consecutive_failures=?,
        last_session_id=?,last_updated=datetime('now') WHERE template_exercise_id=?`).run(state.weight,state.reps,state.failures,state.last_session_id,id)
    }else initializeTemplateProgression(db,id)
    return {...updated,name_fr:replacement.name_fr,name_en:replacement.name_en,updated_planned_exercises:updatedPlans}
  })()
}
