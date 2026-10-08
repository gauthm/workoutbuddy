/**
 * Calcule les streaks de l'utilisateur à partir des séances complétées.
 *
 * Définitions :
 * - streak semaine : nombre de semaines ISO consécutives avec ≥1 séance complétée,
 *   en remontant à partir de la semaine courante.
 * - streak séance : non utilisé dans le MVP (remplacé par total_sessions).
 * - total_weeks   : nombre de semaines distinctes avec au moins une séance.
 *
 * @param {object} db - instance better-sqlite3
 * @returns {{
 *   current_week_streak: number,
 *   longest_week_streak: number,
 *   total_sessions: number,
 *   total_weeks: number
 * }}
 */
export function calculateStreaks(db) {
  // 1. Dates de toutes les séances complétées
  const rows = db.prepare(`
    SELECT DISTINCT date(scheduled_date) AS d
    FROM session
    WHERE status = 'completed'
    ORDER BY d DESC
  `).all()

  const totalSessions = db.prepare(
    "SELECT COUNT(*) AS n FROM session WHERE status = 'completed'"
  ).get().n

  if (rows.length === 0) {
    return {
      current_week_streak: 0,
      longest_week_streak: 0,
      total_sessions:      0,
      total_weeks:         0,
    }
  }

  // 2. Ensemble des semaines ISO avec au moins une séance
  const weeksWithSession = new Set(rows.map(r => isoWeek(r.d)))
  const totalWeeks = weeksWithSession.size

  // 3. Streak courant : remonter depuis la semaine courante
  const currentWeekStr = isoWeek(todayIso())
  let streakWeeks = 0
  let w = currentWeekStr
  while (weeksWithSession.has(w)) {
    streakWeeks++
    w = previousIsoWeek(w)
  }

  // 4. Streak le plus long
  const sortedWeeks = Array.from(weeksWithSession).sort()
  let longest = sortedWeeks.length > 0 ? 1 : 0
  let current = 1
  for (let i = 1; i < sortedWeeks.length; i++) {
    if (sortedWeeks[i] === nextIsoWeek(sortedWeeks[i - 1])) {
      current++
      if (current > longest) longest = current
    } else {
      current = 1
    }
  }

  return {
    current_week_streak: streakWeeks,
    longest_week_streak: longest,
    total_sessions:      totalSessions,
    total_weeks:         totalWeeks,
  }
}

// ── Helpers date ─────────────────────────────────────────────────────────

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

/**
 * Retourne la semaine ISO au format "YYYY-Www" (ex: "2025-W27").
 * @param {string} dateStr - "YYYY-MM-DD"
 */
export function isoWeek(dateStr) {
  const d = new Date(dateStr + 'T12:00:00Z')  // midi UTC pour éviter les décalages
  d.setUTCDate(d.getUTCDate() + 3 - ((d.getUTCDay() + 6) % 7))
  const week1 = new Date(Date.UTC(d.getUTCFullYear(), 0, 4))
  const weekNum = 1 + Math.round(
    ((d - week1) / 86400000 - 3 + (week1.getUTCDay() + 6) % 7) / 7
  )
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`
}

/**
 * Retourne la semaine ISO précédente.
 * @param {string} weekStr - "YYYY-Www"
 */
export function previousIsoWeek(weekStr) {
  const [year, w] = weekStr.split('-W').map(Number)
  if (w === 1) {
    // Dernière semaine de l'année précédente : trouver le 28 décembre
    const dec28 = new Date(Date.UTC(year - 1, 11, 28))
    return isoWeek(dec28.toISOString().slice(0, 10))
  }
  return `${year}-W${String(w - 1).padStart(2, '0')}`
}

/**
 * Retourne la semaine ISO suivante.
 * @param {string} weekStr - "YYYY-Www"
 */
export function nextIsoWeek(weekStr) {
  const [year, w] = weekStr.split('-W').map(Number)
  // Trouver le nombre de semaines dans cette année
  const dec28 = new Date(Date.UTC(year, 11, 28))
  const weeksInYear = isoWeek(dec28.toISOString().slice(0, 10)).split('-W')[1]
  if (w >= parseInt(weeksInYear)) {
    return `${year + 1}-W01`
  }
  return `${year}-W${String(w + 1).padStart(2, '0')}`
}
