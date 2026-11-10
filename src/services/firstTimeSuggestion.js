import { message } from '../utils/messages.js'
import { calculateAchievableLoads, roundDownToAchievable } from './equipmentCalc.js'

// Keep load conventions comparable: no conversion between bars, per-dumbbell loads,
// bodyweight, bands or machines with unknown leverage.
function loadFamily(exercise) {
  const equipment = exercise.equipment_required
  const supports = ['bench','bench_adjustable','bench_decline','preacher_bench','rack','chair','plyo_box','press_board','plate']
  const families = new Set()
  for (const category of equipment) {
    if (supports.includes(category)) continue
    if (['dumbbell_fixed','dumbbell_adjustable','dumbbell_loadable'].includes(category)) families.add('dumbbell')
    else if (['barbell','ez_bar','kettlebell'].includes(category)) families.add(category)
    else return null
  }
  return families.size===1 ? [...families][0] : null
}

/** Use actual performance on a compatible variation before the generic profile estimate. */
export function suggestFirstTimeWithHistory(db, exercise, profile, template, equipment) {
  const fallback = () => suggestFirstTime(exercise, profile, template, equipment)
  const row = db.prepare('SELECT * FROM exercise WHERE id=?').get(exercise.id)
  if (!row) return fallback()
  const target = {...row, equipment_required:JSON.parse(row.equipment_required), primary_muscles:JSON.parse(row.primary_muscles)}
  const family = loadFamily(target)
  if (!family || !target.movement_pattern || !target.primary_muscles.length) return fallback()

  const history = db.prepare(`SELECT e.*,se.id AS session_exercise_id,s.completed_at,s.id AS session_id,
      MIN(sl.weight_kg) AS performed_weight,MIN(sl.reps) AS performed_reps
    FROM exercise e JOIN session_exercise se ON se.exercise_id=e.id
    JOIN session s ON s.id=se.session_id JOIN set_log sl ON sl.session_exercise_id=se.id
    WHERE e.id!=? AND s.status='completed' AND s.is_deload=0
      AND sl.is_completed=1 AND sl.is_warmup=0 AND sl.reps>0
    GROUP BY se.id ORDER BY s.completed_at DESC,s.id DESC,se.id DESC`).all(target.id)
  const seen = new Set()
  const source = history.find(row => {
    if (seen.has(row.id)) return false
    seen.add(row.id)
    const candidate = {...row,equipment_required:JSON.parse(row.equipment_required),primary_muscles:JSON.parse(row.primary_muscles)}
    return candidate.performed_weight>0 && candidate.performed_reps<=30 &&
      candidate.category===target.category && candidate.movement_pattern===target.movement_pattern &&
      candidate.mechanic===target.mechanic && candidate.force===target.force &&
      !!candidate.is_unilateral===!!target.is_unilateral && loadFamily(candidate)===family &&
      candidate.primary_muscles[0]===target.primary_muscles[0]
  })
  if (!source) return fallback()

  const reps = template?.target_reps_min || fallback().reps
  // Estimated rep conversion, then a 20% reduction for an unfamiliar variation.
  const estimate = source.performed_weight*(1+source.performed_reps/30)/(1+reps/30)*0.8
  const loads = calculateAchievableLoads(equipment,target).loads_kg.filter(w => w>0 && w<=estimate+0.001)
  if (!loads.length) return fallback()
  const weight = roundDownToAchievable(estimate,loads)
  return {weight_kg:weight,reps,reasoning:message('suggestion.similar_exercise', {
    exercise:source.name_fr || source.name_en,weightKg:weight,reps,
  })}
}

/**
 * First-attempt suggestion table.
 * [goal][level][mechanic] = { pct: % of body weight, reps: suggested repetitions }
 * pct = 0 for bodyweight exercises (no external load)
 */
const FIRST_TIME_TABLE = {
  strength: {
    beginner:     { compound: { pct: 0.30, reps: 5  }, isolation: { pct: 0.12, reps: 8  } },
    intermediate: { compound: { pct: 0.50, reps: 5  }, isolation: { pct: 0.20, reps: 8  } },
    advanced:     { compound: { pct: 0.65, reps: 5  }, isolation: { pct: 0.28, reps: 8  } },
    athlete:      { compound: { pct: 0.80, reps: 3  }, isolation: { pct: 0.35, reps: 6  } },
  },
  hypertrophy: {
    beginner:     { compound: { pct: 0.25, reps: 10 }, isolation: { pct: 0.10, reps: 12 } },
    intermediate: { compound: { pct: 0.40, reps: 10 }, isolation: { pct: 0.18, reps: 12 } },
    advanced:     { compound: { pct: 0.55, reps: 8  }, isolation: { pct: 0.25, reps: 12 } },
    athlete:      { compound: { pct: 0.70, reps: 8  }, isolation: { pct: 0.30, reps: 10 } },
  },
  endurance: {
    beginner:     { compound: { pct: 0.20, reps: 15 }, isolation: { pct: 0.08, reps: 15 } },
    intermediate: { compound: { pct: 0.30, reps: 15 }, isolation: { pct: 0.15, reps: 15 } },
    advanced:     { compound: { pct: 0.40, reps: 15 }, isolation: { pct: 0.20, reps: 15 } },
    athlete:      { compound: { pct: 0.50, reps: 12 }, isolation: { pct: 0.25, reps: 12 } },
  },
  weight_loss: {
    beginner:     { compound: { pct: 0.22, reps: 12 }, isolation: { pct: 0.09, reps: 15 } },
    intermediate: { compound: { pct: 0.35, reps: 12 }, isolation: { pct: 0.15, reps: 15 } },
    advanced:     { compound: { pct: 0.48, reps: 12 }, isolation: { pct: 0.20, reps: 12 } },
    athlete:      { compound: { pct: 0.55, reps: 12 }, isolation: { pct: 0.25, reps: 12 } },
  },
  general_fitness: {
    beginner:     { compound: { pct: 0.25, reps: 10 }, isolation: { pct: 0.10, reps: 12 } },
    intermediate: { compound: { pct: 0.38, reps: 10 }, isolation: { pct: 0.16, reps: 12 } },
    advanced:     { compound: { pct: 0.50, reps: 10 }, isolation: { pct: 0.22, reps: 12 } },
    athlete:      { compound: { pct: 0.60, reps: 10 }, isolation: { pct: 0.28, reps: 10 } },
  },
  sport_performance: {
    beginner:     { compound: { pct: 0.35, reps: 6  }, isolation: { pct: 0.15, reps: 10 } },
    intermediate: { compound: { pct: 0.55, reps: 5  }, isolation: { pct: 0.22, reps: 8  } },
    advanced:     { compound: { pct: 0.70, reps: 4  }, isolation: { pct: 0.30, reps: 8  } },
    athlete:      { compound: { pct: 0.85, reps: 3  }, isolation: { pct: 0.38, reps: 6  } },
  },
}

// Reps for bodyweight exercises (no external load)
const BODYWEIGHT_REPS = {
  strength:         { beginner: 3,  intermediate: 5,  advanced: 8,  athlete: 12 },
  hypertrophy:      { beginner: 5,  intermediate: 8,  advanced: 12, athlete: 15 },
  endurance:        { beginner: 10, intermediate: 15, advanced: 20, athlete: 25 },
  weight_loss:      { beginner: 8,  intermediate: 12, advanced: 15, athlete: 20 },
  general_fitness:  { beginner: 6,  intermediate: 10, advanced: 15, athlete: 20 },
  sport_performance:{ beginner: 5,  intermediate: 8,  advanced: 12, athlete: 15 },
}

/**
 * Calculate suggested weight and reps for a first-time exercise.
 *
 * DETERMINISTIC algorithm — no LLM calls.
 *
 * @param {object} exercise      - { id, mechanic, equipment_required, is_unilateral }
 * @param {object} userProfile   - { weight_kg, fitness_level, primary_goal }
 * @param {object} templateExercise - { target_reps_min, target_reps_max }
 * @param {object[]} equipmentItems - complete inventory
 * @returns {{
 *   weight_kg: number,
 *   reps: number,
 *   reasoning: string     // text displayed in the tooltip
 * }}
 */
export function suggestFirstTime(exercise, userProfile, templateExercise, equipmentItems) {
  const bodyweightKg = userProfile?.weight_kg || 70
  const level        = userProfile?.fitness_level || 'beginner'
  const goal         = userProfile?.primary_goal  || 'general_fitness'
  const mechanic     = exercise.mechanic === 'compound' ? 'compound' : 'isolation'

  // ── Exercise without external load (bodyweight) ───────────
  const isBodyweight = !exercise.equipment_required ||
                       exercise.equipment_required.length === 0

  if (isBodyweight) {
    const reps = (BODYWEIGHT_REPS[goal] || BODYWEIGHT_REPS.general_fitness)[level] || 8
    // Use the template rep range when available
    const templateReps = templateExercise?.target_reps_min || reps
    return {
      weight_kg: 0,
      reps:      templateReps,
      reasoning: buildReasoning(goal, level, mechanic, 0, templateReps, bodyweightKg, true),
    }
  }

  // ── Exercise with external load ─────────────────────────────────────
  const table = (FIRST_TIME_TABLE[goal] || FIRST_TIME_TABLE.general_fitness)[level]
  const config = table?.[mechanic] || { pct: 0.25, reps: 10 }

  // Bilateral dumbbell weights are logged per hand, not as the pair's total.
  const pairedDumbbells = exercise.equipment_required?.some(c=>c.startsWith('dumbbell')) && !exercise.is_unilateral
  const rawWeight   = bodyweightKg * config.pct / (pairedDumbbells ? 2 : 1)
  const loadsResult = calculateAchievableLoads(equipmentItems, exercise)

  let weight
  if (loadsResult.loads_kg.length === 0) {
    // No load available (missing equipment)
    weight = 0
  } else {
    weight = roundDownToAchievable(rawWeight, loadsResult.loads_kg)
    // Use the suggested load even when it is the minimum available
    if (weight <= 0) weight = loadsResult.loads_kg[0]
  }

  // Use the template rep range when available
  const reps = templateExercise?.target_reps_min || config.reps

  return {
    weight_kg: weight,
    reps,
    reasoning: buildReasoning(goal, level, mechanic, weight, reps, bodyweightKg, false),
  }
}

/**
 * Build the explanation text for the tooltip.
 */
function buildReasoning(goal, level, mechanic, weightKg, reps, bodyweightKg, isBodyweight) {
  const goalLabels = {
    strength: message('suggestion.goal_strength'), hypertrophy: message('suggestion.goal_hypertrophy'), endurance: 'endurance',
    weight_loss: message('suggestion.goal_weight_loss'), general_fitness: message('suggestion.goal_general_fitness'),
    sport_performance: message('suggestion.goal_sport_performance'),
  }
  const levelLabels = {
    beginner: message('suggestion.level_beginner'), intermediate: message('suggestion.level_intermediate'),
    advanced: message('suggestion.level_advanced'), athlete: message('suggestion.level_athlete'),
  }
  const mechanicLabel = mechanic === 'compound' ? message('suggestion.mechanic_compound') : 'isolation'

  if (isBodyweight) {
    return message('suggestion.introduction', { level: levelLabels[level] || level, goal: goalLabels[goal] || goal }) +
           message('suggestion.bodyweight', { reps: reps }) +
           message('suggestion.adjust_by_feel')
  }

  const pct = Math.round((weightKg / bodyweightKg) * 100)
  return message('suggestion.introduction', { level: levelLabels[level] || level, goal: goalLabels[goal] || goal }) +
         message('suggestion.weighted', { mechanic: mechanicLabel, weightKg: weightKg, pct: pct, reps: reps }) +
         message('suggestion.conservative_load')
}
