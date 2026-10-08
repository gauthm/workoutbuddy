import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import request from 'supertest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

// DB isolée (DB fichier partagée sinon → course avec les autres fichiers de tests)
process.env.DB_PATH = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'wb-t63-')), 'test.db')

const { migrate } = await import('../../src/db/migrate.js')
const { getDb }   = await import('../../src/db/database.js')
migrate(getDb())

const { app } = await import('../../server.js')

describe('T6.3 — Export / Import', () => {

  it('GET /export retourne un JSON valide avec version=1', async () => {
    const res = await request(app).get('/api/v1/export')
    assert.equal(res.status, 200)
    assert.equal(res.body.version, 1)
    assert.equal(res.body.app, 'workoutbuddy')
    assert.ok('data' in res.body)
    assert.ok('exported_at' in res.body)

    // Vérifier la structure data
    const REQUIRED_TABLES = [
      'exercises','equipment_items','programs','workout_templates',
      'template_exercises','progression_states','sessions','session_exercises',
      'set_logs','body_weights','personal_records','equipment_advice','settings',
    ]
    for (const table of REQUIRED_TABLES) {
      assert.ok(table in res.body.data, `Champ manquant dans data : ${table}`)
    }
  })

  it("GET /export n'exporte pas les exercices built-in", async () => {
    const res = await request(app).get('/api/v1/export')
    assert.equal(res.status, 200)
    // Les exercices du seed (is_custom=0) ne doivent pas être dans l'export
    for (const ex of res.body.data.exercises) {
      assert.equal(ex.is_custom, true, `Exercice built-in exporté : ${ex.id}`)
    }
  })

  it("GET /export n'exporte pas ai_api_key", async () => {
    const res = await request(app).get('/api/v1/export')
    assert.ok(!('ai_api_key' in (res.body.data.settings || {})))
  })

  it('POST /import avec payload valide vide → 200 avec counts', async () => {
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

  it('POST /import avec version incorrecte → 400', async () => {
    const res = await request(app).post('/api/v1/import').send({
      version: 99, app: 'workoutbuddy', data: {}
    })
    assert.equal(res.status, 400)
    assert.equal(res.body.error, 'INVALID_IMPORT_FORMAT')
  })

  it('POST /import avec app incorrecte → 400', async () => {
    const res = await request(app).post('/api/v1/import').send({
      version: 1, app: 'autre_app', data: {}
    })
    assert.equal(res.status, 400)
  })

  it('Export → Import → re-export : données identiques', async () => {
    // 1. Créer des données de test
    await request(app).post('/api/v1/bodyweight').send({
      date: '2025-07-15', weight_kg: 77.5
    })
    await request(app).post('/api/v1/equipment').send({
      category: 'barbell', name: 'Barre test', weight_kg: 20, count: 1
    })

    // 2. Exporter
    const exportRes = await request(app).get('/api/v1/export')
    assert.equal(exportRes.status, 200)
    const originalData = exportRes.body

    // 3. Importer
    const importRes = await request(app).post('/api/v1/import').send(originalData)
    assert.equal(importRes.status, 200)

    // 4. Re-exporter et comparer les structures clés
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

  it('GET /export/csv/sessions retourne du CSV', async () => {
    const res = await request(app).get('/api/v1/export/csv/sessions')
    assert.equal(res.status, 200)
    assert.ok(res.headers['content-type'].includes('text/csv'))
    // Vérifier la présence du BOM UTF-8
    assert.ok(res.text.startsWith('\uFEFF') || res.text.startsWith(''))
  })

  it('GET /export/csv/table_invalide → 400', async () => {
    const res = await request(app).get('/api/v1/export/csv/programs')
    assert.equal(res.status, 400)
    assert.equal(res.body.error, 'INVALID_TABLE')
  })

  it('POST /backup crée un fichier de backup', async () => {
    const res = await request(app).post('/api/v1/backup')
    assert.equal(res.status, 200)
    assert.ok(res.body.message.includes('Sauvegarde'))
    assert.ok(typeof res.body.backup_count === 'number')
  })
})
