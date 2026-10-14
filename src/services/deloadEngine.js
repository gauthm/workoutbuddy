import { detectProgramPlateau } from './plateauDetector.js'

/**
 * Détermine si un programme doit passer en deload.
 *
 * Deux déclencheurs :
 * 1. Deload planifié : N semaines écoulées depuis le dernier deload
 * 2. Plateau : ≥ 50% des exercices en plateau sur `plateau_sessions` séances
 *
 * @param {object}  program   - ligne de la table `program`
 * @param {object}  settings  - settings parsés (objet clé→valeur)
 * @param {object}  db
 * @returns {{ should: bool, reason?: 'scheduled'|'plateau', detail?: string }}
 */
export function shouldDeload(program, settings, db, now = new Date()) {
  if (program.is_in_deload) {
    return { should: false }
  }

  // ── Déclencheur 1 : deload planifié ──────────────────────────────
  if (program.deload_auto_enabled) {
    const freqWeeks = program.deload_frequency_weeks || 6
    const refDate   = program.last_deload_date || program.started_on || program.created_at
    const weeksSince = weeksBetween(refDate, now.toISOString())

    if (weeksSince >= freqWeeks) {
      return {
        should: true,
        reason: 'scheduled',
        detail: `${weeksSince} semaines depuis le dernier deload (fréquence : ${freqWeeks}).`,
      }
    }
  }

  // ── Déclencheur 2 : plateau persistant ───────────────────────────
  const plateauSessions = settings.plateau_detection_sessions || 4
  const result = detectProgramPlateau(program.id, plateauSessions, 0.5, db)

  if (result.is_program_plateau) {
    return {
      should: true,
      reason: 'plateau',
      detail: `${result.plateau_count}/${result.total_exercises} exercices en plateau sur ${plateauSessions} séances.`,
    }
  }

  return { should: false }
}

/**
 * Calcule les objectifs d'une séance de deload pour un template_exercise.
 *
 * Règles :
 * - Poids     : current_weight_kg × (1 - load_reduction_pct / 100)
 * - Séries    : max(deload_min_sets, round(target_sets × (1 - volume_reduction_pct / 100)))
 * - Reps      : target_reps_min (fourchette basse)
 *
 * @param {object}  templateExercise  - ligne template_exercise
 * @param {object}  progressionState  - ligne progression_state
 * @param {object}  program           - ligne program
 * @param {object}  settings          - settings parsés
 * @param {number[]} achievableLoads  - charges atteignables
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

  // Arrondir vers le bas à la charge atteignable la plus proche
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
    reps_max:  templateExercise.target_reps_min,  // fourchette resserrée au minimum
  }
}

// ── Helper : nombre de semaines entre deux dates ISO ────────────────────
function weeksBetween(dateA, dateB) {
  const a = new Date(dateA.slice(0, 10))
  const b = new Date(dateB.slice(0, 10))
  const diffMs   = Math.abs(b - a)
  const diffDays = diffMs / (1000 * 60 * 60 * 24)
  return Math.floor(diffDays / 7)
}
