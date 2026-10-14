import { localIsoDate } from './date.js'

export function programWeeklyProgress(db, program, today = localIsoDate()) {
  const start = new Date(today + 'T12:00:00Z')
  start.setUTCDate(start.getUTCDate() - (start.getUTCDay() + 6) % 7)
  const week_start = start.toISOString().slice(0, 10)
  start.setUTCDate(start.getUTCDate() + 6)
  const week_end = start.toISOString().slice(0, 10)
  const { completed_sessions } = db.prepare(`SELECT COUNT(*) AS completed_sessions FROM session
    WHERE program_id=? AND status='completed' AND scheduled_date BETWEEN ? AND ?`)
    .get(program.id, week_start, week_end)
  return { week_start, week_end, completed_sessions, target_sessions:program.days_per_week,
    is_complete:program.days_per_week > 0 && completed_sessions >= program.days_per_week }
}
