import { isFiniteNumber, isIsoDate } from '../services/validation.js'
import express from 'express'
import { getDb } from '../db/database.js'

const router = express.Router()
const db     = getDb()

// ── GET /bodyweight ───────────────────────────────────────────
// Query: days=90 (défaut : setting bodyweight_display_days)
router.get('/', (req, res) => {
  try {
    const settingRow = db.prepare(
      "SELECT value FROM settings WHERE key = 'bodyweight_display_days'"
    ).get()
    const defaultDays = settingRow ? JSON.parse(settingRow.value) : 90
    const days = Math.min(parseInt(req.query.days) || defaultDays, 365 * 3)

    const rows = db.prepare(`
      SELECT * FROM body_weight
      WHERE date >= date('now', ? || ' days')
      ORDER BY date ASC
    `).all(`-${days}`)

    res.json({ entries: rows })
  } catch (err) {
    console.error('[GET /bodyweight]', err.message)
    res.status(500).json({ error: 'INTERNAL_ERROR' })
  }
})

// ── POST /bodyweight ──────────────────────────────────────────
router.post('/', (req, res) => {
  try {
    const { date, weight_kg, notes } = req.body
    if (!date)       return res.status(400).json({ error: 'MISSING_DATE' })
    if (!isFiniteNumber(weight_kg, { min: Number.MIN_VALUE })) {
      return res.status(400).json({ error: 'INVALID_WEIGHT' })
    }

    // Vérifier la date (format YYYY-MM-DD)
    if (!isIsoDate(date)) {
      return res.status(400).json({ error: 'INVALID_DATE_FORMAT' })
    }

    // Vérifier doublon
    const existing = db.prepare('SELECT id FROM body_weight WHERE date = ?').get(date)
    if (existing) {
      return res.status(409).json({ error: 'BODYWEIGHT_DATE_EXISTS', detail: `Une entrée existe déjà pour le ${date}.` })
    }

    const result = db.prepare(
      'INSERT INTO body_weight (date, weight_kg, notes) VALUES (?,?,?)'
    ).run(date, parseFloat(weight_kg), notes || null)

    res.status(201).json(
      db.prepare('SELECT * FROM body_weight WHERE id = ?').get(result.lastInsertRowid)
    )
  } catch (err) {
    console.error('[POST /bodyweight]', err.message)
    res.status(500).json({ error: 'INTERNAL_ERROR' })
  }
})

// ── PUT /bodyweight/:id ───────────────────────────────────────
router.put('/:id', (req, res) => {
  try {
    const entry = db.prepare('SELECT id FROM body_weight WHERE id = ?').get(req.params.id)
    if (!entry) return res.status(404).json({ error: 'BODYWEIGHT_NOT_FOUND' })

    const updates = []; const values = []
    if (req.body.weight_kg !== undefined) {
      if (!isFiniteNumber(req.body.weight_kg, { min: Number.MIN_VALUE })) return res.status(400).json({ error: 'INVALID_WEIGHT' })
      updates.push('weight_kg = ?')
      values.push(parseFloat(req.body.weight_kg))
    }
    if (req.body.notes !== undefined) {
      updates.push('notes = ?')
      values.push(req.body.notes)
    }
    if (updates.length === 0) return res.status(400).json({ error: 'NO_FIELDS_TO_UPDATE' })

    values.push(req.params.id)
    db.prepare(`UPDATE body_weight SET ${updates.join(', ')} WHERE id = ?`).run(...values)
    res.json(db.prepare('SELECT * FROM body_weight WHERE id = ?').get(req.params.id))
  } catch (err) {
    console.error('[PUT /bodyweight/:id]', err.message)
    res.status(500).json({ error: 'INTERNAL_ERROR' })
  }
})

// ── DELETE /bodyweight/:id ────────────────────────────────────
router.delete('/:id', (req, res) => {
  try {
    const entry = db.prepare('SELECT id FROM body_weight WHERE id = ?').get(req.params.id)
    if (!entry) return res.status(404).json({ error: 'BODYWEIGHT_NOT_FOUND' })
    db.prepare('DELETE FROM body_weight WHERE id = ?').run(req.params.id)
    res.status(204).end()
  } catch (err) {
    console.error('[DELETE /bodyweight/:id]', err.message)
    res.status(500).json({ error: 'INTERNAL_ERROR' })
  }
})

export default router
