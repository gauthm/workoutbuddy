import { isEquipmentAvailable } from './rotationEngine.js'

// Calculate achievable loads with a given equipment inventory

/**
 * Calculate all achievable loads with the given inventory.
 *
 * Supported categories:
 *   barbell / ez_bar      + plate          → bar + plates calculation
 *   dumbbell_loadable     + plate / dumbbell_plate → handle + plates calculation
 *   dumbbell_fixed                         → fixed load (per pair)
 *   dumbbell_adjustable                    → range in steps
 *
 * @param {object[]} equipmentItems - EquipmentItem[]
 * @param {object}   exercise       - { equipment_required: string[], is_unilateral: 0|1 }
 * @returns {{ loads_kg: number[], min_increment_kg: number, max_load_kg: number }}
 */
export function calculateAchievableLoads(equipmentItems, exercise) {
  equipmentItems=equipmentItems.filter(item=>item.count === undefined || item.count>0)
  const eqTypes      = exercise.equipment_required || []
  const isUnilateral = exercise.is_unilateral === 1 || exercise.is_unilateral === true
  const requiredDumbbells = isUnilateral ? 1 : 2

  // Exercise requiring no equipment
  if (eqTypes.length === 0) {
    return { loads_kg: [0], min_increment_kg: 0, max_load_kg: 0 }
  }

  if (!isEquipmentAvailable(eqTypes, equipmentItems)) return { loads_kg: [], min_increment_kg: 0, max_load_kg: 0 }
  const all_loads = new Set()

  // ── 1. Bars + barbell plates ────────────────────────────
  const barbells = equipmentItems.filter(i =>
    ['barbell', 'ez_bar'].includes(i.category) &&
    eqTypes.includes(i.category)
  )
  if (barbells.length > 0) {
    // Bar-compatible plates: 'plate' only (not dumbbell_plate)
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

  // ── 2. Loadable dumbbells (dumbbell_loadable) ───────────────
  // An exercise requiring dumbbell_fixed or dumbbell_loadable
  // can use loadable dumbbell handles.
  const exerciseNeedsDumbbells =
    eqTypes.includes('dumbbell_loadable') ||
    eqTypes.includes('dumbbell_fixed') ||
    eqTypes.includes('dumbbell_adjustable')

  const dumbHandles = exerciseNeedsDumbbells
    ? quantitiesByWeight(equipmentItems, ['dumbbell_loadable']).filter(item => item.count >= requiredDumbbells)
    : []

  if (dumbHandles.length > 0) {
    // Dumbbell plates: 'plate' + 'dumbbell_plate'
    const dumbPlatePairs = quantitiesByWeight(equipmentItems, ['plate', 'dumbbell_plate'])
      .map(i => ({ weight: i.weight_kg, max: Math.floor(i.count / (2 * requiredDumbbells)) }))
      .filter(p => p.max > 0 && p.weight > 0)

    const perSide = dpSubsetSum(dumbPlatePairs)
    for (const handle of dumbHandles) {
      for (const s of perSide) {
        // Load per dumbbell = handle weight + plates on both sides
        all_loads.add(round2(handle.weight_kg + 2 * s))
      }
    }
  }

  // ── 3. Fixed dumbbells ────────────────────────────────────────
  if (exerciseNeedsDumbbells) {
    quantitiesByWeight(equipmentItems, ['dumbbell_fixed'])
      .filter(i => i.count >= requiredDumbbells)
      .forEach(i => all_loads.add(round2(i.weight_kg)))
  }

  // ── 4. Adjustable dumbbells (selector) ───────────────────────
  if (exerciseNeedsDumbbells) {
    equipmentItems
      .filter(i => i.category === 'dumbbell_adjustable' && i.count >= requiredDumbbells)
      .forEach(i => {
        const min = i.weight_min_kg, max = i.weight_max_kg, step = i.weight_step_kg
        if (![min, max, step].every(Number.isFinite) || min < 0 || max < min || step <= 0) return
        const count = Math.floor((max - min) / step + 0.001)
        if (count > 10000) return
        for (let index = 0; index <= count; index++) all_loads.add(round2(min + index * step))
      })
  }

  if (eqTypes.includes('kettlebell')) {
    quantitiesByWeight(equipmentItems, ['kettlebell']).forEach(i => all_loads.add(round2(i.weight_kg)))
  }
  const resistanceRanges = eqTypes.includes('resistance_band') ? equipmentItems
    .filter(i => i.category === 'resistance_band' && i.count > 0 && Number.isFinite(i.resistance_min_kg) && Number.isFinite(i.resistance_max_kg) && i.resistance_min_kg > 0 && i.resistance_max_kg > i.resistance_min_kg)
    .map(i => ({min_kg: i.resistance_min_kg, max_kg: i.resistance_max_kg})) : []
  for (const range of resistanceRanges) { all_loads.add(range.min_kg); all_loads.add(range.max_kg) }
  const loadedCategories = ['barbell','ez_bar','dumbbell_fixed','dumbbell_loadable','dumbbell_adjustable','kettlebell','resistance_band']
  if (!eqTypes.some(c => loadedCategories.includes(c))) all_loads.add(0)

  // ── 5. Sort + minimum increment ────────────────────────────
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
    ...(resistanceRanges.length ? { resistance_ranges: resistanceRanges, resistance_is_approximate: true } : {}),
    min_increment_kg: resistanceRanges.length ? 0 : sorted.length <= 1 ? 0 : (minInc === Infinity ? 0 : minInc),
    max_load_kg:      sorted[sorted.length - 1],
  }
}

function quantitiesByWeight(items, categories) {
  const groups = new Map()
  for (const item of items) {
    if (!categories.includes(item.category) || !Number.isFinite(item.weight_kg)
      || !Number.isInteger(item.count) || item.count < 1) continue
    const key = item.weight_kg
    const group = groups.get(key) || { weight_kg: key, count: 0 }
    group.count += item.count
    groups.set(key, group)
  }
  return [...groups.values()]
}

// ── Helper : DP bounded subset sum ──────────────────────────
// Return a Set of all sums achievable with plate pairs.
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

// ── Helper: round to 2 decimal places ─────────────────────────────
function round2(n) {
  return Math.round(n * 100) / 100
}

// ── Export roundDownToAchievable (unchanged) ──────────────────
export function roundDownToAchievable(targetWeight, achievableLoads) {
  if (!achievableLoads || achievableLoads.length === 0) return 0
  const valid = achievableLoads.filter(l => l <= targetWeight + 0.001)
  if (valid.length === 0) return achievableLoads[0]
  return valid[valid.length - 1]
}
