import express from 'express'
import { getDb } from '../db/database.js'
import { EQUIPMENT_FAMILIES } from '../../public/js/components/equipment/inventoryCatalog.js'
import { calculateAchievableLoads } from '../services/equipmentCalc.js'

const router = express.Router()
const db = getDb()

function parseExercise(row) {
  if (!row) return null
  return {
    ...row,
    primary_muscles:    JSON.parse(row.primary_muscles    || '[]'),
    secondary_muscles:  JSON.parse(row.secondary_muscles  || '[]'),
    equipment_required: JSON.parse(row.equipment_required || '[]'),
    instructions_fr:    JSON.parse(row.instructions_fr    || '[]'),
    instructions_en:    JSON.parse(row.instructions_en    || '[]'),
    image_paths:        JSON.parse(row.image_paths        || '[]'),
    is_custom:    row.is_custom    === 1,
    is_unilateral: row.is_unilateral === 1,
    is_excluded:        (row.is_excluded || 0) === 1,
    exclusion_reason:   row.exclusion_reason || null,
  }
}

router.get('/', (req, res) => {
  try {
    const family = EQUIPMENT_FAMILIES.find(f => f.id === req.query.equipment_family)
    if (req.query.equipment_family && !family && req.query.equipment_family !== 'bodyweight') {
      return res.status(400).json({ error: 'INVALID_EQUIPMENT_FAMILY' })
    }
    if (req.query.available !== undefined && !['0','1'].includes(req.query.available)) {
      return res.status(400).json({ error: 'INVALID_AVAILABLE_FILTER' })
    }
    let sql = 'SELECT * FROM exercise WHERE 1=1'
    const params = []

    if (req.query.movement) {
      sql += ' AND movement_pattern = ?'
      params.push(req.query.movement)
    }
    if (req.query.custom !== undefined) {
      sql += ' AND is_custom = ?'
      params.push(parseInt(req.query.custom))
    }
    if (req.query.excluded !== undefined) {
      // Pas de paramètre → tous (exclus compris) ; excluded=0 → disponibles ; excluded=1 → exclus
      sql += ' AND is_excluded = ?'
      params.push(parseInt(req.query.excluded))
    }
    if (req.query.muscle) {
      // Filtre JSON : primary_muscles est '["chest","triceps"]'
      // Chercher la valeur exacte entre guillemets
      sql += ' AND primary_muscles LIKE ?'
      params.push(`%"${req.query.muscle}"%`)
    }
    if (req.query.equipment) {
      sql += ' AND equipment_required LIKE ?'
      params.push(`%"${req.query.equipment}"%`)
    }
    if (req.query.q) {
      sql += ' AND (name_fr LIKE ? OR name_en LIKE ?)'
      const term = `%${req.query.q}%`
      params.push(term, term)
    }

    sql += ' ORDER BY name_fr ASC'

    const rows = db.prepare(sql).all(...params)
    let exercises = rows.map(parseExercise)
    if (family) exercises = exercises.filter(ex => ex.equipment_required.some(c => family.categories.includes(c)))
    else if (req.query.equipment_family === 'bodyweight') exercises = exercises.filter(ex => !ex.equipment_required.length)
    if (req.query.available === '1') {
      const inventory = db.prepare('SELECT * FROM equipment_item WHERE count > 0').all()
      const cache = new Map()
      exercises = exercises.filter(ex => {
        const key = JSON.stringify([ex.equipment_required, ex.is_unilateral])
        if (!cache.has(key)) cache.set(key, calculateAchievableLoads(inventory, ex).loads_kg.length > 0)
        return cache.get(key)
      })
    }
    res.json({ exercises })
  } catch (err) {
    console.error('[GET /exercises]', err.message)
    res.status(500).json({ error: 'INTERNAL_ERROR' })
  }
})

router.post('/', (req, res) => {
  try {
    const {
      name_fr, name_en, category, force, mechanic, movement_pattern,
      primary_muscles, secondary_muscles, equipment_required,
      instructions_fr, instructions_en, image_paths, is_unilateral
    } = req.body

    // Validations
    if (!name_fr || !name_fr.trim()) {
      return res.status(400).json({ error: 'MISSING_NAME_FR' })
    }
    if (!name_en || !name_en.trim()) {
      return res.status(400).json({ error: 'MISSING_NAME_EN' })
    }
    const VALID_CATEGORIES = ['strength','cardio','stretching','plyometrics','olympic_weightlifting']
    if (!VALID_CATEGORIES.includes(category)) {
      return res.status(400).json({ error: 'INVALID_CATEGORY' })
    }
    const VALID_MOVEMENTS = [
      'push_horizontal','push_vertical','pull_horizontal','pull_vertical',
      'squat','hinge','lunge','carry','core','rotation','other'
    ]
    if (!VALID_MOVEMENTS.includes(movement_pattern)) {
      return res.status(400).json({ error: 'INVALID_MOVEMENT_PATTERN' })
    }
    if (!Array.isArray(primary_muscles) || primary_muscles.length === 0) {
      return res.status(400).json({ error: 'MISSING_PRIMARY_MUSCLES' })
    }

    // Générer un ID depuis name_en
    const baseId = name_en.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
    let id = baseId
    let suffix = 2
    while (db.prepare('SELECT id FROM exercise WHERE id = ?').get(id)) {
      id = `${baseId}_${suffix++}`
    }

    db.prepare(`
      INSERT INTO exercise
        (id, name_fr, name_en, category, force, mechanic, movement_pattern,
         primary_muscles, secondary_muscles, equipment_required,
         instructions_fr, instructions_en, image_paths, is_custom, is_unilateral)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,1,?)
    `).run(
      id, name_fr.trim(), name_en.trim(), category,
      force || null, mechanic || null, movement_pattern,
      JSON.stringify(primary_muscles),
      JSON.stringify(secondary_muscles || []),
      JSON.stringify(equipment_required || []),
      JSON.stringify(instructions_fr || []),
      JSON.stringify(instructions_en || []),
      JSON.stringify(image_paths || []),
      is_unilateral ? 1 : 0
    )

    const created = db.prepare('SELECT * FROM exercise WHERE id = ?').get(id)
    res.status(201).json(parseExercise(created))
  } catch (err) {
    console.error('[POST /exercises]', err.message)
    res.status(500).json({ error: 'INTERNAL_ERROR' })
  }
})

// Ordre important : routes spécifiques AVANT /:id
router.get('/:id/history', (req, res) => {
  try {
    const exercise = db.prepare('SELECT id FROM exercise WHERE id = ?').get(req.params.id)
    if (!exercise) return res.status(404).json({ error: 'EXERCISE_NOT_FOUND' })

    const limit = Math.min(parseInt(req.query.limit) || 20, 100)

    let sql = `
      SELECT
        s.id        AS session_id,
        s.name      AS session_name,
        s.scheduled_date,
        s.completed_at,
        sl.id       AS set_id,
        sl.set_number,
        sl.weight_kg,
        sl.reps,
        sl.rpe,
        sl.rir,
        sl.is_completed
      FROM session s
      JOIN session_exercise se ON se.session_id = s.id
      JOIN set_log sl ON sl.session_exercise_id = se.id
      WHERE se.exercise_id = ?
        AND s.status = 'completed'
        AND sl.is_warmup = 0
    `
    const params = [req.params.id]

    if (req.query.program_id) {
      sql += ' AND s.program_id = ?'
      params.push(parseInt(req.query.program_id))
    }

    sql += ' ORDER BY s.completed_at DESC, sl.set_number ASC'

    const rows = db.prepare(sql).all(...params)

    // Grouper par session
    const sessionsMap = new Map()
    for (const row of rows) {
      if (!sessionsMap.has(row.session_id)) {
        sessionsMap.set(row.session_id, {
          session_id:    row.session_id,
          session_name:  row.session_name,
          scheduled_date: row.scheduled_date,
          completed_at:  row.completed_at,
          sets: []
        })
      }
      sessionsMap.get(row.session_id).sets.push({
        set_id:       row.set_id,
        set_number:   row.set_number,
        weight_kg:    row.weight_kg,
        reps:         row.reps,
        rpe:          row.rpe,
        rir:          row.rir,
        is_completed: row.is_completed === 1
      })
    }

    const history = Array.from(sessionsMap.values()).slice(0, limit)

    res.json({ exercise_id: req.params.id, history })
  } catch (err) {
    console.error('[GET /exercises/:id/history]', err.message)
    res.status(500).json({ error: 'INTERNAL_ERROR' })
  }
})

router.get('/:id/rm-history', (req, res) => {
  try {
    const exercise = db.prepare('SELECT id FROM exercise WHERE id = ?').get(req.params.id)
    if (!exercise) return res.status(404).json({ error: 'EXERCISE_NOT_FOUND' })

    const days = parseInt(req.query.days) || 90

    // Récupérer le setting de formule RM
    const formulaRow = db.prepare("SELECT value FROM settings WHERE key = 'rm_formula'").get()
    const formula = formulaRow ? JSON.parse(formulaRow.value) : 'epley'

    const rows = db.prepare(`
      SELECT
        date(s.completed_at) AS date,
        sl.weight_kg,
        sl.reps,
        MAX(sl.weight_kg * (1 + sl.reps / 30.0)) AS estimated_1rm_kg
      FROM session s
      JOIN session_exercise se ON se.session_id = s.id
      JOIN set_log sl ON sl.session_exercise_id = se.id
      WHERE se.exercise_id = ?
        AND s.status = 'completed'
        AND sl.is_warmup = 0
        AND sl.is_completed = 1
        AND sl.reps > 0
        AND sl.weight_kg > 0
        AND date(s.completed_at) >= date('now', ? || ' days')
      GROUP BY date(s.completed_at)
      ORDER BY date(s.completed_at) ASC
    `).all(req.params.id, `-${days}`)

    const history = rows.map(r => ({
      date:             r.date,
      estimated_1rm_kg: Math.round(r.estimated_1rm_kg * 100) / 100,
      formula
    }))

    res.json({ exercise_id: req.params.id, history })
  } catch (err) {
    console.error('[GET /exercises/:id/rm-history]', err.message)
    res.status(500).json({ error: 'INTERNAL_ERROR' })
  }
})

// Déclarée AVANT /:id pour éviter qu'Express interprète "toggle-exclusion" comme un :id
router.put('/:id/toggle-exclusion', (req, res) => {
  try {
    const exercise = db.prepare('SELECT * FROM exercise WHERE id = ?').get(req.params.id)
    if (!exercise) return res.status(404).json({ error: 'EXERCISE_NOT_FOUND' })

    const { is_excluded, exclusion_reason } = req.body
    if (is_excluded === undefined || is_excluded === null) {
      return res.status(400).json({ error: 'MISSING_IS_EXCLUDED' })
    }

    const newValue = (is_excluded === true || is_excluded === 1) ? 1 : 0

    db.prepare(`
      UPDATE exercise
      SET is_excluded      = ?,
          exclusion_reason = ?
      WHERE id = ?
    `).run(
      newValue,
      newValue === 1 ? (exclusion_reason || null) : null,
      req.params.id
    )

    const updated = db.prepare('SELECT * FROM exercise WHERE id = ?').get(req.params.id)
    res.json(parseExercise(updated))
  } catch (err) {
    console.error('[PUT /exercises/:id/toggle-exclusion]', err.message)
    res.status(500).json({ error: 'INTERNAL_ERROR' })
  }
})

router.get('/:id', (req, res) => {
  try {
    const row = db.prepare('SELECT * FROM exercise WHERE id = ?').get(req.params.id)
    if (!row) return res.status(404).json({ error: 'EXERCISE_NOT_FOUND' })
    res.json(parseExercise(row))
  } catch (err) {
    console.error('[GET /exercises/:id]', err.message)
    res.status(500).json({ error: 'INTERNAL_ERROR' })
  }
})

router.put('/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM exercise WHERE id = ?').get(req.params.id)
    if (!existing) return res.status(404).json({ error: 'EXERCISE_NOT_FOUND' })
    if (!existing.is_custom) {
      return res.status(403).json({ error: 'CANNOT_EDIT_BUILTIN_EXERCISE' })
    }

    // Champs modifiables
    const fields = [
      'name_fr','name_en','category','force','mechanic','movement_pattern',
      'is_unilateral'
    ]
    const arrayFields = [
      'primary_muscles','secondary_muscles','equipment_required',
      'instructions_fr','instructions_en','image_paths'
    ]
    const updates = []
    const values = []

    for (const f of fields) {
      if (req.body[f] !== undefined) {
        updates.push(`${f} = ?`)
        values.push(req.body[f])
      }
    }
    for (const f of arrayFields) {
      if (req.body[f] !== undefined) {
        updates.push(`${f} = ?`)
        values.push(JSON.stringify(req.body[f]))
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'NO_FIELDS_TO_UPDATE' })
    }

    values.push(req.params.id)
    db.prepare(`UPDATE exercise SET ${updates.join(', ')} WHERE id = ?`).run(...values)

    const updated = db.prepare('SELECT * FROM exercise WHERE id = ?').get(req.params.id)
    res.json(parseExercise(updated))
  } catch (err) {
    console.error('[PUT /exercises/:id]', err.message)
    res.status(500).json({ error: 'INTERNAL_ERROR' })
  }
})

router.delete('/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM exercise WHERE id = ?').get(req.params.id)
    if (!existing) return res.status(404).json({ error: 'EXERCISE_NOT_FOUND' })
    if (!existing.is_custom) {
      return res.status(403).json({ error: 'CANNOT_DELETE_BUILTIN_EXERCISE' })
    }

    // Vérifier qu'il n'est pas utilisé dans un template
    const inUse = db.prepare(
      'SELECT COUNT(*) as n FROM template_exercise WHERE exercise_id = ?'
    ).get(req.params.id)
    if (inUse.n > 0) {
      return res.status(409).json({
        error: 'EXERCISE_IN_USE',
        detail: `Utilisé dans ${inUse.n} template(s)`
      })
    }

    db.prepare('DELETE FROM exercise WHERE id = ?').run(req.params.id)
    res.status(204).end()
  } catch (err) {
    console.error('[DELETE /exercises/:id]', err.message)
    res.status(500).json({ error: 'INTERNAL_ERROR' })
  }
})

export default router
