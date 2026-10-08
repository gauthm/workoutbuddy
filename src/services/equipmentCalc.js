// Calcul des charges atteignables avec un inventaire d'équipement donné

/**
 * Calcule toutes les charges atteignables avec l'inventaire donné.
 *
 * Catégories prises en compte :
 *   barbell / ez_bar      + plate          → calcul barre + plaques
 *   dumbbell_loadable     + plate / dumbbell_plate → calcul poignée + disques
 *   dumbbell_fixed                         → charge fixe (par paire)
 *   dumbbell_adjustable                    → plage par pas
 *
 * @param {object[]} equipmentItems - EquipmentItem[]
 * @param {object}   exercise       - { equipment_required: string[], is_unilateral: 0|1 }
 * @returns {{ loads_kg: number[], min_increment_kg: number, max_load_kg: number }}
 */
export function calculateAchievableLoads(equipmentItems, exercise) {
  const eqTypes      = exercise.equipment_required || []
  const isUnilateral = exercise.is_unilateral === 1

  // Exercice sans équipement requis
  if (eqTypes.length === 0) {
    return { loads_kg: [0], min_increment_kg: 0, max_load_kg: 0 }
  }

  const all_loads = new Set()

  // ── 1. Barres + disques de barre ────────────────────────────
  const barbells = equipmentItems.filter(i =>
    ['barbell', 'ez_bar'].includes(i.category) &&
    eqTypes.includes(i.category)
  )
  if (barbells.length > 0) {
    // Disques compatibles avec les barres : 'plate' uniquement (pas dumbbell_plate)
    const barPlatePairs = equipmentItems
      .filter(i => i.category === 'plate')
      .map(i => ({ weight: i.weight_kg, max: Math.floor((i.count || 0) / 2) }))
      .filter(p => p.max > 0 && p.weight > 0)

    const perSide = dpSubsetSum(barPlatePairs)
    for (const bar of barbells) {
      for (const s of perSide) {
        all_loads.add(
          round2(isUnilateral ? bar.weight_kg + s : bar.weight_kg + 2 * s)
        )
      }
    }
  }

  // ── 2. Haltères à disques (dumbbell_loadable) ───────────────
  // Un exercice qui requiert dumbbell_fixed ou dumbbell_loadable
  // peut être réalisé avec des poignées à disques.
  const exerciseNeedsDumbbells =
    eqTypes.includes('dumbbell_loadable') ||
    eqTypes.includes('dumbbell_fixed') ||
    eqTypes.includes('dumbbell_adjustable')

  const dumbHandles = exerciseNeedsDumbbells
    ? equipmentItems.filter(i => i.category === 'dumbbell_loadable' && i.count >= 2)
    : []

  if (dumbHandles.length > 0) {
    // Disques pour haltères : 'plate' + 'dumbbell_plate'
    const dumbPlatePairs = equipmentItems
      .filter(i => i.category === 'plate' || i.category === 'dumbbell_plate')
      .map(i => ({ weight: i.weight_kg, max: Math.floor((i.count || 0) / 2) }))
      .filter(p => p.max > 0 && p.weight > 0)

    const perSide = dpSubsetSum(dumbPlatePairs)
    for (const handle of dumbHandles) {
      for (const s of perSide) {
        // Charge par haltère = poids poignée + disques des 2 côtés
        all_loads.add(round2(handle.weight_kg + 2 * s))
      }
    }
  }

  // ── 3. Haltères fixes ────────────────────────────────────────
  if (exerciseNeedsDumbbells) {
    equipmentItems
      .filter(i => i.category === 'dumbbell_fixed' && i.count >= 2)
      .forEach(i => all_loads.add(round2(i.weight_kg)))
  }

  // ── 4. Haltères réglables (sélecteur) ───────────────────────
  if (exerciseNeedsDumbbells) {
    equipmentItems
      .filter(i => i.category === 'dumbbell_adjustable')
      .forEach(i => {
        let w = i.weight_min_kg
        while (w <= i.weight_max_kg + 0.001) {
          all_loads.add(round2(w))
          w = round2(w + i.weight_step_kg)
        }
      })
  }

  // ── 5. Trier + incrément minimal ────────────────────────────
  const sorted = Array.from(all_loads).sort((a, b) => a - b)
  if (sorted.length === 0) {
    return { loads_kg: [], min_increment_kg: 0, max_load_kg: 0 }
  }

  let minInc = Infinity
  for (let i = 1; i < sorted.length; i++) {
    const d = round2(sorted[i] - sorted[i - 1])
    if (d > 0.001) minInc = Math.min(minInc, d)
  }

  return {
    loads_kg:         sorted,
    min_increment_kg: sorted.length <= 1 ? 0 : (minInc === Infinity ? 0 : minInc),
    max_load_kg:      sorted[sorted.length - 1],
  }
}

// ── Helper : DP bounded subset sum ──────────────────────────
// Retourne un Set de toutes les sommes atteignables avec les paires de disques.
function dpSubsetSum(platePairs) {
  let current = new Set([0])
  for (const { weight, max } of platePairs) {
    const next = new Set(current)
    for (const s of current) {
      for (let k = 1; k <= max; k++) {
        next.add(round2(s + k * weight))
      }
    }
    current = next
  }
  return current
}

// ── Helper : arrondi 2 décimales ─────────────────────────────
function round2(n) {
  return Math.round(n * 100) / 100
}

// ── Export roundDownToAchievable (inchangé) ──────────────────
export function roundDownToAchievable(targetWeight, achievableLoads) {
  if (!achievableLoads || achievableLoads.length === 0) return 0
  const valid = achievableLoads.filter(l => l <= targetWeight + 0.001)
  if (valid.length === 0) return achievableLoads[0]
  return valid[valid.length - 1]
}
