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
