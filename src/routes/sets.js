import { markRecord, refreshPersonalRecords, refreshSessionMetrics } from '../services/personalRecords.js'
import { refreshHistoricalProgression } from '../services/trainingHistory.js'
import { isFiniteNumber, isBoolean } from '../services/validation.js'
import express from 'express'
import { getDb } from '../db/database.js'

const router = express.Router()
const db = getDb()

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
      'SELECT se.*, s.program_id, s.status FROM session_exercise se JOIN session s ON se.session_id = s.id WHERE se.id = ?'
    ).get(req.params.seId)
    if (!se) return res.status(404).json({ error: 'SESSION_EXERCISE_NOT_FOUND' })
    if (se.status === 'completed' || se.status === 'skipped') return res.status(409).json({error:'SESSION_NOT_EDITABLE'})

    const { set_number, weight_kg, reps, rpe, rir, is_warmup, notes, is_completed } = req.body
    if (set_number === undefined) return res.status(400).json({ error: 'MISSING_SET_NUMBER' })
    if (!isFiniteNumber(set_number, { min: 1, integer: true }) || !validFields(req.body)) return res.status(400).json({ error: 'INVALID_SET_VALUES' })
    const set = db.transaction(() => {
      const existing=db.prepare('SELECT * FROM set_log WHERE session_exercise_id=? AND set_number=? ORDER BY id LIMIT 1').get(se.id,set_number)
      if (existing) {
        const expected={weight_kg:weight_kg??0,reps:reps??0,rpe:rpe??null,rir:rir??null,
          is_warmup:Number(!!is_warmup),is_completed:Number(!!is_completed),notes:notes??null}
        if (Object.entries(expected).some(([key,value])=>existing[key]!==value)) {
          const error=new Error('SET_NUMBER_EXISTS');error.status=409;throw error
        }
        return existing
      }
      const previous = db.prepare('SELECT MAX(weight_kg) AS weight FROM personal_record WHERE exercise_id = ? AND reps = ?').get(se.exercise_id, reps ?? 0)


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

      const created = db.prepare('SELECT * FROM set_log WHERE id = ?').get(result.lastInsertRowid)
      return markRecord(db, created, previous?.weight || 0)
    }).immediate()

    res.status(201).json(set)
  } catch (err) {
    if (err.status === 409) return res.status(409).json({error:err.message})
    console.error('[POST /session-exercises/:id/sets]', err.message)
    res.status(500).json({ error: 'INTERNAL_ERROR' })
  }
})

// ── PUT /sets/:id ─────────────────────────────────────────────
router.put('/sets/:id', (req, res) => {
  try {
    const set = db.prepare('SELECT id FROM set_log WHERE id = ?').get(req.params.id)
    if (!set) return res.status(404).json({ error: 'SET_NOT_FOUND' })

    if (!validFields(req.body)) return res.status(400).json({ error: 'INVALID_SET_VALUES' })
    const UPDATABLE = ['weight_kg','reps','rpe','rir','is_completed','rest_seconds_after','notes']
    const updates = []; const values = []
    for (const f of UPDATABLE) {
      if (req.body[f] !== undefined) { updates.push(`${f} = ?`); values.push(f === 'is_completed' ? Number(req.body[f]) : req.body[f]) }
    }
    if (updates.length === 0) return res.status(400).json({ error: 'NO_FIELDS_TO_UPDATE' })
    values.push(req.params.id)
    const result = db.transaction(() => {
      const previous = db.prepare(`SELECT MAX(pr.weight_kg) AS weight FROM personal_record pr
        JOIN session_exercise se ON se.exercise_id = pr.exercise_id
        JOIN set_log sl ON sl.session_exercise_id = se.id
        WHERE sl.id = ? AND pr.reps = ?`).get(req.params.id, req.body.reps ?? db.prepare('SELECT reps FROM set_log WHERE id = ?').get(req.params.id).reps)
      db.prepare(`UPDATE set_log SET ${updates.join(', ')} WHERE id = ?`).run(...values)
      return markRecord(db, db.prepare('SELECT * FROM set_log WHERE id = ?').get(req.params.id), previous?.weight || 0)
    })()
    res.json(result)
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
    db.transaction(() => {
      const se = db.prepare('SELECT se.exercise_id, se.session_id FROM session_exercise se JOIN set_log sl ON sl.session_exercise_id = se.id WHERE sl.id = ?').get(req.params.id)
      db.prepare('DELETE FROM personal_record WHERE set_log_id = ?').run(req.params.id)
      db.prepare('DELETE FROM set_log WHERE id = ?').run(req.params.id)
      refreshPersonalRecords(db, se.exercise_id)
      refreshSessionMetrics(db, se.session_id)
      refreshHistoricalProgression(db,se.session_id,[se.exercise_id])
    })()
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
    const se = db.prepare('SELECT * FROM session_exercise WHERE id = ?').get(req.params.id)
    if (!se) return res.status(404).json({ error: 'SESSION_EXERCISE_NOT_FOUND' })
    db.transaction(() => {
      db.prepare('DELETE FROM personal_record WHERE set_log_id IN (SELECT id FROM set_log WHERE session_exercise_id = ?)').run(req.params.id)
      db.prepare('DELETE FROM session_exercise WHERE id = ?').run(req.params.id)
      refreshPersonalRecords(db, se.exercise_id)
      refreshSessionMetrics(db, se.session_id)
      refreshHistoricalProgression(db,se.session_id,[se.exercise_id])
    })()
    res.status(204).end()
  } catch (err) {
    console.error('[DELETE /session-exercises/:id]', err.message)
    res.status(500).json({ error: 'INTERNAL_ERROR' })
  }
})

function validFields(body) {
  for (const key of ['weight_kg','reps','rpe','rir','rest_seconds_after']) {
    if (body[key] === undefined || (['rpe','rir'].includes(key) && body[key] === null)) continue
    if (!isFiniteNumber(body[key], { min: 0, max: key === 'rpe' ? 10 : Infinity, integer: key === 'reps' })) return false
  }
  for (const key of ['is_completed','is_warmup']) if (body[key] !== undefined && !isBoolean(body[key])) return false
  return body.notes === undefined || body.notes === null || typeof body.notes === 'string'
}

export default router
