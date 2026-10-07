// Formules de RM estimé — miroir client de src/services/rmCalculator.js
// Utiliser uniquement pour l'affichage (calcul autoritaire sur le serveur)

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

export function rmTable(estimated1rm, formula = 'epley') {
  if (!estimated1rm || estimated1rm <= 0) return []
  const result = []
  for (let n = 1; n <= 15; n++) {
    const w = n === 1
      ? estimated1rm
      : Math.round((estimated1rm / (1 + n / 30)) * 10) / 10
    result.push({ reps: n, weight_kg: w })
  }
  return result
}
