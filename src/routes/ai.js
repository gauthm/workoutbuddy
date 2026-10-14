import { createActionStreamParser } from '../services/actionStreamParser.js'
import express from 'express'
import { getDb }                from '../db/database.js'
import { getAiSettings }        from './settings.js'
import { streamChat }           from '../services/aiProvider.js'
import { buildSystemPrompt }    from '../services/systemPromptBuilder.js'

const router = express.Router()
const db     = getDb()

// ── Conversations ─────────────────────────────────────────────

// GET /ai/conversations — liste complète, tri par activité récente
router.get('/conversations', (req, res) => {
  try {
    const conversations = db.prepare(`
      SELECT c.*,
             COUNT(m.id) AS message_count,
             MAX(m.created_at) AS last_message_at
      FROM coach_conversation c
      LEFT JOIN coach_message m ON m.conversation_id = c.id
      GROUP BY c.id
      ORDER BY c.is_active DESC, COALESCE(last_message_at, c.created_at) DESC
    `).all()
    res.json({ conversations })
  } catch (err) {
    console.error('[GET /ai/conversations]', err.message)
    res.status(500).json({ error: 'INTERNAL_ERROR' })
  }
})

// POST /ai/conversations — crée ET active (déactive les autres)
router.post('/conversations', (req, res) => {
  try {
    const raw = typeof req.body?.title === 'string' ? req.body.title.trim() : ''
    if (raw.length > 100) return res.status(400).json({ error: 'TITLE_TOO_LONG' })
    const title = raw || 'Conversation'
    const result = db.transaction(() => {
      db.prepare('UPDATE coach_conversation SET is_active = 0').run()
      return db.prepare('INSERT INTO coach_conversation (title, is_active) VALUES (?,1)').run(title)
    })()
    const conv = db.prepare('SELECT * FROM coach_conversation WHERE id = ?').get(result.lastInsertRowid)
    res.status(201).json(conv)
  } catch (err) {
    console.error('[POST /ai/conversations]', err.message)
    res.status(500).json({ error: 'INTERNAL_ERROR' })
  }
})

// GET /ai/conversations/:id/messages — détail d'un fil
router.get('/conversations/:id/messages', (req, res) => {
  try {
    const conversation = db.prepare('SELECT * FROM coach_conversation WHERE id = ?').get(req.params.id)
    if (!conversation) return res.status(404).json({ error: 'CONVERSATION_NOT_FOUND' })
    const messages = db.prepare(
      'SELECT id, role, content, created_at FROM coach_message WHERE conversation_id = ? ORDER BY id ASC'
    ).all(req.params.id)
    res.json({ conversation, messages })
  } catch (err) {
    console.error('[GET /ai/conversations/:id/messages]', err.message)
    res.status(500).json({ error: 'INTERNAL_ERROR' })
  }
})

// PATCH /ai/conversations/:id — renommage et/ou activation
// Body : { title?: string, is_active?: boolean } — au moins une clé
router.patch('/conversations/:id', (req, res) => {
  try {
    const conv = db.prepare('SELECT * FROM coach_conversation WHERE id = ?').get(req.params.id)
    if (!conv) return res.status(404).json({ error: 'CONVERSATION_NOT_FOUND' })

    const { title, is_active } = req.body || {}
    if (title === undefined && is_active === undefined) {
      return res.status(400).json({ error: 'NO_FIELDS_TO_UPDATE' })
    }
    if (title !== undefined) {
      const t = typeof title === 'string' ? title.trim() : ''
      if (!t || t.length > 100) return res.status(400).json({ error: 'INVALID_TITLE' })
    }
    if (is_active !== undefined && typeof is_active !== 'boolean') {
      return res.status(400).json({ error: 'INVALID_IS_ACTIVE' })
    }

    db.transaction(() => {
      if (title !== undefined) {
        db.prepare("UPDATE coach_conversation SET title = ?, updated_at = datetime('now') WHERE id = ?")
          .run(title.trim(), req.params.id)
      }
      if (is_active === true) {
        db.prepare('UPDATE coach_conversation SET is_active = 0').run()
        db.prepare("UPDATE coach_conversation SET is_active = 1, updated_at = datetime('now') WHERE id = ?")
          .run(req.params.id)
      } else if (is_active === false) {
        db.prepare('UPDATE coach_conversation SET is_active = 0 WHERE id = ?').run(req.params.id)
      }
    })()

    res.json(db.prepare('SELECT * FROM coach_conversation WHERE id = ?').get(req.params.id))
  } catch (err) {
    console.error('[PATCH /ai/conversations/:id]', err.message)
    res.status(500).json({ error: 'INTERNAL_ERROR' })
  }
})

// DELETE /ai/conversations/:id — supprime le fil + ses messages (cascade)
router.delete('/conversations/:id', (req, res) => {
  try {
    const conv = db.prepare('SELECT id FROM coach_conversation WHERE id = ?').get(req.params.id)
    if (!conv) return res.status(404).json({ error: 'CONVERSATION_NOT_FOUND' })
    db.prepare('DELETE FROM coach_conversation WHERE id = ?').run(req.params.id)
    res.status(204).end()
  } catch (err) {
    console.error('[DELETE /ai/conversations/:id]', err.message)
    res.status(500).json({ error: 'INTERNAL_ERROR' })
  }
})

// ── POST /ai/chat ─────────────────────────────────────────────
router.post('/chat', async (req, res) => {
  const { message, conversation_id } = req.body
  // Le champ "history" du body est volontairement ignoré (contexte depuis la DB)
  if (typeof message !== 'string' || !message.trim()) return res.status(400).json({ error: 'MISSING_MESSAGE' })

  const aiSettings = getAiSettings(db)
  if (!aiSettings.base_url || !aiSettings.model) {
    return res.status(503).json({ error: 'AI_NOT_CONFIGURED' })
  }

  // ── 1. Résolution de la conversation ──────────────────────
  let conversation
  try {
    conversation = db.transaction(() => {
      if (conversation_id !== undefined && conversation_id !== null) {
        const c = db.prepare('SELECT * FROM coach_conversation WHERE id = ?').get(conversation_id)
        if (!c) return null
        if (!c.is_active) {
          db.prepare('UPDATE coach_conversation SET is_active = 0').run()
          db.prepare("UPDATE coach_conversation SET is_active = 1, updated_at = datetime('now') WHERE id = ?").run(c.id)
          return db.prepare('SELECT * FROM coach_conversation WHERE id = ?').get(c.id)
        }
        return c
      }
      let c = db.prepare('SELECT * FROM coach_conversation WHERE is_active = 1 LIMIT 1').get()
      if (!c) {
        const n = db.prepare('SELECT COUNT(*) n FROM coach_conversation').get().n + 1
        db.prepare('INSERT INTO coach_conversation (title, is_active) VALUES (?,1)').run(`Conversation ${n}`)
        c = db.prepare('SELECT * FROM coach_conversation WHERE id = (SELECT last_insert_rowid())').get()
      }
      return c
    })()
  } catch (err) {
    console.error('[POST /ai/chat] résolution conversation', err.message)
    return res.status(500).json({ error: 'INTERNAL_ERROR' })
  }
  if (!conversation) return res.status(404).json({ error: 'CONVERSATION_NOT_FOUND' })

  // ── 2. Insertion du message utilisateur ───────────────────
  const userMsg = db.prepare('INSERT INTO coach_message (conversation_id, role, content) VALUES (?,\'user\',?)')
    .run(conversation.id, message.trim())

  // Titre dérivé de la première question (si jamais renommée)
  const msgCount = db.prepare('SELECT COUNT(*) n FROM coach_message WHERE conversation_id = ?').get(conversation.id).n
  if (msgCount === 1 && /^Conversation( \d+)?$/.test(conversation.title)) {
    const derived = message.trim().slice(0, 60)
    db.prepare("UPDATE coach_conversation SET title = ? WHERE id = ?")
      .run(message.trim().length > 60 ? derived + '…' : derived, conversation.id)
  }

  // ── 3. Contexte LLM construit depuis la DB ────────────────
  const history = db.prepare(`
    SELECT role, content FROM coach_message
    WHERE conversation_id = ? AND id < ?
    ORDER BY id DESC LIMIT 14
  `).all(conversation.id, userMsg.lastInsertRowid).reverse()

  res.writeHead(200, {
    'Content-Type':      'text/event-stream',
    'Cache-Control':     'no-cache',
    'Connection':        'keep-alive',
    'X-Accel-Buffering': 'no',
  })

  const systemPrompt = buildSystemPrompt(db)
  const messages = [
    { role: 'system', content: systemPrompt },
    ...history,
    { role: 'user', content: message.trim() },
  ]

  const sendEvent = (data) => !res.destroyed && !res.writableEnded && res.write(`data: ${JSON.stringify(data)}\n\n`)

  let fullContent = ''
  const parse = createActionStreamParser()
  const sendParsed = events => {
    for (const event of events) {
      if (event.type === 'action') continue
      if (event.type === 'token') fullContent += event.content
      sendEvent(event)
    }
  }
  const controller = new AbortController()
  const onClose = () => { if (!res.writableEnded) controller.abort() }
  res.on('close', onClose)
  try {
    for await (const event of streamChat(messages, aiSettings, { signal: controller.signal })) {
      if (event.type === 'error') { sendParsed(parse('', true)); sendEvent(event); break }
      if (event.type === 'done') {
        sendParsed(parse('', true))
        sendEvent({ type: 'done', usage: event.usage, actions_count: 0, conversation_id: conversation.id })
        break
      }
      if (event.type !== 'token') continue
      sendParsed(parse(event.content))
    }
  } catch (err) {
    sendEvent({ type: 'error', message: err.message })
  } finally {
    res.off('close', onClose)
    // Persistance de la réponse (brute, blocs ```action inclus)
    try {
      if (fullContent.trim()) {
        db.prepare('INSERT INTO coach_message (conversation_id, role, content) VALUES (?,\'assistant\',?)')
          .run(conversation.id, fullContent)
      }
      db.prepare("UPDATE coach_conversation SET updated_at = datetime('now') WHERE id = ?")
        .run(conversation.id)
    } catch (err) {
      console.error('[POST /ai/chat] persistance assistant', err.message)
      // Non bloquant : le client a déjà reçu le stream
    }
    res.end()
  }
})

// Legacy clients and historical action blocks cannot configure the app.
router.post(['/apply-action', '/apply-actions'], (req, res) => {
  res.status(403).json({ error: 'COACH_READ_ONLY' })
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
