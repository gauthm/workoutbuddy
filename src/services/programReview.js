import { shouldDeload } from './deloadEngine.js'

// Review the last closed calendar week, once. Never replace exercises or progression state.
export function reviewProgramWeek(db, programId, now = new Date()) {
  const plan = db.prepare('SELECT program_id FROM program_plan WHERE program_id=?').get(programId)
  if (!plan) return null
  const program = db.prepare('SELECT * FROM program WHERE id=?').get(programId)
  const date = new Date(now)
  date.setUTCHours(0,0,0,0)
  date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7)
  const end = date.toISOString().slice(0,10)
  date.setUTCDate(date.getUTCDate() - 7)
  const start = date.toISOString().slice(0,10)
  const existing = db.prepare('SELECT * FROM program_weekly_review WHERE program_id=? AND week_start=?').get(programId,start)
  if (existing) return { ...existing, evidence:JSON.parse(existing.evidence) }
  const first = db.prepare("SELECT MIN(date(completed_at)) AS date FROM session WHERE program_id=? AND status='completed'").get(programId)
  if (!first?.date || first.date >= end) return null
  const sessions = db.prepare(`SELECT s.id, AVG(sl.rpe) AS effort, COUNT(sl.id) AS work_sets
    FROM session s JOIN session_exercise se ON se.session_id=s.id
    JOIN set_log sl ON sl.session_exercise_id=se.id
    WHERE s.program_id=? AND s.status='completed' AND date(s.completed_at)>=? AND date(s.completed_at)<?
      AND sl.is_completed=1 AND sl.is_warmup=0 AND sl.reps>0
    GROUP BY s.id`).all(programId,start,end)
  const settings = Object.fromEntries(db.prepare('SELECT key,value FROM settings').all().map(r => [r.key,JSON.parse(r.value)]))
  const evidence = { completed_sessions:sessions.length, high_effort_sessions:sessions.filter(s => s.effort >= 9.5).length,
    reason:'normal_progression', exercises_retained:true }
  let decision = 'maintain'
  if (program.is_in_deload) { decision='recovery'; evidence.reason='already_in_deload' }
  else if (sessions.length < 2) { decision='insufficient_data'; evidence.reason='not_enough_workouts' }
  else {
    const deload = shouldDeload(program,settings,db)
    if (evidence.high_effort_sessions >= 2 && evidence.high_effort_sessions >= sessions.length / 2 || deload.should) {
      decision='deload'; evidence.reason=deload.should ? deload.reason : 'repeated_high_effort'
    }
  }
  return db.transaction(() => {
    if (decision === 'deload') db.prepare("UPDATE program SET is_in_deload=1,last_deload_date=?,updated_at=datetime('now') WHERE id=?").run(now.toISOString().slice(0,10),programId)
    db.prepare('INSERT INTO program_weekly_review (program_id,week_start,decision,evidence) VALUES (?,?,?,?)').run(programId,start,decision,JSON.stringify(evidence))
    return { program_id:programId,week_start:start,decision,evidence }
  })()
}

// A lighter week lasts seven days; it never permanently lowers normal targets.
export function expireProgramDeload(db, programId, now = new Date()) {
  const program = db.prepare('SELECT p.* FROM program p JOIN program_plan pp ON pp.program_id=p.id WHERE p.id=?').get(programId)
  if (program?.is_in_deload && program.last_deload_date && now.getTime() - Date.parse(program.last_deload_date + 'T00:00:00Z') >= 7 * 86400000) {
    db.prepare("UPDATE program SET is_in_deload=0,updated_at=datetime('now') WHERE id=?").run(programId)
  }
}
