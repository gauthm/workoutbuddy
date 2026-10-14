import { refreshPersonalRecords } from './personalRecords.js'
import { rebuildExerciseProgression } from './exerciseProgression.js'

export function resetSession(db,id,expectedStatus) {
  if (!['in_progress','completed'].includes(expectedStatus)) {
    const error=new Error('INVALID_SESSION_RESET_STATUS');error.status=400;throw error
  }
  return db.transaction(()=>{
    const session=db.prepare('SELECT * FROM session WHERE id=?').get(id)
    if (!session) {const error=new Error('SESSION_NOT_FOUND');error.status=404;throw error}
    if (session.status!==expectedStatus) {const error=new Error('SESSION_STATUS_CHANGED');error.status=409;throw error}
    const exercises=db.prepare('SELECT * FROM session_exercise WHERE session_id=? ORDER BY order_index,id').all(id)
    db.prepare(`DELETE FROM personal_record WHERE set_log_id IN
      (SELECT sl.id FROM set_log sl JOIN session_exercise se ON se.id=sl.session_exercise_id WHERE se.session_id=?)`).run(id)
    // Fresh exercise IDs ensure a delayed set request from an old tab cannot undo the reset.
    db.prepare('DELETE FROM session_exercise WHERE session_id=?').run(id)
    const insert=db.prepare(`INSERT INTO session_exercise(session_id,exercise_id,template_exercise_id,order_index,notes)
      VALUES (?,?,?,?,?)`)
    for (const ex of exercises)insert.run(id,ex.exercise_id,ex.template_exercise_id,ex.order_index,ex.notes)
    db.prepare(`UPDATE session SET status='planned',scheduled_date=COALESCE(original_scheduled_date,scheduled_date),
      original_scheduled_date=NULL,started_at=NULL,completed_at=NULL,duration_seconds=NULL,
      total_volume_kg=NULL,rpe_avg=NULL,is_deload=0,updated_at=datetime('now') WHERE id=?`).run(id)
    for(const exerciseId of new Set(exercises.map(ex=>ex.exercise_id))){
      refreshPersonalRecords(db,exerciseId)
      if(session.status==='completed' && !session.is_deload)rebuildExerciseProgression(db,exerciseId)
    }
    if(session.program_id && session.completed_at)db.prepare(`DELETE FROM program_weekly_review
      WHERE program_id=? AND week_start<=date(?) AND date(week_start,'+7 days')>date(?)`)
      .run(session.program_id,session.completed_at,session.completed_at)
    return db.prepare('SELECT * FROM session WHERE id=?').get(id)
  }).immediate()
}
