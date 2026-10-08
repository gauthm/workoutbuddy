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

function selectSplit(daysPerWeek, goal, level) {
  if (daysPerWeek === 2) return 'full_body_2'
  if (daysPerWeek === 3 && level === 'beginner') return 'full_body_3'
  if (daysPerWeek === 3) return 'push_pull_legs'
  if (daysPerWeek === 4) return 'upper_lower'
  if (daysPerWeek === 5) return 'upper_lower_x5'
  return 'ppl_x2'
}

/**
 * Vérifie si un exercice est réalisable avec l'inventaire disponible.
 * Applique les règles de sous-type :
 *   bench_adjustable satisfait 'bench'
 *   dumbbell_loadable satisfait 'dumbbell_fixed'
 *   dumbbell_fixed / dumbbell_adjustable / dumbbell_loadable satisfait 'dumbbell'
 *
 * @param {string[]} equipmentRequired - liste des catégories requises par l'exercice
 * @param {object[]} equipmentItems    - inventaire complet
 * @returns {boolean}
 */
function isEquipmentAvailable(equipmentRequired, equipmentItems) {
  if (!equipmentRequired || equipmentRequired.length === 0) return true

  // Construire l'ensemble des catégories disponibles avec sous-types
  const available = new Set(equipmentItems.map(i => i.category))

  // bench_adjustable → satisfait bench
  if (available.has('bench_adjustable')) available.add('bench')

  // dumbbell_loadable → satisfait dumbbell_fixed
  if (available.has('dumbbell_loadable')) available.add('dumbbell_fixed')

  // Toute forme d'haltère → satisfait les autres formes pour la disponibilité
  if (
    available.has('dumbbell_fixed') ||
    available.has('dumbbell_adjustable') ||
    available.has('dumbbell_loadable')
  ) {
    available.add('dumbbell_fixed')
    available.add('dumbbell_adjustable')
    available.add('dumbbell_loadable')
  }

  return equipmentRequired.every(req => available.has(req))
}

export function generateProgram(params, allExercises, equipmentItems) {
  const { goal, level, days_per_week, duration_weeks, priority_muscles = [] } = params

  // Exclure les exercices désactivés en premier — avant toute autre logique
  const availableExercises = allExercises.filter(ex => !ex.is_excluded)

  const splitKey = selectSplit(days_per_week, goal, level)
  const templateDefs = SPLIT_TEMPLATES[splitKey]

  const templates = []

  for (const tdef of templateDefs) {
    let muscles = [...tdef.muscles]
    for (const pm of [...priority_muscles].reverse()) {
      if (muscles.includes(pm)) {
        muscles = [pm, ...muscles.filter(m => m !== pm)]
      }
    }

    const exercises = []
    const usedExercises = new Set()

    for (const muscle of muscles) {
      const candidates = availableExercises.filter(ex =>
        ex.primary_muscles.includes(muscle) &&
        isEquipmentAvailable(ex.equipment_required, equipmentItems) &&
        !usedExercises.has(ex.id)
      )
      if (candidates.length === 0) continue

      const preferred = candidates.filter(e => e.mechanic === 'compound')
      const selected = preferred.length > 0 ? preferred[0] : candidates[0]

      const mechanic = selected.mechanic === 'compound' ? 'compound' : 'isolation'
      const cfg = SETS_REPS[goal]?.[mechanic] || SETS_REPS.general_fitness.compound

      const sets = level === 'beginner' ? Math.max(2, cfg.sets - 1) : cfg.sets

      exercises.push({
        exercise_id:   selected.id,
        target_sets:   sets,
        target_reps_min: cfg.rmin,
        target_reps_max: cfg.rmax,
        rest_seconds:  cfg.rest,
        progression_model: 'inherit',
      })
      usedExercises.add(selected.id)

      if (priority_muscles.includes(muscle) && goal === 'hypertrophy') {
        const isolations = candidates.filter(e =>
          e.mechanic === 'isolation' && !usedExercises.has(e.id)
        )
        if (isolations.length > 0) {
          const iso = isolations[0]
          const isoCfg = SETS_REPS[goal].isolation
          exercises.push({
            exercise_id:     iso.id,
            target_sets:     level === 'beginner' ? 2 : isoCfg.sets,
            target_reps_min: isoCfg.rmin,
            target_reps_max: isoCfg.rmax,
            rest_seconds:    isoCfg.rest,
            progression_model: 'inherit',
          })
          usedExercises.add(iso.id)
        }
      }
    }

    if (exercises.length > 0) {
      templates.push({ name: tdef.name, day_of_week: null, exercises })
    }
  }

  return {
    name: params.name ||
      `${level === 'beginner' ? 'Débutant' : level === 'intermediate' ? 'Intermédiaire' : 'Avancé'} — ${goal} ${days_per_week}j`,
    goal,
    level,
    days_per_week,
    duration_weeks: duration_weeks || null,
    progression_model: DEFAULT_MODEL[goal] || 'double_progression',
    use_exercise_rotation: 0,
    deload_auto_enabled: 0,
    templates,
  }
}
