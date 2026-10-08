// ── Helper : arrondir vers le bas à la charge atteignable la plus proche ──
export function roundDownToAchievable(targetWeight, achievableLoads) {
  if (!achievableLoads || achievableLoads.length === 0) return 0
  const valid = achievableLoads.filter(l => l <= targetWeight + 0.001)
  if (valid.length === 0) return achievableLoads[0]
  return valid[valid.length - 1]
}

// ── Résoudre le modèle effectif ──────────────────────────────────────────
export function resolveProgressionModel(templateExercise, program) {
  if (templateExercise.progression_model !== 'inherit') {
    return templateExercise.progression_model
  }
  return program?.progression_model || 'double_progression'
}

/**
 * Calcule le prochain état de progression après une séance.
 *
 * @param {object} state            - ProgressionState courant depuis la DB
 * @param {object[]} lastSessionSets - SetLog[] de la dernière séance
 *                                    (is_warmup=0, is_completed=1 uniquement)
 * @param {object} templateExercise  - TemplateExercise
 * @param {object} program           - Program (pour progression_model hérité)
 * @param {number[]} achievableLoads - Charges atteignables triées ASC
 * @param {object} settings          - { progression_failure_threshold,
 *                                       progression_weight_reduction_pct }
 * @returns {{ current_weight_kg, current_target_reps?, consecutive_failures, explanation }}
 */
export function computeNextState(
  state,
  lastSessionSets,
  templateExercise,
  program,
  achievableLoads,
  settings
) {
  const model = resolveProgressionModel(templateExercise, program)

  switch (model) {
    case 'linear':
      return linearProgression(state, lastSessionSets, templateExercise, achievableLoads, settings)
    case 'double_progression':
      return doubleProgression(state, lastSessionSets, templateExercise, achievableLoads, settings)
    case 'rpe_based':
      return rpeProgression(state, lastSessionSets, templateExercise, achievableLoads, settings)
    default:
      return doubleProgression(state, lastSessionSets, templateExercise, achievableLoads, settings)
  }
}

// ── Progression linéaire ─────────────────────────────────────────────────
function linearProgression(state, sets, te, achievable, settings) {
  const threshold   = settings.progression_failure_threshold  || 2
  const reductionPct = settings.progression_weight_reduction_pct || 10

  // Cible de reps : target_reps si défini, sinon target_reps_min
  const targetReps = te.target_reps || te.target_reps_min

  // Succès = toutes les séries prévues effectuées avec au moins targetReps reps
  const allOk = sets.length >= te.target_sets &&
    sets.every(s => s.reps >= targetReps)

  if (allOk) {
    // Déterminer l'incrément
    const increment = te.progression_weight_increment_kg
      || minIncrement(achievable)
      || 2.5

    const newW = roundDownToAchievable(state.current_weight_kg + increment, achievable)
    return {
      current_weight_kg:   newW,
      consecutive_failures: 0,
      explanation: `Objectif atteint (${sets.length}×${targetReps} reps). +${increment} kg → ${newW} kg.`,
    }
  }

  // Échec
  const fails = (state.consecutive_failures || 0) + 1
  if (fails >= threshold) {
    const newW = roundDownToAchievable(
      state.current_weight_kg * (1 - reductionPct / 100),
      achievable
    )
    return {
      current_weight_kg:   newW,
      consecutive_failures: 0,
      explanation: `${fails} échecs consécutifs. -${reductionPct}% → ${newW} kg.`,
    }
  }

  return {
    current_weight_kg:   state.current_weight_kg,
    consecutive_failures: fails,
    explanation: `Objectif non atteint (${fails}/${threshold}). Maintien ${state.current_weight_kg} kg.`,
  }
}

// ── Double progression ───────────────────────────────────────────────────
function doubleProgression(state, sets, te, achievable, settings) {
  const threshold    = settings.progression_failure_threshold  || 2
  const reductionPct = settings.progression_weight_reduction_pct || 10
  const minR = te.target_reps_min
  const maxR = te.target_reps_max
  const curTargetReps = state.current_target_reps || minR

  const completedSets = sets.length >= te.target_sets
  const minRepsDone   = completedSets
    ? Math.min(...sets.map(s => s.reps))
    : 0

  // Toutes les séries ≥ max_reps → augmenter le poids
  if (completedSets && minRepsDone >= maxR) {
    const increment = te.progression_weight_increment_kg
      || minIncrement(achievable)
      || 2.5
    const newW = roundDownToAchievable(state.current_weight_kg + increment, achievable)
    return {
      current_weight_kg:    newW,
      current_target_reps:  minR,
      consecutive_failures: 0,
      explanation: `Toutes séries ≥ ${maxR} reps. +${increment} kg → ${newW} kg. Retour à ${minR} reps.`,
    }
  }

  // Toutes les séries ≥ min_reps → augmenter les reps cibles
  if (completedSets && minRepsDone >= minR) {
    const newReps = Math.min(curTargetReps + 1, maxR)
    return {
      current_weight_kg:    state.current_weight_kg,
      current_target_reps:  newReps,
      consecutive_failures: 0,
      explanation: `Objectif atteint. Prochaine cible : ${newReps} reps à ${state.current_weight_kg} kg.`,
    }
  }

  // Échec
  const fails = (state.consecutive_failures || 0) + 1
  if (fails >= threshold) {
    const newW = roundDownToAchievable(
      state.current_weight_kg * (1 - reductionPct / 100),
      achievable
    )
    return {
      current_weight_kg:    newW,
      current_target_reps:  minR,
      consecutive_failures: 0,
      explanation: `${fails} échecs. Réduction à ${newW} kg, retour à ${minR} reps.`,
    }
  }

  return {
    current_weight_kg:    state.current_weight_kg,
    current_target_reps:  curTargetReps,
    consecutive_failures: fails,
    explanation: `Objectif non atteint (${fails}/${threshold}). Maintien ${state.current_weight_kg} kg.`,
  }
}

// ── Progression RPE ──────────────────────────────────────────────────────
function rpeProgression(state, sets, te, achievable, settings) {
  // Prendre le RPE de la dernière série complétée
  const completedSets = sets.filter(s => s.rpe !== null && s.rpe !== undefined)
  if (completedSets.length === 0) {
    return {
      current_weight_kg:    state.current_weight_kg,
      consecutive_failures: state.consecutive_failures,
      explanation: 'RPE non renseigné. Pas de changement.',
    }
  }

  const lastRpe    = completedSets[completedSets.length - 1].rpe
  const targetRpe  = te.rpe_target || 8.0
  const diff       = lastRpe - targetRpe

  // RPE très inférieur à la cible → augmenter le poids
  if (diff <= -1.0) {
    const pct  = 0.025 * Math.abs(diff)
    const newW = roundDownToAchievable(state.current_weight_kg * (1 + pct), achievable)
    return {
      current_weight_kg:    newW,
      consecutive_failures: 0,
      explanation: `RPE ${lastRpe} < cible ${targetRpe}. +${(pct * 100).toFixed(1)}% → ${newW} kg.`,
    }
  }

  // RPE très supérieur → réduire le poids
  if (diff >= 1.0) {
    const pct  = 0.025 * Math.abs(diff)
    const newW = roundDownToAchievable(state.current_weight_kg * (1 - pct), achievable)
    return {
      current_weight_kg:    newW,
      consecutive_failures: 0,
      explanation: `RPE ${lastRpe} > cible ${targetRpe}. -${(pct * 100).toFixed(1)}% → ${newW} kg.`,
    }
  }

  // RPE dans la cible ±1
  return {
    current_weight_kg:    state.current_weight_kg,
    consecutive_failures: 0,
    explanation: `RPE ${lastRpe} ≈ cible ${targetRpe}. Maintien ${state.current_weight_kg} kg.`,
  }
}

// ── Helper : incrément minimal d'une liste de charges ────────────────────
function minIncrement(loads) {
  if (!loads || loads.length <= 1) return 0
  let min = Infinity
  for (let i = 1; i < loads.length; i++) {
    const d = loads[i] - loads[i - 1]
    if (d > 0.001) min = Math.min(min, d)
  }
  return min === Infinity ? 0 : Math.round(min * 100) / 100
}
