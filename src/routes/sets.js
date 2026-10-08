import express from 'express'
import { getDb } from '../db/database.js'

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

// ── GET /session-exercises/:id/sets ──────────────────────────
router.get('/session-exercises/:seId/sets', (req, res) => {
  try {
    const se = db.prepare('SELECT id FROM session_exercise WHERE id = ?').get(req.params.seId)
    if (!se) return res.status(404).json({ error: 'SESSION_EXERCISE_NOT_FOUND' })
    const sets = db.prepare(
      'SELECT * FROM set_log WHERE session_exercise_id = ? ORDER BY set_number'
    ).all(req.params.seId)
    res.json({ sets })
  } catch (err) {
    console.error('[GET /session-exercises/:id/sets]', err.message)
    res.status(500).json({ error: 'INTERNAL_ERROR' })
  }
})

// ── POST /session-exercises/:id/sets ─────────────────────────
router.post('/session-exercises/:seId/sets', (req, res) => {
  try {
    const se = db.prepare(
      'SELECT se.*, s.program_id FROM session_exercise se JOIN session s ON se.session_id = s.id WHERE se.id = ?'
    ).get(req.params.seId)
    if (!se) return res.status(404).json({ error: 'SESSION_EXERCISE_NOT_FOUND' })

    const { set_number, weight_kg, reps, rpe, rir, is_warmup, notes, is_completed } = req.body
    if (set_number === undefined) return res.status(400).json({ error: 'MISSING_SET_NUMBER' })

    const result = db.prepare(`
      INSERT INTO set_log
        (session_exercise_id, set_number, weight_kg, reps, rpe, rir, is_warmup, is_completed, notes)
      VALUES (?,?,?,?,?,?,?,?,?)
    `).run(
      parseInt(req.params.seId),
      set_number,
      weight_kg ?? 0,
      reps ?? 0,
      rpe ?? null,
      rir ?? null,
      is_warmup ? 1 : 0,
      is_completed ? 1 : 0,
      notes ?? null
    )

    const set = db.prepare('SELECT * FROM set_log WHERE id = ?').get(result.lastInsertRowid)

    // Vérifier si c'est un PR (seulement si série complétée, non warmup, reps > 0)
    if (set.is_completed && !set.is_warmup && set.reps > 0 && set.weight_kg > 0) {
      const formula = getFormula(db)
      const new1rm  = estimate1RM(set.weight_kg, set.reps, formula)

      const existingPR = db.prepare(`
        SELECT * FROM personal_record
        WHERE exercise_id = (SELECT exercise_id FROM session_exercise WHERE id = ?)
          AND reps = ?
        ORDER BY estimated_1rm_kg DESC LIMIT 1
      `).get(req.params.seId, set.reps)

      if (!existingPR || new1rm > existingPR.estimated_1rm_kg) {
        const exerciseId = db.prepare(
          'SELECT exercise_id FROM session_exercise WHERE id = ?'
        ).get(req.params.seId).exercise_id

        const today = new Date().toISOString().slice(0, 10)

        // Supprimer l'ancien PR pour ce reps si existant
        if (existingPR) {
          db.prepare('DELETE FROM personal_record WHERE id = ?').run(existingPR.id)
        }

        db.prepare(`
          INSERT INTO personal_record
            (exercise_id, reps, weight_kg, estimated_1rm_kg, achieved_date, set_log_id)
          VALUES (?,?,?,?,?,?)
        `).run(exerciseId, set.reps, set.weight_kg,
          Math.round(new1rm * 100) / 100, today, set.id)

        set._new_pr = true
        set._estimated_1rm = Math.round(new1rm * 100) / 100
      }
    }

    res.status(201).json(set)
  } catch (err) {
    console.error('[POST /session-exercises/:id/sets]', err.message)
    res.status(500).json({ error: 'INTERNAL_ERROR' })
  }
})

// ── PUT /sets/:id ─────────────────────────────────────────────
router.put('/sets/:id', (req, res) => {
  try {
    const set = db.prepare('SELECT id FROM set_log WHERE id = ?').get(req.params.id)
    if (!set) return res.status(404).json({ error: 'SET_NOT_FOUND' })

    const UPDATABLE = ['weight_kg','reps','rpe','rir','is_completed','rest_seconds_after','notes']
    const updates = []; const values = []
    for (const f of UPDATABLE) {
      if (req.body[f] !== undefined) { updates.push(`${f} = ?`); values.push(req.body[f]) }
    }
    if (updates.length === 0) return res.status(400).json({ error: 'NO_FIELDS_TO_UPDATE' })
    values.push(req.params.id)
    db.prepare(`UPDATE set_log SET ${updates.join(', ')} WHERE id = ?`).run(...values)
    res.json(db.prepare('SELECT * FROM set_log WHERE id = ?').get(req.params.id))
  } catch (err) {
    console.error('[PUT /sets/:id]', err.message)
    res.status(500).json({ error: 'INTERNAL_ERROR' })
  }
})

// ── DELETE /sets/:id ──────────────────────────────────────────
router.delete('/sets/:id', (req, res) => {
  try {
    const set = db.prepare('SELECT id FROM set_log WHERE id = ?').get(req.params.id)
    if (!set) return res.status(404).json({ error: 'SET_NOT_FOUND' })
    db.prepare('DELETE FROM set_log WHERE id = ?').run(req.params.id)
    res.status(204).end()
  } catch (err) {
    console.error('[DELETE /sets/:id]', err.message)
    res.status(500).json({ error: 'INTERNAL_ERROR' })
  }
})

// ── POST /session-exercises (ajouter un exercice à une séance) ─
router.post('/session-exercises', (req, res) => {
  try {
    const { session_id, exercise_id, order_index, template_exercise_id } = req.body
    if (!session_id)  return res.status(400).json({ error: 'MISSING_SESSION_ID' })
    if (!exercise_id) return res.status(400).json({ error: 'MISSING_EXERCISE_ID' })

    const session = db.prepare('SELECT id FROM session WHERE id = ?').get(session_id)
    if (!session) return res.status(404).json({ error: 'SESSION_NOT_FOUND' })

    const exercise = db.prepare('SELECT id FROM exercise WHERE id = ?').get(exercise_id)
    if (!exercise) return res.status(404).json({ error: 'EXERCISE_NOT_FOUND' })

    const result = db.prepare(`
      INSERT INTO session_exercise
        (session_id, exercise_id, order_index, template_exercise_id)
      VALUES (?,?,?,?)
    `).run(session_id, exercise_id, order_index ?? 0, template_exercise_id ?? null)

    res.status(201).json(
      db.prepare('SELECT * FROM session_exercise WHERE id = ?').get(result.lastInsertRowid)
    )
  } catch (err) {
    console.error('[POST /session-exercises]', err.message)
    res.status(500).json({ error: 'INTERNAL_ERROR' })
  }
})

// ── DELETE /session-exercises/:id ────────────────────────────
router.delete('/session-exercises/:id', (req, res) => {
  try {
    const se = db.prepare('SELECT id FROM session_exercise WHERE id = ?').get(req.params.id)
    if (!se) return res.status(404).json({ error: 'SESSION_EXERCISE_NOT_FOUND' })
    db.prepare('DELETE FROM session_exercise WHERE id = ?').run(req.params.id)
    res.status(204).end()
  } catch (err) {
    console.error('[DELETE /session-exercises/:id]', err.message)
    res.status(500).json({ error: 'INTERNAL_ERROR' })
  }
})

export default router
