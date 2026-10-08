/**
 * Génère les séances planifiées pour la semaine courante + la semaine suivante.
 *
 * Règles :
 * - Ne crée PAS de séance si une séance 'planned' ou 'in_progress' existe déjà
 *   pour ce template sur ce jour ou cette semaine.
 * - Ne crée PAS de séance dans le passé (avant aujourd'hui).
 * - Distribue les séances sur la semaine selon days_per_week et les templates.
 * - Respecte l'ordre des templates (A → B → C → A → ...).
 * - Séances au format : status='planned', scheduled_date=YYYY-MM-DD.
 *
 * @param {object} db       - instance better-sqlite3
 * @param {number} programId - ID du programme actif (optionnel : lit l'actif si absent)
 * @returns {number} nombre de séances créées
 */
export function scheduleWeeks(db, programId = null) {
  try {
    // Trouver le programme actif
    const program = programId
      ? db.prepare('SELECT * FROM program WHERE id = ? AND is_active = 1').get(programId)
      : db.prepare('SELECT * FROM program WHERE is_active = 1 LIMIT 1').get()

    if (!program) return 0

    const templates = db.prepare(
      'SELECT * FROM workout_template WHERE program_id = ? ORDER BY order_index ASC'
    ).all(program.id)

    if (templates.length === 0) return 0

    const today       = todayIso()
    const endOfRange  = endOfWeek(addWeeks(today, 1))  // fin de la semaine suivante

    // Séances déjà planifiées dans la plage
    const existing = db.prepare(`
      SELECT scheduled_date, workout_template_id
      FROM session
      WHERE program_id = ?
        AND status IN ('planned','in_progress')
        AND scheduled_date BETWEEN ? AND ?
    `).all(program.id, today, endOfRange)

    const existingDates = new Set(existing.map(s => s.scheduled_date))

    // Déterminer quel template utiliser en premier
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

    // Calculer les jours disponibles dans la plage
    const daysInRange = getDaysInRange(today, endOfRange)

    // Distribuer les séances : days_per_week réparties sur chaque semaine
    const slots = distributeSlots(daysInRange, program.days_per_week, existingDates)

    let created = 0
    for (const date of slots) {
      const template = templates[nextTemplateIdx % templates.length]
      nextTemplateIdx++

      db.prepare(`
        INSERT INTO session (name, scheduled_date, workout_template_id, program_id, status)
        VALUES (?, ?, ?, ?, 'planned')
      `).run(template.name, date, template.id, program.id)

      created++
    }

    return created

  } catch (err) {
    console.warn('[sessionScheduler] Erreur :', err.message)
    return 0  // Non bloquant
  }
}

// ── Helpers date ──────────────────────────────────────────────

/** YYYY-MM-DD d'aujourd'hui */
function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

/** Ajoute N semaines à une date ISO */
function addWeeks(dateIso, n) {
  const d = new Date(dateIso + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + n * 7)
  return d.toISOString().slice(0, 10)
}

/** Dernier jour (dimanche) de la semaine contenant dateIso */
function endOfWeek(dateIso) {
  const d   = new Date(dateIso + 'T12:00:00Z')
  const dow = d.getUTCDay()  // 0=dimanche
  const diff = dow === 0 ? 0 : 7 - dow
  d.setUTCDate(d.getUTCDate() + diff)
  return d.toISOString().slice(0, 10)
}

/** Liste tous les jours YYYY-MM-DD entre start et end (inclus) */
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
 * Choisit les jours où planifier des séances.
 *
 * Stratégie : répartir les jours de façon uniforme sur chaque semaine.
 * - Pour days_per_week = 3 : Lun, Mer, Ven (indices 0, 2, 4 de la semaine)
 * - Pour days_per_week = 4 : Lun, Mar, Jeu, Ven
 * - Pour days_per_week = 5 : Lun, Mar, Mer, Jeu, Ven
 * - Pour days_per_week = 6 : Lun, Mar, Mer, Jeu, Ven, Sam
 * - Pour days_per_week = 2 : Lun, Jeu
 *
 * Ignorer les jours déjà dans existingDates.
 *
 * @param {string[]} daysInRange   - tous les jours de la plage
 * @param {number}   daysPerWeek   - séances par semaine (2–6)
 * @param {Set}      existingDates - jours déjà planifiés (à ignorer)
 * @returns {string[]} dates des séances à créer
 */
function distributeSlots(daysInRange, daysPerWeek, existingDates) {
  // Indices de jours de semaine (0=Lun, 6=Dim) selon days_per_week
  const PREFERRED_DAYS = {
    2: [0, 3],           // Lun, Jeu
    3: [0, 2, 4],        // Lun, Mer, Ven
    4: [0, 1, 3, 4],     // Lun, Mar, Jeu, Ven
    5: [0, 1, 2, 3, 4],  // Lun au Ven
    6: [0, 1, 2, 3, 4, 5], // Lun au Sam
    7: [0, 1, 2, 3, 4, 5, 6],
  }

  const preferred = PREFERRED_DAYS[daysPerWeek] || PREFERRED_DAYS[3]
  const slots     = []

  // Regrouper les jours par semaine ISO
  const byWeek = {}
  for (const day of daysInRange) {
    const weekKey = isoWeekKey(day)
    if (!byWeek[weekKey]) byWeek[weekKey] = []
    byWeek[weekKey].push(day)
  }

  // Pour chaque semaine, sélectionner les jours préférés non encore planifiés
  for (const [, days] of Object.entries(byWeek).sort()) {
    let addedThisWeek = 0
    for (const day of days) {
      if (addedThisWeek >= daysPerWeek) break
      if (existingDates.has(day)) { addedThisWeek++; continue }

      const d   = new Date(day + 'T12:00:00Z')
      const dow = (d.getUTCDay() + 6) % 7  // 0=Lun, 6=Dim

      if (preferred.includes(dow)) {
        slots.push(day)
        existingDates.add(day)  // éviter les doublons
        addedThisWeek++
      }
    }
  }

  return slots
}

/** Retourne "YYYY-Www" pour une date ISO */
function isoWeekKey(dateIso) {
  const d = new Date(dateIso + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + 3 - ((d.getUTCDay() + 6) % 7))
  const week1 = new Date(Date.UTC(d.getUTCFullYear(), 0, 4))
  const weekNum = 1 + Math.round(
    ((d - week1) / 86400000 - 3 + (week1.getUTCDay() + 6) % 7) / 7
  )
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`
}
