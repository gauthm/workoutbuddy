import { computeNextState } from './progressionEngine.js'
import { calculateAchievableLoads } from './equipmentCalc.js'

export function saveExerciseProgression(db, exerciseId, state, template, sessionId) {
  db.prepare(`INSERT INTO exercise_progression
    (exercise_id,current_weight_kg,current_target_reps,consecutive_failures,target_reps_min,target_reps_max,last_session_id)
    VALUES (?,?,?,?,?,?,?) ON CONFLICT(exercise_id) DO UPDATE SET
    current_weight_kg=excluded.current_weight_kg,current_target_reps=excluded.current_target_reps,
    consecutive_failures=excluded.consecutive_failures,target_reps_min=excluded.target_reps_min,
    target_reps_max=excluded.target_reps_max,last_session_id=excluded.last_session_id,last_updated=datetime('now')`)
    .run(exerciseId,state.current_weight_kg,state.current_target_reps ?? template.target_reps_min,
      state.consecutive_failures || 0,template.target_reps_min,template.target_reps_max,sessionId)
}

export function initialExerciseState(db, exerciseId, template, equipment) {
  let learned = db.prepare('SELECT * FROM exercise_progression WHERE exercise_id=?').get(exerciseId)
  if (!learned) {
    // Historical sessions may have lost their old template when a program was deleted.
    const last = db.prepare(`SELECT sl.*,s.id AS session_id FROM set_log sl
      JOIN session_exercise se ON se.id=sl.session_exercise_id JOIN session s ON s.id=se.session_id
      WHERE se.exercise_id=? AND s.status='completed' AND s.is_deload=0
        AND sl.is_warmup=0 AND sl.is_completed=1 AND sl.reps>0
      ORDER BY s.completed_at DESC,s.id DESC,sl.set_number ASC LIMIT 1`).get(exerciseId)
    if (!last) return { weight:0,reps:template.target_reps_min,failures:0,last_session_id:null }
    learned={current_weight_kg:last.weight_kg,current_target_reps:last.reps,last_session_id:last.session_id}
  }
  let weight=learned.current_weight_kg, reps=learned.current_target_reps || template.target_reps_min
  const sameRange=learned.target_reps_min === template.target_reps_min && learned.target_reps_max === template.target_reps_max
  if (!sameRange) {
    const newReps=template.target_reps_min
    if (weight > 0) weight=weight*(1+reps/30)/(1+newReps/30)
    reps=newReps
  } else reps=Math.max(template.target_reps_min,Math.min(template.target_reps_max,reps))
  const exercise=db.prepare('SELECT * FROM exercise WHERE id=?').get(exerciseId)
  const loads=calculateAchievableLoads(equipment,{...exercise,equipment_required:JSON.parse(exercise.equipment_required)})
  if (loads.loads_kg.some(w=>w>0) && !loads.resistance_is_approximate) {
    const allowed=loads.loads_kg.filter(w=>w<=weight+0.001)
    weight=allowed.length ? allowed.at(-1) : loads.loads_kg[0]
  }
  return {weight:Math.round(weight*100)/100,reps,failures:sameRange ? learned.consecutive_failures || 0 : 0,last_session_id:learned.last_session_id}
}

export function initializeTemplateProgression(db, templateId) {
  const template=db.prepare('SELECT * FROM template_exercise WHERE id=?').get(templateId)
  const state=initialExerciseState(db,template.exercise_id,template,db.prepare('SELECT * FROM equipment_item').all())
  db.prepare(`INSERT INTO progression_state(template_exercise_id,current_weight_kg,current_target_reps,consecutive_failures,last_session_id)
    VALUES (?,?,?,?,?)`).run(templateId,state.weight,state.reps,state.failures,state.last_session_id)
}

export function synchronizeTemplateProgression(db, templateId) {
  const template=db.prepare('SELECT * FROM template_exercise WHERE id=?').get(templateId)
  const state=db.prepare('SELECT * FROM progression_state WHERE template_exercise_id=?').get(templateId)
  if (!template || !state) return
  const learned=db.prepare('SELECT * FROM exercise_progression WHERE exercise_id=?').get(template.exercise_id)
  if (!learned || learned.last_session_id === state.last_session_id) return
  const next=initialExerciseState(db,template.exercise_id,template,db.prepare('SELECT * FROM equipment_item').all())
  db.prepare(`UPDATE progression_state SET current_weight_kg=?,current_target_reps=?,consecutive_failures=?,
    last_session_id=?,last_updated=datetime('now') WHERE template_exercise_id=?`)
    .run(next.weight,next.reps,next.failures,next.last_session_id,templateId)
}

// Retain the calculation context even when a program or its templates are removed.
export function saveProgressionEvent(db,sessionExerciseId,context) {
  db.prepare(`INSERT INTO exercise_progression_event(session_exercise_id,context) VALUES (?,?)
    ON CONFLICT(session_exercise_id) DO UPDATE SET context=excluded.context`).run(sessionExerciseId,JSON.stringify(context))
}

export function rebuildExerciseProgression(db,exerciseId) {
  const previous=db.prepare('SELECT * FROM exercise_progression WHERE exercise_id=?').get(exerciseId)
  const sessions=db.prepare(`SELECT se.id,s.id AS session_id,event.context FROM session_exercise se
    JOIN session s ON s.id=se.session_id LEFT JOIN exercise_progression_event event ON event.session_exercise_id=se.id
    WHERE se.exercise_id=? AND s.status='completed' AND s.is_deload=0
    ORDER BY COALESCE(s.completed_at,s.scheduled_date),s.id,se.order_index,se.id`).all(exerciseId)
  db.prepare('DELETE FROM exercise_progression WHERE exercise_id=?').run(exerciseId)
  let learned=null, lastTemplate=null
  for (const session of sessions) {
    const sets=db.prepare(`SELECT * FROM set_log WHERE session_exercise_id=? AND is_warmup=0
      AND is_completed=1 ORDER BY set_number,id`).all(session.id)
    if (!sets.length) continue
    const context=session.context ? JSON.parse(session.context) : null
    const template=context?.template || {target_reps_min:previous?.target_reps_min || Math.min(...sets.map(s=>s.reps)),
      target_reps_max:previous?.target_reps_max || Math.max(...sets.map(s=>s.reps))}
    const sameRange=lastTemplate?.target_reps_min===template.target_reps_min && lastTemplate?.target_reps_max===template.target_reps_max
    const performance={current_weight_kg:Math.min(...sets.map(s=>s.weight_kg)),
      current_target_reps:Math.max(template.target_reps_min,Math.min(template.target_reps_max,Math.min(...sets.map(s=>s.reps)))),
      consecutive_failures:sameRange ? learned?.consecutive_failures || 0 : 0}
    // Older sessions lack calculation context: retain their actual performance conservatively.
    learned=context ? computeNextState(performance,sets,template,context.program,context.loads,context.settings)
      : {...performance,consecutive_failures:0}
    saveExerciseProgression(db,exerciseId,learned,template,session.session_id)
    lastTemplate=template
  }
  const equipment=db.prepare('SELECT * FROM equipment_item').all()
  for (const template of db.prepare('SELECT * FROM template_exercise WHERE exercise_id=?').all(exerciseId)) {
    const next=initialExerciseState(db,exerciseId,template,equipment)
    db.prepare(`UPDATE progression_state SET current_weight_kg=?,current_target_reps=?,consecutive_failures=?,
      last_session_id=?,last_updated=datetime('now') WHERE template_exercise_id=?`)
      .run(next.weight,next.reps,next.failures,next.last_session_id,template.id)
  }
}
