export function kgToLb(kg) {
  return Math.round(kg * 2.20462 * 10) / 10
}

export function lbToKg(lb) {
  return Math.round(lb / 2.20462 * 10) / 10
}

// Format a weight in the active unit
// unit: 'kg' | 'lb'
export function formatWeight(kg, unit = 'kg', decimals = 1) {
  if (kg === null || kg === undefined) return '—'
  const val = unit === 'lb' ? kgToLb(kg) : kg
  return `${parseFloat(val.toFixed(decimals))} ${unit}`
}
