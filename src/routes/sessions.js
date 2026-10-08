import express from 'express'
import fs from 'fs'
import path from 'path'
import { getDb, getDbPath } from '../db/database.js'

const router = express.Router()
const db = getDb()

function getFormula(db) {
  const row = db.prepare("SELECT value FROM settings WHERE key = 'rm_formula'").get()
  return row ? JSON.parse(row.value) : 'epley'
}

function estimate1RM(weightKg, reps, formula = 'epley') {
  if (!weightKg || weightKg <= 0 || !reps || reps <= 0) return 0
  if (reps === 1) return weightKg
  if (formula === 'epley')   return weightKg * (1 + reps / 30)
  if (formula === 'brzycki') return reps >= 37 ? weightKg : weightKg * 36 / (37 - reps)
  if (formula === 'lander')  return 100 * weightKg / (101.3 - 2.67123 * reps)
  if (formula === 'oconner') return weightKg * (1 + 0.025 * reps)
  return weightKg * (1 + reps / 30) // fallback Epley
}

function autoBackup() {
  try {
    const today = new Date().toISOString().slice(0, 10)
    const src = getDbPath()
    const backupDir = path.join(path.dirname(src), 'backups')
    fs.mkdirSync(backupDir, { recursive: true })

    const dest = path.join(backupDir, `workoutbuddy_${today}.db`)
    if (!fs.existsSync(dest)) {
      fs.copyFileSync(src, dest)
    }

    // Garder seulement les 7 plus récents
    const files = fs.readdirSync(backupDir)
      .filter(f => f.endsWith('.db'))
      .sort()
      .reverse()
    for (const f of files.slice(7)) {
      fs.unlinkSync(path.join(backupDir, f))
    }
  } catch (err) {
    console.warn('[backup] Erreur auto-backup :', err.message)
    // Non bloquant : ne pas faire échouer la complétion
  }
}

// ── GET /sessions ─────────────────────────────────────────────
router.get('/', (req, res) => {
  try {
    let sql = 'SELECT * FROM session WHERE 1=1'
    const params = []
    if (req.query.from)       { sql += ' AND scheduled_date >= ?'; params.push(req.query.from) }
    if (req.query.to)         { sql += ' AND scheduled_date <= ?'; params.push(req.query.to) }
    if (req.query.status)     { sql += ' AND status = ?';          params.push(req.query.status) }
    if (req.query.program_id) { sql += ' AND program_id = ?';      params.push(req.query.program_id) }
    sql += ' ORDER BY scheduled_date DESC'
    const limit = Math.min(parseInt(req.query.limit) || 50, 200)
    sql += ` LIMIT ${limit}`
    res.json({ sessions: db.prepare(sql).all(...params) })
  } catch (err) {
    console.error('[GET /sessions]', err.message)
    res.status(500).json({ error: 'INTERNAL_ERROR' })
  }
})

// ── POST /sessions/from-template/:templateId ─────────────────
// IMPORTANT : déclarée AVANT /:id
router.post('/from-template/:templateId', (req, res) => {
  try {
    const tpl = db.prepare('SELECT * FROM workout_template WHERE id = ?').get(req.params.templateId)
    if (!tpl) return res.status(404).json({ error: 'TEMPLATE_NOT_FOUND' })

    const { scheduled_date } = req.body
    if (!scheduled_date) return res.status(400).json({ error: 'MISSING_DATE' })

    const templateExercises = db.prepare(
      'SELECT * FROM template_exercise WHERE workout_template_id = ? ORDER BY order_index'
    ).all(tpl.id)

    const program = tpl.program_id
      ? db.prepare('SELECT * FROM program WHERE id = ?').get(tpl.program_id)
      : null

    const sessionId = db.transaction(() => {
      const sResult = db.prepare(`
        INSERT INTO session (name, scheduled_date, workout_template_id, program_id, is_deload)
        VALUES (?,?,?,?,?)
      `).run(
        tpl.name, scheduled_date, tpl.id,
        tpl.program_id || null,
        program?.is_in_deload ? 1 : 0
      )
      const sid = sResult.lastInsertRowid

      for (let i = 0; i < templateExercises.length; i++) {
        const te = templateExercises[i]
        db.prepare(`
          INSERT INTO session_exercise (session_id, exercise_id, template_exercise_id, order_index)
          VALUES (?,?,?,?)
        `).run(sid, te.exercise_id, te.id, i)
      }
      return sid
    }).immediate()

    // Retourner session complète
    const session = db.prepare('SELECT * FROM session WHERE id = ?').get(sessionId)
    const exercises = db.prepare(
      'SELECT se.*, e.name_fr FROM session_exercise se JOIN exercise e ON se.exercise_id = e.id WHERE se.session_id = ? ORDER BY se.order_index'
    ).all(sessionId)
    for (const se of exercises) {
      se.sets = []
    }
    res.status(201).json({ ...session, exercises })
  } catch (err) {
    console.error('[POST /sessions/from-template]', err.message)
    res.status(500).json({ error: 'INTERNAL_ERROR' })
  }
})

// ── POST /sessions ────────────────────────────────────────────
router.post('/', (req, res) => {
  try {
    const { name, scheduled_date, workout_template_id, program_id, is_deload } = req.body
    if (!name?.trim())       return res.status(400).json({ error: 'MISSING_NAME' })
    if (!scheduled_date)     return res.status(400).json({ error: 'MISSING_DATE' })

    const result = db.prepare(`
      INSERT INTO session (name, scheduled_date, workout_template_id, program_id, is_deload)
      VALUES (?,?,?,?,?)
    `).run(
      name.trim(), scheduled_date,
      workout_template_id || null,
      program_id || null,
      is_deload ? 1 : 0
    )
    res.status(201).json(db.prepare('SELECT * FROM session WHERE id = ?').get(result.lastInsertRowid))
  } catch (err) {
    console.error('[POST /sessions]', err.message)
    res.status(500).json({ error: 'INTERNAL_ERROR' })
  }
})

// ── GET /sessions/:id ─────────────────────────────────────────
router.get('/:id', (req, res) => {
  try {
    const session = db.prepare('SELECT * FROM session WHERE id = ?').get(req.params.id)
    if (!session) return res.status(404).json({ error: 'SESSION_NOT_FOUND' })

    const sessionExercises = db.prepare(
      'SELECT se.*, e.name_fr, e.name_en FROM session_exercise se JOIN exercise e ON se.exercise_id = e.id WHERE se.session_id = ? ORDER BY se.order_index'
    ).all(session.id)

    for (const se of sessionExercises) {
      se.sets = db.prepare(
        'SELECT * FROM set_log WHERE session_exercise_id = ? ORDER BY set_number'
      ).all(se.id)
    }

    res.json({ ...session, exercises: sessionExercises })
  } catch (err) {
    console.error('[GET /sessions/:id]', err.message)
    res.status(500).json({ error: 'INTERNAL_ERROR' })
  }
})

// ── POST /sessions/:id/start ──────────────────────────────────
router.post('/:id/start', (req, res) => {
  try {
    const session = db.prepare('SELECT * FROM session WHERE id = ?').get(req.params.id)
    if (!session) return res.status(404).json({ error: 'SESSION_NOT_FOUND' })
    if (session.status === 'completed') {
      return res.status(409).json({ error: 'SESSION_ALREADY_COMPLETED' })
    }

    // Vérifier qu'il n'y a pas déjà une séance in_progress
    const existing = db.prepare(
      "SELECT id FROM session WHERE status = 'in_progress' AND id != ?"
    ).get(req.params.id)
    if (existing) {
      return res.status(409).json({
        error: 'SESSION_ALREADY_IN_PROGRESS',
        detail: `Séance ${existing.id} déjà en cours.`
      })
    }

    db.prepare(`
      UPDATE session SET status = 'in_progress', started_at = datetime('now'),
      updated_at = datetime('now') WHERE id = ?
    `).run(req.params.id)

    res.json(db.prepare('SELECT * FROM session WHERE id = ?').get(req.params.id))
  } catch (err) {
    console.error('[POST /sessions/:id/start]', err.message)
    res.status(500).json({ error: 'INTERNAL_ERROR' })
  }
})

// ── POST /sessions/:id/complete ───────────────────────────────
router.post('/:id/complete', (req, res) => {
  try {
    const session = db.prepare('SELECT * FROM session WHERE id = ?').get(req.params.id)
    if (!session) return res.status(404).json({ error: 'SESSION_NOT_FOUND' })
    if (session.status === 'completed') {
      return res.status(409).json({ error: 'SESSION_ALREADY_COMPLETED' })
    }

    db.transaction(() => {
      // Calculer les métriques
      const volumeRow = db.prepare(`
        SELECT COALESCE(SUM(sl.weight_kg * sl.reps), 0) as vol
        FROM set_log sl
        JOIN session_exercise se ON sl.session_exercise_id = se.id
        WHERE se.session_id = ? AND sl.is_completed = 1 AND sl.is_warmup = 0
      `).get(req.params.id)

      const rpeRow = db.prepare(`
        SELECT AVG(sl.rpe) as avg_rpe
        FROM set_log sl
        JOIN session_exercise se ON sl.session_exercise_id = se.id
        WHERE se.session_id = ? AND sl.rpe IS NOT NULL AND sl.is_completed = 1
      `).get(req.params.id)

      const durationSec = session.started_at
        ? Math.round(
            (new Date().getTime() - new Date(session.started_at + 'Z').getTime()) / 1000
          )
        : null

      db.prepare(`
        UPDATE session
        SET status = 'completed',
            completed_at = datetime('now'),
            total_volume_kg = ?,
            rpe_avg = ?,
            duration_seconds = ?,
            updated_at = datetime('now')
        WHERE id = ?
      `).run(
        Math.round(volumeRow.vol * 100) / 100,
        rpeRow.avg_rpe ? Math.round(rpeRow.avg_rpe * 10) / 10 : null,
        durationSec,
        req.params.id
      )

      // Incrémenter current_week du programme
      if (session.program_id) {
        const prog = db.prepare('SELECT * FROM program WHERE id = ?').get(session.program_id)
        if (prog) {
          db.prepare('UPDATE program SET current_week = current_week + 1 WHERE id = ?')
            .run(session.program_id)
        }
      }
    }).immediate()

    autoBackup()

    // Retourner session complète
    const updated = db.prepare('SELECT * FROM session WHERE id = ?').get(req.params.id)
    const exercises = db.prepare(
      'SELECT se.*, e.name_fr FROM session_exercise se JOIN exercise e ON se.exercise_id = e.id WHERE se.session_id = ? ORDER BY se.order_index'
    ).all(req.params.id)
    for (const se of exercises) {
      se.sets = db.prepare(
        'SELECT * FROM set_log WHERE session_exercise_id = ? ORDER BY set_number'
      ).all(se.id)
    }

    res.json({ ...updated, exercises, deload_triggered: false })
  } catch (err) {
    console.error('[POST /sessions/:id/complete]', err.message)
    res.status(500).json({ error: 'INTERNAL_ERROR' })
  }
})

// ── PUT /sessions/:id ─────────────────────────────────────────
router.put('/:id', (req, res) => {
  try {
    const session = db.prepare('SELECT * FROM session WHERE id = ?').get(req.params.id)
    if (!session) return res.status(404).json({ error: 'SESSION_NOT_FOUND' })

    const updates = []; const values = []
    if (req.body.name !== undefined) {
      updates.push('name = ?'); values.push(req.body.name.trim())
    }
    if (req.body.scheduled_date !== undefined) {
      if (session.status !== 'planned') {
        return res.status(400).json({ error: 'CANNOT_CHANGE_DATE_OF_STARTED_SESSION' })
      }
      updates.push('scheduled_date = ?'); values.push(req.body.scheduled_date)
    }
    if (req.body.notes !== undefined) {
      updates.push('notes = ?'); values.push(req.body.notes)
    }
    if (updates.length === 0) return res.status(400).json({ error: 'NO_FIELDS_TO_UPDATE' })
    updates.push("updated_at = datetime('now')")
    values.push(req.params.id)
    db.prepare(`UPDATE session SET ${updates.join(', ')} WHERE id = ?`).run(...values)
    res.json(db.prepare('SELECT * FROM session WHERE id = ?').get(req.params.id))
  } catch (err) {
    console.error('[PUT /sessions/:id]', err.message)
    res.status(500).json({ error: 'INTERNAL_ERROR' })
  }
})

// ── DELETE /sessions/:id ──────────────────────────────────────
router.delete('/:id', (req, res) => {
  try {
    const session = db.prepare('SELECT * FROM session WHERE id = ?').get(req.params.id)
    if (!session) return res.status(404).json({ error: 'SESSION_NOT_FOUND' })
    if (session.status === 'in_progress') {
      return res.status(409).json({ error: 'CANNOT_DELETE_IN_PROGRESS_SESSION' })
    }
    db.prepare('DELETE FROM session WHERE id = ?').run(req.params.id)
    res.status(204).end()
  } catch (err) {
    console.error('[DELETE /sessions/:id]', err.message)
    res.status(500).json({ error: 'INTERNAL_ERROR' })
  }
})

// ── GET /sessions/:id/target/:templateExerciseId ──────────────
router.get('/:id/target/:teId', (req, res) => {
  try {
    const session = db.prepare('SELECT * FROM session WHERE id = ?').get(req.params.id)
    if (!session) return res.status(404).json({ error: 'SESSION_NOT_FOUND' })

    const te = db.prepare('SELECT * FROM template_exercise WHERE id = ?').get(req.params.teId)
    if (!te) return res.status(404).json({ error: 'TEMPLATE_EXERCISE_NOT_FOUND' })

    const state = db.prepare(
      'SELECT * FROM progression_state WHERE template_exercise_id = ?'
    ).get(req.params.teId)

    const weight = state?.current_weight_kg || 0
    const explanation = weight === 0
      ? 'Premier entraînement — commencez léger.'
      : `Charge précédente : ${weight} kg.`

    res.json({
      weight_kg:       weight,
      reps_min:        te.target_reps_min,
      reps_max:        te.target_reps_max,
      explanation,
      achievable_loads_kg: [weight], // sera enrichi en T3.1
    })
  } catch (err) {
    console.error('[GET /sessions/:id/target/:teId]', err.message)
    res.status(500).json({ error: 'INTERNAL_ERROR' })
  }
})

export default router
