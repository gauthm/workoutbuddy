import express from 'express'
import { getDb } from '../db/database.js'

const router = express.Router()
const db     = getDb()

// Champs modifiables avec leurs types et contraintes
const PROFILE_SCHEMA = {
  display_name:              { type: 'string_nullable' },
  age:                       { type: 'number', min: 10, max: 100 },
  sex:                       { type: 'enum', enum: ['male','female','other','prefer_not_to_say'] },
  weight_kg:                 { type: 'number', min: 20, max: 500 },
  height_cm:                 { type: 'number', min: 50, max: 280 },
  fitness_level:             { type: 'enum', enum: ['beginner','intermediate','advanced','athlete'] },
  primary_goal:              { type: 'enum', enum: ['strength','hypertrophy','endurance','weight_loss','general_fitness','sport_performance'] },
  secondary_goals:           { type: 'json_array' },
  target_weight_kg:          { type: 'number_nullable', min: 20, max: 500 },
  sport_practiced:           { type: 'string_nullable' },
  sessions_per_week:         { type: 'number', min: 1, max: 7 },
  session_duration_min:      { type: 'number', min: 15, max: 240 },
  prefers_exercise_variation:{ type: 'boolean_int' },
  injury_notes:              { type: 'string_nullable' },
  medical_notes:             { type: 'string_nullable' },
  onboarding_completed:      { type: 'boolean_int' },
  onboarding_step:           { type: 'string' },
}

function parseProfile(row) {
  if (!row) return null
  return {
    ...row,
    secondary_goals:           JSON.parse(row.secondary_goals || '[]'),
    prefers_exercise_variation: row.prefers_exercise_variation === 1,
    onboarding_completed:       row.onboarding_completed === 1,
  }
}

function validateField(key, value) {
  const schema = PROFILE_SCHEMA[key]
  if (!schema) return { valid: false, error: `Champ inconnu : ${key}` }

  if (value === null || value === undefined) {
    if (['string_nullable','number_nullable'].includes(schema.type)) return { valid: true }
    if (schema.type !== 'json_array') return { valid: false, error: `${key} ne peut pas être null.` }
  }

  switch (schema.type) {
    case 'string':
    case 'string_nullable':
      if (value !== null && typeof value !== 'string') return { valid: false, error: `${key} doit être une chaîne.` }
      break
    case 'number':
    case 'number_nullable': {
      if (value === null) break
      const n = Number(value)
      if (isNaN(n)) return { valid: false, error: `${key} doit être un nombre.` }
      if (schema.min !== undefined && n < schema.min) return { valid: false, error: `${key} ≥ ${schema.min}.` }
      if (schema.max !== undefined && n > schema.max) return { valid: false, error: `${key} ≤ ${schema.max}.` }
      break
    }
    case 'enum':
      if (!schema.enum.includes(value)) return { valid: false, error: `${key} : valeurs valides = ${schema.enum.join(', ')}.` }
      break
    case 'boolean_int':
      if (![0, 1, true, false].includes(value)) return { valid: false, error: `${key} doit être 0, 1, true ou false.` }
      break
    case 'json_array':
      if (!Array.isArray(value)) return { valid: false, error: `${key} doit être un tableau.` }
      break
  }
  return { valid: true }
}

// ── GET /user-profile ─────────────────────────────────────────
router.get('/', (req, res) => {
  try {
    const row = db.prepare('SELECT * FROM user_profile WHERE id = 1').get()
    res.json(parseProfile(row))
  } catch (err) {
    console.error('[GET /user-profile]', err.message)
    res.status(500).json({ error: 'INTERNAL_ERROR' })
  }
})

// ── PUT /user-profile ─────────────────────────────────────────
// Met à jour les champs fournis (patch partiel)
router.put('/', (req, res) => {
  try {
    const body = req.body
    if (!body || typeof body !== 'object') {
      return res.status(400).json({ error: 'INVALID_BODY' })
    }

    const errors = []; const updates = []; const values = []

    for (const [key, value] of Object.entries(body)) {
      const r = validateField(key, value)
      if (!r.valid) { errors.push(r.error); continue }

      // Sérialiser selon le type
      let dbValue = value
      if (PROFILE_SCHEMA[key]?.type === 'json_array') dbValue = JSON.stringify(value)
      if (PROFILE_SCHEMA[key]?.type === 'boolean_int') dbValue = (value === true || value === 1) ? 1 : 0

      updates.push(`${key} = ?`)
      values.push(dbValue)
    }

    if (errors.length > 0) return res.status(400).json({ error: 'VALIDATION_ERRORS', details: errors })
    if (updates.length === 0) return res.status(400).json({ error: 'NO_FIELDS_TO_UPDATE' })

    updates.push("updated_at = datetime('now')")
    values.push(1)  // id=1 singleton

    db.prepare(`UPDATE user_profile SET ${updates.join(', ')} WHERE id = ?`).run(...values)

    const updated = db.prepare('SELECT * FROM user_profile WHERE id = 1').get()
    res.json(parseProfile(updated))
  } catch (err) {
    console.error('[PUT /user-profile]', err.message)
    res.status(500).json({ error: 'INTERNAL_ERROR' })
  }
})

export default router
