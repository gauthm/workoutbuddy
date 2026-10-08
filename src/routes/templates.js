import express from 'express'
import { getDb } from '../db/database.js'

const db = getDb()

function parseTemplateExercise(row) {
  if (!row) return null
  return { ...row }
}

const templatesRouter = express.Router()

templatesRouter.get('/:id', (req, res) => {
  try {
    const tpl = db.prepare('SELECT * FROM workout_template WHERE id = ?').get(req.params.id)
    if (!tpl) return res.status(404).json({ error: 'TEMPLATE_NOT_FOUND' })
    tpl.exercises = db.prepare(
      'SELECT * FROM template_exercise WHERE workout_template_id = ? ORDER BY order_index'
    ).all(tpl.id)
    res.json(tpl)
  } catch (err) {
    console.error('[GET /templates/:id]', err.message)
    res.status(500).json({ error: 'INTERNAL_ERROR' })
  }
})

templatesRouter.put('/:id', (req, res) => {
  try {
    const tpl = db.prepare('SELECT id FROM workout_template WHERE id = ?').get(req.params.id)
    if (!tpl) return res.status(404).json({ error: 'TEMPLATE_NOT_FOUND' })
    const { name, day_of_week, order_index } = req.body
    const updates = []; const values = []
    if (name !== undefined)       { updates.push('name = ?');        values.push(name.trim()) }
    if (day_of_week !== undefined) { updates.push('day_of_week = ?'); values.push(day_of_week) }
    if (order_index !== undefined) { updates.push('order_index = ?'); values.push(order_index) }
    if (updates.length === 0) return res.status(400).json({ error: 'NO_FIELDS_TO_UPDATE' })
    values.push(req.params.id)
    db.prepare(`UPDATE workout_template SET ${updates.join(', ')} WHERE id = ?`).run(...values)
    res.json(db.prepare('SELECT * FROM workout_template WHERE id = ?').get(req.params.id))
  } catch (err) {
    console.error('[PUT /templates/:id]', err.message)
    res.status(500).json({ error: 'INTERNAL_ERROR' })
  }
})

templatesRouter.delete('/:id', (req, res) => {
  try {
    const tpl = db.prepare('SELECT id FROM workout_template WHERE id = ?').get(req.params.id)
    if (!tpl) return res.status(404).json({ error: 'TEMPLATE_NOT_FOUND' })
    db.prepare('DELETE FROM workout_template WHERE id = ?').run(req.params.id)
    res.status(204).end()
  } catch (err) {
    console.error('[DELETE /templates/:id]', err.message)
    res.status(500).json({ error: 'INTERNAL_ERROR' })
  }
})

templatesRouter.post('/:id/exercises', (req, res) => {
  try {
    const tpl = db.prepare('SELECT id FROM workout_template WHERE id = ?').get(req.params.id)
    if (!tpl) return res.status(404).json({ error: 'TEMPLATE_NOT_FOUND' })

    const { exercise_id, order_index, target_sets, target_reps_min, target_reps_max,
            target_reps, rest_seconds, progression_model, progression_weight_increment_kg,
            rir_target, rpe_target, rotation_group, notes } = req.body

    if (!exercise_id) return res.status(400).json({ error: 'MISSING_EXERCISE_ID' })
    const ex = db.prepare('SELECT id FROM exercise WHERE id = ?').get(exercise_id)
    if (!ex) return res.status(404).json({ error: 'EXERCISE_NOT_FOUND' })

    const teResult = db.prepare(`
      INSERT INTO template_exercise
        (workout_template_id, exercise_id, order_index, target_sets,
         target_reps_min, target_reps_max, target_reps, rest_seconds,
         progression_model, progression_weight_increment_kg,
         rir_target, rpe_target, rotation_group, notes)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(
      parseInt(req.params.id), exercise_id,
      order_index ?? 0, target_sets ?? 3,
      target_reps_min ?? 8, target_reps_max ?? 12, target_reps ?? null,
      rest_seconds ?? 90, progression_model ?? 'inherit',
      progression_weight_increment_kg ?? null,
      rir_target ?? null, rpe_target ?? null,
      rotation_group ?? null, notes ?? null
    )

    db.prepare(
      'INSERT INTO progression_state (template_exercise_id, current_weight_kg) VALUES (?,0)'
    ).run(teResult.lastInsertRowid)

    const te = db.prepare('SELECT * FROM template_exercise WHERE id = ?').get(teResult.lastInsertRowid)
    res.status(201).json(parseTemplateExercise(te))
  } catch (err) {
    console.error('[POST /templates/:id/exercises]', err.message)
    res.status(500).json({ error: 'INTERNAL_ERROR' })
  }
})

const templateExercisesRouter = express.Router()

templateExercisesRouter.put('/reorder', (req, res) => {
  try {
    const { items } = req.body
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'MISSING_ITEMS' })
    }
    const update = db.prepare(
      'UPDATE template_exercise SET order_index = ? WHERE id = ?'
    )
    db.transaction(() => {
      for (const item of items) update.run(item.order_index, item.id)
    })()
    res.json({ updated: items.length })
  } catch (err) {
    console.error('[PUT /template-exercises/reorder]', err.message)
    res.status(500).json({ error: 'INTERNAL_ERROR' })
  }
})

templateExercisesRouter.put('/:id', (req, res) => {
  try {
    const te = db.prepare('SELECT id FROM template_exercise WHERE id = ?').get(req.params.id)
    if (!te) return res.status(404).json({ error: 'TEMPLATE_EXERCISE_NOT_FOUND' })

    const UPDATABLE = [
      'order_index','target_sets','target_reps_min','target_reps_max','target_reps',
      'rest_seconds','progression_model','progression_weight_increment_kg',
      'rir_target','rpe_target','rotation_group','notes',
    ]
    const updates = []; const values = []
    for (const f of UPDATABLE) {
      if (req.body[f] !== undefined) { updates.push(`${f} = ?`); values.push(req.body[f]) }
    }
    if (updates.length === 0) return res.status(400).json({ error: 'NO_FIELDS_TO_UPDATE' })
    values.push(req.params.id)
    db.prepare(`UPDATE template_exercise SET ${updates.join(', ')} WHERE id = ?`).run(...values)
    res.json(parseTemplateExercise(db.prepare('SELECT * FROM template_exercise WHERE id = ?').get(req.params.id)))
  } catch (err) {
    console.error('[PUT /template-exercises/:id]', err.message)
    res.status(500).json({ error: 'INTERNAL_ERROR' })
  }
})

templateExercisesRouter.delete('/:id', (req, res) => {
  try {
    const te = db.prepare('SELECT id FROM template_exercise WHERE id = ?').get(req.params.id)
    if (!te) return res.status(404).json({ error: 'TEMPLATE_EXERCISE_NOT_FOUND' })
    db.prepare('DELETE FROM template_exercise WHERE id = ?').run(req.params.id)
    res.status(204).end()
  } catch (err) {
    console.error('[DELETE /template-exercises/:id]', err.message)
    res.status(500).json({ error: 'INTERNAL_ERROR' })
  }
})

export { templatesRouter, templateExercisesRouter }
