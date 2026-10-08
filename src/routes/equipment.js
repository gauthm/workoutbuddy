import express from 'express'
import { getDb } from '../db/database.js'
import { calculateAchievableLoads } from '../services/equipmentCalc.js'

const router = express.Router()
const db = getDb()

const VALID_CATEGORIES = [
  'barbell', 'ez_bar',
  'plate', 'dumbbell_plate',
  'dumbbell_fixed', 'dumbbell_adjustable', 'dumbbell_loadable',
  'kettlebell',
  'resistance_band',
  'bench', 'bench_adjustable',
  'rack', 'pullup_bar', 'cable_machine', 'smith_machine', 'other',
]

// Déclaré AVANT les routes paramétrées : sinon 'achievable-loads' serait pris comme :id
router.get('/achievable-loads', (req, res) => {
  try {
    const exerciseId = req.query.exercise_id
    if (!exerciseId) return res.status(400).json({ error: 'MISSING_EXERCISE_ID' })

    const exercise = db.prepare('SELECT * FROM exercise WHERE id = ?').get(exerciseId)
    if (!exercise) return res.status(404).json({ error: 'EXERCISE_NOT_FOUND' })

    const items = db.prepare('SELECT * FROM equipment_item').all()

    const result = calculateAchievableLoads(items, {
      equipment_required: JSON.parse(exercise.equipment_required || '[]'),
      is_unilateral: exercise.is_unilateral
    })

    res.json({
      exercise_id: exerciseId,
      is_unilateral: exercise.is_unilateral === 1,
      ...result
    })
  } catch (err) {
    console.error('[GET /equipment/achievable-loads]', err.message)
    res.status(500).json({ error: 'INTERNAL_ERROR' })
  }
})

router.get('/', (req, res) => {
  try {
    const items = db.prepare('SELECT * FROM equipment_item ORDER BY id ASC').all()
    res.json({ items })
  } catch (err) {
    console.error('[GET /equipment]', err.message)
    res.status(500).json({ error: 'INTERNAL_ERROR' })
  }
})

router.post('/', (req, res) => {
  try {
    const {
      category, name, weight_kg, count,
      weight_min_kg, weight_max_kg, weight_step_kg,
      resistance_min_kg, resistance_max_kg, notes
    } = req.body

    // Validation catégorie
    if (!VALID_CATEGORIES.includes(category)) {
      return res.status(400).json({
        error:  'INVALID_CATEGORY',
        detail: `Catégories valides : ${VALID_CATEGORIES.join(', ')}`,
      })
    }

    // Validation nom
    if (!name?.trim()) {
      return res.status(400).json({ error: 'MISSING_NAME' })
    }

    // Validation count pair pour plate et dumbbell_plate
    if (['plate', 'dumbbell_plate'].includes(category)) {
      const n = parseInt(count) || 1
      if (n < 2 || n % 2 !== 0) {
        return res.status(400).json({
          error:  'PLATE_COUNT_MUST_BE_EVEN',
          detail: 'Les disques doivent être en quantité paire (minimum 2).',
        })
      }
    }

    // dumbbell_loadable : count toujours 2
    const effectiveCount =
      category === 'dumbbell_loadable' ? 2 : (parseInt(count) || 1)

    // Validation champs haltères réglables
    if (category === 'dumbbell_adjustable') {
      if (!weight_min_kg || !weight_max_kg || !weight_step_kg) {
        return res.status(400).json({
          error:  'MISSING_ADJUSTABLE_FIELDS',
          detail: 'weight_min_kg, weight_max_kg et weight_step_kg sont requis pour dumbbell_adjustable.',
        })
      }
      if (parseFloat(weight_min_kg) >= parseFloat(weight_max_kg)) {
        return res.status(400).json({ error: 'INVALID_WEIGHT_RANGE' })
      }
    }

    const result = db.prepare(`
      INSERT INTO equipment_item
        (category, name, weight_kg, count, weight_min_kg, weight_max_kg,
         weight_step_kg, resistance_min_kg, resistance_max_kg, notes)
      VALUES (?,?,?,?,?,?,?,?,?,?)
    `).run(
      category, name.trim(),
      weight_kg   ? parseFloat(weight_kg)   : null,
      effectiveCount,
      weight_min_kg       ? parseFloat(weight_min_kg)       : null,
      weight_max_kg       ? parseFloat(weight_max_kg)       : null,
      weight_step_kg      ? parseFloat(weight_step_kg)      : null,
      resistance_min_kg   ? parseFloat(resistance_min_kg)   : null,
      resistance_max_kg   ? parseFloat(resistance_max_kg)   : null,
      notes || null,
    )

    res.status(201).json(
      db.prepare('SELECT * FROM equipment_item WHERE id = ?').get(result.lastInsertRowid)
    )
  } catch (err) {
    console.error('[POST /equipment]', err.message)
    res.status(500).json({ error: 'INTERNAL_ERROR' })
  }
})

router.put('/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM equipment_item WHERE id = ?').get(req.params.id)
    if (!existing) return res.status(404).json({ error: 'EQUIPMENT_NOT_FOUND' })

    const fields = [
      'category', 'name', 'weight_kg', 'count',
      'weight_min_kg', 'weight_max_kg', 'weight_step_kg',
      'resistance_min_kg', 'resistance_max_kg', 'notes'
    ]

    const updates = []
    const values = []
    for (const f of fields) {
      if (req.body[f] !== undefined) {
        updates.push(`${f} = ?`)
        values.push(req.body[f])
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'NO_FIELDS_TO_UPDATE' })
    }

    values.push(req.params.id)
    db.prepare(`UPDATE equipment_item SET ${updates.join(', ')} WHERE id = ?`).run(...values)

    const updated = db.prepare('SELECT * FROM equipment_item WHERE id = ?').get(req.params.id)
    res.json(updated)
  } catch (err) {
    console.error('[PUT /equipment/:id]', err.message)
    res.status(500).json({ error: 'INTERNAL_ERROR' })
  }
})

router.delete('/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM equipment_item WHERE id = ?').get(req.params.id)
    if (!existing) return res.status(404).json({ error: 'EQUIPMENT_NOT_FOUND' })

    db.prepare('DELETE FROM equipment_item WHERE id = ?').run(req.params.id)
    res.status(204).end()
  } catch (err) {
    console.error('[DELETE /equipment/:id]', err.message)
    res.status(500).json({ error: 'INTERNAL_ERROR' })
  }
})

export default router
