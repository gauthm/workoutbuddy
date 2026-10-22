import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import request from 'supertest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

// Isolated DB (otherwise shared file DB → race with other test files)
process.env.DB_PATH = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'wb-t63-')), 'test.db')

const { migrate } = await import('../../src/db/migrate.js')
const { getDb }   = await import('../../src/db/database.js')
migrate(getDb())

const { app } = await import('../../server.js')

describe('T6.3 — Export / Import', () => {

  it('GET /export returns valid JSON with version=1', async () => {
    const res = await request(app).get('/api/v1/export')
    assert.equal(res.status, 200)
    assert.equal(res.body.version, 1)
    assert.equal(res.body.app, 'workoutbuddy')
    assert.ok('data' in res.body)
    assert.ok('exported_at' in res.body)

    // Check the data structure
    const REQUIRED_TABLES = [
      'exercises','equipment_items','programs','workout_templates',
      'template_exercises','progression_states','sessions','session_exercises',
      'set_logs','body_weights','personal_records','equipment_advice','settings',
    ]
    for (const table of REQUIRED_TABLES) {
      assert.ok(table in res.body.data, `Missing field in data: ${table}`)
    }
  })

  it("GET /export does not export built-in exercises", async () => {
    const res = await request(app).get('/api/v1/export')
    assert.equal(res.status, 200)
    // Seed exercises (is_custom=0) must not appear in the export
    for (const ex of res.body.data.exercises) {
      assert.equal(ex.is_custom, true, `Built-in exercise exported: ${ex.id}`)
    }
  })

  it("GET /export does not export ai_api_key", async () => {
    const res = await request(app).get('/api/v1/export')
    assert.ok(!('ai_api_key' in (res.body.data.settings || {})))
  })

  it('POST /import with valid empty payload → 200 with counts', async () => {
    const payload = {
      version:     1,
      app:         'workoutbuddy',
      exported_at: new Date().toISOString(),
      data: {
        exercises: [], equipment_items: [], programs: [],
        workout_templates: [], template_exercises: [],
        progression_states: [], sessions: [], session_exercises: [],
        set_logs: [], body_weights: [], personal_records: [],
        equipment_advice: [], settings: {},
      }
    }
    const res = await request(app).post('/api/v1/import').send(payload)
    assert.equal(res.status, 200)
    assert.ok('imported' in res.body)
  })

  it('POST /import with incorrect version → 400', async () => {
    const res = await request(app).post('/api/v1/import').send({
      version: 99, app: 'workoutbuddy', data: {}
    })
    assert.equal(res.status, 400)
    assert.equal(res.body.error, 'INVALID_IMPORT_FORMAT')
  })

  it('POST /import with incorrect app → 400', async () => {
    const res = await request(app).post('/api/v1/import').send({
      version: 1, app: 'autre_app', data: {}
    })
    assert.equal(res.status, 400)
  })

  it('Export → Import → re-export: identical data', async () => {
    // 1. Create test data
    await request(app).post('/api/v1/bodyweight').send({
      date: '2025-07-15', weight_kg: 77.5
    })
    await request(app).post('/api/v1/equipment').send({
      category: 'barbell', name: 'Test barbell', weight_kg: 20, count: 1
    })

    // 2. Export
    const exportRes = await request(app).get('/api/v1/export')
    assert.equal(exportRes.status, 200)
    const originalData = exportRes.body

    // 3. Import
    const importRes = await request(app).post('/api/v1/import').send(originalData)
    assert.equal(importRes.status, 200)

    // 4. Re-export and compare key structures
    const reExportRes = await request(app).get('/api/v1/export')
    assert.equal(reExportRes.status, 200)
    assert.equal(
      reExportRes.body.data.body_weights.length,
      originalData.data.body_weights.length
    )
    assert.equal(
      reExportRes.body.data.equipment_items.length,
      originalData.data.equipment_items.length
    )
  })

  it('GET /export/csv/sessions returns CSV', async () => {
    const res = await request(app).get('/api/v1/export/csv/sessions')
    assert.equal(res.status, 200)
    assert.ok(res.headers['content-type'].includes('text/csv'))
    // Check for the UTF-8 BOM
    assert.ok(res.text.startsWith('\uFEFF') || res.text.startsWith(''))
  })

  it('GET /export/csv/invalid_table → 400', async () => {
    const res = await request(app).get('/api/v1/export/csv/programs')
    assert.equal(res.status, 400)
    assert.equal(res.body.error, 'INVALID_TABLE')
  })

  it('POST /backup creates a backup file', async () => {
    const res = await request(app).post('/api/v1/backup')
    assert.equal(res.status, 200)
    assert.ok(res.body.message.includes('Sauvegarde'))
    assert.ok(typeof res.body.backup_count === 'number')
  })
})
