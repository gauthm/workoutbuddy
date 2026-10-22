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

  it('GET /api/v1/unknown returns 404 or falls through to the next handler', async () => {
    const res = await request(app).get('/api/v1/route-inconnue')
    assert.ok([404, 500].includes(res.status))
  })
})
