import express from 'express'
import { getDb } from '../db/database.js'
import { generateProgram } from '../services/programGenerator.js'

const router = express.Router()
const db = getDb()

function parseProgram(row) {
  if (!row) return null
  return {
    ...row,
    is_active:              row.is_active === 1,
    use_exercise_rotation:  row.use_exercise_rotation === 1,
    deload_auto_enabled:    row.deload_auto_enabled === 1,
    is_in_deload:           row.is_in_deload === 1,
  }
}

// OBLIGATOIRE : /generate avant /:id
router.post('/generate', (req, res) => {
  try {
    const { goal, level, days_per_week, duration_weeks, priority_muscles, equipment_ids, name } = req.body
    const VALID_GOALS  = ['strength','hypertrophy','endurance','weight_loss','general_fitness']
    const VALID_LEVELS = ['beginner','intermediate','advanced']
    if (!VALID_GOALS.includes(goal))   return res.status(400).json({ error: 'INVALID_GOAL' })
    if (!VALID_LEVELS.includes(level)) return res.status(400).json({ error: 'INVALID_LEVEL' })
    const dpw = parseInt(days_per_week)
    if (!dpw || dpw < 2 || dpw > 6)   return res.status(400).json({ error: 'INVALID_DAYS_PER_WEEK' })

    const allExercisesRaw = db.prepare('SELECT * FROM exercise').all()
    const allExercises = allExercisesRaw.map(ex => ({
      ...ex,
      primary_muscles:    JSON.parse(ex.primary_muscles    || '[]'),
      secondary_muscles:  JSON.parse(ex.secondary_muscles  || '[]'),
      equipment_required: JSON.parse(ex.equipment_required || '[]'),
    }))

    let equipmentItems
    if (equipment_ids && equipment_ids.length > 0) {
      const placeholders = equipment_ids.map(() => '?').join(',')
      equipmentItems = db.prepare(
        `SELECT * FROM equipment_item WHERE id IN (${placeholders})`
      ).all(...equipment_ids)
    } else {
      equipmentItems = db.prepare('SELECT * FROM equipment_item').all()
    }

    const draft = generateProgram(
      { goal, level, days_per_week: dpw, duration_weeks, priority_muscles: priority_muscles || [], name },
      allExercises,
      equipmentItems
    )

    const programId = db.transaction(() => {
      const pResult = db.prepare(`
        INSERT INTO program
          (name, goal, level, days_per_week, duration_weeks, progression_model,
           use_exercise_rotation, deload_auto_enabled)
        VALUES (?,?,?,?,?,?,0,0)
      `).run(
        draft.name, draft.goal, draft.level, draft.days_per_week,
        draft.duration_weeks, draft.progression_model
      )
      const pid = pResult.lastInsertRowid

      for (let ti = 0; ti < draft.templates.length; ti++) {
        const tpl = draft.templates[ti]
        const tResult = db.prepare(`
          INSERT INTO workout_template (program_id, name, order_index)
          VALUES (?, ?, ?)
        `).run(pid, tpl.name, ti)
        const tid = tResult.lastInsertRowid

        for (let ei = 0; ei < tpl.exercises.length; ei++) {
          const ex = tpl.exercises[ei]
          const teResult = db.prepare(`
            INSERT INTO template_exercise
              (workout_template_id, exercise_id, order_index,
               target_sets, target_reps_min, target_reps_max, rest_seconds, progression_model)
            VALUES (?,?,?,?,?,?,?,?)
          `).run(tid, ex.exercise_id, ei,
            ex.target_sets, ex.target_reps_min, ex.target_reps_max,
            ex.rest_seconds, ex.progression_model || 'inherit')

          db.prepare(`
            INSERT INTO progression_state (template_exercise_id, current_weight_kg)
            VALUES (?, 0)
          `).run(teResult.lastInsertRowid)
        }
      }
      return pid
    })()

    const program = db.prepare('SELECT * FROM program WHERE id = ?').get(programId)
    const templates = db.prepare(
      'SELECT * FROM workout_template WHERE program_id = ? ORDER BY order_index'
    ).all(programId)
    for (const tpl of templates) {
      tpl.exercises = db.prepare(
        'SELECT * FROM template_exercise WHERE workout_template_id = ? ORDER BY order_index'
      ).all(tpl.id)
    }

    res.status(201).json({ ...parseProgram(program), templates })
  } catch (err) {
    console.error('[POST /programs/generate]', err.message)
    res.status(500).json({ error: 'INTERNAL_ERROR' })
  }
})

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

router.post('/', (req, res) => {
  try {
    const {
      name, description, goal, level, days_per_week, duration_weeks,
      use_exercise_rotation, rotation_frequency_weeks, progression_model,
      deload_auto_enabled, deload_frequency_weeks,
      deload_load_reduction_pct, deload_volume_reduction_pct,
    } = req.body

    if (!name?.trim()) return res.status(400).json({ error: 'MISSING_NAME' })
    const VALID_GOALS = ['strength','hypertrophy','endurance','weight_loss','general_fitness']
    if (!VALID_GOALS.includes(goal)) return res.status(400).json({ error: 'INVALID_GOAL' })
    const VALID_LEVELS = ['beginner','intermediate','advanced']
    if (!VALID_LEVELS.includes(level)) return res.status(400).json({ error: 'INVALID_LEVEL' })
    const dpw = parseInt(days_per_week)
    if (!dpw || dpw < 2 || dpw > 6) return res.status(400).json({ error: 'INVALID_DAYS_PER_WEEK' })

    const result = db.prepare(`
      INSERT INTO program
        (name, description, goal, level, days_per_week, duration_weeks,
         use_exercise_rotation, rotation_frequency_weeks, progression_model,
         deload_auto_enabled, deload_frequency_weeks,
         deload_load_reduction_pct, deload_volume_reduction_pct)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(
      name.trim(), description || null, goal, level, dpw,
      duration_weeks || null,
      use_exercise_rotation ? 1 : 0,
      rotation_frequency_weeks || 1,
      progression_model || 'double_progression',
      deload_auto_enabled ? 1 : 0,
      deload_frequency_weeks || 6,
      deload_load_reduction_pct || 20,
      deload_volume_reduction_pct || 40,
    )

    const created = db.prepare('SELECT * FROM program WHERE id = ?').get(result.lastInsertRowid)
    res.status(201).json(parseProgram(created))
  } catch (err) {
    console.error('[POST /programs]', err.message)
    res.status(500).json({ error: 'INTERNAL_ERROR' })
  }
})

router.post('/:programId/templates', (req, res) => {
  try {
    const prog = db.prepare('SELECT id FROM program WHERE id = ?').get(req.params.programId)
    if (!prog) return res.status(404).json({ error: 'PROGRAM_NOT_FOUND' })
    const { name, day_of_week, order_index } = req.body
    if (!name?.trim()) return res.status(400).json({ error: 'MISSING_NAME' })
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
      tpl.exercises = db.prepare(
        'SELECT * FROM template_exercise WHERE workout_template_id = ? ORDER BY order_index ASC'
      ).all(tpl.id)
    }

    res.json({ ...parseProgram(program), templates })
  } catch (err) {
    console.error('[GET /programs/:id]', err.message)
    res.status(500).json({ error: 'INTERNAL_ERROR' })
  }
})

router.put('/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT id FROM program WHERE id = ?').get(req.params.id)
    if (!existing) return res.status(404).json({ error: 'PROGRAM_NOT_FOUND' })

    const UPDATABLE = [
      'name','description','goal','level','days_per_week','duration_weeks',
      'use_exercise_rotation','rotation_frequency_weeks','progression_model',
      'deload_auto_enabled','deload_frequency_weeks',
      'deload_load_reduction_pct','deload_volume_reduction_pct',
    ]
    const updates = []; const values = []
    for (const f of UPDATABLE) {
      if (req.body[f] !== undefined) {
        updates.push(`${f} = ?`)
        values.push(req.body[f])
      }
    }
    if (updates.length === 0) return res.status(400).json({ error: 'NO_FIELDS_TO_UPDATE' })
    updates.push("updated_at = datetime('now')")
    values.push(req.params.id)
    db.prepare(`UPDATE program SET ${updates.join(', ')} WHERE id = ?`).run(...values)

    const updated = db.prepare('SELECT * FROM program WHERE id = ?').get(req.params.id)
    res.json(parseProgram(updated))
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
      return res.status(409).json({ error: 'CONFLICT', detail: 'Une séance est en cours.' })
    }

    db.prepare('DELETE FROM program WHERE id = ?').run(req.params.id)
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
      db.prepare("UPDATE program SET is_active = 1 WHERE id = ?").run(req.params.id)
    })()

    res.json({ message: 'Programme activé', program_id: parseInt(req.params.id) })
  } catch (err) {
    console.error('[POST /programs/:id/activate]', err.message)
    res.status(500).json({ error: 'INTERNAL_ERROR' })
  }
})

router.get('/:id/next-session', (req, res) => {
  try {
    const program = db.prepare('SELECT * FROM program WHERE id = ?').get(req.params.id)
    if (!program) return res.status(404).json({ error: 'PROGRAM_NOT_FOUND' })

    const templates = db.prepare(
      'SELECT * FROM workout_template WHERE program_id = ? ORDER BY order_index'
    ).all(program.id)
    if (templates.length === 0) return res.status(404).json({ error: 'NO_TEMPLATES' })

    const lastSession = db.prepare(
      "SELECT workout_template_id FROM session WHERE program_id = ? AND status = 'completed' ORDER BY completed_at DESC LIMIT 1"
    ).get(program.id)

    let nextTemplate
    if (!lastSession || !lastSession.workout_template_id) {
      nextTemplate = templates[0]
    } else {
      const lastIdx = templates.findIndex(t => t.id === lastSession.workout_template_id)
      nextTemplate = templates[(lastIdx + 1) % templates.length]
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
        ? 'Premier entraînement — commencez léger pour trouver votre charge.'
        : `Dernière charge : ${currentWeight} kg.`

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

    const today = new Date().toISOString().slice(0, 10)

    res.json({
      template_id:    nextTemplate.id,
      template_name:  nextTemplate.name,
      suggested_date: today,
      exercises,
    })
  } catch (err) {
    console.error('[GET /programs/:id/next-session]', err.message)
    res.status(500).json({ error: 'INTERNAL_ERROR' })
  }
})

export default router
