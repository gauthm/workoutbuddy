export function kgToLb(kg) {
  return Math.round(kg * 2.20462 * 10) / 10
}

export function lbToKg(lb) {
  return Math.round(lb / 2.20462 * 10) / 10
}

// Formate un poids selon l'unité active
// unit: 'kg' | 'lb'
export function formatWeight(kg, unit = 'kg', decimals = 1) {
  if (kg === null || kg === undefined) return '—'
  const val = unit === 'lb' ? kgToLb(kg) : kg
  return `${parseFloat(val.toFixed(decimals))} ${unit}`
}
