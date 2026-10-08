import express   from 'express'
import fs        from 'fs'
import path      from 'path'
import { getDb, getDbPath } from '../db/database.js'

const router = express.Router()
const db     = getDb()

// ── Helper : autoBackup (identique à sessions.js — duplication assumée) ─
export function autoBackup() {
  try {
    const today     = new Date().toISOString().slice(0, 10)
    const src       = getDbPath()
    const backupDir = path.join(path.dirname(src), 'backups')
    fs.mkdirSync(backupDir, { recursive: true })

    const dest = path.join(backupDir, `workoutbuddy_${today}.db`)
    if (!fs.existsSync(dest)) {
      fs.copyFileSync(src, dest)
      console.log(`[backup] Sauvegarde créée : ${dest}`)
    }

    // Conserver les 7 dernières sauvegardes
    const files = fs.readdirSync(backupDir)
      .filter(f => f.endsWith('.db'))
      .sort()
      .reverse()
    for (const f of files.slice(7)) {
      fs.unlinkSync(path.join(backupDir, f))
    }
  } catch (err) {
    console.warn('[backup] Erreur :', err.message)
    // Non bloquant
  }
}

// ── GET /export ───────────────────────────────────────────────
router.get('/export', (req, res) => {
  try {
    const today = new Date().toISOString()

    // Exercices customs uniquement
    const exercises = db.prepare(
      'SELECT * FROM exercise WHERE is_custom = 1'
    ).all().map(deserializeExercise)

    // Toutes les autres tables
    const equipment_items    = db.prepare('SELECT * FROM equipment_item').all()
    const programs           = db.prepare('SELECT * FROM program').all()
    const workout_templates  = db.prepare('SELECT * FROM workout_template').all()
    const template_exercises = db.prepare('SELECT * FROM template_exercise').all()
    const progression_states = db.prepare('SELECT * FROM progression_state').all()
    const sessions           = db.prepare('SELECT * FROM session').all()
    const session_exercises  = db.prepare('SELECT * FROM session_exercise').all()
    const set_logs           = db.prepare('SELECT * FROM set_log').all()
    const body_weights       = db.prepare('SELECT * FROM body_weight').all()
    const personal_records   = db.prepare('SELECT * FROM personal_record').all()
    const equipment_advice   = db.prepare('SELECT * FROM equipment_advice').all()

    // Settings (sans ai_api_key)
    const settingsRows = db.prepare(
      "SELECT key, value FROM settings WHERE key != 'ai_api_key'"
    ).all()
    const settings = {}
    for (const r of settingsRows) settings[r.key] = JSON.parse(r.value)

    const payload = {
      version:     1,
      app:         'workoutbuddy',
      exported_at: today,
      data: {
        exercises,
        equipment_items,
        programs,
        workout_templates,
        template_exercises,
        progression_states,
        sessions,
        session_exercises,
        set_logs,
        body_weights,
        personal_records,
        equipment_advice,
        settings,
      }
    }

    const filename = `workoutbuddy-export-${today.slice(0, 10)}.json`
    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.json(payload)
  } catch (err) {
    console.error('[GET /export]', err.message)
    res.status(500).json({ error: 'INTERNAL_ERROR' })
  }
})

// ── POST /import ──────────────────────────────────────────────
router.post('/import', (req, res) => {
  try {
    const payload = req.body

    // Validation de base
    if (!payload || typeof payload !== 'object') {
      return res.status(400).json({ error: 'INVALID_IMPORT_FORMAT', detail: 'Corps JSON manquant.' })
    }
    if (payload.version !== 1) {
      return res.status(400).json({
        error:  'INVALID_IMPORT_FORMAT',
        detail: `Version ${payload.version} non supportée. Version attendue : 1.`,
      })
    }
    if (payload.app !== 'workoutbuddy') {
      return res.status(400).json({
        error:  'INVALID_IMPORT_FORMAT',
        detail: `Application "${payload.app}" non reconnue.`,
      })
    }
    if (!payload.data || typeof payload.data !== 'object') {
      return res.status(400).json({ error: 'INVALID_IMPORT_FORMAT', detail: 'Champ "data" manquant.' })
    }

    const d = payload.data

    // Sauvegarder avant l'import (protection)
    autoBackup()

    const counts = {}

    db.transaction(() => {
      // Vider dans l'ordre correct (FK-safe)
      db.prepare('DELETE FROM set_log').run()
      db.prepare('DELETE FROM session_exercise').run()
      db.prepare('DELETE FROM session').run()
      db.prepare('DELETE FROM progression_state').run()
      db.prepare('DELETE FROM template_exercise').run()
      db.prepare('DELETE FROM workout_template').run()
      db.prepare('DELETE FROM program').run()
      db.prepare('DELETE FROM equipment_item').run()
      db.prepare('DELETE FROM personal_record').run()
      db.prepare('DELETE FROM body_weight').run()
      db.prepare('DELETE FROM equipment_advice').run()
      // Supprimer uniquement les exercices custom (garder les built-in)
      db.prepare('DELETE FROM exercise WHERE is_custom = 1').run()

      // Réinsérer exercices custom
      if (Array.isArray(d.exercises)) {
        for (const ex of d.exercises) {
          db.prepare(`
            INSERT OR IGNORE INTO exercise
              (id, name_fr, name_en, category, force, mechanic, movement_pattern,
               primary_muscles, secondary_muscles, equipment_required,
               instructions_fr, instructions_en, image_paths, is_custom, is_unilateral, created_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
          `).run(
            ex.id, ex.name_fr, ex.name_en, ex.category, ex.force, ex.mechanic,
            ex.movement_pattern,
            serializeJson(ex.primary_muscles),
            serializeJson(ex.secondary_muscles),
            serializeJson(ex.equipment_required),
            serializeJson(ex.instructions_fr),
            serializeJson(ex.instructions_en),
            serializeJson(ex.image_paths),
            ex.is_custom ? 1 : 0,
            ex.is_unilateral ? 1 : 0,
            ex.created_at || new Date().toISOString()
          )
        }
        counts.exercises = d.exercises.length
      }

      // equipment_item
      if (Array.isArray(d.equipment_items)) {
        for (const item of d.equipment_items) {
          db.prepare(`
            INSERT INTO equipment_item
              (id, category, name, weight_kg, count, weight_min_kg, weight_max_kg,
               weight_step_kg, resistance_min_kg, resistance_max_kg, notes, created_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
          `).run(
            item.id, item.category, item.name, item.weight_kg ?? null, item.count,
            item.weight_min_kg ?? null, item.weight_max_kg ?? null, item.weight_step_kg ?? null,
            item.resistance_min_kg ?? null, item.resistance_max_kg ?? null, item.notes ?? null,
            item.created_at
          )
        }
        counts.equipment_items = d.equipment_items.length
      }

      // program
      if (Array.isArray(d.programs)) {
        for (const p of d.programs) {
          db.prepare(`
            INSERT INTO program
              (id, name, description, goal, level, days_per_week, duration_weeks,
               is_active, use_exercise_rotation, rotation_frequency_weeks,
               progression_model, deload_auto_enabled, deload_frequency_weeks,
               deload_load_reduction_pct, deload_volume_reduction_pct,
               last_deload_date, is_in_deload, current_week, created_at, updated_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
          `).run(
            p.id, p.name, p.description, p.goal, p.level, p.days_per_week,
            p.duration_weeks, p.is_active, p.use_exercise_rotation,
            p.rotation_frequency_weeks, p.progression_model, p.deload_auto_enabled,
            p.deload_frequency_weeks, p.deload_load_reduction_pct,
            p.deload_volume_reduction_pct, p.last_deload_date, p.is_in_deload,
            p.current_week, p.created_at, p.updated_at
          )
        }
        counts.programs = d.programs.length
      }

      // workout_template
      if (Array.isArray(d.workout_templates)) {
        for (const wt of d.workout_templates) {
          db.prepare(`
            INSERT INTO workout_template (id, program_id, name, day_of_week, order_index, created_at)
            VALUES (?,?,?,?,?,?)
          `).run(wt.id, wt.program_id, wt.name, wt.day_of_week, wt.order_index, wt.created_at)
        }
        counts.workout_templates = d.workout_templates.length
      }

      // template_exercise
      if (Array.isArray(d.template_exercises)) {
        for (const te of d.template_exercises) {
          db.prepare(`
            INSERT INTO template_exercise
              (id, workout_template_id, exercise_id, order_index, target_sets,
               target_reps_min, target_reps_max, target_reps, rest_seconds,
               progression_model, progression_weight_increment_kg,
               rir_target, rpe_target, rotation_group, current_rotation_index, notes, created_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
          `).run(
            te.id, te.workout_template_id, te.exercise_id, te.order_index,
            te.target_sets, te.target_reps_min, te.target_reps_max, te.target_reps,
            te.rest_seconds, te.progression_model, te.progression_weight_increment_kg,
            te.rir_target, te.rpe_target, te.rotation_group,
            te.current_rotation_index || 0, te.notes, te.created_at
          )
        }
        counts.template_exercises = d.template_exercises.length
      }

      // progression_state
      if (Array.isArray(d.progression_states)) {
        for (const ps of d.progression_states) {
          db.prepare(`
            INSERT INTO progression_state
              (id, template_exercise_id, current_weight_kg, current_target_reps,
               consecutive_failures, last_session_id, last_updated)
            VALUES (?,?,?,?,?,?,?)
          `).run(
            ps.id, ps.template_exercise_id, ps.current_weight_kg,
            ps.current_target_reps, ps.consecutive_failures,
            ps.last_session_id, ps.last_updated
          )
        }
        counts.progression_states = d.progression_states.length
      }

      // session
      if (Array.isArray(d.sessions)) {
        for (const s of d.sessions) {
          db.prepare(`
            INSERT INTO session
              (id, workout_template_id, program_id, name, scheduled_date, started_at,
               completed_at, status, duration_seconds, total_volume_kg, rpe_avg,
               is_deload, notes, created_at, updated_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
          `).run(
            s.id, s.workout_template_id, s.program_id, s.name, s.scheduled_date,
            s.started_at, s.completed_at, s.status, s.duration_seconds,
            s.total_volume_kg, s.rpe_avg, s.is_deload, s.notes,
            s.created_at, s.updated_at
          )
        }
        counts.sessions = d.sessions.length
      }

      // session_exercise
      if (Array.isArray(d.session_exercises)) {
        for (const se of d.session_exercises) {
          db.prepare(`
            INSERT INTO session_exercise
              (id, session_id, exercise_id, template_exercise_id, order_index, notes, created_at)
            VALUES (?,?,?,?,?,?,?)
          `).run(
            se.id, se.session_id, se.exercise_id, se.template_exercise_id,
            se.order_index, se.notes, se.created_at
          )
        }
        counts.session_exercises = d.session_exercises.length
      }

      // set_log
      if (Array.isArray(d.set_logs)) {
        for (const sl of d.set_logs) {
          db.prepare(`
            INSERT INTO set_log
              (id, session_exercise_id, set_number, weight_kg, reps, rpe, rir,
               is_warmup, is_completed, duration_seconds, rest_seconds_after, notes, created_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
          `).run(
            sl.id, sl.session_exercise_id, sl.set_number, sl.weight_kg, sl.reps,
            sl.rpe, sl.rir, sl.is_warmup, sl.is_completed, sl.duration_seconds,
            sl.rest_seconds_after, sl.notes, sl.created_at
          )
        }
        counts.set_logs = d.set_logs.length
      }

      // body_weight
      if (Array.isArray(d.body_weights)) {
        for (const bw of d.body_weights) {
          db.prepare(`
            INSERT OR IGNORE INTO body_weight (id, date, weight_kg, notes, created_at)
            VALUES (?,?,?,?,?)
          `).run(bw.id, bw.date, bw.weight_kg, bw.notes, bw.created_at)
        }
        counts.body_weights = d.body_weights.length
      }

      // personal_record
      if (Array.isArray(d.personal_records)) {
        for (const pr of d.personal_records) {
          db.prepare(`
            INSERT INTO personal_record
              (id, exercise_id, reps, weight_kg, estimated_1rm_kg, achieved_date, set_log_id, created_at)
            VALUES (?,?,?,?,?,?,?,?)
          `).run(
            pr.id, pr.exercise_id, pr.reps, pr.weight_kg, pr.estimated_1rm_kg,
            pr.achieved_date, pr.set_log_id, pr.created_at
          )
        }
        counts.personal_records = d.personal_records.length
      }

      // equipment_advice
      if (Array.isArray(d.equipment_advice)) {
        for (const ea of d.equipment_advice) {
          db.prepare(`
            INSERT INTO equipment_advice
              (id, signal_type, exercise_id, muscle_group, movement_pattern,
               signal_data, advice_text, status, dismissed_at, purchased_at,
               last_generated_at, created_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
          `).run(
            ea.id, ea.signal_type, ea.exercise_id, ea.muscle_group, ea.movement_pattern,
            ea.signal_data, ea.advice_text, ea.status, ea.dismissed_at, ea.purchased_at,
            ea.last_generated_at, ea.created_at
          )
        }
        counts.equipment_advice = d.equipment_advice.length
      }

      // settings (sans ai_api_key)
      if (d.settings && typeof d.settings === 'object') {
        const stmt = db.prepare(`
          INSERT INTO settings (key, value, updated_at)
          VALUES (?, ?, datetime('now'))
          ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
        `)
        for (const [key, value] of Object.entries(d.settings)) {
          if (key === 'ai_api_key') continue  // ne jamais importer la clé API
          stmt.run(key, JSON.stringify(value))
        }
        counts.settings = Object.keys(d.settings).length
      }
    })()

    res.json({ imported: counts })
  } catch (err) {
    console.error('[POST /import]', err.message)
    res.status(400).json({ error: 'INVALID_IMPORT_FORMAT', detail: err.message })
  }
})

// ── GET /export/csv/:table ────────────────────────────────────
router.get('/export/csv/:table', (req, res) => {
  const ALLOWED = {
    sessions:         'SELECT id, name, scheduled_date, status, duration_seconds, total_volume_kg, rpe_avg, is_deload FROM session ORDER BY scheduled_date',
    set_logs:         'SELECT sl.id, se.exercise_id, s.scheduled_date, sl.set_number, sl.weight_kg, sl.reps, sl.rpe, sl.rir, sl.is_warmup, sl.is_completed FROM set_log sl JOIN session_exercise se ON sl.session_exercise_id=se.id JOIN session s ON se.session_id=s.id ORDER BY s.scheduled_date, sl.id',
    body_weights:     'SELECT id, date, weight_kg, notes FROM body_weight ORDER BY date',
    personal_records: 'SELECT pr.id, pr.exercise_id, e.name_fr, pr.reps, pr.weight_kg, pr.estimated_1rm_kg, pr.achieved_date FROM personal_record pr JOIN exercise e ON pr.exercise_id=e.id ORDER BY pr.achieved_date',
  }

  const table = req.params.table
  if (!ALLOWED[table]) {
    return res.status(400).json({
      error:  'INVALID_TABLE',
      detail: `Table autorisée : ${Object.keys(ALLOWED).join(', ')}`,
    })
  }

  try {
    const rows = db.prepare(ALLOWED[table]).all()
    if (rows.length === 0) {
      return res.status(200)
        .setHeader('Content-Type', 'text/csv; charset=utf-8')
        .send('\uFEFF')  // BOM UTF-8 uniquement
    }

    // Générer le CSV
    const headers = Object.keys(rows[0])
    const csvLines = [
      '\uFEFF' + headers.join(';'),  // BOM UTF-8 + en-têtes (séparateur ; pour Excel FR)
      ...rows.map(row =>
        headers.map(h => {
          const val = row[h]
          if (val === null || val === undefined) return ''
          const str = String(val)
          // Échapper les valeurs avec guillemets si nécessaire
          if (str.includes(';') || str.includes('"') || str.includes('\n')) {
            return '"' + str.replace(/"/g, '""') + '"'
          }
          return str
        }).join(';')
      )
    ]

    const filename = `${table}-${new Date().toISOString().slice(0, 10)}.csv`
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.send(csvLines.join('\n'))
  } catch (err) {
    console.error(`[GET /export/csv/${table}]`, err.message)
    res.status(500).json({ error: 'INTERNAL_ERROR' })
  }
})

// ── POST /backup ──────────────────────────────────────────────
router.post('/backup', (req, res) => {
  try {
    autoBackup()
    const backupDir = path.join(path.dirname(getDbPath()), 'backups')
    const files = fs.existsSync(backupDir)
      ? fs.readdirSync(backupDir).filter(f => f.endsWith('.db')).sort().reverse()
      : []
    res.json({
      message:      'Sauvegarde effectuée.',
      backup_count: files.length,
      latest:       files[0] || null,
    })
  } catch (err) {
    console.error('[POST /backup]', err.message)
    res.status(500).json({ error: 'INTERNAL_ERROR' })
  }
})

// ── Helpers ───────────────────────────────────────────────────
function serializeJson(val) {
  if (!val) return '[]'
  if (typeof val === 'string') return val  // déjà sérialisé
  return JSON.stringify(val)
}

function deserializeExercise(row) {
  return {
    ...row,
    primary_muscles:    JSON.parse(row.primary_muscles    || '[]'),
    secondary_muscles:  JSON.parse(row.secondary_muscles  || '[]'),
    equipment_required: JSON.parse(row.equipment_required || '[]'),
    instructions_fr:    JSON.parse(row.instructions_fr    || '[]'),
    instructions_en:    JSON.parse(row.instructions_en    || '[]'),
    image_paths:        JSON.parse(row.image_paths        || '[]'),
    is_custom:     row.is_custom     === 1,
    is_unilateral: row.is_unilateral === 1,
  }
}

export default router
