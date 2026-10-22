import { message } from '../utils/messages.js'
// ── Helper: round down to the nearest achievable load ──
export function roundDownToAchievable(targetWeight, achievableLoads) {
  if (!achievableLoads || achievableLoads.length === 0) return 0
  const valid = achievableLoads.filter(l => l <= targetWeight + 0.001)
  if (valid.length === 0) return achievableLoads[0]
  return valid[valid.length - 1]
}

// ── Resolve the effective model ──────────────────────────────────────────
export function resolveProgressionModel(templateExercise, program) {
  if (templateExercise.progression_model !== 'inherit') {
    return templateExercise.progression_model
  }
  return program?.progression_model || 'double_progression'
}

/**
 * Calculate the next progression state after a session.
 *
 * @param {object} state            - current ProgressionState from the database
 * @param {object[]} lastSessionSets - SetLog[] from the last session
 *                                    (is_warmup=0, is_completed=1 only)
 * @param {object} templateExercise  - TemplateExercise
 * @param {object} program           - Program (for inherited progression_model)
 * @param {number[]} achievableLoads - Achievable loads sorted ASC
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
  // Bands provide a nominal resistance range, not discrete load increments.
  if (settings.resistance_is_approximate) achievableLoads = [state.current_weight_kg]
  const model = resolveProgressionModel(templateExercise, program)
  // Reaching the rep ceiling at failure is not a reason to add load immediately.
  if (model !== 'rpe_based' && lastSessionSets.length >= templateExercise.target_sets &&
      lastSessionSets.every(set=>set.reps >= templateExercise.target_reps_min) &&
      lastSessionSets.some(set=>(set.rpe != null && set.rpe >= 9.5) || (set.rir != null && set.rir <= 0))) {
    return {current_weight_kg:state.current_weight_kg,current_target_reps:state.current_target_reps ?? templateExercise.target_reps_min,
      consecutive_failures:0,explanation:message('progression.hold_at_limit')}
  }

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

// ── Linear progression ─────────────────────────────────────────────────
function linearProgression(state, sets, te, achievable, settings) {
  const threshold   = settings.progression_failure_threshold  || 2
  const reductionPct = settings.progression_weight_reduction_pct || 10

  // Rep target: target_reps if defined, otherwise target_reps_min
  const targetReps = te.target_reps || te.target_reps_min

  // Success = all planned sets completed with at least targetReps reps
  const allOk = sets.length >= te.target_sets &&
    sets.every(s => s.reps >= targetReps)

  if (allOk) {
    // Determine the increment
    const increment = te.progression_weight_increment_kg
      || minIncrement(achievable)
      || 2.5

    const newW = nextManageableLoad(state.current_weight_kg, increment, achievable)
    return {
      current_weight_kg:   newW,
      consecutive_failures: 0,
      explanation: newW > state.current_weight_kg
        ? message('progression.linear_increase', { sets: sets.length, targetReps: targetReps, weight: newW })
        : message('progression.hold_without_increment', { weight: newW }),
    }
  }

  // Failure
  const fails = (state.consecutive_failures || 0) + 1
  if (fails >= threshold) {
    const newW = Math.min(state.current_weight_kg, roundDownToAchievable(
      state.current_weight_kg * (1 - reductionPct / 100),
      achievable
    ))
    return {
      current_weight_kg:   newW,
      consecutive_failures: 0,
      explanation: message('progression.reduce_after_failures', { failures: fails, reductionPct: reductionPct, weight: newW }),
    }
  }

  return {
    current_weight_kg:   state.current_weight_kg,
    consecutive_failures: fails,
    explanation: message('progression.target_not_reached', { failures: fails, threshold: threshold, weight: state.current_weight_kg }),
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

  // All sets ≥ max_reps → increase weight
  if (completedSets && minRepsDone >= maxR) {
    const increment = te.progression_weight_increment_kg
      || minIncrement(achievable)
      || 2.5
    const newW = nextManageableLoad(state.current_weight_kg, increment, achievable)
    if (newW <= state.current_weight_kg + 0.001) {
      return { current_weight_kg:state.current_weight_kg,current_target_reps:maxR,consecutive_failures:0,
        explanation:message('progression.hold_at_rep_ceiling', { weight: state.current_weight_kg, maxReps: maxR }) }
    }
    return {
      current_weight_kg:    newW,
      current_target_reps:  minR,
      consecutive_failures: 0,
      explanation: message('progression.double_increase', { maxReps: maxR, increment: increment, weight: newW, minReps: minR }),
    }
  }

  // All sets ≥ min_reps → increase target reps
  if (completedSets && minRepsDone >= minR) {
    const newReps = Math.min(curTargetReps + 1, maxR)
    return {
      current_weight_kg:    state.current_weight_kg,
      current_target_reps:  newReps,
      consecutive_failures: 0,
      explanation: message('progression.increase_reps', { newReps: newReps, weight: state.current_weight_kg }),
    }
  }

  // Failure
  const fails = (state.consecutive_failures || 0) + 1
  if (fails >= threshold) {
    const newW = Math.min(state.current_weight_kg, roundDownToAchievable(
      state.current_weight_kg * (1 - reductionPct / 100),
      achievable
    ))
    return {
      current_weight_kg:    newW,
      current_target_reps:  minR,
      consecutive_failures: 0,
      explanation: message('progression.reset_reps_after_failures', { failures: fails, weight: newW, minReps: minR }),
    }
  }

  return {
    current_weight_kg:    state.current_weight_kg,
    current_target_reps:  curTargetReps,
    consecutive_failures: fails,
    explanation: message('progression.target_not_reached', { failures: fails, threshold: threshold, weight: state.current_weight_kg }),
  }
}

// ── RPE progression ──────────────────────────────────────────────────────
function rpeProgression(state, sets, te, achievable, settings) {
  // Use the RPE from the last completed set
  const completedSets = sets.filter(s => s.rpe !== null && s.rpe !== undefined)
  if (completedSets.length === 0) {
    return {
      current_weight_kg:    state.current_weight_kg,
      consecutive_failures: state.consecutive_failures,
      explanation: message('progression.missing_rpe'),
    }
  }

  const lastRpe    = completedSets[completedSets.length - 1].rpe
  const targetRpe  = te.rpe_target || 8.0
  const diff       = lastRpe - targetRpe

  // RPE well below target → increase weight
  if (diff <= -1.0 && sets.length >= te.target_sets && sets.every(set=>set.reps >= te.target_reps_min)) {
    const pct  = 0.025 * Math.abs(diff)
    const newW = nextManageableLoad(state.current_weight_kg, state.current_weight_kg*pct, achievable)
    return {
      current_weight_kg:    newW,
      consecutive_failures: 0,
      explanation: message('progression.rpe_increase', { lastRpe: lastRpe, targetRpe: targetRpe, changePct: (pct * 100).toFixed(1), weight: newW }),
    }
  }

  // RPE well above target → reduce weight
  if (diff >= 1.0) {
    const pct  = 0.025 * Math.abs(diff)
    const newW = Math.min(state.current_weight_kg,roundDownToAchievable(state.current_weight_kg * (1 - pct), achievable))
    return {
      current_weight_kg:    newW,
      consecutive_failures: 0,
      explanation: message('progression.rpe_decrease', { lastRpe: lastRpe, targetRpe: targetRpe, changePct: (pct * 100).toFixed(1), weight: newW }),
    }
  }

  // RPE within target ±1
  return {
    current_weight_kg:    state.current_weight_kg,
    consecutive_failures: 0,
    explanation: message('progression.rpe_hold', { lastRpe: lastRpe, targetRpe: targetRpe, weight: state.current_weight_kg }),
  }
}

// ── Helper: minimum increment in a list of loads ────────────────────
function minIncrement(loads) {
  if (!loads || loads.length <= 1) return 0
  let min = Infinity
  for (let i = 1; i < loads.length; i++) {
    const d = loads[i] - loads[i - 1]
    if (d > 0.001) min = Math.min(min, d)
  }
  return min === Infinity ? 0 : Math.round(min * 100) / 100
}

// Avoid a sudden jump caused by a sparse inventory (e.g. 10 → 20 kg).
// One kilogram is allowed for light exercises; otherwise cap automatic increases at 10%.
function nextManageableLoad(current,increment,loads) {
  const next=roundDownToAchievable(current+increment,loads)
  return next > current && next-current <= Math.max(1,current*.1)+.001 ? next : current
}
