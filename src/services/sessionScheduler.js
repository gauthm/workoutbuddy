import { programDates } from './programLifecycle.js'
import { localIsoDate } from './date.js'
/**
 * Generate planned sessions for the current and following week.
 *
 * Rules:
 * - Do NOT create a session if a 'planned' or 'in_progress' session already exists
 *   for this template on that day or week.
 * - Do NOT create sessions in the past (before today).
 * - Distribute sessions across the week according to days_per_week and templates.
 * - Respect template order (A → B → C → A → ...).
 * - Session format: status='planned', scheduled_date=YYYY-MM-DD.
 *
 * @param {object} db       - better-sqlite3 instance
 * @param {number} programId - Active program ID (optional: look up the active program when omitted)
 * @returns {number} number of sessions created
 */
export function scheduleWeeks(db, programId = null, { throwOnError = false } = {}) {
  try {
    // Find the active program
    const program = programId
      ? db.prepare('SELECT * FROM program WHERE id = ? AND is_active = 1').get(programId)
      : db.prepare('SELECT * FROM program WHERE is_active = 1 LIMIT 1').get()

    if (!program) return 0
    const lifecycle=programDates(program)
    if (lifecycle.end_exclusive) db.prepare("DELETE FROM session WHERE program_id=? AND status='planned' AND scheduled_date>=?").run(program.id,lifecycle.end_exclusive)
    if (lifecycle.is_finished) return 0

    const templates = db.prepare(
      'SELECT * FROM workout_template WHERE program_id = ? ORDER BY order_index ASC'
    ).all(program.id)

    if (templates.length === 0) return 0

    const today       = todayIso()
    const endOfRange  = endOfWeek(addWeeks(today, 1))  // end of the following week

    // Sessions already planned within the range
    const existing = db.prepare(`
      SELECT scheduled_date, original_scheduled_date, workout_template_id
      FROM session
      WHERE program_id = ?
        AND status IN ('planned','in_progress','completed','skipped')
        AND (scheduled_date BETWEEN ? AND ? OR original_scheduled_date BETWEEN ? AND ?)
    `).all(program.id, today, endOfRange, today, endOfRange)

    // Keep the original slot occupied when a workout was performed on another day.
    const existingDates = new Set(existing.flatMap(s => [s.scheduled_date,s.original_scheduled_date].filter(Boolean)))

    for (const row of db.prepare('SELECT scheduled_date FROM session_schedule_exclusion WHERE program_id=? AND scheduled_date BETWEEN ? AND ?').all(program.id,today,endOfRange)) existingDates.add(row.scheduled_date)

    // Determine which template to use first
    const lastCompleted = db.prepare(`
      SELECT workout_template_id FROM session
      WHERE program_id = ? AND status = 'completed'
      ORDER BY completed_at DESC LIMIT 1
    `).get(program.id)

    let nextTemplateIdx = 0
    if (lastCompleted?.workout_template_id) {
      const idx = templates.findIndex(t => t.id === lastCompleted.workout_template_id)
      if (idx !== -1) nextTemplateIdx = (idx + 1) % templates.length
    }

    // Calculate available days within the range
    const daysInRange = getDaysInRange(today, endOfRange)

    // Distribute sessions: spread days_per_week across each week
    const plan = db.prepare('SELECT parameters FROM program_plan WHERE program_id = ?').get(program.id)
    const trainingDays = plan ? JSON.parse(plan.parameters).training_days : null
    const chosenDays = Array.isArray(trainingDays) && trainingDays.length === program.days_per_week && new Set(trainingDays).size === trainingDays.length && trainingDays.every(day => Number.isInteger(day) && day >= 0 && day <= 6) ? [...trainingDays].sort((a,b)=>a-b) : null
    const slots = distributeSlots(daysInRange, program.days_per_week, existingDates, chosenDays)

    let created = 0
    for (const date of slots) {
      if (lifecycle.end_exclusive && date>=lifecycle.end_exclusive) continue
      const weekday = (new Date(date + 'T12:00:00Z').getUTCDay() + 6) % 7
      const template = chosenDays ? templates[chosenDays.indexOf(weekday) % templates.length] : templates[nextTemplateIdx % templates.length]
      nextTemplateIdx++

      db.prepare(`
        INSERT INTO session (name, scheduled_date, original_scheduled_date, workout_template_id, program_id, status)
        VALUES (?, ?, ?, ?, ?, 'planned')
      `).run(template.name, date, date, template.id, program.id)

      created++
    }

    return created

  } catch (err) {
    if (throwOnError) throw err
    console.warn('[sessionScheduler] Error:', err.message)
    return 0  // Non-blocking
  }
}

// ── Date helpers ──────────────────────────────────────────────

/** Today's YYYY-MM-DD */
function todayIso() {
  return localIsoDate()
}

/** Add N weeks to an ISO date */
function addWeeks(dateIso, n) {
  const d = new Date(dateIso + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + n * 7)
  return d.toISOString().slice(0, 10)
}

/** Last day (Sunday) of the week containing dateIso */
function endOfWeek(dateIso) {
  const d   = new Date(dateIso + 'T12:00:00Z')
  const dow = d.getUTCDay()  // 0=Sunday
  const diff = dow === 0 ? 0 : 7 - dow
  d.setUTCDate(d.getUTCDate() + diff)
  return d.toISOString().slice(0, 10)
}

/** List all YYYY-MM-DD days between start and end (inclusive) */
function getDaysInRange(start, end) {
  const days = []
  const current = new Date(start + 'T12:00:00Z')
  const endDate = new Date(end   + 'T12:00:00Z')
  while (current <= endDate) {
    days.push(current.toISOString().slice(0, 10))
    current.setUTCDate(current.getUTCDate() + 1)
  }
  return days
}

/**
 * Choose the days on which to schedule sessions.
 *
 * Strategy: distribute days evenly across each week.
 * - For days_per_week = 3 : Mon, Wed, Fri (week indices 0, 2, 4)
 * - For days_per_week = 4 : Mon, Tue, Thu, Fri
 * - For days_per_week = 5 : Mon, Tue, Wed, Thu, Fri
 * - For days_per_week = 6 : Mon, Tue, Wed, Thu, Fri, Sat
 * - For days_per_week = 2 : Mon, Thu
 *
 * Skip days already in existingDates.
 *
 * @param {string[]} daysInRange   - all days within the range
 * @param {number}   daysPerWeek   - sessions per week (2–6)
 * @param {Set}      existingDates - already planned days (to skip)
 * @returns {string[]} dates of sessions to create
 */
function distributeSlots(daysInRange, daysPerWeek, existingDates, chosenDays = null) {
  // Weekday indices (0=Mon, 6=Sun) according to days_per_week
  const PREFERRED_DAYS = {
    2: [0, 3],           // Mon, Thu
    3: [0, 2, 4],        // Mon, Wed, Fri
    4: [0, 1, 3, 4],     // Mon, Tue, Thu, Fri
    5: [0, 1, 2, 3, 4],  // Mon to Fri
    6: [0, 1, 2, 3, 4, 5], // Mon to Sat
    7: [0, 1, 2, 3, 4, 5, 6],
  }

  const preferred = chosenDays || PREFERRED_DAYS[daysPerWeek] || PREFERRED_DAYS[3]
  const slots     = []

  // Group days by ISO week
  const byWeek = {}
  for (const day of daysInRange) {
    const weekKey = isoWeekKey(day)
    if (!byWeek[weekKey]) byWeek[weekKey] = []
    byWeek[weekKey].push(day)
  }

  // For each week, select preferred days that are not already planned
  for (const [, days] of Object.entries(byWeek).sort()) {
    let addedThisWeek = 0
    for (const day of days) {
      if (addedThisWeek >= daysPerWeek) break
      const d   = new Date(day + 'T12:00:00Z')
      const dow = (d.getUTCDay() + 6) % 7  // 0=Mon, 6=Sun
      if (existingDates.has(day)) {
        if (!chosenDays || preferred.includes(dow)) addedThisWeek++
        continue
      }

      if (preferred.includes(dow)) {
        slots.push(day)
        existingDates.add(day)  // avoid duplicates
        addedThisWeek++
      }
    }
  }

  return slots
}

/** Return "YYYY-Www" for an ISO date */
function isoWeekKey(dateIso) {
  const d = new Date(dateIso + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + 3 - ((d.getUTCDay() + 6) % 7))
  const week1 = new Date(Date.UTC(d.getUTCFullYear(), 0, 4))
  const weekNum = 1 + Math.round(
    ((d - week1) / 86400000 - 3 + (week1.getUTCDay() + 6) % 7) / 7
  )
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`
}
