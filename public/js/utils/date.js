// Return today's date in YYYY-MM-DD format
export function isoDate(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Return the ISO week in YYYY-Www format (e.g. "2025-W27")
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

// Previous ISO week
export function previousIsoWeek(weekStr) {
  // weekStr: "2025-W27"
  const [year, w] = weekStr.split('-W').map(Number)
  if (w === 1) {
    // Find the last week of the previous year
    const dec28 = new Date(year - 1, 11, 28)
    return isoWeek(isoDate(dec28))
  }
  return `${year}-W${String(w - 1).padStart(2, '0')}`
}

// Number of days between two YYYY-MM-DD dates
export function daysBetween(dateA, dateB) {
  const a = new Date(dateA)
  const b = new Date(dateB)
  return Math.round(Math.abs(b - a) / 86400000)
}

// Format a YYYY-MM-DD date for display
export function formatDate(dateStr, locale = 'fr-FR') {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString(locale, {
    day: 'numeric', month: 'short', year: 'numeric'
  })
}

// Format a duration in seconds → "1h 23min" or "45min"
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
