import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import request from 'supertest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

process.env.DB_PATH = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'wb-t82-')), 'test.db')

const { migrate }       = await import('../../src/db/migrate.js')
const { getDb }         = await import('../../src/db/database.js')
const { seedExercises } = await import('../../src/seed/seed.js')
migrate(getDb())
seedExercises(getDb())

const { app } = await import('../../server.js')

// ── Mock provider SSE ─────────────────────────────────────────
let originalFetch
before(async () => {
  originalFetch = globalThis.fetch
  globalThis.fetch = async (_url, options) => {
    const last = JSON.parse(options.body).messages.at(-1).content
    return new Response(`data: ${JSON.stringify({ choices: [{ delta: { content: `Réponse à: ${last}` } }] })}\n\ndata: [DONE]\n\n`, {
      headers: { 'Content-Type': 'text/event-stream' },
    })
  }
  await request(app).put('/api/v1/settings').send({ ai_base_url: 'http://mock.invalid', ai_model: 'mock' })
})
after(() => { globalThis.fetch = originalFetch })

describe('T8.2 — Persistance du chat coach', () => {

  it('Premier chat sans conversation_id → crée et active une conversation', async () => {
    const res = await request(app).post('/api/v1/ai/chat').send({ message: 'Bonjour' })
    assert.equal(res.status, 200)
    assert.ok(res.text.includes('"type":"done"'))
    const done = JSON.parse(res.text.split('\n').find(l => l.includes('"conversation_id"')).slice(6))

    const list = await request(app).get('/api/v1/ai/conversations')
    const actives = list.body.conversations.filter(c => c.is_active === 1)
    assert.equal(actives.length, 1)
    assert.equal(actives[0].id, done.conversation_id)
  })

  it('Titre dérivé de la première question', async () => {
    const list = await request(app).get('/api/v1/ai/conversations')
    const conv = list.body.conversations.find(c => c.is_active === 1)
    assert.equal(conv.title, 'Bonjour')
  })

  it('Messages user + assistant persistés dans l\'ordre', async () => {
    const list = await request(app).get('/api/v1/ai/conversations')
    const id = list.body.conversations.find(c => c.is_active === 1).id
    const detail = await request(app).get(`/api/v1/ai/conversations/${id}/messages`)
    assert.equal(detail.body.messages.length, 2)
    assert.equal(detail.body.messages[0].role, 'user')
    assert.equal(detail.body.messages[0].content, 'Bonjour')
    assert.equal(detail.body.messages[1].role, 'assistant')
    assert.ok(detail.body.messages[1].content.includes('Réponse à: Bonjour'))
  })

  it('Deuxième message dans le même fil → 4 messages', async () => {
    const list = await request(app).get('/api/v1/ai/conversations')
    const id = list.body.conversations.find(c => c.is_active === 1).id
    await request(app).post('/api/v1/ai/chat').send({ message: 'Comment aller ?', conversation_id: id })
    const detail = await request(app).get(`/api/v1/ai/conversations/${id}/messages`)
    assert.equal(detail.body.messages.length, 4)
    // Le contexte DB est utilisé : le mock voit le dernier message user
    assert.ok(detail.body.messages[3].content.includes('Comment aller ?'))
  })

  it('conversation_id inconnu → 404, aucun message écrit', async () => {
    const before = await request(app).get('/api/v1/ai/conversations')
    const res = await request(app).post('/api/v1/ai/chat')
      .send({ message: 'test', conversation_id: 99999 })
    assert.equal(res.status, 404)
    assert.equal(res.body.error, 'CONVERSATION_NOT_FOUND')
  })

  it('ignore les actions de configuration dans le flux et dans le message sauvegardé', async () => {
    const db=getDb()
    const snapshot=()=>Object.fromEntries(['program','equipment_item','exercise','settings','user_profile'].map(table=>[table,db.prepare(`SELECT * FROM ${table}`).all()]))
    const before=snapshot()
    const message='Conseil seulement.\n```action\n{"action":"update_settings","payload":{"unit":"lb"}}\n```\nContinuez progressivement.'
    const res=await request(app).post('/api/v1/ai/chat').send({message})
    assert.equal(res.status,200)
    assert.ok(!res.text.includes('update_settings'))
    assert.ok(!res.text.includes('"type":"action"'))
    const persisted=db.prepare("SELECT content FROM coach_message WHERE role='assistant' ORDER BY id DESC LIMIT 1").get().content
    assert.ok(!persisted.includes('update_settings'))
    assert.ok(persisted.includes('Continuez progressivement.'))
    assert.deepEqual(snapshot(),before)
  })

  it('Provider non configuré → 503 et aucune écriture DB', async () => {
    await request(app).put('/api/v1/settings').send({ ai_base_url: '' })
    const before = getDb().prepare('SELECT COUNT(*) n FROM coach_message').get().n
    const res = await request(app).post('/api/v1/ai/chat').send({ message: 'devrait échouer' })
    assert.equal(res.status, 503)
    const after = getDb().prepare('SELECT COUNT(*) n FROM coach_message').get().n
    assert.equal(after, before)
  })
})
