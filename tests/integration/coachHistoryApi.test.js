import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import request from 'supertest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

// Isolated DB
process.env.DB_PATH = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'wb-t81-')), 'test.db')

const { migrate }       = await import('../../src/db/migrate.js')
const { getDb }         = await import('../../src/db/database.js')
const { seedExercises } = await import('../../src/seed/seed.js')
migrate(getDb())
seedExercises(getDb())

const { app } = await import('../../server.js')

describe('T8.1 — Coach conversations API', () => {

  it('POST /ai/conversations creates an active conversation', async () => {
    const res = await request(app).post('/api/v1/ai/conversations').send({ title: 'Fil test' })
    assert.equal(res.status, 201)
    assert.equal(res.body.title, 'Fil test')
    assert.equal(res.body.is_active, 1)
  })

  it('POST without title → default title "Conversation"', async () => {
    const res = await request(app).post('/api/v1/ai/conversations').send({})
    assert.equal(res.status, 201)
    assert.equal(res.body.title, 'Conversation')
  })

  it('Creating a second conversation deactivates the first', async () => {
    const list = await request(app).get('/api/v1/ai/conversations')
    const actives = list.body.conversations.filter(c => c.is_active === 1)
    assert.equal(actives.length, 1, 'Exactly one active conversation')
  })

  it('GET /ai/conversations returns message_count and last_message_at', async () => {
    const list = await request(app).get('/api/v1/ai/conversations')
    assert.ok(Array.isArray(list.body.conversations))
    const c = list.body.conversations[0]
    assert.equal(typeof c.message_count, 'number')
  })

  it('GET /ai/conversations/:id/messages → unknown thread = 404', async () => {
    const res = await request(app).get('/api/v1/ai/conversations/99999/messages')
    assert.equal(res.status, 404)
    assert.equal(res.body.error, 'CONVERSATION_NOT_FOUND')
  })

  it('PATCH rename + activation exclusive', async () => {
    const created = await request(app).post('/api/v1/ai/conversations').send({})
    const id = created.body.id

    const ren = await request(app).patch(`/api/v1/ai/conversations/${id}`).send({ title: 'Renamed' })
    assert.equal(ren.status, 200)
    assert.equal(ren.body.title, 'Renamed')

    const act = await request(app).patch(`/api/v1/ai/conversations/${id}`).send({ is_active: true })
    assert.equal(act.status, 200)

    const list = await request(app).get('/api/v1/ai/conversations')
    const actives = list.body.conversations.filter(c => c.is_active === 1)
    assert.equal(actives.length, 1)
    assert.equal(actives[0].id, id)
  })

  it('PATCH without field → 400', async () => {
    const list = await request(app).get('/api/v1/ai/conversations')
    const id = list.body.conversations[0].id
    const res = await request(app).patch(`/api/v1/ai/conversations/${id}`).send({})
    assert.equal(res.status, 400)
    assert.equal(res.body.error, 'NO_FIELDS_TO_UPDATE')
  })

  it('DELETE + cascade: messages follow', async () => {
    const db = getDb()
    const conv = await request(app).post('/api/v1/ai/conversations').send({ title: 'Avec messages' })
    const id = conv.body.id
    db.prepare("INSERT INTO coach_message (conversation_id, role, content) VALUES (?, 'user', 'salut')").run(id)
    db.prepare("INSERT INTO coach_message (conversation_id, role, content) VALUES (?, 'assistant', 'hello')").run(id)

    const del = await request(app).delete(`/api/v1/ai/conversations/${id}`)
    assert.equal(del.status, 204)

    const msgs = db.prepare('SELECT COUNT(*) n FROM coach_message WHERE conversation_id = ?').get(id)
    assert.equal(msgs.n, 0, 'Messages must be cascade-deleted')
  })

  it('DELETE unknown conversation → 404', async () => {
    const res = await request(app).delete('/api/v1/ai/conversations/99999')
    assert.equal(res.status, 404)
  })

  it('Export → import round-trip preserves conversations', async () => {
    await request(app).post('/api/v1/ai/conversations').send({ title: 'Round trip' })

    const exp = await request(app).get('/api/v1/export')
    assert.ok(Array.isArray(exp.body.data.coach_conversations))
    assert.ok(exp.body.data.coach_conversations.some(c => c.title === 'Round trip'))

    const payload = exp.body
    payload.data.coach_conversations.push({
      id: 90001, title: 'Injected', is_active: 0,
      created_at: '2026-01-01 00:00:00', updated_at: '2026-01-01 00:00:00',
    })
    payload.data.coach_messages.push({
      id: 90002, conversation_id: 90001, role: 'user',
      content: 'hello', created_at: '2026-01-01 00:00:00',
    })
    const imp = await request(app).post('/api/v1/import').send(payload)
    assert.equal(imp.status, 200)

    const msgs = await request(app).get('/api/v1/ai/conversations/90001/messages')
    assert.equal(msgs.status, 200)
    assert.equal(msgs.body.messages.length, 1)
    assert.equal(msgs.body.messages[0].content, 'hello')
  })
})
