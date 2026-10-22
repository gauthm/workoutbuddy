import { localIsoDate } from './date.js'
/**
 * Calculate user streaks from completed sessions.
 *
 * Definitions:
 * - weekly streak: number of consecutive ISO weeks with ≥1 completed session,
 *   counting back from the current week.
 * - session streak: unused in the MVP (replaced by total_sessions).
 * - total_weeks   : number of distinct weeks with at least one session.
 *
 * @param {object} db - better-sqlite3 instance
 * @returns {{
 *   current_week_streak: number,
 *   longest_week_streak: number,
 *   total_sessions: number,
 *   total_weeks: number
 * }}
 */
export function calculateStreaks(db) {
  // 1. Dates of all completed sessions
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

  // 2. Set of ISO weeks with at least one session
  const weeksWithSession = new Set(rows.map(r => isoWeek(r.d)))
  const totalWeeks = weeksWithSession.size

  // 3. Current streak: count back from the current week
  const currentWeekStr = isoWeek(todayIso())
  let streakWeeks = 0
  let w = currentWeekStr
  while (weeksWithSession.has(w)) {
    streakWeeks++
    w = previousIsoWeek(w)
  }

  // 4. Longest streak
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

// ── Date helpers ─────────────────────────────────────────────────────────

function todayIso() {
  return localIsoDate()
}

/**
 * Return the ISO week in "YYYY-Www" format (e.g. "2025-W27").
 * @param {string} dateStr - "YYYY-MM-DD"
 */
export function isoWeek(dateStr) {
  const d = new Date(dateStr + 'T12:00:00Z')  // noon UTC to avoid date shifts
  d.setUTCDate(d.getUTCDate() + 3 - ((d.getUTCDay() + 6) % 7))
  const week1 = new Date(Date.UTC(d.getUTCFullYear(), 0, 4))
  const weekNum = 1 + Math.round(
    ((d - week1) / 86400000 - 3 + (week1.getUTCDay() + 6) % 7) / 7
  )
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`
}

/**
 * Return the previous ISO week.
 * @param {string} weekStr - "YYYY-Www"
 */
export function previousIsoWeek(weekStr) {
  const [year, w] = weekStr.split('-W').map(Number)
  if (w === 1) {
    // Last week of the previous year: find December 28
    const dec28 = new Date(Date.UTC(year - 1, 11, 28))
    return isoWeek(dec28.toISOString().slice(0, 10))
  }
  return `${year}-W${String(w - 1).padStart(2, '0')}`
}

/**
 * Return the next ISO week.
 * @param {string} weekStr - "YYYY-Www"
 */
export function nextIsoWeek(weekStr) {
  const [year, w] = weekStr.split('-W').map(Number)
  // Find the number of weeks in this year
  const dec28 = new Date(Date.UTC(year, 11, 28))
  const weeksInYear = isoWeek(dec28.toISOString().slice(0, 10)).split('-W')[1]
  if (w >= parseInt(weeksInYear)) {
    return `${year + 1}-W01`
  }
  return `${year}-W${String(w + 1).padStart(2, '0')}`
}
