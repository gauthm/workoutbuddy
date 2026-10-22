import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import request from '../helpers/in-process-request.js'
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
    return new Response(`data: ${JSON.stringify({ choices: [{ delta: { content: `Response to: ${last}` } }] })}\n\ndata: [DONE]\n\n`, {
      headers: { 'Content-Type': 'text/event-stream' },
    })
  }
  await request(app).put('/api/v1/settings').send({ ai_base_url: 'http://mock.invalid', ai_model: 'mock' })
})
after(() => { globalThis.fetch = originalFetch })

describe('T8.2 — Coach chat persistence', () => {

  it('First chat without conversation_id → creates and activates a conversation', async () => {
    const res = await request(app).post('/api/v1/ai/chat').send({ message: 'Hello' })
    assert.equal(res.status, 200)
    assert.ok(res.text.includes('"type":"done"'))
    const done = JSON.parse(res.text.split('\n').find(l => l.includes('"conversation_id"')).slice(6))

    const list = await request(app).get('/api/v1/ai/conversations')
    const actives = list.body.conversations.filter(c => c.is_active === 1)
    assert.equal(actives.length, 1)
    assert.equal(actives[0].id, done.conversation_id)
  })

  it('Title derived from the first question', async () => {
    const list = await request(app).get('/api/v1/ai/conversations')
    const conv = list.body.conversations.find(c => c.is_active === 1)
    assert.equal(conv.title, 'Hello')
  })

  it('User + assistant messages persisted in order', async () => {
    const list = await request(app).get('/api/v1/ai/conversations')
    const id = list.body.conversations.find(c => c.is_active === 1).id
    const detail = await request(app).get(`/api/v1/ai/conversations/${id}/messages`)
    assert.equal(detail.body.messages.length, 2)
    assert.equal(detail.body.messages[0].role, 'user')
    assert.equal(detail.body.messages[0].content, 'Hello')
    assert.equal(detail.body.messages[1].role, 'assistant')
    assert.ok(detail.body.messages[1].content.includes('Response to: Hello'))
  })

  it('Second message in the same thread → 4 messages', async () => {
    const list = await request(app).get('/api/v1/ai/conversations')
    const id = list.body.conversations.find(c => c.is_active === 1).id
    const sent = await request(app).post('/api/v1/ai/chat').send({ message: 'Comment aller ?', conversation_id: id })
    assert.equal(sent.status, 200)
    assert.ok(sent.text.includes('"type":"done"'))
    const detail = await request(app).get(`/api/v1/ai/conversations/${id}/messages`)
    assert.equal(detail.body.messages.length, 4)
    // DB context is used: the mock sees the latest user message
    assert.ok(detail.body.messages[3].content.includes('Comment aller ?'))
  })

  it('unknown conversation_id → 404, no message written', async () => {
    const before = await request(app).get('/api/v1/ai/conversations')
    const res = await request(app).post('/api/v1/ai/chat')
      .send({ message: 'test', conversation_id: 99999 })
    assert.equal(res.status, 404)
    assert.equal(res.body.error, 'CONVERSATION_NOT_FOUND')
  })

  it('ignores configuration actions in the stream and saved message', async () => {
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

  it('Unconfigured provider → 503 and no DB write', async () => {
    await request(app).put('/api/v1/settings').send({ ai_base_url: '' })
    const before = getDb().prepare('SELECT COUNT(*) n FROM coach_message').get().n
    const res = await request(app).post('/api/v1/ai/chat').send({ message: 'should fail' })
    assert.equal(res.status, 503)
    const after = getDb().prepare('SELECT COUNT(*) n FROM coach_message').get().n
    assert.equal(after, before)
  })
})
