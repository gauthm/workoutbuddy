import { resetProfile } from './userProfile.js'
import { createBackup } from '../db/backup.js'
import express   from 'express'
import fs        from 'fs'
import path      from 'path'
import { getDb, getDbPath } from '../db/database.js'

const router = express.Router()
const db     = getDb()

// ── Helper : autoBackup (identique à sessions.js — duplication assumée) ─
export function autoBackup() {
  try { return createBackup(db, getDbPath()) }
  catch (err) { console.warn('[backup] Erreur :', err.message) }
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
    const program_plans = db.prepare('SELECT * FROM program_plan').all().map(p => ({...p,parameters:JSON.parse(p.parameters),warnings:JSON.parse(p.warnings)}))
    const program_weekly_reviews = db.prepare('SELECT * FROM program_weekly_review').all().map(r => ({...r,evidence:JSON.parse(r.evidence)}))
    const workout_templates  = db.prepare('SELECT * FROM workout_template').all()
    const template_exercises = db.prepare('SELECT * FROM template_exercise').all()
    const progression_states = db.prepare('SELECT * FROM progression_state').all()
    const exercise_progression_events = db.prepare('SELECT * FROM exercise_progression_event').all().map(e=>({...e,context:JSON.parse(e.context)}))
    const exercise_progressions = db.prepare('SELECT * FROM exercise_progression').all()
    const sessions           = db.prepare('SELECT * FROM session').all()
    const session_exercises  = db.prepare('SELECT * FROM session_exercise').all()
    const set_logs           = db.prepare('SELECT * FROM set_log').all()
    const body_weights       = db.prepare('SELECT * FROM body_weight').all()
    const personal_records   = db.prepare('SELECT * FROM personal_record').all()
    const equipment_advice   = db.prepare('SELECT * FROM equipment_advice').all()
    const coach_conversations = db.prepare('SELECT * FROM coach_conversation').all()
    const coach_messages      = db.prepare('SELECT * FROM coach_message').all()
    const profile = db.prepare('SELECT * FROM user_profile WHERE id = 1').get()
    const user_profile = { ...profile, secondary_goals: JSON.parse(profile.secondary_goals) }
    const exercise_exclusions = db.prepare('SELECT id, is_excluded, exclusion_reason FROM exercise WHERE is_excluded = 1').all()

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
        program_plans,
        program_weekly_reviews,
        workout_templates,
        template_exercises,
        progression_states,
        exercise_progressions,
        exercise_progression_events,
        sessions,
        session_exercises,
        set_logs,
        body_weights,
        personal_records,
        equipment_advice,
        coach_conversations,
        coach_messages,
        user_profile,
        exercise_exclusions,
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
    const required = ['exercises','equipment_items','programs','workout_templates',
      'template_exercises','progression_states','sessions','session_exercises',
      'set_logs','body_weights','personal_records','equipment_advice']
    if (required.some(key => !Array.isArray(d[key])) || !d.settings || typeof d.settings !== 'object' || Array.isArray(d.settings)) {
      return res.status(400).json({ error: 'INVALID_IMPORT_FORMAT', detail: 'Export incomplet : tables ou paramètres manquants.' })
    }
    for (const key of ['coach_conversations','coach_messages','exercise_exclusions']) {
      if (d[key] !== undefined && !Array.isArray(d[key])) return res.status(400).json({ error: 'INVALID_IMPORT_FORMAT' })
    }
    if ((d.coach_conversations === undefined) !== (d.coach_messages === undefined)) return res.status(400).json({ error: 'INVALID_IMPORT_FORMAT' })
    if (d.user_profile !== undefined && (!d.user_profile || typeof d.user_profile !== 'object' || Array.isArray(d.user_profile))) return res.status(400).json({ error: 'INVALID_IMPORT_FORMAT' })
    const customIds = new Set()
    for (const exercise of d.exercises) {
      if (!exercise || typeof exercise.id !== 'string' || !exercise.id || customIds.has(exercise.id)
        || db.prepare('SELECT id FROM exercise WHERE id = ? AND is_custom = 0').get(exercise.id)) {
        return res.status(400).json({ error: 'INVALID_IMPORT_FORMAT', detail: 'Identifiant d’exercice personnalisé invalide ou dupliqué.' })
      }
      customIds.add(exercise.id)
    }

    // Sauvegarder avant l'import (protection)
    createBackup(db, getDbPath(), { force: true })

    const counts = {}

    db.transaction(() => {
      // Vider dans l'ordre correct (FK-safe) : personal_record référence set_log
      if (d.coach_conversations !== undefined) {
        db.prepare('DELETE FROM coach_message').run()
        db.prepare('DELETE FROM coach_conversation').run()
      }
      db.prepare('DELETE FROM personal_record').run()
      db.prepare('DELETE FROM set_log').run()
      db.prepare('DELETE FROM session_exercise').run()
      db.prepare('DELETE FROM session').run()
      db.prepare('DELETE FROM exercise_progression').run()
      db.prepare('DELETE FROM progression_state').run()
      db.prepare('DELETE FROM template_exercise').run()
      db.prepare('DELETE FROM workout_template').run()
      db.prepare('DELETE FROM program').run()
      db.prepare('DELETE FROM equipment_item').run()
      db.prepare('DELETE FROM program_weekly_review').run()
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
               instructions_fr, instructions_en, image_paths, is_custom, is_unilateral, created_at, is_excluded, exclusion_reason)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
          `).run(
            ex.id, ex.name_fr, ex.name_en, ex.category, ex.force, ex.mechanic,
            ex.movement_pattern,
            serializeJson(ex.primary_muscles),
            serializeJson(ex.secondary_muscles),
            serializeJson(ex.equipment_required),
            serializeJson(ex.instructions_fr),
            serializeJson(ex.instructions_en),
            serializeJson(ex.image_paths),
            1,
            ex.is_unilateral ? 1 : 0,
            ex.created_at || new Date().toISOString(),
            ex.is_excluded ? 1 : 0, ex.exclusion_reason ?? null
          )
        }
        counts.exercises = d.exercises.length
      }

      if (d.exercise_exclusions !== undefined) {
        db.prepare('UPDATE exercise SET is_excluded = 0, exclusion_reason = NULL').run()
        for (const ex of d.exercise_exclusions) {
          const result = db.prepare('UPDATE exercise SET is_excluded = 1, exclusion_reason = ? WHERE id = ?').run(ex.exclusion_reason ?? null, ex.id)
          if (!result.changes) throw new Error('Exercice exclu inconnu.')
        }
      }
      if (d.user_profile !== undefined) {
        const fields = db.prepare('PRAGMA table_info(user_profile)').all().map(row => row.name).filter(key => key !== 'id')
        const profile = d.user_profile
        const values = fields.map(key => key === 'secondary_goals' ? serializeJson(profile[key])
          : ['prefers_exercise_variation','onboarding_completed'].includes(key) ? (profile[key] ? 1 : 0) : profile[key] ?? null)
        db.prepare(`UPDATE user_profile SET ${fields.map(key => `${key} = ?`).join(', ')} WHERE id = 1`).run(...values)
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
               last_deload_date, is_in_deload, current_week, created_at, updated_at, started_on)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
          `).run(
            p.id, p.name, p.description, p.goal, p.level, p.days_per_week,
            p.duration_weeks, p.is_active, p.use_exercise_rotation,
            p.rotation_frequency_weeks, p.progression_model, p.deload_auto_enabled,
            p.deload_frequency_weeks, p.deload_load_reduction_pct,
            p.deload_volume_reduction_pct, p.last_deload_date, p.is_in_deload,
            p.current_week, p.created_at, p.updated_at, p.started_on ?? (p.is_active ? p.created_at.slice(0,10) : null)
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

      for (const plan of (d.program_plans || [])) {
        db.prepare('INSERT INTO program_plan (program_id,engine_version,parameters,warnings) VALUES (?,?,?,?)')
          .run(plan.program_id,plan.engine_version,JSON.stringify(plan.parameters),JSON.stringify(plan.warnings))
      }
      for (const review of (d.program_weekly_reviews || [])) {
        db.prepare('INSERT INTO program_weekly_review (id,program_id,week_start,decision,evidence,created_at) VALUES (?,?,?,?,?,?)')
          .run(review.id,review.program_id,review.week_start,review.decision,JSON.stringify(review.evidence),review.created_at)
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
               is_deload, notes, created_at, updated_at, original_scheduled_date)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
          `).run(
            s.id, s.workout_template_id, s.program_id, s.name, s.scheduled_date,
            s.started_at, s.completed_at, s.status, s.duration_seconds,
            s.total_volume_kg, s.rpe_avg, s.is_deload, s.notes,
            s.created_at, s.updated_at, s.original_scheduled_date ?? s.scheduled_date
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

      for (const event of d.exercise_progression_events || []) {
        db.prepare('INSERT INTO exercise_progression_event(session_exercise_id,context) VALUES (?,?)').run(event.session_exercise_id,JSON.stringify(event.context))
      }
      if (Array.isArray(d.exercise_progressions)) {
        for (const ps of d.exercise_progressions) {
          db.prepare(`INSERT INTO exercise_progression (exercise_id,current_weight_kg,current_target_reps,
            consecutive_failures,target_reps_min,target_reps_max,last_session_id,last_updated) VALUES (?,?,?,?,?,?,?,?)`)
            .run(ps.exercise_id,ps.current_weight_kg,ps.current_target_reps,ps.consecutive_failures,ps.target_reps_min,ps.target_reps_max,ps.last_session_id,ps.last_updated)
        }
      } else {
        db.prepare(`INSERT OR IGNORE INTO exercise_progression
          (exercise_id,current_weight_kg,current_target_reps,consecutive_failures,target_reps_min,target_reps_max,last_session_id,last_updated)
          SELECT te.exercise_id,ps.current_weight_kg,ps.current_target_reps,ps.consecutive_failures,
            te.target_reps_min,te.target_reps_max,ps.last_session_id,ps.last_updated FROM progression_state ps
          JOIN template_exercise te ON te.id=ps.template_exercise_id WHERE ps.last_session_id IS NOT NULL
          ORDER BY ps.last_updated DESC,ps.last_session_id DESC`).run()
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

      if (Array.isArray(d.coach_conversations)) {
        const stmt = db.prepare(`
          INSERT OR IGNORE INTO coach_conversation (id, title, is_active, created_at, updated_at)
          VALUES (@id, @title, @is_active, @created_at, @updated_at)
        `)
        for (const c of d.coach_conversations) {
          stmt.run({ is_active: 0, ...c })  // défauts si champ absent
          counts.coach_conversations = (counts.coach_conversations || 0) + 1
        }
        // Garantir l'invariant : un seul actif
        const actives = db.prepare('SELECT id FROM coach_conversation WHERE is_active = 1 ORDER BY id DESC').all()
        if (actives.length > 1) {
          db.prepare('UPDATE coach_conversation SET is_active = 0 WHERE id != ?').run(actives[0].id)
        }
      }

      if (Array.isArray(d.coach_messages)) {
        const stmt = db.prepare(`
          INSERT OR IGNORE INTO coach_message (id, conversation_id, role, content, created_at)
          VALUES (@id, @conversation_id, @role, @content, @created_at)
        `)
        for (const m of d.coach_messages) {
          stmt.run(m)
          counts.coach_messages = (counts.coach_messages || 0) + 1
        }
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

// ── POST /reset-stats ─────────────────────────────────────────
// Efface uniquement les données d'activité (séances, séries, poids, records,
// état de progression) sans toucher aux programmes, exercices, équipement,
// paramètres.
router.post('/reset-stats', (req, res) => {
  try {
    // Sauvegarder avant d'effacer
    createBackup(db, getDbPath(), { force: true })

    db.transaction(() => {
      // Ordre FK-safe : personal_record référence set_log (NO ACTION)
      db.prepare('DELETE FROM personal_record').run()
      db.prepare('DELETE FROM set_log').run()
      db.prepare('DELETE FROM session_exercise').run()
      db.prepare('DELETE FROM session').run()
      db.prepare('DELETE FROM program_weekly_review').run()
      db.prepare('DELETE FROM exercise_progression').run()
      db.prepare('DELETE FROM body_weight').run()
      db.prepare('DELETE FROM equipment_advice').run()

      // Remettre les états de progression à zéro
      // (garder les lignes — elles sont liées aux template_exercises)
      db.prepare(`
        UPDATE progression_state
        SET current_weight_kg    = 0,
            current_target_reps  = NULL,
            consecutive_failures = 0,
            last_session_id      = NULL,
            last_updated         = datetime('now')
      `).run()

      // Remettre la semaine courante des programmes à 1
      db.prepare(`
        UPDATE program
        SET current_week     = 1,
            is_in_deload     = 0,
            last_deload_date = NULL,
            updated_at       = datetime('now')
      `).run()
    })()

    res.json({
      message: 'Statistiques et historique réinitialisés.',
      cleared: ['sessions', 'set_logs', 'body_weights',
                'personal_records', 'equipment_advice',
                'progression_states (reset to 0)'],
    })
  } catch (err) {
    console.error('[POST /reset-stats]', err.message)
    res.status(500).json({ error: 'INTERNAL_ERROR' })
  }
})

// Explicit full user-data reset: application settings and built-in catalog are retained.
router.post('/reset-all', (req,res) => {
  try {
    createBackup(db,getDbPath(),{force:true})
    db.transaction(() => {
      for (const table of ['personal_record','set_log','session_exercise','session','exercise_progression',
        'progression_state','template_exercise','workout_template','program','equipment_item','body_weight',
        'equipment_advice','coach_message','coach_conversation']) db.prepare(`DELETE FROM ${table}`).run()
      db.prepare('DELETE FROM exercise WHERE is_custom=1').run()
      db.prepare('UPDATE exercise SET is_excluded=0,exclusion_reason=NULL').run()
      resetProfile(db)
      db.prepare("UPDATE settings SET value='[]' WHERE key='painful_muscles'").run()
    })()
    res.json({ reset:true,settings_retained:true })
  } catch (err) {
    console.error('[POST /reset-all]',err.message)
    res.status(500).json({error:'INTERNAL_ERROR'})
  }
})

// ── POST /backup ──────────────────────────────────────────────
router.post('/backup', (req, res) => {
  try {
    createBackup(db, getDbPath(), { force: true })
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
