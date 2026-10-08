// Formules de RM estimé — source de vérité côté serveur
// Le client (utils/rm.js) en est un miroir pour l'affichage uniquement.

export const FORMULAS = {
  epley:    (w, r) => r === 1 ? w : w * (1 + r / 30),
  brzycki:  (w, r) => r >= 37 ? w : w * 36 / (37 - r),
  lander:   (w, r) => 100 * w / (101.3 - 2.67123 * r),
  oconner:  (w, r) => w * (1 + 0.025 * r),
  lombardi: (w, r) => w * Math.pow(r, 0.10),
}

/**
 * Estime le 1RM depuis un poids et un nombre de répétitions.
 * @param {number} weightKg  - poids soulevé
 * @param {number} reps      - répétitions effectuées
 * @param {string} formula   - clé de FORMULAS (défaut: 'epley')
 * @returns {number} 1RM estimé, arrondi à 2 décimales
 */
export function estimate1RM(weightKg, reps, formula = 'epley') {
  if (!weightKg || weightKg <= 0) return 0
  if (!reps || reps <= 0) return 0
  if (reps === 1) return Math.round(weightKg * 100) / 100
  const fn = FORMULAS[formula] || FORMULAS.epley
  return Math.round(fn(weightKg, reps) * 100) / 100
}

/**
 * Génère un tableau RM pour N=1..15 répétitions.
 * Inversion de la formule Epley pour tous les modèles
 * (approximation conservative, suffisante pour l'affichage).
 * @param {number} estimated1rm - 1RM de référence
 * @param {string} formula      - utilisé pour le libellé uniquement
 * @returns {{ reps: number, weight_kg: number }[]}
 */
export function rmTable(estimated1rm, formula = 'epley') {
  if (!estimated1rm || estimated1rm <= 0) return []
  const result = []
  for (let n = 1; n <= 15; n++) {
    const w = n === 1
      ? estimated1rm
      : estimated1rm / (1 + n / 30)  // inversion Epley
    result.push({ reps: n, weight_kg: Math.round(w * 10) / 10 })
  }
  return result
}
