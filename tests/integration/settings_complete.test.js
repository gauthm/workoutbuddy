import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import request from 'supertest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

// DB isolée (DB fichier partagée sinon → course avec les autres fichiers de tests)
process.env.DB_PATH = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'wb-t61-')), 'test.db')

const { getDb } = await import('../../src/db/database.js')
const { migrate } = await import('../../src/db/migrate.js')
migrate(getDb())

const { app } = await import('../../server.js')

describe('T6.1 — Settings API complète', () => {

  // ── GET /settings ──────────────────────────────────────────
  describe('GET /settings', () => {
    it('retourne 200 avec toutes les clés attendues', async () => {
      const res = await request(app).get('/api/v1/settings')
      assert.equal(res.status, 200)
      const REQUIRED_KEYS = [
        'unit', 'rm_formula', 'default_rest_seconds', 'theme', 'language',
        'network_host', 'network_port',
        'ai_base_url', 'ai_model', 'ai_api_key_set',
        'progression_failure_threshold', 'progression_weight_reduction_pct',
        'plateau_detection_sessions',
        'deload_auto_enabled', 'deload_frequency_weeks',
        'deload_load_reduction_pct', 'deload_volume_reduction_pct', 'deload_min_sets',
        'equipment_advice_cooldown_days', 'equipment_advice_max_load_sessions',
        'equipment_advice_min_increment_pct', 'equipment_advice_plateau_sessions',
        'linear_increment_kg', 'linear_dumbbell_increment_kg',
        'bodyweight_display_days', 'timer_sound_enabled', 'timer_vibration_enabled',
        'show_rpe_field', 'show_rir_field', 'warmup_sets_count', 'auto_next_exercise',
      ]
      for (const key of REQUIRED_KEYS) {
        assert.ok(key in res.body, `Clé manquante : ${key}`)
      }
    })

    it('ne retourne JAMAIS ai_api_key', async () => {
      const res = await request(app).get('/api/v1/settings')
      assert.ok(!('ai_api_key' in res.body))
    })

    it('retourne les valeurs par défaut correctes', async () => {
      const res = await request(app).get('/api/v1/settings')
      assert.equal(res.body.unit,               'kg')
      assert.equal(res.body.rm_formula,         'epley')
      assert.equal(res.body.default_rest_seconds, 90)
      assert.equal(res.body.theme,              'dark')
      assert.equal(res.body.language,           'fr')
    })
  })

  // ── PUT /settings ──────────────────────────────────────────
  describe('PUT /settings', () => {
    it('met à jour une clé string valide', async () => {
      const res = await request(app).put('/api/v1/settings').send({ language: 'en' })
      assert.equal(res.status, 200)
      assert.equal(res.body.language, 'en')
      // Remettre la valeur par défaut
      await request(app).put('/api/v1/settings').send({ language: 'fr' })
    })

    it('met à jour un boolean', async () => {
      const res = await request(app).put('/api/v1/settings').send({ show_rpe_field: true })
      assert.equal(res.status, 200)
      assert.equal(res.body.show_rpe_field, true)
      await request(app).put('/api/v1/settings').send({ show_rpe_field: false })
    })

    it('met à jour un nombre dans la plage', async () => {
      const res = await request(app).put('/api/v1/settings').send({ default_rest_seconds: 120 })
      assert.equal(res.status, 200)
      assert.equal(res.body.default_rest_seconds, 120)
      await request(app).put('/api/v1/settings').send({ default_rest_seconds: 90 })
    })

    it('rejette une valeur hors enum → 400', async () => {
      const res = await request(app).put('/api/v1/settings').send({ unit: 'stones' })
      assert.equal(res.status, 400)
      assert.equal(res.body.error, 'VALIDATION_ERRORS')
      assert.ok(Array.isArray(res.body.details))
      assert.ok(res.body.details.length > 0)
    })

    it('rejette un nombre hors plage → 400', async () => {
      const res = await request(app).put('/api/v1/settings').send({ default_rest_seconds: 5 })
      assert.equal(res.status, 400)
    })

    it('rejette une clé inconnue → 400', async () => {
      const res = await request(app).put('/api/v1/settings').send({ foobar_key: 'test' })
      assert.equal(res.status, 400)
    })

    it('met à jour ai_api_key → retourne ai_api_key_set=true sans exposer la clé', async () => {
      const res = await request(app).put('/api/v1/settings').send({ ai_api_key: 'sk-test-xyz' })
      assert.equal(res.status, 200)
      assert.equal(res.body.ai_api_key_set, true)
      assert.ok(!('ai_api_key' in res.body))
    })

    it('efface ai_api_key avec chaîne vide → ai_api_key_set=false', async () => {
      const res = await request(app).put('/api/v1/settings').send({ ai_api_key: '' })
      assert.equal(res.status, 200)
      assert.equal(res.body.ai_api_key_set, false)
    })

    it('changement réseau → restart_required=true', async () => {
      const res = await request(app).put('/api/v1/settings').send({ network_port: 3001 })
      assert.equal(res.status, 200)
      assert.equal(res.body.restart_required, true)
      await request(app).put('/api/v1/settings').send({ network_port: 3000 })
    })

    it('changement non-réseau → pas de restart_required', async () => {
      const res = await request(app).put('/api/v1/settings').send({ theme: 'light' })
      assert.equal(res.status, 200)
      assert.ok(!res.body.restart_required)
      await request(app).put('/api/v1/settings').send({ theme: 'dark' })
    })

    it('plusieurs clés en une requête → toutes mises à jour', async () => {
      const res = await request(app).put('/api/v1/settings').send({
        timer_sound_enabled:     true,
        timer_vibration_enabled: false,
        warmup_sets_count:       1,
      })
      assert.equal(res.status, 200)
      assert.equal(res.body.timer_sound_enabled,     true)
      assert.equal(res.body.timer_vibration_enabled, false)
      assert.equal(res.body.warmup_sets_count,        1)
      // Remettre les valeurs par défaut
      await request(app).put('/api/v1/settings').send({
        timer_sound_enabled: true, timer_vibration_enabled: true, warmup_sets_count: 0
      })
    })
  })

  // ── POST /settings/test-ai ─────────────────────────────────
  describe('POST /settings/test-ai', () => {
    it('sans provider configuré → 400', async () => {
      await request(app).put('/api/v1/settings').send({ ai_base_url: '', ai_model: '' })
      const res = await request(app).post('/api/v1/settings/test-ai')
      assert.equal(res.status, 400)
      assert.equal(res.body.success, false)
    })
  })

  // ── GET /settings/ai-models ────────────────────────────────
  describe('GET /settings/ai-models', () => {
    it('sans base_url → 400', async () => {
      await request(app).put('/api/v1/settings').send({ ai_base_url: '' })
      const res = await request(app).get('/api/v1/settings/ai-models')
      assert.equal(res.status, 400)
    })
  })
})
