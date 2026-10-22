import { message } from '../utils/messages.js'

/**
 * Detect a progression plateau for an exercise.
 *
 * Algorithm: compare the estimated RM (Epley) of the most recent session
 * with the oldest session RM within the N-session window.
 * An improvement of ≤ 1% indicates a plateau.
 *
 * @param {string}  exerciseId  - Exercise ID
 * @param {number}  programId   - Program ID
 * @param {number}  n           - number of sessions to analyze (default 4)
 * @param {object}  db          - better-sqlite3 instance
 * @returns {{ is_plateau, sessions_checked, first_1rm?, current_1rm?, delta_pct?, reason }}
 */
export function detectPlateau(exerciseId, programId, n = 4, db) {
  const rows = db.prepare(`
    SELECT
      s.id      AS session_id,
      s.completed_at,
      MAX(sl.weight_kg * (1.0 + sl.reps / 30.0)) AS session_1rm
    FROM set_log sl
    JOIN session_exercise se ON sl.session_exercise_id = se.id
    JOIN session s            ON se.session_id = s.id
    WHERE se.exercise_id  = ?
      AND s.program_id    = ?
      AND s.status        = 'completed'
      AND sl.is_warmup    = 0
      AND sl.is_completed = 1
      AND sl.reps         > 0
      AND sl.weight_kg    > 0
    GROUP BY s.id
    ORDER BY s.completed_at DESC
    LIMIT ?
  `).all(exerciseId, programId, n)

  if (rows.length < n) {
    return {
      is_plateau: false,
      sessions_checked: rows.length,
      reason: message('plateau.insufficient_data', { sessions: rows.length, required: n }),
    }
  }

  // rows[0] = newest, rows[n-1] = oldest
  const currentRm = rows[0].session_1rm
  const firstRm   = rows[n - 1].session_1rm

  if (firstRm <= 0) {
    return { is_plateau: false, sessions_checked: n, reason: message('plateau.zero_reference') }
  }

  const deltaPct = ((currentRm - firstRm) / firstRm) * 100

  if (deltaPct <= 1.0) {  // 1% tolerance for load rounding
    return {
      is_plateau:       true,
      sessions_checked: n,
      first_1rm:        Math.round(firstRm * 100) / 100,
      current_1rm:      Math.round(currentRm * 100) / 100,
      delta_pct:        Math.round(deltaPct * 10) / 10,
    }
  }

  return {
    is_plateau:       false,
    sessions_checked: n,
    first_1rm:        Math.round(firstRm * 100) / 100,
    current_1rm:      Math.round(currentRm * 100) / 100,
    delta_pct:        Math.round(deltaPct * 10) / 10,
  }
}

/**
 * Check whether at least `minFraction` of a program's active exercises
 * have plateaued.
 *
 * @param {number}  programId    - Program ID
 * @param {number}  n            - session window
 * @param {number}  minFraction  - minimum fraction (e.g. 0.5 = 50%)
 * @param {object}  db
 * @returns {{ is_program_plateau, plateau_count, total_exercises }}
 */
export function detectProgramPlateau(programId, n, minFraction = 0.5, db) {
  const templateExercises = db.prepare(`
    SELECT te.id, te.exercise_id
    FROM template_exercise te
    JOIN workout_template wt ON te.workout_template_id = wt.id
    WHERE wt.program_id = ?
  `).all(programId)

  if (templateExercises.length === 0) {
    return { is_program_plateau: false, plateau_count: 0, total_exercises: 0 }
  }

  let plateauCount = 0
  for (const te of templateExercises) {
    const result = detectPlateau(te.exercise_id, programId, n, db)
    if (result.is_plateau) plateauCount++
  }

  return {
    is_program_plateau: plateauCount >= Math.ceil(templateExercises.length * minFraction),
    plateau_count:      plateauCount,
    total_exercises:    templateExercises.length,
  }
}
