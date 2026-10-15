import { rebuildExerciseProgression } from './exerciseProgression.js'

// A cached review must not keep describing evidence which was edited or removed.
export function invalidateSessionReview(db, session) {
  if (!session?.program_id || !session.completed_at) return
  db.prepare(`DELETE FROM program_weekly_review
    WHERE program_id=? AND week_start<=date(?,'localtime')
      AND date(week_start,'+7 days')>date(?,'localtime')`)
    .run(session.program_id,session.completed_at,session.completed_at)
}

export function refreshHistoricalProgression(db, sessionId, exerciseIds) {
  const session=db.prepare('SELECT * FROM session WHERE id=?').get(sessionId)
  if (session?.status !== 'completed') return
  if (!session.is_deload) for (const id of new Set(exerciseIds)) rebuildExerciseProgression(db,id)
  invalidateSessionReview(db,session)
}
