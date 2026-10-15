import { estimate1RM } from './rmCalculator.js'
import { refreshHistoricalProgression } from './trainingHistory.js'

export function refreshPersonalRecords(db, exerciseId) {
  const setting = db.prepare("SELECT value FROM settings WHERE key = 'rm_formula'").get()
  const formula = setting ? JSON.parse(setting.value) : 'epley'
  const sets = db.prepare(`
    SELECT sl.*, s.scheduled_date FROM set_log sl
    JOIN session_exercise se ON se.id = sl.session_exercise_id
    JOIN session s ON s.id = se.session_id
    WHERE se.exercise_id = ? AND sl.is_completed = 1 AND sl.is_warmup = 0
      AND sl.reps > 0 AND sl.weight_kg > 0
    ORDER BY sl.weight_kg DESC, sl.id ASC
  `).all(exerciseId)
  const best = new Map()
  for (const set of sets) if (!best.has(set.reps)) best.set(set.reps, set)
  db.prepare('DELETE FROM personal_record WHERE exercise_id = ?').run(exerciseId)
  const insert = db.prepare(`INSERT INTO personal_record
    (exercise_id, reps, weight_kg, estimated_1rm_kg, achieved_date, set_log_id)
    VALUES (?, ?, ?, ?, ?, ?)`)
  for (const set of best.values()) insert.run(exerciseId, set.reps, set.weight_kg,
    estimate1RM(set.weight_kg, set.reps, formula), set.scheduled_date, set.id)
}

export function markRecord(db, set, previousWeight = 0) {
  const se = db.prepare('SELECT exercise_id, session_id FROM session_exercise WHERE id = ?').get(set.session_exercise_id)
  refreshPersonalRecords(db, se.exercise_id)
  refreshSessionMetrics(db, se.session_id)
  refreshHistoricalProgression(db,se.session_id,[se.exercise_id])
  if (set.is_completed && !set.is_warmup && set.weight_kg > previousWeight && set.reps > 0) {
    const record = db.prepare('SELECT * FROM personal_record WHERE set_log_id = ?').get(set.id)
    if (record) { set._new_pr = true; set._estimated_1rm = record.estimated_1rm_kg }
  }
  return set
}

export function refreshSessionMetrics(db, sessionId) {
  db.prepare(`UPDATE session SET
    total_volume_kg = (SELECT COALESCE(SUM(sl.weight_kg * sl.reps), 0) FROM set_log sl
      JOIN session_exercise se ON se.id = sl.session_exercise_id
      WHERE se.session_id = ? AND sl.is_completed = 1 AND sl.is_warmup = 0),
    rpe_avg = (SELECT AVG(sl.rpe) FROM set_log sl JOIN session_exercise se ON se.id = sl.session_exercise_id
      WHERE se.session_id = ? AND sl.is_completed = 1 AND sl.is_warmup = 0),
    updated_at = datetime('now')
    WHERE id = ? AND status = 'completed'`).run(sessionId, sessionId, sessionId)
}
