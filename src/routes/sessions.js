import { saveProgressionEvent, rebuildExerciseProgression, saveExerciseProgression, synchronizeTemplateProgression } from '../services/exerciseProgression.js'
import { cannotStartProgram } from '../services/programLifecycle.js'
import { localIsoDate, parseUtcTimestamp } from '../services/date.js'
import { refreshPersonalRecords } from '../services/personalRecords.js'
import { createBackup } from '../db/backup.js'
import express from 'express'
import { getDb, getDbPath } from '../db/database.js'
import { computeNextState, resolveProgressionModel } from '../services/progressionEngine.js'
import { calculateAchievableLoads } from '../services/equipmentCalc.js'
import { estimate1RM, weightForReps }              from '../services/rmCalculator.js'
import { reviewProgramWeek, expireProgramDeload } from '../services/programReview.js'
import { computeDeloadTargets } from '../services/deloadEngine.js'
import { shouldDeload }             from '../services/deloadEngine.js'
import { detectPlateau }            from '../services/plateauDetector.js'
import { getExerciseForWeek }       from '../services/rotationEngine.js'
import { suggestFirstTime }         from '../services/firstTimeSuggestion.js'
import { runAllSignalChecks }       from '../services/coachingAdvisor.js'
import { generatePendingAdviceTexts } from '../services/adviceTextGenerator.js'
import { scheduleWeeks }              from '../services/sessionScheduler.js'

const router = express.Router()
const db = getDb()

function autoBackup() {
  try { return createBackup(db, getDbPath()) }
  catch (err) { console.warn('[backup] Erreur :', err.message) }
}

// ── GET /sessions ─────────────────────────────────────────────
router.get('/', (req, res) => {
  try {
    if (req.query.active_program==='1') scheduleWeeks(db)
    let sql = 'SELECT * FROM session WHERE 1=1'
    const params = []
    if (req.query.active_program === '1') sql += " AND program_id = (SELECT id FROM program WHERE is_active = 1 LIMIT 1) AND status IN ('completed','in_progress','planned','skipped')"
    if (req.query.from)       { sql += ' AND scheduled_date >= ?'; params.push(req.query.from) }
    if (req.query.to)         { sql += ' AND scheduled_date <= ?'; params.push(req.query.to) }
    if (req.query.status)     { sql += ' AND status = ?';          params.push(req.query.status) }
    if (req.query.program_id) { sql += ' AND program_id = ?';      params.push(req.query.program_id) }
    sql += ' ORDER BY scheduled_date DESC'
    const limit = Math.min(parseInt(req.query.limit) || 50, 200)
    sql += ` LIMIT ${limit}`
    res.json({ sessions: db.prepare(sql).all(...params) })
  } catch (err) {
    console.error('[GET /sessions]', err.message)
    res.status(500).json({ error: 'INTERNAL_ERROR' })
  }
})

// ── POST /sessions/from-template/:templateId ─────────────────
// IMPORTANT : déclarée AVANT /:id
router.post('/from-template/:templateId', (req, res) => {
  try {
    const tpl = db.prepare('SELECT * FROM workout_template WHERE id = ?').get(req.params.templateId)
    if (!tpl) return res.status(404).json({ error: 'TEMPLATE_NOT_FOUND' })

    const { scheduled_date, apply_rotation } = req.body
    if (!scheduled_date) return res.status(400).json({ error: 'MISSING_DATE' })

    const templateExercises = db.prepare(
      'SELECT * FROM template_exercise WHERE workout_template_id = ? ORDER BY order_index'
    ).all(tpl.id)

    const program = tpl.program_id
      ? db.prepare('SELECT * FROM program WHERE id = ?').get(tpl.program_id)
      : null

    if (program && cannotStartProgram(program,scheduled_date)) return res.status(409).json({error:'PROGRAM_FINISHED'})
    // Préparer la rotation hors transaction
    const useRotation = apply_rotation === true
    let allExercises = []
    let equipmentItems = []

    if (useRotation) {
      const raw = db.prepare('SELECT * FROM exercise').all()
      allExercises = raw.map(ex => ({
        ...ex,
        primary_muscles:    JSON.parse(ex.primary_muscles    || '[]'),
        secondary_muscles:  JSON.parse(ex.secondary_muscles  || '[]'),
        equipment_required: JSON.parse(ex.equipment_required || '[]'),
      }))
      equipmentItems = db.prepare('SELECT * FROM equipment_item').all()
    }

    const sessionId = db.transaction(() => {
      const sResult = db.prepare(`
        INSERT INTO session (name, scheduled_date, original_scheduled_date, workout_template_id, program_id, is_deload)
        VALUES (?,?,?,?,?,?)
      `).run(
        tpl.name, scheduled_date, scheduled_date, tpl.id,
        tpl.program_id || null,
        program?.is_in_deload ? 1 : 0
      )
      const sid = sResult.lastInsertRowid

      for (let i = 0; i < templateExercises.length; i++) {
        const te = templateExercises[i]
        let exerciseId = te.exercise_id

        if (useRotation && te.rotation_group) {
          const weekNumber = program?.current_week || 1
          exerciseId = getExerciseForWeek(te, weekNumber, allExercises, equipmentItems, db)
        }

        db.prepare(`
          INSERT INTO session_exercise (session_id, exercise_id, template_exercise_id, order_index)
          VALUES (?,?,?,?)
        `).run(sid, exerciseId, te.id, i)
      }
      return sid
    }).immediate()

    // Retourner session complète
    const session = db.prepare('SELECT * FROM session WHERE id = ?').get(sessionId)
    const exercises = db.prepare(
      'SELECT se.*, e.name_fr FROM session_exercise se JOIN exercise e ON se.exercise_id = e.id WHERE se.session_id = ? ORDER BY se.order_index'
    ).all(sessionId)
    for (const se of exercises) {
      se.sets = []
    }
    res.status(201).json({ ...session, exercises })
  } catch (err) {
    console.error('[POST /sessions/from-template]', err.message)
    res.status(500).json({ error: 'INTERNAL_ERROR' })
  }
})

// ── POST /sessions ────────────────────────────────────────────
router.post('/', (req, res) => {
  try {
    const { name, scheduled_date, workout_template_id, program_id, is_deload } = req.body
    if (typeof name !== 'string' || !name.trim())       return res.status(400).json({ error: 'MISSING_NAME' })
    if (!scheduled_date)     return res.status(400).json({ error: 'MISSING_DATE' })

    const result = db.prepare(`
      INSERT INTO session (name, scheduled_date, original_scheduled_date, workout_template_id, program_id, is_deload)
      VALUES (?,?,?,?,?,?)
    `).run(
      name.trim(), scheduled_date, scheduled_date,
      workout_template_id || null,
      program_id || null,
      is_deload ? 1 : 0
    )
    res.status(201).json(db.prepare('SELECT * FROM session WHERE id = ?').get(result.lastInsertRowid))
  } catch (err) {
    console.error('[POST /sessions]', err.message)
    res.status(500).json({ error: 'INTERNAL_ERROR' })
  }
})

// ── GET /sessions/:id ─────────────────────────────────────────
router.get('/:id', (req, res) => {
  try {
    const session = db.prepare('SELECT * FROM session WHERE id = ?').get(req.params.id)
    if (!session) return res.status(404).json({ error: 'SESSION_NOT_FOUND' })

    const sessionExercises = db.prepare(
      `SELECT se.*, e.name_fr, e.name_en, te.target_sets, te.target_reps_min, te.target_reps_max, te.rest_seconds
       FROM session_exercise se JOIN exercise e ON se.exercise_id = e.id
       LEFT JOIN template_exercise te ON se.template_exercise_id = te.id
       WHERE se.session_id = ? ORDER BY se.order_index`
    ).all(session.id)

    for (const se of sessionExercises) {
      if (session.is_deload && se.target_sets) {
        const program = db.prepare('SELECT * FROM program WHERE id=?').get(session.program_id)
        if (program) se.target_sets = computeDeloadTargets(se,{ current_weight_kg:0 },program,{},[]).sets
      }
      se.sets = db.prepare(
        'SELECT * FROM set_log WHERE session_exercise_id = ? ORDER BY set_number'
      ).all(se.id)
    }

    res.json({ ...session, exercises: sessionExercises })
  } catch (err) {
    console.error('[GET /sessions/:id]', err.message)
    res.status(500).json({ error: 'INTERNAL_ERROR' })
  }
})

// ── POST /sessions/:id/start ──────────────────────────────────
router.post('/:id/start', (req, res) => {
  try {
    const session = db.prepare('SELECT * FROM session WHERE id = ?').get(req.params.id)
    if (!session) return res.status(404).json({ error: 'SESSION_NOT_FOUND' })
    if (session.status === 'completed') {
      return res.status(409).json({ error: 'SESSION_ALREADY_COMPLETED' })
    }

    if (session.status === 'in_progress') {
      return res.json({ ...session, adjustments: computeSessionAdjustments(db, session) })
    }
    const programForStart=session.program_id ? db.prepare('SELECT * FROM program WHERE id=?').get(session.program_id) : null
    if (programForStart && cannotStartProgram(programForStart,session.scheduled_date)) return res.status(409).json({error:'PROGRAM_FINISHED'})
    // Vérifier qu'il n'y a pas déjà une séance in_progress
    const existing = db.prepare(
      "SELECT id FROM session WHERE status = 'in_progress' AND id != ?"
    ).get(req.params.id)
    if (existing) {
      return res.status(409).json({
        error: 'SESSION_ALREADY_IN_PROGRESS',
        detail: `Séance ${existing.id} déjà en cours.`
      })
    }

    const updated = db.transaction(() => {
      // Scheduled sessions initially store only their template; prepare their exercises once.
      if (session.workout_template_id && !db.prepare('SELECT id FROM session_exercise WHERE session_id=? LIMIT 1').get(session.id)) {
        db.prepare(`INSERT INTO session_exercise (session_id,exercise_id,template_exercise_id,order_index)
          SELECT ?,exercise_id,id,order_index FROM template_exercise WHERE workout_template_id=? ORDER BY order_index`)
          .run(session.id, session.workout_template_id)
      }

      if (session.program_id) {
        expireProgramDeload(db,session.program_id)
        reviewProgramWeek(db,session.program_id)
        const current = db.prepare('SELECT is_in_deload FROM program WHERE id=?').get(session.program_id)
        session.is_deload = current?.is_in_deload ? 1 : 0
        db.prepare('UPDATE session SET is_deload=? WHERE id=?').run(session.is_deload,session.id)
      }

      db.prepare(`
        UPDATE session SET status = 'in_progress', started_at = datetime('now'),
        original_scheduled_date=COALESCE(original_scheduled_date,scheduled_date), scheduled_date=?,
        updated_at = datetime('now') WHERE id = ?
      `).run(localIsoDate(),req.params.id)

      for (const row of db.prepare('SELECT template_exercise_id FROM session_exercise WHERE session_id=? AND template_exercise_id IS NOT NULL').all(session.id)) {
        synchronizeTemplateProgression(db,row.template_exercise_id)
      }
      // ── Calcul des ajustements coach (déterministe, lecture seule) ──
      const started = db.prepare('SELECT * FROM session WHERE id = ?').get(req.params.id)
      return { ...started, adjustments: computeSessionAdjustments(db,started) }
    })()
    res.json(updated)
  } catch (err) {
    console.error('[POST /sessions/:id/start]', err.message)
    res.status(500).json({ error: 'INTERNAL_ERROR' })
  }
})

/**
 * Calcule les cibles actualisées pour chaque exercice de la séance
 * et retourne la liste des ajustements par rapport à la dernière performance.
 *
 * Un ajustement est significatif si :
 * - Le poids a changé de plus de 0.1 kg
 * - Les reps cibles ont changé
 * - C'est un premier essai (weight_kg = 0 → suggestion)
 *
 * Lit uniquement — ne modifie jamais progression_state.
 *
 * @returns {Array<{
 *   exercise_id: string,
 *   exercise_name_fr: string,
 *   template_exercise_id: number,
 *   is_first_time: boolean,
 *   target_weight_kg: number,
 *   target_reps: number,
 *   explanation: string,
 *   change_type: 'increase'|'decrease'|'first_time'|'unchanged'
 * }>}
 */
function computeSessionAdjustments(db, session) {
  if (!session.workout_template_id) return []

  const sessionExercises = db.prepare(`
    SELECT se.*, e.name_fr, e.mechanic, e.equipment_required, e.is_unilateral
    FROM session_exercise se
    JOIN exercise e ON se.exercise_id = e.id
    WHERE se.session_id = ?
      AND se.template_exercise_id IS NOT NULL
    ORDER BY se.order_index
  `).all(session.id)

  if (sessionExercises.length === 0) return []

  const program = session.program_id
    ? db.prepare('SELECT * FROM program WHERE id = ?').get(session.program_id)
    : null
  const equipmentItems = db.prepare('SELECT * FROM equipment_item').all()
  const planRow = program ? db.prepare('SELECT parameters FROM program_plan WHERE program_id=?').get(program.id) : null
  const planParams = planRow ? JSON.parse(planRow.parameters) : null
  const profileRow = planParams ? { weight_kg:planParams.weight_kg, fitness_level:program.level, primary_goal:program.goal }
    : db.prepare('SELECT * FROM user_profile WHERE id = 1').get()

  const settingsRows = db.prepare('SELECT key, value FROM settings').all()
  const settings     = {}
  for (const r of settingsRows) settings[r.key] = JSON.parse(r.value)
  const progressionSettings = {
    progression_failure_threshold:    settings.progression_failure_threshold    || 2,
    progression_weight_reduction_pct: settings.progression_weight_reduction_pct || 10,
  }

  const adjustments = []

  for (const se of sessionExercises) {
    const te = db.prepare('SELECT * FROM template_exercise WHERE id = ?')
      .get(se.template_exercise_id)
    if (!te) continue

    const state = db.prepare(
      'SELECT * FROM progression_state WHERE template_exercise_id = ?'
    ).get(te.id)

    const exerciseForCalc = {
      equipment_required: JSON.parse(se.equipment_required || '[]'),
      is_unilateral:      se.is_unilateral || 0,
      mechanic:           se.mechanic,
    }
    const loadsResult = calculateAchievableLoads(equipmentItems, exerciseForCalc)
    const achievable  = loadsResult.loads_kg.length > 0
      ? loadsResult.loads_kg
      : [state?.current_weight_kg || 0]

    // Séries de travail de la DERNIÈRE séance complétée pour ce template_exercise
    const lastSets = db.prepare(`
      SELECT sl.*, s.id AS session_id
      FROM set_log sl
      JOIN session_exercise se2 ON sl.session_exercise_id = se2.id
      JOIN session s ON se2.session_id = s.id
      WHERE se2.template_exercise_id = ?
        AND s.status = 'completed'
        AND sl.is_warmup = 0
        AND sl.is_completed = 1
        AND s.is_deload = 0
      ORDER BY s.completed_at DESC, s.id DESC, sl.set_number ASC
    `).all(te.id)
    const lastSeId     = lastSets.length > 0 ? lastSets[0].session_exercise_id : null
    const relevantSets = lastSets.filter(s => s.session_exercise_id === lastSeId)

    const isFirstTime = !state || !state.last_session_id && state.current_weight_kg === 0

    let targetWeight, targetReps, explanation, changeType

    if (isFirstTime) {
      const profile = profileRow ? {
        weight_kg:     profileRow.weight_kg,
        fitness_level: profileRow.fitness_level,
        primary_goal:  profileRow.primary_goal,
      } : null

      let suggestion
      try {
        suggestion = suggestFirstTime(
          { ...exerciseForCalc, id: se.exercise_id },
          profile,
          te,
          equipmentItems
        )
      } catch (suggestErr) {
        console.warn('[computeSessionAdjustments] suggestion:', suggestErr.message)
        suggestion = { weight_kg: 0, reps: te.target_reps_min, reasoning: 'Commencez léger et ajustez à votre ressenti.' }
      }

      targetWeight = suggestion.weight_kg
      targetReps   = suggestion.reps
      explanation  = suggestion.reasoning
      changeType   = 'first_time'

    } else {
      // Le calcul a déjà été fait à la complétion → on relit progression_state
      const learned = db.prepare('SELECT last_session_id FROM exercise_progression WHERE exercise_id=?').get(se.exercise_id)
      const stateUpToDate = learned?.last_session_id === state.last_session_id || relevantSets.length > 0 &&
        state.last_session_id === lastSets[0].session_id

      const nextState = (relevantSets.length > 0 && !stateUpToDate)
        ? computeNextState(state, relevantSets, te, program, achievable, { ...progressionSettings, resistance_is_approximate: loadsResult.resistance_is_approximate })
        : null

      targetWeight = nextState?.current_weight_kg ?? state.current_weight_kg
      targetReps   = nextState?.current_target_reps ?? state.current_target_reps ?? te.target_reps_min

      // Référence de comparaison : performance réellement réalisée à la dernière séance
      const prevWeight = relevantSets.length > 0 ? relevantSets[0].weight_kg : state.current_weight_kg
      const prevReps   = relevantSets.length > 0
        ? Math.max(...relevantSets.map(s => s.reps))
        : (state.current_target_reps ?? te.target_reps_min)

      if (nextState) {
        explanation = nextState.explanation
      } else if (relevantSets.length > 0) {
        explanation = `Dernière séance : ${prevWeight} kg × ${prevReps} reps. ` +
                      `Cible : ${targetWeight} kg × ${targetReps} reps.`
      } else {
        explanation = `Charge maintenue : ${targetWeight} kg × ${targetReps} reps.`
      }

      const weightDiff = targetWeight - prevWeight
      if (Math.abs(weightDiff) > 0.1) {
        changeType = weightDiff > 0 ? 'increase' : 'decrease'
      } else if (targetReps !== prevReps) {
        changeType = targetReps > prevReps ? 'increase' : 'decrease'
      } else {
        changeType = 'unchanged'
      }
    }

    if (session.is_deload && program) {
      const target = computeDeloadTargets(te,{ current_weight_kg:targetWeight },program,{},loadsResult.loads_kg)
      targetWeight = loadsResult.resistance_is_approximate ? targetWeight : target.weight_kg
      targetReps = target.reps_min
      explanation = 'Semaine allégée : mêmes exercices, charge et volume temporairement réduits.'
      changeType = 'decrease'
    }
    adjustments.push({
      exercise_id:          se.exercise_id,
      exercise_name_fr:     se.name_fr,
      template_exercise_id: se.template_exercise_id,
      is_first_time:        isFirstTime,
      target_weight_kg:     targetWeight,
      target_reps:          targetReps,
      explanation,
      change_type:          changeType,
    })
  }

  // Premier essai + changements réels uniquement
  return adjustments.filter(a => a.change_type !== 'unchanged')
}

// ── POST /sessions/:id/complete ───────────────────────────────
router.post('/:id/complete', (req, res) => {
  try {
    const session = db.prepare('SELECT * FROM session WHERE id = ?').get(req.params.id)
    if (!session) return res.status(404).json({ error: 'SESSION_NOT_FOUND' })
    if (session.status === 'completed') {
      return res.status(409).json({ error: 'SESSION_ALREADY_COMPLETED' })
    }

    if (session.status !== 'in_progress') return res.status(409).json({ error: 'SESSION_NOT_IN_PROGRESS' })

    db.transaction(() => {
      // Calculer les métriques
      const volumeRow = db.prepare(`
        SELECT COALESCE(SUM(sl.weight_kg * sl.reps), 0) as vol
        FROM set_log sl
        JOIN session_exercise se ON sl.session_exercise_id = se.id
        WHERE se.session_id = ? AND sl.is_completed = 1 AND sl.is_warmup = 0
      `).get(req.params.id)

      const rpeRow = db.prepare(`
        SELECT AVG(sl.rpe) as avg_rpe
        FROM set_log sl
        JOIN session_exercise se ON sl.session_exercise_id = se.id
        WHERE se.session_id = ? AND sl.rpe IS NOT NULL AND sl.is_completed = 1
      `).get(req.params.id)

      const rawDurationSec = session.started_at
        ? Math.round(
            (new Date().getTime() - parseUtcTimestamp(session.started_at)) / 1000
          )
        : null
      const durationSec = Number.isFinite(rawDurationSec) ? Math.max(0, rawDurationSec) : null

      db.prepare(`
        UPDATE session
        SET status = 'completed',
            completed_at = datetime('now'),
            total_volume_kg = ?,
            rpe_avg = ?,
            duration_seconds = ?,
            updated_at = datetime('now')
        WHERE id = ?
      `).run(
        Math.round(volumeRow.vol * 100) / 100,
        rpeRow.avg_rpe ? Math.round(rpeRow.avg_rpe * 10) / 10 : null,
        durationSec,
        req.params.id
      )

      // Calendar weeks, not a counter incremented for every workout.
      if (session.program_id) {
        db.prepare(`UPDATE program SET current_week = MAX(1,
          CAST((julianday(date('now')) - julianday(date(created_at))) / 7 AS INTEGER) + 1)
          WHERE id=?`).run(session.program_id)
      }
    }).immediate()

    // ── Mise à jour de la progression après complétion ────────────────────
    // Récupérer le programme et ses settings
    const program = session.program_id
      ? db.prepare('SELECT * FROM program WHERE id = ?').get(session.program_id)
      : null

    const settingsRows = db.prepare('SELECT key, value FROM settings').all()
    const settings = {}
    for (const r of settingsRows) {
      settings[r.key] = JSON.parse(r.value)
    }
    const progressionSettings = {
      progression_failure_threshold:   settings.progression_failure_threshold  || 2,
      progression_weight_reduction_pct: settings.progression_weight_reduction_pct || 10,
    }

    const equipmentItems = db.prepare('SELECT * FROM equipment_item').all()

    // Pour chaque session_exercise rattaché à un template_exercise
    const sessionExercises = db.prepare(
      'SELECT * FROM session_exercise WHERE session_id = ? AND template_exercise_id IS NOT NULL'
    ).all(req.params.id)

    for (const se of sessionExercises) {
      const te = db.prepare('SELECT * FROM template_exercise WHERE id = ?').get(se.template_exercise_id)
      if (!te) continue

      const state = db.prepare(
        'SELECT * FROM progression_state WHERE template_exercise_id = ?'
      ).get(te.id)
      if (!state) continue

      const exercise = db.prepare('SELECT * FROM exercise WHERE id = ?').get(se.exercise_id)
      if (!exercise) continue

      // Séries de travail complétées
      const workSets = db.prepare(`
        SELECT * FROM set_log
        WHERE session_exercise_id = ?
          AND is_warmup = 0
          AND is_completed = 1
        ORDER BY set_number
      `).all(se.id)

      if (workSets.length === 0) continue

      // Calculer les charges atteignables
      const exerciseForCalc = {
        equipment_required: JSON.parse(exercise.equipment_required || '[]'),
        is_unilateral: exercise.is_unilateral,
      }
      const loadsResult = calculateAchievableLoads(equipmentItems, exerciseForCalc)
      const achievable  = loadsResult.loads_kg.length > 0
        ? loadsResult.loads_kg
        : [state.current_weight_kg || 0]

      if (session.is_deload) continue
      const performedWeight = Math.min(...workSets.map(set=>set.weight_kg))
      const performanceState = { ...state,current_weight_kg:performedWeight,
        current_target_reps:Math.max(te.target_reps_min,Math.min(te.target_reps_max,Math.min(...workSets.map(set=>set.reps)))) }
      const actualLoads = loadsResult.max_load_kg > 0 ? achievable : [performedWeight]
      const nextState = computeNextState(
        performanceState,workSets,te,program,actualLoads,{...progressionSettings,resistance_is_approximate:loadsResult.resistance_is_approximate}
      )

      db.prepare(`
        UPDATE progression_state
        SET current_weight_kg    = ?,
            current_target_reps  = ?,
            consecutive_failures = ?,
            last_session_id      = ?,
            last_updated         = datetime('now')
        WHERE template_exercise_id = ?
      `).run(
        nextState.current_weight_kg,
        nextState.current_target_reps ?? state.current_target_reps,
        nextState.consecutive_failures,
        parseInt(req.params.id),
        te.id
      )
      saveExerciseProgression(db,se.exercise_id,nextState,te,Number(session.id))
      saveProgressionEvent(db,se.id,{template:te,program,loads:actualLoads,settings:{...progressionSettings,resistance_is_approximate:loadsResult.resistance_is_approximate}})
    }
    // ── fin mise à jour progression ───────────────────────────────────────

    // ── Vérification deload ───────────────────────────────────────────────
    let deloadTriggered = false
    let deloadReason    = null

    if (program) {
      const settingsForDeload = {
        plateau_detection_sessions: settings.plateau_detection_sessions || 4,
        deload_min_sets: settings.deload_min_sets || 2,
      }
      const enginePlan = db.prepare('SELECT program_id FROM program_plan WHERE program_id=?').get(program.id)
      const review = enginePlan ? reviewProgramWeek(db,program.id) : null
      const deloadCheck = enginePlan
        ? {should:review?.decision === 'deload' && !program.is_in_deload,reason:review?.evidence.reason}
        : shouldDeload(program,settingsForDeload,db)

      if (deloadCheck.should) {
        db.prepare(`
          UPDATE program
          SET is_in_deload = 1,
              last_deload_date = date('now'),
              updated_at = datetime('now')
          WHERE id = ?
        `).run(program.id)
        deloadTriggered = true
        deloadReason    = deloadCheck.reason
      }
    }
    // ── fin vérification deload ───────────────────────────────────────────

    // ── Signaux coaching (non bloquant) ───────────────────────────
    try {
      const newAdvice = runAllSignalChecks(db, settings)
      if (newAdvice > 0) {
        // Génération LLM en arrière-plan
        generatePendingAdviceTexts(db).catch(e =>
          console.warn('[advice] génération arrière-plan:', e.message)
        )
      }
    } catch (err) {
      console.warn('[coaching] Erreur signaux:', err.message)
      // Non bloquant
    }
    // ── fin signaux coaching ──────────────────────────────────────────────

    autoBackup()

    try {
      const scheduled = scheduleWeeks(db, session.program_id)
      if (scheduled > 0) {
        console.log(`[scheduler] ${scheduled} séance(s) planifiée(s) après complétion`)
      }
    } catch (err) {
      console.warn('[scheduler] Erreur planification :', err.message)
      // Non bloquant
    }

    // Retourner session complète
    const updated = db.prepare('SELECT * FROM session WHERE id = ?').get(req.params.id)
    const exercises = db.prepare(
      'SELECT se.*, e.name_fr FROM session_exercise se JOIN exercise e ON se.exercise_id = e.id WHERE se.session_id = ? ORDER BY se.order_index'
    ).all(req.params.id)
    for (const se of exercises) {
      se.sets = db.prepare(
        'SELECT * FROM set_log WHERE session_exercise_id = ? ORDER BY set_number'
      ).all(se.id)
    }

    res.json({
      ...updated,
      exercises,
      deload_triggered: deloadTriggered,
      deload_reason:    deloadReason,
    })
  } catch (err) {
    console.error('[POST /sessions/:id/complete]', err.message)
    res.status(500).json({ error: 'INTERNAL_ERROR' })
  }
})

// ── PUT /sessions/:id ─────────────────────────────────────────
router.put('/:id', (req, res) => {
  try {
    const session = db.prepare('SELECT * FROM session WHERE id = ?').get(req.params.id)
    if (!session) return res.status(404).json({ error: 'SESSION_NOT_FOUND' })

    const updates = []; const values = []
    if (req.body.name !== undefined) {
      updates.push('name = ?'); values.push(req.body.name.trim())
    }
    if (req.body.scheduled_date !== undefined) {
      if (session.status !== 'planned') {
        return res.status(400).json({ error: 'CANNOT_CHANGE_DATE_OF_STARTED_SESSION' })
      }
      updates.push('scheduled_date = ?'); values.push(req.body.scheduled_date)
    }
    if (req.body.notes !== undefined) {
      updates.push('notes = ?'); values.push(req.body.notes)
    }
    if (updates.length === 0) return res.status(400).json({ error: 'NO_FIELDS_TO_UPDATE' })
    updates.push("updated_at = datetime('now')")
    values.push(req.params.id)
    db.prepare(`UPDATE session SET ${updates.join(', ')} WHERE id = ?`).run(...values)
    res.json(db.prepare('SELECT * FROM session WHERE id = ?').get(req.params.id))
  } catch (err) {
    console.error('[PUT /sessions/:id]', err.message)
    res.status(500).json({ error: 'INTERNAL_ERROR' })
  }
})

// ── DELETE /sessions/:id ──────────────────────────────────────
router.delete('/:id', (req, res) => {
  try {
    const session = db.prepare('SELECT * FROM session WHERE id = ?').get(req.params.id)
    if (!session) return res.status(404).json({ error: 'SESSION_NOT_FOUND' })
    if (session.status === 'in_progress') {
      return res.status(409).json({ error: 'CANNOT_DELETE_IN_PROGRESS_SESSION' })
    }
    db.transaction(() => {
      const exercises = db.prepare('SELECT DISTINCT exercise_id FROM session_exercise WHERE session_id = ?').all(req.params.id)
      db.prepare(`DELETE FROM personal_record WHERE set_log_id IN (
        SELECT sl.id FROM set_log sl JOIN session_exercise se ON se.id = sl.session_exercise_id WHERE se.session_id = ?
      )`).run(req.params.id)
      if (session.program_id) {
        const exclude=db.prepare('INSERT OR IGNORE INTO session_schedule_exclusion(program_id,scheduled_date) VALUES (?,?)')
        for (const date of new Set([session.scheduled_date,session.original_scheduled_date].filter(Boolean))) exclude.run(session.program_id,date)
      }
      db.prepare('DELETE FROM session WHERE id = ?').run(req.params.id)
      for (const exercise of exercises) {
        refreshPersonalRecords(db,exercise.exercise_id)
        if (session.status==='completed' && !session.is_deload) rebuildExerciseProgression(db,exercise.exercise_id)
      }
    })()
    res.status(204).end()
  } catch (err) {
    console.error('[DELETE /sessions/:id]', err.message)
    res.status(500).json({ error: 'INTERNAL_ERROR' })
  }
})

// ── POST /sessions/:id/skip ───────────────────────────────────
router.post('/:id/skip', (req, res) => {
  try {
    const session = db.prepare('SELECT * FROM session WHERE id = ?').get(req.params.id)
    if (!session) return res.status(404).json({ error: 'SESSION_NOT_FOUND' })
    if (session.status === 'completed') {
      return res.status(409).json({ error: 'SESSION_ALREADY_COMPLETED' })
    }
    if (session.status === 'in_progress') {
      return res.status(409).json({ error: 'CANNOT_SKIP_IN_PROGRESS_SESSION' })
    }
    db.prepare(`
      UPDATE session
      SET status = 'skipped', updated_at = datetime('now')
      WHERE id = ?
    `).run(req.params.id)
    res.json(db.prepare('SELECT * FROM session WHERE id = ?').get(req.params.id))
  } catch (err) {
    console.error('[POST /sessions/:id/skip]', err.message)
    res.status(500).json({ error: 'INTERNAL_ERROR' })
  }
})

// ── GET /sessions/:id/target/:templateExerciseId ──────────────
router.get('/:id/target/:teId', (req, res) => {
  try {
    const session = db.prepare('SELECT * FROM session WHERE id = ?').get(req.params.id)
    if (!session) return res.status(404).json({ error: 'SESSION_NOT_FOUND' })

    const te = db.prepare('SELECT * FROM template_exercise WHERE id = ?').get(req.params.teId)
    if (!te) return res.status(404).json({ error: 'TEMPLATE_EXERCISE_NOT_FOUND' })

    const state = db.prepare(
      'SELECT * FROM progression_state WHERE template_exercise_id = ?'
    ).get(req.params.teId)

    const program = session.program_id ? db.prepare('SELECT * FROM program WHERE id=?').get(session.program_id) : null

    const exercise = db.prepare('SELECT * FROM exercise WHERE id = ?').get(te.exercise_id)
    const exerciseForCalc = {
      equipment_required: JSON.parse(exercise?.equipment_required || '[]'),
      is_unilateral:      exercise?.is_unilateral || 0,
      mechanic:           exercise?.mechanic,
    }

    const equipmentItems = db.prepare('SELECT * FROM equipment_item').all()
    const loadsResult    = calculateAchievableLoads(equipmentItems, exerciseForCalc)

    // ── Détection premier essai ───────────────────────────────
    const isFirstTime = !state || !state.last_session_id && state.current_weight_kg === 0

    let weight, targetReps, explanation, suggestion

    if (isFirstTime) {
      // Charger le profil utilisateur
      const planRow = program ? db.prepare('SELECT parameters FROM program_plan WHERE program_id=?').get(program.id) : null
      const planParams = planRow ? JSON.parse(planRow.parameters) : null
      const profileRow = planParams ? { weight_kg:planParams.weight_kg, fitness_level:program.level, primary_goal:program.goal }
        : db.prepare('SELECT * FROM user_profile WHERE id = 1').get()
      const profile = profileRow ? {
        weight_kg:     profileRow.weight_kg,
        fitness_level: profileRow.fitness_level,
        primary_goal:  profileRow.primary_goal,
      } : null

      const parsed = {
        ...exerciseForCalc,
        id:       exercise?.id,
        mechanic: exercise?.mechanic,
      }

      try {
        suggestion = suggestFirstTime(parsed, profile, te, equipmentItems)
      } catch (suggestErr) {
        console.warn('[GET /sessions/:id/target/:teId] suggestion:', suggestErr.message)
        suggestion = { weight_kg: 0, reps: 8, reasoning: 'Aucun profil configuré. Commencez léger.' }
      }
      weight      = suggestion.weight_kg
      targetReps  = suggestion.reps
      explanation = suggestion.reasoning

    } else {
      // Essais suivants : lire depuis progression_state
      weight      = state.current_weight_kg
      targetReps  = state.current_target_reps || te.target_reps_min

      // Récupérer la dernière performance réelle
      const lastSet = db.prepare(`
        SELECT sl.weight_kg, sl.reps, s.scheduled_date
        FROM set_log sl
        JOIN session_exercise se ON sl.session_exercise_id = se.id
        JOIN session s ON se.session_id = s.id
        WHERE se.exercise_id = ?
          AND se.template_exercise_id = ?
          AND s.status = 'completed'
          AND sl.is_warmup = 0
          AND sl.is_completed = 1
        ORDER BY s.completed_at DESC, sl.set_number DESC
        LIMIT 1
      `).get(te.exercise_id, req.params.teId)

      const program = session.program_id
        ? db.prepare('SELECT * FROM program WHERE id = ?').get(session.program_id)
        : null

      const model = resolveProgressionModel(te, program)

      const modelLabels = {
        linear:             'progression linéaire',
        double_progression: 'double progression',
        rpe_based:          'progression RPE',
      }

      if (lastSet) {
        const failureInfo = state.consecutive_failures > 0
          ? ` (${state.consecutive_failures} échec(s) consécutif(s))`
          : ''
        explanation = `Dernière séance (${lastSet.scheduled_date}) : ` +
                      `${lastSet.weight_kg} kg × ${lastSet.reps} reps. ` +
                      `Cible : ${weight} kg × ${targetReps} reps ` +
                      `[${modelLabels[model] || model}]${failureInfo}.`
      } else {
        explanation = `Charge initiale : ${weight} kg × ${targetReps} reps [${modelLabels[model] || model}].`
      }
    }

    if (session.is_deload && program) {
      const target = computeDeloadTargets(te,{ current_weight_kg:weight },program,{},loadsResult.loads_kg)
      weight = loadsResult.resistance_is_approximate ? weight : target.weight_kg
      targetReps = target.reps_min
      explanation = 'Semaine allégée : mêmes exercices, charge et volume temporairement réduits.'
    }

    // ── Calcul du 10RM estimé pour la charge cible ────────────
    // Conversion inverse de la formule sélectionnée : une série de 10 reps conserve sa charge.
    const formulaRow = db.prepare("SELECT value FROM settings WHERE key = 'rm_formula'").get()
    const formula    = formulaRow ? JSON.parse(formulaRow.value) : 'epley'
    const est1rm     = weight > 0 && targetReps > 0
      ? estimate1RM(weight, targetReps, formula)
      : 0
    const est10rm    = est1rm > 0
      ? weightForReps(est1rm,10,formula)
      : null

    res.json({
      weight_kg:           weight,
      reps_min:            targetReps,
      reps_max:            session.is_deload ? targetReps : te.target_reps_max,
      explanation,
      achievable_loads_kg: loadsResult.loads_kg,
      is_first_time:       isFirstTime,
      // Bulle "suggestion premier essai" — null si essai suivant
      first_time_suggestion: isFirstTime ? {
        weight_kg: suggestion.weight_kg,
        reps:      suggestion.reps,
        reasoning: suggestion.reasoning,
      } : null,
      // 10RM estimé de la charge cible
      estimated_10rm_kg: est10rm,
    })
  } catch (err) {
    console.error('[GET /sessions/:id/target/:teId]', err.message)
    res.status(500).json({ error: 'INTERNAL_ERROR' })
  }
})

export default router
