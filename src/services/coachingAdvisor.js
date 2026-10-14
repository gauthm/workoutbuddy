import { calculateAchievableLoads } from './equipmentCalc.js'
import { detectPlateau }            from './plateauDetector.js'

const ALL_MUSCLES = [
  'chest','back','shoulders','biceps','triceps',
  'quads','hamstrings','glutes','calves','core','traps','forearms',
]

/**
 * Lance tous les contrôles de signaux pour le programme actif.
 * Retourne le nombre de nouveaux conseils créés en DB.
 *
 * Signaux détectés :
 * Équipement : max_load_reached, min_increment_too_large, no_exercise_available,
 *              no_rotation_possible, persistent_plateau
 * Coaching   : performance_plateau (plateau multi-exercices), high_fatigue (RPE élevé),
 *              low_volume (volume insuffisant)
 */
export function runAllSignalChecks(db, settings) {
  const activeProgram = db.prepare("SELECT * FROM program WHERE is_active=1 LIMIT 1").get()
  if (!activeProgram) return 0

  const equipmentItems  = db.prepare('SELECT * FROM equipment_item').all()
  const activeAdvice    = db.prepare("SELECT * FROM equipment_advice WHERE status='active'").all()

  const cooldownDays    = settings.equipment_advice_cooldown_days      || 14
  const maxLoadSessions = settings.equipment_advice_max_load_sessions  || 3
  const minIncrPct      = settings.equipment_advice_min_increment_pct  || 5
  const plateauSessions = settings.equipment_advice_plateau_sessions   || 6
  const detSessions     = settings.plateau_detection_sessions          || 4

  const templateExercises = db.prepare(`
    SELECT te.*, e.primary_muscles, e.equipment_required, e.is_unilateral, e.name_fr, e.name_en,
           e.movement_pattern
    FROM template_exercise te
    JOIN workout_template wt ON te.workout_template_id = wt.id
    JOIN exercise e ON te.exercise_id = e.id
    WHERE wt.program_id = ?
  `).all(activeProgram.id).map(te => ({
    ...te,
    primary_muscles:    JSON.parse(te.primary_muscles    || '[]'),
    equipment_required: JSON.parse(te.equipment_required || '[]'),
  }))

  let created = 0

  // ── SIGNAUX ÉQUIPEMENT ───────────────────────────────────────

  // Signal 1 : Charge max atteinte
  for (const te of templateExercises) {
    if (isOnCooldown('max_load_reached', te.exercise_id, null, activeAdvice, cooldownDays)) continue
    const loads = calculateAchievableLoads(equipmentItems, { equipment_required: te.equipment_required, is_unilateral: te.is_unilateral })
    if (!loads.loads_kg.length || loads.max_load_kg <= 0) continue

    const recentSets = db.prepare(`
      SELECT MIN(sl.weight_kg) AS weight_kg, MIN(sl.reps) AS reps, te2.target_reps_max
      FROM set_log sl
      JOIN session_exercise se ON sl.session_exercise_id = se.id
      JOIN session s           ON se.session_id = s.id
      JOIN template_exercise te2 ON se.template_exercise_id = te2.id
      WHERE se.exercise_id=? AND s.program_id=? AND s.status='completed'
        AND sl.is_warmup=0 AND sl.is_completed=1 AND te2.id=?
      GROUP BY s.id
      ORDER BY s.completed_at DESC, s.id DESC LIMIT ?
    `).all(te.exercise_id, activeProgram.id, te.id, maxLoadSessions)

    if (recentSets.length < maxLoadSessions) continue
    const allAtMax = recentSets.every(s => s.weight_kg >= loads.max_load_kg * 0.99)
    const allExceeded = recentSets.every(s => s.reps >= (s.target_reps_max || te.target_reps_max))

    if (allAtMax && allExceeded) {
      const avgReps = recentSets.reduce((s, r) => s + r.reps, 0) / recentSets.length
      insertAdvice(db, 'max_load_reached', te.exercise_id, null, null, {
        type: 'max_load_reached', exercise_id: te.exercise_id, exercise_name_fr: te.name_fr, exercise_name_en: te.name_en,
        max_load_kg: loads.max_load_kg, resistance_is_approximate: !!loads.resistance_is_approximate, equipment_required: te.equipment_required, sessions_checked: maxLoadSessions,
        target_reps_max: te.target_reps_max, actual_reps_avg: Math.round(avgReps * 10) / 10,
      })
      created++
    }
  }

  // Advance notice based on the last distinct completed sessions, never a promised date.
  for (const te of templateExercises) {
    if (isOnCooldown('equipment_limit_approaching', te.exercise_id, null, activeAdvice, cooldownDays)) continue
    const loads = calculateAchievableLoads(equipmentItems, te)
    if (loads.max_load_kg <= 0) continue
    const history = db.prepare(`
      SELECT s.id, MAX(sl.weight_kg) AS weight_kg
      FROM set_log sl JOIN session_exercise se ON sl.session_exercise_id=se.id
      JOIN session s ON se.session_id=s.id
      WHERE se.template_exercise_id=? AND s.program_id=? AND s.status='completed'
        AND sl.is_completed=1 AND sl.is_warmup=0
      GROUP BY s.id ORDER BY s.completed_at DESC, s.id DESC LIMIT 4
    `).all(te.id, activeProgram.id).reverse()
    const forecast = forecastEquipmentLimit(loads, history)
    if (!forecast) continue
    if (insertAdvice(db, 'equipment_limit_approaching', te.exercise_id, null, null, {
      type: 'equipment_limit_approaching', exercise_id: te.exercise_id, exercise_name_fr: te.name_fr, exercise_name_en: te.name_en,
      equipment_required: te.equipment_required, max_load_kg: loads.max_load_kg, ...forecast,
    })) created++
  }

  // Signal 2 : Incrément trop grand + plateau
  for (const te of templateExercises) {
    if (isOnCooldown('min_increment_too_large', te.exercise_id, null, activeAdvice, cooldownDays)) continue
    const state = db.prepare('SELECT * FROM progression_state WHERE template_exercise_id=?').get(te.id)
    if (!state || state.current_weight_kg <= 0) continue
    const loads = calculateAchievableLoads(equipmentItems, { equipment_required: te.equipment_required, is_unilateral: te.is_unilateral })
    if (loads.min_increment_kg <= 0) continue
    const pct = (loads.min_increment_kg / state.current_weight_kg) * 100
    if (pct > minIncrPct) {
      const plateau = detectPlateau(te.exercise_id, activeProgram.id, detSessions, db)
      if (!plateau.is_plateau) continue
      insertAdvice(db, 'min_increment_too_large', te.exercise_id, null, null, {
        type: 'min_increment_too_large', exercise_id: te.exercise_id, exercise_name_fr: te.name_fr, exercise_name_en: te.name_en,
        equipment_required: te.equipment_required, min_increment_kg: loads.min_increment_kg, current_weight_kg: state.current_weight_kg, pct: Math.round(pct * 10) / 10,
      })
      created++
    }
  }

  // Signal 3 : Aucun exercice pour un muscle
  for (const muscle of ALL_MUSCLES) {
    if (isOnCooldown('no_exercise_available', null, muscle, activeAdvice, cooldownDays)) continue
    const candidates = db.prepare("SELECT * FROM exercise WHERE primary_muscles LIKE ? AND category='strength' AND is_excluded = 0").all(`%"${muscle}"%`)
    const feasible = candidates.filter(ex => {
      const req = JSON.parse(ex.equipment_required || '[]')
      if (!req.length) return true
      return calculateAchievableLoads(equipmentItems, { equipment_required: req, is_unilateral: ex.is_unilateral }).loads_kg.length > 0
    })
    if (feasible.length === 0) {
      insertAdvice(db, 'no_exercise_available', null, muscle, null, { type: 'no_exercise_available', muscle_group: muscle })
      created++
    }
  }

  // Signal 4 : Rotation impossible
  if (activeProgram.use_exercise_rotation) {
    for (const te of templateExercises) {
      if (!te.rotation_group) continue
      if (isOnCooldown('no_rotation_possible', te.exercise_id, null, activeAdvice, cooldownDays)) continue
      const baseEx = db.prepare('SELECT * FROM exercise WHERE id=?').get(te.exercise_id)
      if (!baseEx) continue
      const basePrimary = JSON.parse(baseEx.primary_muscles || '[]')
      const candidates = db.prepare('SELECT * FROM exercise WHERE movement_pattern=? AND id!=?').all(baseEx.movement_pattern, te.exercise_id).filter(ex => {
        const muscles = JSON.parse(ex.primary_muscles || '[]')
        const req     = JSON.parse(ex.equipment_required || '[]')
        return muscles.some(m => basePrimary.includes(m)) &&
               calculateAchievableLoads(equipmentItems, { equipment_required: req, is_unilateral: ex.is_unilateral }).loads_kg.length > 0
      })
      if (candidates.length === 0) {
        insertAdvice(db, 'no_rotation_possible', te.exercise_id, null, null, {
          type: 'no_rotation_possible', exercise_id: te.exercise_id, rotation_group: te.rotation_group, exercise_name_fr: te.name_fr, exercise_name_en: te.name_en,
        })
        created++
      }
    }
  }

  // Signal 5 : Plateau persistant avec incrément trop grand
  for (const te of templateExercises) {
    if (isOnCooldown('persistent_plateau', te.exercise_id, null, activeAdvice, cooldownDays)) continue
    const plateau = detectPlateau(te.exercise_id, activeProgram.id, plateauSessions, db)
    if (!plateau.is_plateau) continue
    const state = db.prepare('SELECT * FROM progression_state WHERE template_exercise_id=?').get(te.id)
    if (!state || state.current_weight_kg <= 0) continue
    const loads = calculateAchievableLoads(equipmentItems, { equipment_required: te.equipment_required, is_unilateral: te.is_unilateral })
    const pct   = loads.min_increment_kg > 0 ? (loads.min_increment_kg / state.current_weight_kg) * 100 : 0
    if (pct <= minIncrPct) continue
    insertAdvice(db, 'persistent_plateau', te.exercise_id, null, null, {
      type: 'persistent_plateau', exercise_id: te.exercise_id, exercise_name_fr: te.name_fr, exercise_name_en: te.name_en,
      sessions_checked: plateauSessions, min_increment_kg: loads.min_increment_kg,
      current_weight_kg: state.current_weight_kg, delta_pct: plateau.delta_pct,
    })
    created++
  }

  // ── SIGNAUX COACHING ─────────────────────────────────────────

  // Signal 6 : Fatigue élevée (RPE moyen > 9 sur 3 séances consécutives)
  if (!isOnCooldown('high_fatigue', null, null, activeAdvice, 7)) {
    const recentRPE = db.prepare(`
      SELECT AVG(sl.rpe) as avg_rpe, COUNT(*) as n
      FROM set_log sl
      JOIN session_exercise se ON sl.session_exercise_id = se.id
      JOIN session s ON se.session_id = s.id
      WHERE s.program_id=? AND s.status='completed' AND sl.rpe IS NOT NULL
        AND s.completed_at >= datetime('now', '-21 days')
    `).get(activeProgram.id)
    if (recentRPE?.n >= 10 && recentRPE.avg_rpe >= 8.5) {
      insertAdvice(db, 'high_fatigue', null, null, null, {
        type: 'high_fatigue', avg_rpe: Math.round(recentRPE.avg_rpe * 10) / 10,
        sets_analyzed: recentRPE.n, message: 'RPE moyen élevé sur les 3 dernières semaines.',
      })
      created++
    }
  }

  return created
}

// ── Helpers ───────────────────────────────────────────────────

function isOnCooldown(signalType, exerciseId, muscleGroup, activeAdvice, cooldownDays) {
  for (const a of activeAdvice) {
    if (a.signal_type !== signalType) continue
    if (exerciseId  !== null && a.exercise_id  !== exerciseId)  continue
    if (muscleGroup !== null && a.muscle_group !== muscleGroup) continue
    const diffDays = (Date.now() - new Date(a.last_generated_at).getTime()) / 86400000
    if (diffDays < cooldownDays) return true
  }
  return false
}

function insertAdvice(db, signalType, exerciseId, muscleGroup, movementPattern, signalData) {
  try {
    const result = db.prepare(`
      INSERT OR IGNORE INTO equipment_advice
        (signal_type, exercise_id, muscle_group, movement_pattern, signal_data, status, last_generated_at)
      VALUES (?,?,?,?,?,'active',datetime('now'))
    `).run(signalType, exerciseId||null, muscleGroup||null, movementPattern||null, JSON.stringify(signalData))
    return result.changes > 0
  } catch (err) {
    console.warn('[coachingAdvisor] insertAdvice:', err.message)
    return false
  }
}

/** A short trend estimate, not a calendar prediction. Bands have no fixed kg increment. */
export function forecastEquipmentLimit(loads, history) {
  if (history.length < 3 || loads.max_load_kg <= 0) return null
  const weights = history.map(s => s.weight_kg)
  if (!weights.every(w => Number.isFinite(w) && w > 0)) return null
  const current = weights.at(-1)
  if (current >= loads.max_load_kg) return null
  const deltas = weights.slice(1).map((w,i) => w - weights[i])
  if (deltas.some(d => d < 0) || !deltas.some(d => d > 0)) return null
  if (loads.resistance_is_approximate) return current >= loads.max_load_kg * .85
    ? {current_weight_kg: current, resistance_is_approximate: true, estimated_sessions: null} : null
  const average = deltas.reduce((a,b) => a+b,0) / deltas.length
  const sessions = Math.ceil((loads.max_load_kg - current) / average)
  return sessions <= 3 ? {current_weight_kg: current, average_gain_kg: Math.round(average*100)/100, estimated_sessions: sessions, resistance_is_approximate: false} : null
}
