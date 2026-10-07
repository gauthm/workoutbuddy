// Calcul des charges atteignables avec un inventaire d'équipement donné

export function calculateAchievableLoads(equipmentItems, exercise) {
  const required = exercise.equipment_required ?? []

  // 1. Pas de matériel requis → charge au poids du corps
  if (required.length === 0) {
    return { loads_kg: [0], min_increment_kg: 0, max_load_kg: 0 }
  }

  const isUnilateral = exercise.is_unilateral === 1

  // 2. Barres compatibles avec l'exercice
  const barbells = equipmentItems.filter(item =>
    ['barbell', 'ez_bar'].includes(item.category) &&
    required.includes(item.category)
  )

  // 3. Paires de plaques disponibles (count toujours pair → paires par côté)
  const platePairs = equipmentItems
    .filter(item => item.category === 'plate')
    .map(item => ({ weight: item.weight_kg, max_count: Math.floor(item.count / 2) }))

  // 4. DP bounded subset sum : charges possibles par côté
  let perSide = new Set([0])
  for (const { weight, max_count } of platePairs) {
    const next = new Set(perSide)
    for (const s of perSide) {
      for (let k = 1; k <= max_count; k++) {
        next.add(s + k * weight)
      }
    }
    perSide = next
  }

  // 5. Charges totales selon les barres
  const allLoads = new Set()
  for (const barbell of barbells) {
    for (const s of perSide) {
      const load = isUnilateral
        ? barbell.weight_kg + s
        : barbell.weight_kg + 2 * s
      allLoads.add(Math.round(load * 100) / 100)
    }
  }

  // 6. Haltères fixes (une paire complète seulement)
  if (required.includes('dumbbell_fixed') || required.includes('dumbbell')) {
    equipmentItems
      .filter(item => item.category === 'dumbbell_fixed' && item.count >= 2)
      .forEach(item => allLoads.add(Math.round(item.weight_kg * 100) / 100))
  }

  // 7. Haltère réglable
  equipmentItems
    .filter(item => item.category === 'dumbbell_adjustable')
    .forEach(item => {
      let w = item.weight_min_kg
      while (w <= item.weight_max_kg + 0.001) {
        allLoads.add(Math.round(w * 100) / 100)
        w += item.weight_step_kg
      }
    })

  // 8. Tri + incrément minimal
  const sorted = Array.from(allLoads).sort((a, b) => a - b)
  if (sorted.length === 0) {
    return { loads_kg: [], min_increment_kg: 0, max_load_kg: 0 }
  }

  let minIncrement = Infinity
  for (let i = 1; i < sorted.length; i++) {
    const diff = sorted[i] - sorted[i - 1]
    if (diff > 0.001) minIncrement = Math.min(minIncrement, diff)
  }
  if (sorted.length <= 1) minIncrement = 0
  if (minIncrement === Infinity) minIncrement = 0

  return {
    loads_kg: sorted,
    min_increment_kg: Math.round(minIncrement * 100) / 100,
    max_load_kg: sorted[sorted.length - 1]
  }
}

export function roundDownToAchievable(targetWeight, achievableLoads) {
  if (!achievableLoads || achievableLoads.length === 0) return 0
  let best = achievableLoads[0]
  for (const load of achievableLoads) {
    if (load <= targetWeight) best = load
    else break
  }
  return best
}
