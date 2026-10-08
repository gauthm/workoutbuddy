import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import request from 'supertest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

// DB isolée
process.env.DB_PATH = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'wb-t81-')), 'test.db')

const { migrate }       = await import('../../src/db/migrate.js')
const { getDb }         = await import('../../src/db/database.js')
const { seedExercises } = await import('../../src/seed/seed.js')
migrate(getDb())
seedExercises(getDb())

const { app } = await import('../../server.js')

describe('T8.1 — API conversations coach', () => {

  it('POST /ai/conversations crée une conversation active', async () => {
    const res = await request(app).post('/api/v1/ai/conversations').send({ title: 'Fil test' })
    assert.equal(res.status, 201)
    assert.equal(res.body.title, 'Fil test')
    assert.equal(res.body.is_active, 1)
  })

  it('POST sans titre → titre par défaut "Conversation"', async () => {
    const res = await request(app).post('/api/v1/ai/conversations').send({})
    assert.equal(res.status, 201)
    assert.equal(res.body.title, 'Conversation')
  })

  it('Créer une 2e conversation déactive la première', async () => {
    const list = await request(app).get('/api/v1/ai/conversations')
    const actives = list.body.conversations.filter(c => c.is_active === 1)
    assert.equal(actives.length, 1, 'Exactement une conversation active')
  })

  it('GET /ai/conversations retourne message_count et last_message_at', async () => {
    const list = await request(app).get('/api/v1/ai/conversations')
    assert.ok(Array.isArray(list.body.conversations))
    const c = list.body.conversations[0]
    assert.equal(typeof c.message_count, 'number')
  })

  it('GET /ai/conversations/:id/messages → fil inconnu = 404', async () => {
    const res = await request(app).get('/api/v1/ai/conversations/99999/messages')
    assert.equal(res.status, 404)
    assert.equal(res.body.error, 'CONVERSATION_NOT_FOUND')
  })

  it('PATCH rename + activation exclusive', async () => {
    const created = await request(app).post('/api/v1/ai/conversations').send({})
    const id = created.body.id

    const ren = await request(app).patch(`/api/v1/ai/conversations/${id}`).send({ title: 'Renommé' })
    assert.equal(ren.status, 200)
    assert.equal(ren.body.title, 'Renommé')

    const act = await request(app).patch(`/api/v1/ai/conversations/${id}`).send({ is_active: true })
    assert.equal(act.status, 200)

    const list = await request(app).get('/api/v1/ai/conversations')
    const actives = list.body.conversations.filter(c => c.is_active === 1)
    assert.equal(actives.length, 1)
    assert.equal(actives[0].id, id)
  })

  it('PATCH sans champ → 400', async () => {
    const list = await request(app).get('/api/v1/ai/conversations')
    const id = list.body.conversations[0].id
    const res = await request(app).patch(`/api/v1/ai/conversations/${id}`).send({})
    assert.equal(res.status, 400)
    assert.equal(res.body.error, 'NO_FIELDS_TO_UPDATE')
  })

  it('DELETE + cascade : les messages suivent', async () => {
    const db = getDb()
    const conv = await request(app).post('/api/v1/ai/conversations').send({ title: 'Avec messages' })
    const id = conv.body.id
    db.prepare("INSERT INTO coach_message (conversation_id, role, content) VALUES (?, 'user', 'salut')").run(id)
    db.prepare("INSERT INTO coach_message (conversation_id, role, content) VALUES (?, 'assistant', 'bonjour')").run(id)

    const del = await request(app).delete(`/api/v1/ai/conversations/${id}`)
    assert.equal(del.status, 204)

    const msgs = db.prepare('SELECT COUNT(*) n FROM coach_message WHERE conversation_id = ?').get(id)
    assert.equal(msgs.n, 0, 'Les messages doivent être supprimés en cascade')
  })

  it('DELETE conversation inconnue → 404', async () => {
    const res = await request(app).delete('/api/v1/ai/conversations/99999')
    assert.equal(res.status, 404)
  })

  it('Export → import round-trip conserve les conversations', async () => {
    await request(app).post('/api/v1/ai/conversations').send({ title: 'Round trip' })

    const exp = await request(app).get('/api/v1/export')
    assert.ok(Array.isArray(exp.body.data.coach_conversations))
    assert.ok(exp.body.data.coach_conversations.some(c => c.title === 'Round trip'))

    const payload = exp.body
    payload.data.coach_conversations.push({
      id: 90001, title: 'Injectée', is_active: 0,
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
