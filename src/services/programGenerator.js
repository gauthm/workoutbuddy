import { PROGRAM_MUSCLES } from '../../public/js/utils/programMuscles.js'
import { isExerciseRestricted } from './exerciseConstraints.js'
import { generationCandidate } from './programExerciseCatalog.js'
import { isEquipmentAvailable } from './rotationEngine.js'
import { calculateAchievableLoads } from './equipmentCalc.js'

const SPLIT_TEMPLATES = {
  full_body_2: [
    { name: 'Full Body A', muscles: ['chest','back','quads','shoulders','biceps','triceps'] },
    { name: 'Full Body B', muscles: ['back','chest','hamstrings','glutes','shoulders','core'] },
  ],
  full_body_3: [
    { name: 'Full Body A', muscles: ['chest','back','quads','shoulders'] },
    { name: 'Full Body B', muscles: ['back','chest','hamstrings','glutes'] },
    { name: 'Full Body C', muscles: ['shoulders','chest','back','quads','core'] },
  ],
  push_pull_legs: [
    { name: 'Push',  muscles: ['chest','shoulders','triceps'] },
    { name: 'Pull',  muscles: ['back','biceps','traps'] },
    { name: 'Legs',  muscles: ['quads','hamstrings','glutes','calves'] },
  ],
  upper_lower: [
    { name: 'Upper A', muscles: ['chest','back','shoulders','biceps','triceps'] },
    { name: 'Lower A', muscles: ['quads','hamstrings','glutes','calves'] },
    { name: 'Upper B', muscles: ['back','chest','shoulders','triceps','biceps'] },
    { name: 'Lower B', muscles: ['hamstrings','glutes','quads','core'] },
  ],
  upper_lower_x5: [
    { name: 'Upper A', muscles: ['chest','back','shoulders','biceps','triceps'] },
    { name: 'Lower A', muscles: ['quads','hamstrings','glutes','calves'] },
    { name: 'Upper B', muscles: ['back','chest','shoulders','triceps','biceps'] },
    { name: 'Lower B', muscles: ['hamstrings','glutes','quads','core'] },
    { name: 'Full Body', muscles: ['chest','back','quads','shoulders','core'] },
  ],
  ppl_x2: [
    { name: 'Push A',  muscles: ['chest','shoulders','triceps'] },
    { name: 'Pull A',  muscles: ['back','biceps','traps'] },
    { name: 'Legs A',  muscles: ['quads','hamstrings','glutes','calves'] },
    { name: 'Push B',  muscles: ['shoulders','chest','triceps'] },
    { name: 'Pull B',  muscles: ['back','traps','biceps'] },
    { name: 'Legs B',  muscles: ['hamstrings','glutes','quads','core'] },
  ],
}

const SETS_REPS = {
  strength: {
    compound:  { sets: 5, rmin: 3, rmax: 5,  rest: 180 },
    isolation: { sets: 3, rmin: 6, rmax: 8,  rest: 90  },
  },
  hypertrophy: {
    compound:  { sets: 4, rmin: 6, rmax: 10, rest: 120 },
    isolation: { sets: 3, rmin: 10, rmax: 15, rest: 90 },
  },
  endurance: {
    compound:  { sets: 3, rmin: 15, rmax: 20, rest: 60 },
    isolation: { sets: 3, rmin: 15, rmax: 20, rest: 60 },
  },
  weight_loss: {
    compound:  { sets: 3, rmin: 12, rmax: 15, rest: 60 },
    isolation: { sets: 3, rmin: 12, rmax: 15, rest: 60 },
  },
  general_fitness: {
    compound:  { sets: 3, rmin: 8, rmax: 12, rest: 90  },
    isolation: { sets: 3, rmin: 10, rmax: 15, rest: 75 },
  },
}

const DEFAULT_MODEL = {
  strength: 'linear', hypertrophy: 'double_progression',
  endurance: 'double_progression', weight_loss: 'double_progression',
  general_fitness: 'double_progression',
}

function selectSplit(daysPerWeek) {
  if (daysPerWeek === 2) return 'full_body_2'
  if (daysPerWeek === 3) return 'full_body_3'
  if (daysPerWeek === 4) return 'upper_lower'
  if (daysPerWeek === 5) return 'upper_lower_x5'
  return 'ppl_x2'
}

export const PROGRAM_GOALS = Object.keys(SETS_REPS)
export const PROGRAM_LEVELS = ['beginner', 'intermediate', 'advanced']
export const PRIORITY_MUSCLES = PROGRAM_MUSCLES

export function validateProgramParams(params) {
  if (!params || typeof params !== 'object' || Array.isArray(params)) return ['parameters']
  const errors = []
  if (!PROGRAM_GOALS.includes(params.goal)) errors.push('goal')
  if (!PROGRAM_LEVELS.includes(params.level)) errors.push('level')
  if (!Number.isInteger(params.days_per_week) || params.days_per_week < 2 || params.days_per_week > 6) errors.push('days_per_week')
  if (params.training_days !== undefined && (!Array.isArray(params.training_days) || params.training_days.length !== params.days_per_week || new Set(params.training_days).size !== params.training_days.length || params.training_days.some(day => !Number.isInteger(day) || day < 0 || day > 6))) errors.push('training_days')
  if (![20,30,45,60,90].includes(params.session_duration_min)) errors.push('session_duration_min')
  if (params.duration_weeks !== null && (!Number.isSafeInteger(params.duration_weeks) || params.duration_weeks < 1)) errors.push('duration_weeks')
  if (!['fr','en'].includes(params.language || 'fr')) errors.push('language')
  if (params.name !== undefined && (typeof params.name !== 'string' || params.name.length > 100)) errors.push('name')
  for (const [key,min,max] of [['weight_kg',20,500],['height_cm',50,280]]) {
    if (params[key] !== undefined && params[key] !== null && (typeof params[key] !== 'number' || !Number.isFinite(params[key]) || params[key] < min || params[key] > max)) errors.push(key)
  }
  const muscles = params.priority_muscles || []
  if (!Array.isArray(muscles) || muscles.length > PRIORITY_MUSCLES.length || new Set(muscles).size !== muscles.length || muscles.some(m => !PRIORITY_MUSCLES.includes(m))) errors.push('priority_muscles')
  return errors
}

// Estimates include general warm-up, execution, rest between sets and exercise changes.
export function estimateSessionMinutes(exercises) {
  return Math.ceil(5 + exercises.reduce((minutes, ex) =>
    minutes + 1 + ex.target_sets * ex.target_reps_max * 3 / 60 * (ex.is_unilateral ? 2 : 1) +
      (ex.target_sets - 1) * ex.rest_seconds / 60, 0))
}

const BASE_EXERCISES = ['bodyweight_squat','pushups','pullups','chin_up','crunches','barbell_bench_press_medium_grip',
  'barbell_squat','dumbbell_squat','dumbbell_bench_press','one_arm_dumbbell_row','lat_pulldown','seated_cable_rows']

// Prefer usable external resistance, while leaving useful bodyweight movements in
// the pool. A bench supports a movement; it does not itself make it loaded.
const RESISTANCE_EQUIPMENT = new Set(['dumbbell_fixed','dumbbell_loadable','dumbbell_adjustable',
  'barbell','ez_bar','kettlebell','resistance_band','cable_machine','lat_pulldown','seated_row',
  'leg_press','leg_extension','leg_curl','chest_press','shoulder_press','calf_machine','smith_machine'])
function equipmentPreference(exercise) {
  const loaded=exercise.equipment_required.some(category=>RESISTANCE_EQUIPMENT.has(category))
  return loaded ? 24 + (exercise.equipment_required.includes('bench_adjustable') ? 6 : 0) : 0
}

export function generateProgram(params, allExercises, equipmentItems, painfulMuscles=[]) {
  const { goal, level, days_per_week, priority_muscles = [] } = params
  const budget = params.session_duration_min || 60
  const available = allExercises.map(ex => generationCandidate(ex,level)).filter(ex => ex && !ex.is_excluded && !isExerciseRestricted(ex,painfulMuscles) &&
    (!ex.category || ex.category === 'strength') && isEquipmentAvailable(ex.equipment_required, equipmentItems) &&
    calculateAchievableLoads(equipmentItems, ex).loads_kg.length > 0)
  const warnings = []
  const weeklyExposure = new Map()
  const templates = SPLIT_TEMPLATES[selectSplit(days_per_week)].map((definition, ti) => {
    const maxExercises = level === 'beginner' ? 8 : 10
    const selected = []
    const used = new Set()
    const covered = new Set()
    let muscles = [...definition.muscles]
    // Each full-body workout includes upper body and lower body before accessories.
    if (days_per_week <= 3) {
      const main = ['chest','back',ti % 2 ? 'hamstrings' : 'quads',ti % 2 ? 'quads' : 'hamstrings']
      main.sort((a,b) => Number(priority_muscles.includes(b)) - Number(priority_muscles.includes(a)))
      muscles = [...main,...priority_muscles.filter(m=>!main.includes(m)),'shoulders','core']
    } else muscles.sort((a,b) => Number(priority_muscles.includes(b)) - Number(priority_muscles.includes(a)))
    for (const muscle of [...new Set(muscles)]) {
      if (selected.length >= maxExercises) break
      if (covered.has(muscle) && !priority_muscles.includes(muscle)) continue
      const candidates = available.filter(ex => ex.primary_muscles.includes(muscle) && !used.has(ex.id))
      const score = ex => {
        const patternCount = selected.filter(item => item.pattern === ex.movement_pattern && ex.movement_pattern !== 'other').length
        const familiarity = BASE_EXERCISES.includes(ex.id) ? 12 : 0
        const coverage = ex.primary_muscles.filter(m => !covered.has(m)).length * 5
        return familiarity + coverage + (ex.mechanic === 'compound' ? 24 : 0) + equipmentPreference(ex) - patternCount * 20 -
          (weeklyExposure.get(ex.id) || 0) * 18 - (ex.is_unilateral ? 2 : 0)
      }
      candidates.sort((a,b) => score(b) - score(a) || a.id.localeCompare(b.id, 'en'))
      const exercise = candidates[0]
      if (!exercise) { warnings.push({ code: 'muscle_unavailable', muscle }); continue }
      const cfg = SETS_REPS[goal]?.[exercise.mechanic === 'compound' ? 'compound' : 'isolation'] || SETS_REPS.general_fitness.compound
      let sets = level === 'beginner' ? Math.min(3, Math.max(2, cfg.sets - 1)) : cfg.sets
      if (priority_muscles.includes(muscle) && level !== 'beginner') sets = Math.min(5, sets + 1)
      const item = { exercise_id: exercise.id, is_unilateral:exercise.is_unilateral, target_sets: sets, target_reps_min: level === 'beginner' && goal === 'strength' ? 8 : cfg.rmin,
        target_reps_max: level === 'beginner' && goal === 'strength' ? 12 : cfg.rmax, rest_seconds: cfg.rest, progression_model: 'inherit', rir_target: 2 }
      while (item.target_sets > 2 && estimateSessionMinutes([...selected, item]) > budget) item.target_sets--
      if (estimateSessionMinutes([...selected, item]) > budget) continue
      selected.push({ ...item, pattern: exercise.movement_pattern, is_unilateral:exercise.is_unilateral })
      used.add(exercise.id)
      exercise.primary_muscles.forEach(m => covered.add(m))
      weeklyExposure.set(exercise.id, (weeklyExposure.get(exercise.id) || 0) + 1)
    }
    // Use the requested time without adding unlimited volume. Keep beginner sessions
    // bounded and add relevant accessories only after the core movement coverage.
    const desired = budget * .9
    const maxSets = level === 'beginner' ? 3 : level === 'intermediate' ? 4 : 5
    const allowedMuscles = days_per_week <= 3 ? PRIORITY_MUSCLES : definition.muscles
    while (selected.length && estimateSessionMinutes(selected) < desired) {
      const order = [...selected].sort((a,b) => {
        const priority = item => available.find(ex=>ex.id===item.exercise_id).primary_muscles.some(m=>priority_muscles.includes(m))
        return Number(priority(b))-Number(priority(a)) || a.target_sets-b.target_sets
      })
      const grow = order.find(item=>item.target_sets < maxSets && estimateSessionMinutes(
        selected.map(ex=>ex===item ? {...ex,target_sets:ex.target_sets+1} : ex)) <= budget)
      if (grow) { grow.target_sets++; continue }
      if (selected.length >= maxExercises) break
      const candidates = available.filter(ex=>!used.has(ex.id) && ex.primary_muscles.some(m=>allowedMuscles.includes(m)) &&
        (!['push_horizontal','push_vertical','pull_horizontal','pull_vertical'].includes(ex.movement_pattern) ||
          !selected.some(item=>item.pattern === ex.movement_pattern)))
      const score = ex => ex.primary_muscles.filter(m=>priority_muscles.includes(m)).length*8 +
        ex.primary_muscles.filter(m=>!covered.has(m)).length*5 + equipmentPreference(ex) -
        selected.filter(item=>item.pattern===ex.movement_pattern).length*10 - (weeklyExposure.get(ex.id)||0)*8
      candidates.sort((a,b)=>score(b)-score(a) || a.id.localeCompare(b.id,'en'))
      let added = false
      for (const ex of candidates) {
        const cfg=SETS_REPS[goal][ex.mechanic === 'compound' ? 'compound' : 'isolation']
        const item={exercise_id:ex.id,is_unilateral:ex.is_unilateral,target_sets:2,target_reps_min:level === 'beginner' && goal === 'strength' ? 8 : cfg.rmin,target_reps_max:level === 'beginner' && goal === 'strength' ? 12 : cfg.rmax,
          rest_seconds:cfg.rest,progression_model:'inherit',rir_target:2,pattern:ex.movement_pattern}
        if (estimateSessionMinutes([...selected,item]) > budget) continue
        selected.push(item);used.add(ex.id);ex.primary_muscles.forEach(m=>covered.add(m))
        weeklyExposure.set(ex.id,(weeklyExposure.get(ex.id)||0)+1);added=true;break
      }
      if (!added) break
    }
    if (selected.length && estimateSessionMinutes(selected) < desired) warnings.push({code:'duration_limited',muscle:''})
    const namesEn = { 'Full Body':'Full body', Upper:'Upper body', Lower:'Lower body', Push:'Push', Pull:'Pull', Legs:'Legs' }
    const namesFr = { 'Full Body':'Corps entier', Upper:'Haut du corps', Lower:'Bas du corps', Push:'Poussée', Pull:'Tirage', Legs:'Jambes' }
    const labels = params.language === 'en' ? namesEn : namesFr
    let name = definition.name
    for (const [key,value] of Object.entries(labels)) name = name.replace(key,value)
    return { name, day_of_week: params.training_days ? [...params.training_days].sort((a,b)=>a-b)[ti] : null, estimated_duration_min: estimateSessionMinutes(selected),
      exercises: selected.map(({ pattern, is_unilateral, ...item }) => item) }
  })
  if (templates.some(t => !t.exercises.length)) throw new Error('NO_AVAILABLE_EXERCISES')
  const goalNames = params.language === 'en'
    ? { strength:'Strength', hypertrophy:'Muscle growth', endurance:'Endurance', weight_loss:'Weight loss', general_fitness:'General fitness' }
    : { strength:'Force', hypertrophy:'Prise de muscle', endurance:'Endurance', weight_loss:'Perte de poids', general_fitness:'Forme générale' }
  const actualMuscles = new Set(templates.flatMap(t => t.exercises.flatMap(item => available.find(e => e.id === item.exercise_id).primary_muscles)))
  for (const muscle of priority_muscles) if (!actualMuscles.has(muscle)) warnings.push({ code:'priority_not_covered', muscle })
  return { name: params.name?.trim() || `${goalNames[goal]} · ${days_per_week} ${params.language === 'en' ? 'days/week' : 'j/sem'}`,
    goal, level, days_per_week, duration_weeks: params.duration_weeks === null ? null : params.duration_weeks || 8,
    progression_model: level === 'beginner' ? 'double_progression' : DEFAULT_MODEL[goal] || 'double_progression', use_exercise_rotation: 0,
    deload_auto_enabled: 1, templates,
    warnings: [...new Map(warnings.map(w => [w.code + w.muscle,w])).values()] }
}
