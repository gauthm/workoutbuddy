import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import request from 'supertest'
import { app } from '../../server.js'

describe('T1.1 — Scaffolding', () => {
  it('GET / returns 200', async () => {
    const res = await request(app).get('/')
    assert.equal(res.status, 200)
  })

  it('GET /unknown-page returns index.html (SPA fallback)', async () => {
    const res = await request(app).get('/unknown-route')
    assert.equal(res.status, 200)
    assert.ok(res.text.includes('<div id="app">'))
  })

  it('GET nested client routes returns index.html (SPA fallback)', async () => {
    const res = await request(app).get('/client/nested/route')
    assert.equal(res.status, 200)
    assert.ok(res.text.includes('<div id="app">'))
  })

  it('missing static files return 404 instead of the SPA', async () => {
    const res = await request(app).get('/vendor/missing.js')
    assert.equal(res.status, 404)
    assert.ok(!res.text.includes('<div id="app">'))
  })

  it('GET /api/v1/unknown returns a JSON 404', async () => {
    const res = await request(app).get('/api/v1/route-inconnue')
    assert.equal(res.status, 404)
    assert.deepEqual(res.body, { error: 'NOT_FOUND' })
  })

  it('a missing JSON body retains API validation instead of causing a server error', async () => {
    const res = await request(app).post('/api/v1/bodyweight')
    assert.equal(res.status, 400)
    assert.deepEqual(res.body, { error: 'MISSING_DATE' })
  })
})
