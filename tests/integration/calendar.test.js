import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import request from 'supertest'
import { app } from '../../server.js'

describe('T3.4 — Calendrier API', () => {
  let sessionId

  it('POST /sessions crée une séance planifiée', async () => {
    const res = await request(app).post('/api/v1/sessions').send({
      name: 'Push test', scheduled_date: '2025-07-15'
    })
    assert.equal(res.status, 201)
    assert.equal(res.body.status, 'planned')
    sessionId = res.body.id
  })

  it('GET /sessions?from=&to= retourne les séances du mois', async () => {
    const res = await request(app)
      .get('/api/v1/sessions?from=2025-07-01&to=2025-07-31')
    assert.equal(res.status, 200)
    assert.ok(Array.isArray(res.body.sessions))
    const found = res.body.sessions.find(s => s.id === sessionId)
    assert.ok(found)
  })

  it('POST /sessions/:id/skip passe status à skipped', async () => {
    const res = await request(app).post(`/api/v1/sessions/${sessionId}/skip`)
    assert.equal(res.status, 200)
    assert.equal(res.body.status, 'skipped')
  })

  it('PUT /sessions/:id replanifie une séance planned', async () => {
    const res2 = await request(app).post('/api/v1/sessions').send({
      name: 'Push test 2', scheduled_date: '2025-07-20'
    })
    const res = await request(app)
      .put(`/api/v1/sessions/${res2.body.id}`)
      .send({ scheduled_date: '2025-07-22' })
    assert.equal(res.status, 200)
    assert.equal(res.body.scheduled_date, '2025-07-22')
  })

  it('POST /sessions/:id/skip sur séance complétée → 409', async () => {
    // Créer et compléter une séance
    const s = await request(app).post('/api/v1/sessions')
      .send({ name: 'Done', scheduled_date: '2025-07-10' })
    await request(app).post(`/api/v1/sessions/${s.body.id}/start`)
    await request(app).post(`/api/v1/sessions/${s.body.id}/complete`)
    const res = await request(app).post(`/api/v1/sessions/${s.body.id}/skip`)
    assert.equal(res.status, 409)
  })
})
