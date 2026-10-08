import express from 'express'
import { getDb }                from '../db/database.js'
import { getAiSettings }        from './settings.js'
import { streamChat }           from '../services/aiProvider.js'
import { buildSystemPrompt }    from '../services/systemPromptBuilder.js'

const router = express.Router()
const db     = getDb()

// ── Validation des actions ────────────────────────────────────

function validateAction(action, db) {
  const errors = []
  if (!action || typeof action !== 'object') return ['Corps d\'action invalide.']

  const VALID_ACTIONS = [
    'complete_user_profile', 'create_program', 'update_program', 'activate_program',
    'create_session', 'schedule_sessions', 'add_equipment', 'swap_exercise',
    'update_progression_state', 'update_settings', 'trigger_deload',
  ]
  if (!VALID_ACTIONS.includes(action.action)) {
    errors.push(`Action "${action.action}" inconnue. Valides : ${VALID_ACTIONS.join(', ')}.`)
  }
  if (!action.explanation?.trim()) errors.push('"explanation" obligatoire et non vide.')
  if (!action.data || typeof action.data !== 'object') {
    errors.push('"data" obligatoire.'); return errors
  }

  const d = action.data
  const GOALS  = ['strength','hypertrophy','endurance','weight_loss','general_fitness','sport_performance']
  const LEVELS = ['beginner','intermediate','advanced','athlete']

  switch (action.action) {
    case 'complete_user_profile':
      // Tous les champs sont optionnels — mise à jour partielle acceptée
      if (d.age !== undefined && (d.age < 10 || d.age > 100)) errors.push('age entre 10 et 100.')
      if (d.sex !== undefined && !['male','female','other','prefer_not_to_say'].includes(d.sex)) errors.push('sex invalide.')
      if (d.fitness_level !== undefined && !LEVELS.includes(d.fitness_level)) errors.push('fitness_level invalide.')
      if (d.primary_goal  !== undefined && !GOALS.includes(d.primary_goal))   errors.push('primary_goal invalide.')
      if (d.sessions_per_week !== undefined && (d.sessions_per_week < 1 || d.sessions_per_week > 7)) errors.push('sessions_per_week entre 1 et 7.')
      if (d.session_duration_min !== undefined && (d.session_duration_min < 15 || d.session_duration_min > 240)) errors.push('session_duration_min entre 15 et 240.')
      break

    case 'create_program':
      if (!d.name?.trim()) errors.push('"data.name" obligatoire.')
      if (!GOALS.includes(d.goal))   errors.push('"data.goal" invalide.')
      if (!LEVELS.includes(d.level)) errors.push('"data.level" invalide.')
      const dpw = parseInt(d.days_per_week)
      if (!dpw || dpw < 2 || dpw > 7) errors.push('"data.days_per_week" entre 2 et 7.')
      for (const tpl of (d.templates || [])) {
        for (const ex of (tpl.exercises || [])) {
          const found = db.prepare('SELECT id FROM exercise WHERE id = ?').get(ex.exercise_id)
          if (!found) errors.push(`exercise_id "${ex.exercise_id}" introuvable.`)
          if (ex.target_sets && (ex.target_sets < 1 || ex.target_sets > 10)) errors.push(`target_sets invalide pour ${ex.exercise_id}.`)
          if (ex.target_reps_min && ex.target_reps_max && ex.target_reps_min > ex.target_reps_max) errors.push(`reps_min > reps_max pour ${ex.exercise_id}.`)
        }
      }
      break

    case 'update_program':
      if (!d.program_id) { errors.push('"data.program_id" obligatoire.'); break }
      if (!db.prepare('SELECT id FROM program WHERE id=?').get(d.program_id)) errors.push(`Programme ${d.program_id} introuvable.`)
      break

    case 'activate_program':
      if (!d.program_id) errors.push('"data.program_id" obligatoire.')
      else if (!db.prepare('SELECT id FROM program WHERE id=?').get(d.program_id)) errors.push(`Programme ${d.program_id} introuvable.`)
      break

    case 'create_session':
      if (!d.name?.trim()) errors.push('"data.name" obligatoire.')
      if (!d.scheduled_date || !/^\d{4}-\d{2}-\d{2}$/.test(d.scheduled_date)) errors.push('"data.scheduled_date" format YYYY-MM-DD requis.')
      for (const ex of (d.exercises || [])) {
        if (!db.prepare('SELECT id FROM exercise WHERE id=?').get(ex.exercise_id)) errors.push(`exercise_id "${ex.exercise_id}" introuvable.`)
      }
      break

    case 'schedule_sessions':
      if (!Array.isArray(d.sessions) || d.sessions.length === 0) errors.push('"data.sessions" tableau non vide requis.')
      for (const s of (d.sessions || [])) {
        if (!s.name?.trim()) errors.push('Chaque session doit avoir un "name".')
        if (!s.scheduled_date || !/^\d{4}-\d{2}-\d{2}$/.test(s.scheduled_date)) errors.push(`"scheduled_date" invalide pour "${s.name}".`)
      }
      break

    case 'add_equipment':
      const VALID_CATS = ['barbell','ez_bar','plate','dumbbell_fixed','dumbbell_adjustable','kettlebell','resistance_band','bench','rack','pullup_bar','cable_machine','smith_machine','other']
      if (!VALID_CATS.includes(d.category)) errors.push(`"data.category" invalide. Valides : ${VALID_CATS.join(', ')}.`)
      if (!d.name?.trim()) errors.push('"data.name" obligatoire.')
      if (d.category === 'plate' && d.count && d.count % 2 !== 0) errors.push('Les disques doivent être en quantité paire.')
      break

    case 'swap_exercise':
      if (!d.template_exercise_id) errors.push('"data.template_exercise_id" obligatoire.')
      if (!d.new_exercise_id) errors.push('"data.new_exercise_id" obligatoire.')
      else if (!db.prepare('SELECT id FROM exercise WHERE id=?').get(d.new_exercise_id)) errors.push(`new_exercise_id "${d.new_exercise_id}" introuvable.`)
      if (d.template_exercise_id && !db.prepare('SELECT id FROM template_exercise WHERE id=?').get(d.template_exercise_id)) errors.push(`template_exercise_id ${d.template_exercise_id} introuvable.`)
      break

    case 'update_progression_state':
      if (!d.template_exercise_id) errors.push('"data.template_exercise_id" obligatoire.')
      if (d.current_weight_kg !== undefined && d.current_weight_kg < 0) errors.push('current_weight_kg ≥ 0.')
      break

    case 'update_settings':
      // Les clés seront validées par settings.js lors de l'application
      if (Object.keys(d).length === 0) errors.push('"data" ne peut pas être vide.')
      break

    case 'trigger_deload':
      if (!d.program_id) errors.push('"data.program_id" obligatoire.')
      else if (!db.prepare('SELECT id FROM program WHERE id=?').get(d.program_id)) errors.push(`Programme ${d.program_id} introuvable.`)
      break
  }

  return errors
}

// ── Application des actions en DB ─────────────────────────────

function applyAction(action, db) {
  const { action: type, data: d } = action

  if (type === 'complete_user_profile') {
    // Mise à jour partielle du profil utilisateur
    const allowed = [
      'display_name','age','sex','weight_kg','height_cm','fitness_level',
      'primary_goal','secondary_goals','target_weight_kg','sport_practiced',
      'sessions_per_week','session_duration_min','prefers_exercise_variation',
      'injury_notes','medical_notes','onboarding_completed','onboarding_step',
    ]
    const updates = []; const values = []
    for (const key of allowed) {
      if (d[key] === undefined) continue
      let val = d[key]
      if (key === 'secondary_goals') val = JSON.stringify(val)
      if (key === 'prefers_exercise_variation' || key === 'onboarding_completed') val = val ? 1 : 0
      updates.push(`${key} = ?`); values.push(val)
    }
    if (updates.length === 0) return { type: 'profile', updated: 0 }
    updates.push("updated_at = datetime('now')"); values.push(1)
    db.prepare(`UPDATE user_profile SET ${updates.join(', ')} WHERE id = ?`).run(...values)
    return { type: 'profile', updated: updates.length - 1 }
  }

  if (type === 'create_program') {
    return db.transaction(() => {
      const pRes = db.prepare(`
        INSERT INTO program (name, goal, level, days_per_week, duration_weeks,
          progression_model, use_exercise_rotation, deload_auto_enabled,
          deload_frequency_weeks, deload_load_reduction_pct, deload_volume_reduction_pct)
        VALUES (?,?,?,?,?,?,?,?,?,?,?)
      `).run(
        d.name.trim(), d.goal, d.level, parseInt(d.days_per_week), d.duration_weeks||null,
        d.progression_model||'double_progression',
        d.use_exercise_rotation ? 1 : 0,
        d.deload_auto_enabled   ? 1 : 0,
        d.deload_frequency_weeks||6, d.deload_load_reduction_pct||20, d.deload_volume_reduction_pct||40,
      )
      const pid = pRes.lastInsertRowid
      for (let ti = 0; ti < (d.templates||[]).length; ti++) {
        const tpl = d.templates[ti]
        const tRes = db.prepare('INSERT INTO workout_template (program_id,name,day_of_week,order_index) VALUES (?,?,?,?)').run(pid, tpl.name, tpl.day_of_week??null, ti)
        const tid = tRes.lastInsertRowid
        for (let ei = 0; ei < (tpl.exercises||[]).length; ei++) {
          const ex = tpl.exercises[ei]
          const teRes = db.prepare(`
            INSERT INTO template_exercise
              (workout_template_id,exercise_id,order_index,target_sets,target_reps_min,
               target_reps_max,rest_seconds,progression_model,progression_weight_increment_kg,
               rir_target,rpe_target,rotation_group)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
          `).run(tid, ex.exercise_id, ei,
            ex.target_sets||3, ex.target_reps_min||8, ex.target_reps_max||12,
            ex.rest_seconds||90, ex.progression_model||'inherit',
            ex.progression_weight_increment_kg||null,
            ex.rir_target||null, ex.rpe_target||null, ex.rotation_group||null)
          db.prepare('INSERT INTO progression_state (template_exercise_id,current_weight_kg) VALUES (?,0)').run(teRes.lastInsertRowid)
        }
      }
      return { type: 'program', id: pid, name: d.name.trim() }
    })()
  }

  if (type === 'activate_program') {
    db.transaction(() => {
      db.prepare('UPDATE program SET is_active=0').run()
      db.prepare('UPDATE program SET is_active=1 WHERE id=?').run(d.program_id)
    })()
    return { type: 'activate', program_id: d.program_id }
  }

  if (type === 'create_session') {
    return db.transaction(() => {
      const sRes = db.prepare('INSERT INTO session (name,scheduled_date,workout_template_id) VALUES (?,?,?)').run(d.name.trim(), d.scheduled_date, d.workout_template_id||null)
      const sid = sRes.lastInsertRowid
      for (let i = 0; i < (d.exercises||[]).length; i++) {
        db.prepare('INSERT INTO session_exercise (session_id,exercise_id,order_index) VALUES (?,?,?)').run(sid, d.exercises[i].exercise_id, i)
      }
      return { type: 'session', id: sid, name: d.name.trim() }
    })()
  }

  if (type === 'schedule_sessions') {
    const ids = db.transaction(() => {
      const created = []
      for (const s of d.sessions) {
        const sRes = db.prepare('INSERT INTO session (name,scheduled_date,workout_template_id) VALUES (?,?,?)').run(s.name.trim(), s.scheduled_date, s.workout_template_id||null)
        created.push(sRes.lastInsertRowid)
      }
      return created
    })()
    return { type: 'schedule', session_ids: ids, count: ids.length }
  }

  if (type === 'add_equipment') {
    const result = db.prepare(`
      INSERT INTO equipment_item (category,name,weight_kg,count,weight_min_kg,weight_max_kg,weight_step_kg,resistance_min_kg,resistance_max_kg,notes)
      VALUES (?,?,?,?,?,?,?,?,?,?)
    `).run(d.category, d.name.trim(), d.weight_kg||null, d.count||1, d.weight_min_kg||null, d.weight_max_kg||null, d.weight_step_kg||null, d.resistance_min_kg||null, d.resistance_max_kg||null, d.notes||null)
    return { type: 'equipment', id: result.lastInsertRowid, name: d.name.trim() }
  }

  if (type === 'swap_exercise') {
    db.prepare('UPDATE template_exercise SET exercise_id=? WHERE id=?').run(d.new_exercise_id, d.template_exercise_id)
    return { type: 'swap', template_exercise_id: d.template_exercise_id, new_exercise_id: d.new_exercise_id }
  }

  if (type === 'update_progression_state') {
    const updates = []; const values = []
    if (d.current_weight_kg  !== undefined) { updates.push('current_weight_kg=?');  values.push(d.current_weight_kg) }
    if (d.current_target_reps !== undefined) { updates.push('current_target_reps=?'); values.push(d.current_target_reps) }
    if (d.consecutive_failures !== undefined) { updates.push('consecutive_failures=?'); values.push(d.consecutive_failures) }
    if (updates.length > 0) {
      updates.push("last_updated=datetime('now')"); values.push(d.template_exercise_id)
      db.prepare(`UPDATE progression_state SET ${updates.join(',')} WHERE template_exercise_id=?`).run(...values)
    }
    return { type: 'progression', template_exercise_id: d.template_exercise_id }
  }

  if (type === 'update_settings') {
    const stmt = db.prepare("INSERT INTO settings (key,value,updated_at) VALUES (?,?,datetime('now')) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at")
    const updated = []
    db.transaction(() => {
      for (const [key, value] of Object.entries(d)) {
        if (key === 'ai_api_key') continue  // sécurité
        stmt.run(key, JSON.stringify(value))
        updated.push(key)
      }
    })()
    return { type: 'settings', updated }
  }

  if (type === 'trigger_deload') {
    db.prepare("UPDATE program SET is_in_deload=1, last_deload_date=date('now'), updated_at=datetime('now') WHERE id=?").run(d.program_id)
    return { type: 'deload', program_id: d.program_id }
  }

  if (type === 'update_program') {
    return db.transaction(() => {
      const results = []
      if (d.fields) {
        const UPDATABLE = ['name','goal','level','days_per_week','progression_model','deload_auto_enabled','deload_frequency_weeks','description']
        const ups = []; const vals = []
        for (const f of UPDATABLE) {
          if (d.fields[f] !== undefined) { ups.push(`${f}=?`); vals.push(d.fields[f]) }
        }
        if (ups.length > 0) {
          ups.push("updated_at=datetime('now')"); vals.push(d.program_id)
          db.prepare(`UPDATE program SET ${ups.join(',')} WHERE id=?`).run(...vals)
          results.push('meta updated')
        }
      }
      return { type: 'program_update', program_id: d.program_id, changes: results.length }
    })()
  }

  throw new Error(`Action "${type}" non implémentée.`)
}

// ── POST /ai/chat ─────────────────────────────────────────────
router.post('/chat', async (req, res) => {
  const { message, history = [] } = req.body
  if (!message?.trim()) return res.status(400).json({ error: 'MISSING_MESSAGE' })

  const aiSettings = getAiSettings(db)
  if (!aiSettings.base_url || !aiSettings.model) {
    return res.status(503).json({ error: 'AI_NOT_CONFIGURED' })
  }

  res.writeHead(200, {
    'Content-Type':      'text/event-stream',
    'Cache-Control':     'no-cache',
    'Connection':        'keep-alive',
    'X-Accel-Buffering': 'no',
  })

  const systemPrompt = buildSystemPrompt(db)
  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.slice(-12).map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: message.trim() },
  ]

  const sendEvent = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`)

  let fullContent = ''
  let actionBuffer = ''
  let inActionBlock = false
  const pendingActions = []

  try {
    for await (const event of streamChat(messages, aiSettings)) {
      if (event.type === 'error') { sendEvent({ type: 'error', message: event.message }); break }
      if (event.type === 'done')  { sendEvent({ type: 'done', usage: event.usage, actions_count: pendingActions.length }); break }
      if (event.type !== 'token') continue

      fullContent += event.content

      // Détecter l'ouverture du bloc action
      if (!inActionBlock) {
        const actionIdx = fullContent.lastIndexOf('```action')
        if (actionIdx !== -1 && !fullContent.slice(actionIdx).includes('```\n') && !fullContent.slice(actionIdx + 9).trimStart().startsWith('`')) {
          inActionBlock = true
          actionBuffer  = fullContent.slice(actionIdx + 9)
          // Envoyer le texte avant le bloc
          const beforeAction = fullContent.slice(0, actionIdx)
          if (event.content && !actionBuffer.length) sendEvent({ type: 'token', content: event.content })
          continue
        }
        sendEvent({ type: 'token', content: event.content })
        continue
      }

      // En mode bloc action
      actionBuffer += event.content
      const closeIdx = actionBuffer.indexOf('```')
      if (closeIdx !== -1) {
        const jsonStr = actionBuffer.slice(0, closeIdx).trim()
        try {
          const parsed = JSON.parse(jsonStr)
          pendingActions.push(parsed)
          sendEvent({ type: 'action', action: parsed })
        } catch {
          sendEvent({ type: 'error', message: 'Bloc action invalide — JSON malformé.' })
        }
        // Texte après le bloc
        const afterBlock = actionBuffer.slice(closeIdx + 3)
        if (afterBlock.trim()) sendEvent({ type: 'token', content: afterBlock })
        inActionBlock = false
        actionBuffer  = ''
      }
    }
  } catch (err) {
    sendEvent({ type: 'error', message: err.message })
  } finally {
    res.end()
  }
})

// ── POST /ai/apply-action ─────────────────────────────────────
router.post('/apply-action', (req, res) => {
  try {
    const { action } = req.body
    if (!action) return res.status(400).json({ error: 'MISSING_ACTION' })
    const errors = validateAction(action, db)
    if (errors.length > 0) return res.status(400).json({ error: 'INVALID_ACTION_SCHEMA', details: errors })
    const result = applyAction(action, db)
    res.status(201).json({ applied: true, result })
  } catch (err) {
    console.error('[POST /ai/apply-action]', err.message)
    res.status(500).json({ error: 'INTERNAL_ERROR' })
  }
})

// ── POST /ai/apply-actions (lot) ──────────────────────────────
// Applique plusieurs actions d'un coup (pour l'onboarding qui émet 3-4 actions)
router.post('/apply-actions', (req, res) => {
  try {
    const { actions } = req.body
    if (!Array.isArray(actions) || actions.length === 0) {
      return res.status(400).json({ error: 'MISSING_ACTIONS' })
    }
    const results = []; const allErrors = []
    for (const action of actions) {
      const errors = validateAction(action, db)
      if (errors.length > 0) { allErrors.push(...errors); continue }
      try {
        results.push(applyAction(action, db))
      } catch (err) {
        allErrors.push(`Action "${action.action}": ${err.message}`)
      }
    }
    res.status(201).json({ applied: results.length, results, errors: allErrors })
  } catch (err) {
    console.error('[POST /ai/apply-actions]', err.message)
    res.status(500).json({ error: 'INTERNAL_ERROR' })
  }
})

// ── GET /ai/advice ────────────────────────────────────────────
router.get('/advice', (req, res) => {
  try {
    const rows = db.prepare(
      "SELECT * FROM equipment_advice WHERE status='active' ORDER BY created_at DESC"
    ).all().map(a => ({ ...a, signal_data: JSON.parse(a.signal_data||'{}') }))
    res.json({ advice: rows })
  } catch (err) {
    console.error('[GET /ai/advice]', err.message)
    res.status(500).json({ error: 'INTERNAL_ERROR' })
  }
})

// ── POST /ai/advice/:id/dismiss ───────────────────────────────
router.post('/advice/:id/dismiss', (req, res) => {
  try {
    const row = db.prepare('SELECT id FROM equipment_advice WHERE id=?').get(req.params.id)
    if (!row) return res.status(404).json({ error: 'ADVICE_NOT_FOUND' })
    db.prepare("UPDATE equipment_advice SET status='dismissed',dismissed_at=datetime('now') WHERE id=?").run(req.params.id)
    res.json({ id: parseInt(req.params.id), status: 'dismissed' })
  } catch (err) {
    res.status(500).json({ error: 'INTERNAL_ERROR' })
  }
})

// ── POST /ai/advice/:id/purchased ─────────────────────────────
router.post('/advice/:id/purchased', (req, res) => {
  try {
    const row = db.prepare('SELECT id FROM equipment_advice WHERE id=?').get(req.params.id)
    if (!row) return res.status(404).json({ error: 'ADVICE_NOT_FOUND' })
    db.prepare("UPDATE equipment_advice SET status='purchased',purchased_at=datetime('now') WHERE id=?").run(req.params.id)
    res.json({ id: parseInt(req.params.id), status: 'purchased' })
  } catch (err) {
    res.status(500).json({ error: 'INTERNAL_ERROR' })
  }
})

// ── POST /ai/generate-equipment-advice ────────────────────────
router.post('/generate-equipment-advice', async (req, res) => {
  try {
    const { runAllSignalChecks } = await import('../services/coachingAdvisor.js')
    const settingsRows = db.prepare('SELECT key,value FROM settings').all()
    const settings = {}
    for (const r of settingsRows) settings[r.key] = JSON.parse(r.value)
    const generated = runAllSignalChecks(db, settings)

    // Générer les textes LLM en arrière-plan
    import('../services/adviceTextGenerator.js').then(m =>
      m.generatePendingAdviceTexts(db).catch(e => console.warn('[advice]', e.message))
    ).catch(() => {})

    res.json({ generated, skipped_cooldown: 0 })
  } catch (err) {
    console.error('[POST /ai/generate-equipment-advice]', err.message)
    res.status(500).json({ error: 'INTERNAL_ERROR' })
  }
})

export default router
