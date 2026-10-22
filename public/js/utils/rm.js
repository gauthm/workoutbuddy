// Estimated RM formulas: client mirror of src/services/rmCalculator.js
// Use for display only (the server performs authoritative calculations)

export const FORMULAS = {
  epley:    (w, r) => r === 1 ? w : w * (1 + r / 30),
  brzycki:  (w, r) => r >= 37 ? w : w * 36 / (37 - r),
  lander:   (w, r) => 100 * w / (101.3 - 2.67123 * r),
  oconner:  (w, r) => w * (1 + 0.025 * r),
  lombardi: (w, r) => w * Math.pow(r, 0.10),
}

export function estimate1RM(weightKg, reps, formula = 'epley') {
  if (!weightKg || weightKg <= 0 || !reps || reps <= 0) return 0
  if (reps === 1) return weightKg
  const fn = FORMULAS[formula] || FORMULAS.epley
  return Math.round(fn(weightKg, reps) * 100) / 100
}

// Invert the selected formula, keeping the original weight convention (e.g. per dumbbell).
export function weightForReps(estimated1rm, reps, formula = 'epley') {
  if (!Number.isFinite(estimated1rm) || estimated1rm <= 0 || !Number.isInteger(reps) || reps < 1 || reps > 15) return 0
  const factor = reps === 1 ? 1 : (FORMULAS[formula] || FORMULAS.epley)(1, reps)
  const weight = estimated1rm / factor
  return Number.isFinite(weight) && weight > 0 ? Math.round(weight * 10) / 10 : 0
}

export function estimate10RM(weightKg, reps, formula = 'epley') {
  if (!Number.isFinite(weightKg) || weightKg <= 0 || !Number.isInteger(reps) || reps < 1) return 0
  return weightForReps(estimate1RM(weightKg,reps,formula),10,formula)
}

export function rmTable(estimated1rm, formula = 'epley') {
  if (!Number.isFinite(estimated1rm) || estimated1rm <= 0) return []
  return Array.from({length:15}, (_,i) => ({reps:i+1,weight_kg:weightForReps(estimated1rm,i+1,formula)}))
}
