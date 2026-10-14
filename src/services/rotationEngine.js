// Moteur de rotation d'exercices — créé à la tâche T1.9 pour héberger
// la version partagée de isEquipmentAvailable (réutilisée en T3.3).

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
export function isEquipmentAvailable(equipmentRequired, equipmentItems) {
  if (!equipmentRequired || equipmentRequired.length === 0) return true

  // Construire l'ensemble des catégories disponibles avec sous-types
  const available = new Set(equipmentItems.map(i => i.category))

  // bench_adjustable → satisfait bench
  if (available.has('bench_adjustable')) available.add('bench')
  if (available.has('cable_machine')) { available.add('lat_pulldown'); available.add('seated_row') }
  if (available.has('roman_chair')) { available.add('pullup_bar'); available.add('dip_station') }

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

/**
 * Trouve les exercices candidats pour la rotation d'un template_exercise.
 *
 * Critères de sélection :
 * 1. Même movement_pattern que l'exercice de base
 * 2. Au moins un muscle primaire en commun
 * 3. Matériel disponible dans l'inventaire
 * 4. Ne pas être l'exercice de base lui-même
 *
 * L'exercice de base est TOUJOURS en position 0 de la liste retournée.
 *
 * @param {object}   baseExercise   - Exercise de base (objet complet avec JSON parsés)
 * @param {object[]} allExercises   - Tous les exercices DB (JSON parsés)
 * @param {object[]} equipmentItems - Inventaire équipement
 * @returns {object[]} Liste [baseExercise, ...candidats] — au moins 1 élément
 */
export function findRotationCandidates(baseExercise, allExercises, equipmentItems) {
  function hasOverlap(musclesA, musclesB) {
    return musclesA.some(m => musclesB.includes(m))
  }

  // Les exercices exclus ne sont jamais candidats à la rotation
  const available = allExercises.filter(ex => !ex.is_excluded)

  const candidates = available.filter(ex =>
    ex.id !== baseExercise.id &&
    ex.movement_pattern === baseExercise.movement_pattern &&
    hasOverlap(ex.primary_muscles, baseExercise.primary_muscles) &&
    isEquipmentAvailable(ex.equipment_required, equipmentItems)
  )

  // Base toujours en premier
  return [baseExercise, ...candidates]
}

/**
 * Retourne l'exercice à utiliser pour une semaine donnée.
 *
 * Si rotation_group est null ou si moins de 2 candidats → exercice de base.
 * Sinon : index = (weekNumber - 1) % len(candidates)
 *
 * @param {object}   templateExercise - ligne template_exercise
 * @param {number}   weekNumber       - semaine courante du programme (≥1)
 * @param {object[]} allExercises     - tous les exercices (JSON parsés)
 * @param {object[]} equipmentItems   - inventaire
 * @param {object}   db
 * @returns {string} exercise_id à utiliser
 */
export function getExerciseForWeek(
  templateExercise,
  weekNumber,
  allExercises,
  equipmentItems,
  db
) {
  // Si pas de groupe de rotation → exercice de base inchangé
  if (!templateExercise.rotation_group) {
    return templateExercise.exercise_id
  }

  const baseExercise = allExercises.find(e => e.id === templateExercise.exercise_id)
  if (!baseExercise) return templateExercise.exercise_id

  const candidates = findRotationCandidates(baseExercise, allExercises, equipmentItems)

  // Pas assez de candidats pour alterner
  if (candidates.length <= 1) {
    return templateExercise.exercise_id
  }

  // Rotation : week 1 → index 0 (base), week 2 → index 1, etc.
  const idx = (weekNumber - 1) % candidates.length
  return candidates[idx].id
}
