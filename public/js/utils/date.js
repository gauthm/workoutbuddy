// Retourne la date du jour au format YYYY-MM-DD
export function isoDate(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Retourne la semaine ISO au format YYYY-Www (ex: "2025-W27")
export function isoWeek(dateStr) {
  const d = new Date(dateStr)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7))
  const week1 = new Date(d.getFullYear(), 0, 4)
  const weekNum = 1 + Math.round(
    ((d - week1) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7
  )
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`
}

// Semaine ISO précédente
export function previousIsoWeek(weekStr) {
  // weekStr: "2025-W27"
  const [year, w] = weekStr.split('-W').map(Number)
  if (w === 1) {
    // Trouver la dernière semaine de l'année précédente
    const dec28 = new Date(year - 1, 11, 28)
    return isoWeek(isoDate(dec28))
  }
  return `${year}-W${String(w - 1).padStart(2, '0')}`
}

// Nombre de jours entre deux dates YYYY-MM-DD
export function daysBetween(dateA, dateB) {
  const a = new Date(dateA)
  const b = new Date(dateB)
  return Math.round(Math.abs(b - a) / 86400000)
}

// Formate une date YYYY-MM-DD pour l'affichage
export function formatDate(dateStr, locale = 'fr-FR') {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString(locale, {
    day: 'numeric', month: 'short', year: 'numeric'
  })
}

// Formate une durée en secondes → "1h 23min" ou "45min"
export function formatDuration(seconds) {
  if (!seconds || seconds < 0) return '—'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h ${m}min`
  return `${m}min`
}

export function parseUtcTimestamp(value) {
  if (typeof value !== 'string') return NaN
  const normalized = value.replace(' ', 'T')
  return Date.parse(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(normalized) ? normalized : normalized + 'Z')
}
