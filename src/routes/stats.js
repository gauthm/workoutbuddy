import express from 'express'
import { getDb }             from '../db/database.js'
import { calculateStreaks }  from '../services/streakCalculator.js'
import { estimate1RM }       from '../services/rmCalculator.js'

const router = express.Router()
const db     = getDb()

function getFormula(db) {
  const row = db.prepare("SELECT value FROM settings WHERE key = 'rm_formula'").get()
  return row ? JSON.parse(row.value) : 'epley'
}

// ── GET /stats/overview ───────────────────────────────────────
router.get('/overview', (req, res) => {
  try {
    const streaks = calculateStreaks(db)

    const totalVolumeRow = db.prepare(`
      SELECT COALESCE(SUM(total_volume_kg), 0) AS vol
      FROM session WHERE status = 'completed'
    `).get()

    const lastSession = db.prepare(
      "SELECT scheduled_date FROM session WHERE status = 'completed' ORDER BY scheduled_date DESC LIMIT 1"
    ).get()

    const activeProgram = db.prepare(
      "SELECT name FROM program WHERE is_active = 1 LIMIT 1"
    ).get()

    const prCount = db.prepare(
      'SELECT COUNT(*) AS n FROM personal_record'
    ).get()

    res.json({
      total_sessions:       streaks.total_sessions,
      total_volume_kg:      Math.round((totalVolumeRow.vol || 0) * 100) / 100,
      current_week_streak:  streaks.current_week_streak,
      longest_week_streak:  streaks.longest_week_streak,
      total_weeks_trained:  streaks.total_weeks,
      active_program_name:  activeProgram?.name || null,
      last_session_date:    lastSession?.scheduled_date || null,
      personal_records_count: prCount.n,
    })
  } catch (err) {
    console.error('[GET /stats/overview]', err.message)
    res.status(500).json({ error: 'INTERNAL_ERROR' })
  }
})

// ── GET /stats/streaks ────────────────────────────────────────
router.get('/streaks', (req, res) => {
  try {
    const streaks = calculateStreaks(db)
    res.json(streaks)
  } catch (err) {
    console.error('[GET /stats/streaks]', err.message)
    res.status(500).json({ error: 'INTERNAL_ERROR' })
  }
})

// ── GET /stats/volume ─────────────────────────────────────────
// Query: weeks=12 (défaut 12), group_by='week'|'muscle' (défaut 'week')
router.get('/volume', (req, res) => {
  try {
    const weeks   = Math.min(parseInt(req.query.weeks) || 12, 52)
    const groupBy = req.query.group_by === 'muscle' ? 'muscle' : 'week'

    if (groupBy === 'week') {
      // Volume total par semaine ISO
      const rows = db.prepare(`
        SELECT
          strftime('%Y', s.scheduled_date)                      AS year,
          CAST(strftime('%W', s.scheduled_date) AS INTEGER) + 1 AS week_num,
          COALESCE(SUM(sl.weight_kg * sl.reps), 0)              AS volume_kg,
          COUNT(DISTINCT sl.id)                                  AS sets
        FROM session s
        JOIN session_exercise se ON se.session_id = s.id
        JOIN set_log sl          ON sl.session_exercise_id = se.id
        WHERE s.status        = 'completed'
          AND sl.is_warmup    = 0
          AND sl.is_completed = 1
          AND s.scheduled_date >= date('now', ? || ' days')
        GROUP BY year, week_num
        ORDER BY year ASC, week_num ASC
      `).all(`-${weeks * 7}`)

      // Formater en "YYYY-Www"
      const data = rows.map(r => ({
        period:    `${r.year}-W${String(r.week_num).padStart(2, '0')}`,
        volume_kg: Math.round(r.volume_kg * 100) / 100,
        sets:      r.sets,
      }))
      return res.json({ data })
    }

    // group_by = 'muscle'
    // Récupérer les séries récentes avec l'exercice associé
    const rows = db.prepare(`
      SELECT
        e.primary_muscles,
        strftime('%Y', s.scheduled_date)                      AS year,
        CAST(strftime('%W', s.scheduled_date) AS INTEGER) + 1 AS week_num,
        SUM(sl.weight_kg * sl.reps)                            AS volume_kg,
        COUNT(DISTINCT sl.id)                                  AS sets
      FROM session s
      JOIN session_exercise se ON se.session_id = s.id
      JOIN set_log sl          ON sl.session_exercise_id = se.id
      JOIN exercise e          ON se.exercise_id = e.id
      WHERE s.status        = 'completed'
        AND sl.is_warmup    = 0
        AND sl.is_completed = 1
        AND s.scheduled_date >= date('now', ? || ' days')
      GROUP BY e.id, year, week_num
      ORDER BY year ASC, week_num ASC
    `).all(`-${weeks * 7}`)

    // Éclater par muscle primaire
    const data = []
    for (const row of rows) {
      const muscles = JSON.parse(row.primary_muscles || '[]')
      const primary = muscles[0] || 'other'
      data.push({
        period:    `${row.year}-W${String(row.week_num).padStart(2, '0')}`,
        muscle:    primary,
        volume_kg: Math.round((row.volume_kg || 0) * 100) / 100,
        sets:      row.sets,
      })
    }
    res.json({ data })
  } catch (err) {
    console.error('[GET /stats/volume]', err.message)
    res.status(500).json({ error: 'INTERNAL_ERROR' })
  }
})

// ── GET /stats/exercises/:id/progress ────────────────────────
// Query: days=180 (défaut 180)
router.get('/exercises/:id/progress', (req, res) => {
  try {
    const exercise = db.prepare('SELECT id FROM exercise WHERE id = ?').get(req.params.id)
    if (!exercise) return res.status(404).json({ error: 'EXERCISE_NOT_FOUND' })

    const days    = Math.min(parseInt(req.query.days) || 180, 365 * 2)
    const formula = getFormula(db)

    const rows = db.prepare(`
      SELECT
        date(s.scheduled_date) AS date,
        MAX(sl.weight_kg)      AS best_weight,
        MAX(sl.reps)           AS best_reps_at_best_weight,
        MAX(sl.weight_kg * (1.0 + sl.reps / 30.0)) AS estimated_1rm
      FROM session s
      JOIN session_exercise se ON se.session_id = s.id
      JOIN set_log sl          ON sl.session_exercise_id = se.id
      WHERE se.exercise_id  = ?
        AND s.status        = 'completed'
        AND sl.is_warmup    = 0
        AND sl.is_completed = 1
        AND sl.reps         > 0
        AND sl.weight_kg    > 0
        AND s.scheduled_date >= date('now', ? || ' days')
      GROUP BY date(s.scheduled_date)
      ORDER BY date ASC
    `).all(req.params.id, `-${days}`)

    // Recalculer avec la formule configurée (Epley par défaut dans la requête)
    // Pour d'autres formules, recalculer côté JS
    const data = rows.map(r => ({
      date:             r.date,
      weight_kg:        r.best_weight,
      reps:             r.best_reps_at_best_weight,
      estimated_1rm_kg: Math.round(
        estimate1RM(r.best_weight, r.best_reps_at_best_weight, formula) * 100
      ) / 100,
    }))

    res.json({ exercise_id: req.params.id, formula, data })
  } catch (err) {
    console.error('[GET /stats/exercises/:id/progress]', err.message)
    res.status(500).json({ error: 'INTERNAL_ERROR' })
  }
})

// ── GET /stats/personal-records ──────────────────────────────
// Query: exercise_id=... (optionnel)
router.get('/personal-records', (req, res) => {
  try {
    let sql = `
      SELECT pr.*, e.name_fr, e.name_en
      FROM personal_record pr
      JOIN exercise e ON pr.exercise_id = e.id
    `
    const params = []
    if (req.query.exercise_id) {
      sql += ' WHERE pr.exercise_id = ?'
      params.push(req.query.exercise_id)
    }
    sql += ' ORDER BY pr.achieved_date DESC, pr.estimated_1rm_kg DESC'

    const rows = db.prepare(sql).all(...params)
    const records = rows.map(r => ({
      id:               r.id,
      exercise_id:      r.exercise_id,
      exercise_name_fr: r.name_fr,
      exercise_name_en: r.name_en,
      reps:             r.reps,
      weight_kg:        r.weight_kg,
      estimated_1rm_kg: r.estimated_1rm_kg,
      achieved_date:    r.achieved_date,
    }))

    res.json({ records })
  } catch (err) {
    console.error('[GET /stats/personal-records]', err.message)
    res.status(500).json({ error: 'INTERNAL_ERROR' })
  }
})

export default router
