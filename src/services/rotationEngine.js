// Exercise rotation engine — created in task T1.9 to host
// the shared isEquipmentAvailable implementation (reused in T3.3).

/**
 * Check whether an exercise can be performed with the available inventory.
 * Apply subtype rules:
 *   bench_adjustable satisfies 'bench'
 *   dumbbell_loadable satisfies 'dumbbell_fixed'
 *   dumbbell_fixed / dumbbell_adjustable / dumbbell_loadable satisfies 'dumbbell'
 *
 * @param {string[]} equipmentRequired - list of categories required by the exercise
 * @param {object[]} equipmentItems    - complete inventory
 * @returns {boolean}
 */
export function isEquipmentAvailable(equipmentRequired, equipmentItems) {
  if (!equipmentRequired || equipmentRequired.length === 0) return true

  // Build the set of available categories including subtypes
  const available = new Set(equipmentItems.filter(i=>i.count === undefined || i.count>0).map(i => i.category))

  // bench_adjustable → satisfies bench
  if (available.has('bench_adjustable')) available.add('bench')
  if (available.has('cable_machine')) { available.add('lat_pulldown'); available.add('seated_row') }
  if (available.has('roman_chair')) { available.add('pullup_bar'); available.add('dip_station') }

  // dumbbell_loadable → satisfies dumbbell_fixed
  if (available.has('dumbbell_loadable')) available.add('dumbbell_fixed')

  // Any dumbbell type → satisfies other types for availability
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

/**
 * Find candidate exercises for rotating a template_exercise.
 *
 * Selection criteria:
 * 1. Same movement_pattern as the base exercise
 * 2. At least one primary muscle in common
 * 3. Equipment available in the inventory
 * 4. Must not be the base exercise itself
 *
 * The base exercise is ALWAYS at index 0 of the returned list.
 *
 * @param {object}   baseExercise   - Base exercise (complete object with parsed JSON)
 * @param {object[]} allExercises   - All database exercises (parsed JSON)
 * @param {object[]} equipmentItems - Equipment inventory
 * @returns {object[]} List [baseExercise, ...candidates] — at least 1 item
 */
export function findRotationCandidates(baseExercise, allExercises, equipmentItems) {
  function hasOverlap(musclesA, musclesB) {
    return musclesA.some(m => musclesB.includes(m))
  }

  // Excluded exercises are never rotation candidates
  const available = allExercises.filter(ex => !ex.is_excluded)

  const candidates = available.filter(ex =>
    ex.id !== baseExercise.id &&
    ex.movement_pattern === baseExercise.movement_pattern &&
    hasOverlap(ex.primary_muscles, baseExercise.primary_muscles) &&
    isEquipmentAvailable(ex.equipment_required, equipmentItems)
  )

  // Base exercise always first
  return [baseExercise, ...candidates]
}

/**
 * Return the exercise to use for a given week.
 *
 * If rotation_group is null or there are fewer than 2 candidates → base exercise.
 * Otherwise: index = (weekNumber - 1) % len(candidates)
 *
 * @param {object}   templateExercise - template_exercise row
 * @param {number}   weekNumber       - current program week (≥1)
 * @param {object[]} allExercises     - all exercises (parsed JSON)
 * @param {object[]} equipmentItems   - inventory
 * @param {object}   db
 * @returns {string} exercise_id to use
 */
export function getExerciseForWeek(
  templateExercise,
  weekNumber,
  allExercises,
  equipmentItems,
  db
) {
  // If there is no rotation group → base exercise unchanged
  if (!templateExercise.rotation_group) {
    return templateExercise.exercise_id
  }

  const baseExercise = allExercises.find(e => e.id === templateExercise.exercise_id)
  if (!baseExercise) return templateExercise.exercise_id

  const candidates = findRotationCandidates(baseExercise, allExercises, equipmentItems)

  // Not enough candidates to alternate
  if (candidates.length <= 1) {
    return templateExercise.exercise_id
  }

  // Rotation : week 1 → index 0 (base), week 2 → index 1, etc.
  const idx = (weekNumber - 1) % candidates.length
  return candidates[idx].id
}
