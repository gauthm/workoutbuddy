import { message } from '../utils/messages.js'
import { detectProgramPlateau } from './plateauDetector.js'

/**
 * Determine whether a program should enter a deload.
 *
 * Two triggers:
 * 1. Scheduled deload: N weeks elapsed since the last deload
 * 2. Plateau: ≥ 50% of exercises plateaued over `plateau_sessions` sessions
 *
 * @param {object}  program   - row from the `program` table
 * @param {object}  settings  - parsed settings (key→value object)
 * @param {object}  db
 * @returns {{ should: bool, reason?: 'scheduled'|'plateau', detail?: string }}
 */
export function shouldDeload(program, settings, db, now = new Date()) {
  if (program.is_in_deload) {
    return { should: false }
  }

  // ── Trigger 1: scheduled deload ──────────────────────────────
  if (program.deload_auto_enabled) {
    const freqWeeks = program.deload_frequency_weeks || 6
    const refDate   = program.last_deload_date || program.started_on || program.created_at
    const weeksSince = weeksBetween(refDate, now.toISOString())

    if (weeksSince >= freqWeeks) {
      return {
        should: true,
        reason: 'scheduled',
        detail: message('deload.scheduled', { weeksSince: weeksSince, freqWeeks: freqWeeks }),
      }
    }
  }

  // ── Trigger 2: persistent plateau ───────────────────────────
  const plateauSessions = settings.plateau_detection_sessions || 4
  const result = detectProgramPlateau(program.id, plateauSessions, 0.5, db)

  if (result.is_program_plateau) {
    return {
      should: true,
      reason: 'plateau',
      detail: message('deload.plateau', { plateauCount: result.plateau_count, totalExercises: result.total_exercises, plateauSessions: plateauSessions }),
    }
  }

  return { should: false }
}

/**
 * Calculate deload session targets for a template_exercise.
 *
 * Rules:
 * - Weight    : current_weight_kg × (1 - load_reduction_pct / 100)
 * - Sets      : max(deload_min_sets, round(target_sets × (1 - volume_reduction_pct / 100)))
 * - Reps      : target_reps_min (lower bound)
 *
 * @param {object}  templateExercise  - template_exercise row
 * @param {object}  progressionState  - progression_state row
 * @param {object}  program           - program row
 * @param {object}  settings          - parsed settings
 * @param {number[]} achievableLoads  - achievable loads
 * @returns {{ weight_kg, sets, reps_min, reps_max }}
 */
export function computeDeloadTargets(
  templateExercise,
  progressionState,
  program,
  settings,
  achievableLoads
) {
  const loadPct   = program.deload_load_reduction_pct   || 20
  const volPct    = program.deload_volume_reduction_pct || 40
  const minSets   = settings.deload_min_sets            || 2

  const targetW = progressionState.current_weight_kg * (1 - loadPct / 100)

  // Round down to the nearest achievable load
  let weight
  if (achievableLoads && achievableLoads.length > 0) {
    const valid = achievableLoads.filter(l => l <= targetW + 0.001)
    weight = valid.length > 0 ? valid[valid.length - 1] : achievableLoads[0]
  } else {
    weight = Math.round(targetW * 100) / 100
  }

  weight = Math.min(progressionState.current_weight_kg,weight)

  const targetSets = Math.max(
    minSets,
    Math.round(templateExercise.target_sets * (1 - volPct / 100))
  )

  return {
    weight_kg: weight,
    sets:      targetSets,
    reps_min:  templateExercise.target_reps_min,
    reps_max:  templateExercise.target_reps_min,  // range narrowed to the minimum
  }
}

// ── Helper: number of weeks between two ISO dates ────────────────────
function weeksBetween(dateA, dateB) {
  const a = new Date(dateA.slice(0, 10))
  const b = new Date(dateB.slice(0, 10))
  const diffMs   = Math.abs(b - a)
  const diffDays = diffMs / (1000 * 60 * 60 * 24)
  return Math.floor(diffDays / 7)
}
