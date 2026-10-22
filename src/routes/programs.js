import { message } from '../utils/messages.js'
import { programWeeklyProgress } from '../services/programWeeklyProgress.js'
import { programDates } from '../services/programLifecycle.js'
import express from 'express'
import { getDb } from '../db/database.js'
import { previewProgram, createPlannedProgram } from '../services/programPlanner.js'
import { scheduleWeeks } from '../services/sessionScheduler.js'
import { localIsoDate } from '../services/date.js'

const router = express.Router()
const db = getDb()

function parseProgram(row) {
  if (!row) return null
  return {
    ...row,
    ...programDates(row),
    weekly_progress: programWeeklyProgress(db,row),
    is_active:              row.is_active === 1,
    use_exercise_rotation:  row.use_exercise_rotation === 1,
    deload_auto_enabled:    row.deload_auto_enabled === 1,
    is_in_deload:           row.is_in_deload === 1,
  }
}

// No model call: the same validated inputs always produce the same draft.
for (const [path, create] of [['/preview', false], ['/generate', true]]) {
  router.post(path, (req, res) => {
    try {
      const result = create ? createPlannedProgram(db, req.body) : previewProgram(db, req.body)
      res.status(create ? 201 : 200).json(result)
    } catch (err) {
      if (['INVALID_PROGRAM_PARAMETERS', 'NO_AVAILABLE_EXERCISES'].includes(err.message)) {
        return res.status(400).json({ error:err.message, details:err.details || [] })
      }
      console.error('[program planner]',err.message)
      res.status(500).json({ error:'INTERNAL_ERROR' })
    }
  })
}

router.get('/', (req, res) => {
  try {
    let sql = 'SELECT * FROM program'
    const params = []
    if (req.query.active !== undefined) {
      sql += ' WHERE is_active = ?'
      params.push(parseInt(req.query.active))
    }
    sql += ' ORDER BY created_at DESC'
    const rows = db.prepare(sql).all(...params)
    res.json({ programs: rows.map(parseProgram) })
  } catch (err) {
    console.error('[GET /programs]', err.message)
    res.status(500).json({ error: 'INTERNAL_ERROR' })
  }
})

router.post('/:programId/templates', (req, res) => {
  try {
    const prog = db.prepare('SELECT id FROM program WHERE id = ?').get(req.params.programId)
    if (!prog) return res.status(404).json({ error: 'PROGRAM_NOT_FOUND' })
    const { name, day_of_week, order_index } = req.body
    if (typeof name !== 'string' || !name.trim()) return res.status(400).json({ error: 'MISSING_NAME' })
    const result = db.prepare(
      'INSERT INTO workout_template (program_id, name, day_of_week, order_index) VALUES (?,?,?,?)'
    ).run(parseInt(req.params.programId), name.trim(), day_of_week ?? null, order_index ?? 0)
    res.status(201).json(db.prepare('SELECT * FROM workout_template WHERE id = ?').get(result.lastInsertRowid))
  } catch (err) {
    console.error('[POST /programs/:id/templates]', err.message)
    res.status(500).json({ error: 'INTERNAL_ERROR' })
  }
})

router.get('/:id', (req, res) => {
  try {
    const program = db.prepare('SELECT * FROM program WHERE id = ?').get(req.params.id)
    if (!program) return res.status(404).json({ error: 'PROGRAM_NOT_FOUND' })

    const templates = db.prepare(
      'SELECT * FROM workout_template WHERE program_id = ? ORDER BY order_index ASC'
    ).all(program.id)

    for (const tpl of templates) {
      tpl.is_in_progress = !!db.prepare("SELECT id FROM session WHERE workout_template_id=? AND status='in_progress' LIMIT 1").get(tpl.id)
      tpl.exercises = db.prepare(
        `SELECT te.*, e.name_fr, e.name_en FROM template_exercise te
         JOIN exercise e ON e.id = te.exercise_id
         WHERE te.workout_template_id = ? ORDER BY te.order_index ASC`
      ).all(tpl.id)
    }

    const plan = db.prepare('SELECT * FROM program_plan WHERE program_id=?').get(program.id)
    const review = db.prepare('SELECT * FROM program_weekly_review WHERE program_id=? ORDER BY week_start DESC LIMIT 1').get(program.id)
    res.json({ ...parseProgram(program), templates,
      plan:plan ? { engine_version:plan.engine_version, parameters:JSON.parse(plan.parameters), warnings:JSON.parse(plan.warnings) } : null,
      weekly_review:review ? { ...review,evidence:JSON.parse(review.evidence) } : null })
  } catch (err) {
    console.error('[GET /programs/:id]', err.message)
    res.status(500).json({ error: 'INTERNAL_ERROR' })
  }
})

router.put('/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM program WHERE id = ?').get(req.params.id)
    if (!existing) return res.status(404).json({ error: 'PROGRAM_NOT_FOUND' })

    const body = req.body
    if (!body || typeof body !== 'object' || Array.isArray(body)) return res.status(400).json({ error: 'INVALID_DURATION' })
    if (Object.keys(body).some(key => !['duration_weeks','training_days'].includes(key))) return res.status(403).json({ error: 'PROGRAM_FIELDS_LOCKED' })
    if (!Object.hasOwn(body, 'duration_weeks') && !Object.hasOwn(body, 'training_days')) return res.status(400).json({ error: 'NO_FIELDS_TO_UPDATE' })
    const weeks = Object.hasOwn(body, 'duration_weeks') ? body.duration_weeks : existing.duration_weeks
    if (weeks !== null && (!Number.isSafeInteger(weeks) || weeks < 1)) return res.status(400).json({ error: 'INVALID_DURATION' })
    const editingDays = Object.hasOwn(body, 'training_days')
    const days = body.training_days
    if (editingDays && (!Array.isArray(days) || days.length !== existing.days_per_week || new Set(days).size !== days.length || days.some(day => !Number.isInteger(day) || day < 0 || day > 6))) {
      return res.status(400).json({ error:'INVALID_TRAINING_DAYS', required_days:existing.days_per_week })
    }
    db.transaction(() => {
      db.prepare("UPDATE program SET duration_weeks=?, updated_at=datetime('now') WHERE id=?").run(weeks, req.params.id)
      const plan = db.prepare('SELECT parameters FROM program_plan WHERE program_id=?').get(req.params.id)
      if (plan || editingDays) {
        const parameters = { goal:existing.goal,level:existing.level,days_per_week:existing.days_per_week,
          ...(plan ? JSON.parse(plan.parameters) : {}),duration_weeks:weeks }
        if (editingDays) parameters.training_days = [...days].sort((a,b)=>a-b)
        db.prepare("INSERT INTO program_plan (program_id,parameters,warnings) VALUES (?,?,'[]') ON CONFLICT(program_id) DO UPDATE SET parameters=excluded.parameters").run(existing.id,JSON.stringify(parameters))
        if (editingDays) {
          const templates = db.prepare('SELECT id FROM workout_template WHERE program_id=? ORDER BY order_index,id').all(existing.id)
          templates.forEach((template,index) => db.prepare('UPDATE workout_template SET day_of_week=? WHERE id=?').run(parameters.training_days[index % parameters.training_days.length],template.id))
          const previous = plan ? JSON.parse(plan.parameters).training_days : null
          const changed = JSON.stringify(previous ? [...previous].sort((a,b)=>a-b) : null) !== JSON.stringify(parameters.training_days)
          if (changed) {
            db.prepare("DELETE FROM session WHERE program_id=? AND status='planned' AND scheduled_date>=?").run(existing.id,localIsoDate())

          }
        }
      }
      if (existing.is_active) scheduleWeeks(db,existing.id,{throwOnError:true})
    })()
    const updated = db.prepare('SELECT * FROM program WHERE id = ?').get(req.params.id)
    const savedPlan = db.prepare('SELECT * FROM program_plan WHERE program_id=?').get(existing.id)
    res.json({...parseProgram(updated),plan:savedPlan ? {engine_version:savedPlan.engine_version,parameters:JSON.parse(savedPlan.parameters),warnings:JSON.parse(savedPlan.warnings)} : null})
  } catch (err) {
    console.error('[PUT /programs/:id]', err.message)
    res.status(500).json({ error: 'INTERNAL_ERROR' })
  }
})

router.delete('/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM program WHERE id = ?').get(req.params.id)
    if (!existing) return res.status(404).json({ error: 'PROGRAM_NOT_FOUND' })

    const inProgress = db.prepare(
      "SELECT COUNT(*) as n FROM session WHERE program_id = ? AND status = 'in_progress'"
    ).get(req.params.id)
    if (inProgress.n > 0) {
      return res.status(409).json({ error: 'CONFLICT', detail: message('session.in_progress') })
    }

    db.transaction(() => {
      db.prepare("DELETE FROM session WHERE program_id = ? AND status = 'planned'").run(req.params.id)
      db.prepare(`UPDATE session_exercise SET template_exercise_id = NULL
        WHERE template_exercise_id IN (SELECT te.id FROM template_exercise te
        JOIN workout_template wt ON wt.id = te.workout_template_id WHERE wt.program_id = ?)`)
        .run(req.params.id)
      db.prepare(`UPDATE session SET program_id = NULL, workout_template_id = NULL WHERE program_id = ?`).run(req.params.id)
      db.prepare('DELETE FROM program WHERE id = ?').run(req.params.id)
    })()
    res.status(204).end()
  } catch (err) {
    console.error('[DELETE /programs/:id]', err.message)
    res.status(500).json({ error: 'INTERNAL_ERROR' })
  }
})

router.post('/:id/activate', (req, res) => {
  try {
    const existing = db.prepare('SELECT id FROM program WHERE id = ?').get(req.params.id)
    if (!existing) return res.status(404).json({ error: 'PROGRAM_NOT_FOUND' })

    db.transaction(() => {
      db.prepare("UPDATE program SET is_active = 0 WHERE is_active = 1").run()
      db.prepare("UPDATE program SET is_active = 1, started_on=COALESCE(started_on,?) WHERE id = ?").run(localIsoDate(),req.params.id)
    })()

    const created = scheduleWeeks(db, parseInt(req.params.id))
    console.log(`[scheduler] ${created} session(s) scheduled on activation`)

    res.json({
      message:            message('program.activated'),
      program_id:         parseInt(req.params.id),
      sessions_scheduled: created,
    })
  } catch (err) {
    console.error('[POST /programs/:id/activate]', err.message)
    res.status(500).json({ error: 'INTERNAL_ERROR' })
  }
})

router.get('/:id/next-session', (req, res) => {
  try {
    const program = db.prepare('SELECT * FROM program WHERE id = ?').get(req.params.id)
    if (!program) return res.status(404).json({ error: 'PROGRAM_NOT_FOUND' })

    scheduleWeeks(db,program.id)
    if (programDates(program).is_finished) return res.status(409).json({error:'PROGRAM_FINISHED'})
    const templates = db.prepare(
      'SELECT * FROM workout_template WHERE program_id = ? ORDER BY order_index'
    ).all(program.id)
    if (templates.length === 0) return res.status(404).json({ error: 'NO_TEMPLATES' })

    const lastSession = db.prepare(
      "SELECT workout_template_id FROM session WHERE program_id = ? AND status = 'completed' ORDER BY completed_at DESC LIMIT 1"
    ).get(program.id)

    const planned = db.prepare("SELECT * FROM session WHERE program_id=? AND status='planned' AND scheduled_date>=? AND workout_template_id IS NOT NULL ORDER BY scheduled_date,id LIMIT 1").get(program.id, localIsoDate())
    let nextTemplate = planned ? templates.find(t => t.id === planned.workout_template_id) : null
    if (!nextTemplate) {
      if (!lastSession || !lastSession.workout_template_id) nextTemplate = templates[0]
      else {
        const lastIdx = templates.findIndex(t => t.id === lastSession.workout_template_id)
        nextTemplate = templates[(lastIdx + 1) % templates.length]
      }
    }

    const templateExercises = db.prepare(
      'SELECT te.*, e.name_fr, e.name_en, e.equipment_required, e.is_unilateral FROM template_exercise te JOIN exercise e ON te.exercise_id = e.id WHERE te.workout_template_id = ? ORDER BY te.order_index'
    ).all(nextTemplate.id)

    const exercises = templateExercises.map(te => {
      const state = db.prepare(
        'SELECT * FROM progression_state WHERE template_exercise_id = ?'
      ).get(te.id)

      const currentWeight = state?.current_weight_kg || 0
      const targetWeight  = currentWeight

      const explanation = currentWeight === 0
        ? message('program.first_workout')
        : message('program.last_load', { currentWeight: currentWeight })

      return {
        template_exercise_id: te.id,
        exercise_id:          te.exercise_id,
        exercise_name_fr:     te.name_fr,
        exercise_name_en:     te.name_en,
        target_sets:          te.target_sets,
        target_weight_kg:     targetWeight,
        target_reps_min:      te.target_reps_min,
        target_reps_max:      te.target_reps_max,
        rest_seconds:         te.rest_seconds,
        progression_explanation: explanation,
      }
    })

    const today = localIsoDate()

    res.json({
      template_id:    nextTemplate.id,
      template_name:  nextTemplate.name,
      suggested_date: planned?.scheduled_date || today,
      session_id: planned?.id || null,
      exercises,
    })
  } catch (err) {
    console.error('[GET /programs/:id/next-session]', err.message)
    res.status(500).json({ error: 'INTERNAL_ERROR' })
  }
})

// ── POST /programs/:id/deload (manual trigger) ─────────────────
router.post('/:id/deload', (req, res) => {
  try {
    const program = db.prepare('SELECT id FROM program WHERE id = ?').get(req.params.id)
    if (!program) return res.status(404).json({ error: 'PROGRAM_NOT_FOUND' })

    db.prepare(`
      UPDATE program
      SET is_in_deload = 1, last_deload_date = date('now'), updated_at = datetime('now')
      WHERE id = ?
    `).run(req.params.id)

    res.json({
      message: message('deload.activated'),
      program_id: parseInt(req.params.id),
    })
  } catch (err) {
    console.error('[POST /programs/:id/deload]', err.message)
    res.status(500).json({ error: 'INTERNAL_ERROR' })
  }
})

// ── POST /programs/:id/end-deload ─────────────────────────────────────
router.post('/:id/end-deload', (req, res) => {
  try {
    const program = db.prepare('SELECT id FROM program WHERE id = ?').get(req.params.id)
    if (!program) return res.status(404).json({ error: 'PROGRAM_NOT_FOUND' })

    db.prepare(`
      UPDATE program
      SET is_in_deload = 0, updated_at = datetime('now')
      WHERE id = ?
    `).run(req.params.id)

    res.json({
      message: message('deload.finished'),
      program_id: parseInt(req.params.id),
    })
  } catch (err) {
    console.error('[POST /programs/:id/end-deload]', err.message)
    res.status(500).json({ error: 'INTERNAL_ERROR' })
  }
})

export default router
