import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import request from 'supertest'
import fs from 'fs'
import path from 'path'
import os from 'os'

// DB isolée (règle AGENT.md §8.3 : ne jamais toucher data/workoutbuddy.db)
process.env.DB_PATH = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'wb-t22-')), 'test.db')

const { migrate }       = await import('../../src/db/migrate.js')
const { getDb, getDbPath } = await import('../../src/db/database.js')
const { seedExercises } = await import('../../src/seed/seed.js')
migrate(getDb())
seedExercises(getDb())

const { app } = await import('../../server.js')

describe('T2.2 — Séance complète bout en bout', () => {
  let programId, templateId, sessionId, seId, setId

  before(() => {
    // Nettoyage des traces d'exécutions précédentes (DB fichier partagée)
    const db = getDb()
    db.prepare(`
      DELETE FROM personal_record
      WHERE set_log_id IN (
        SELECT sl.id FROM set_log sl
        JOIN session_exercise se ON sl.session_exercise_id = se.id
        JOIN session s ON se.session_id = s.id
        WHERE s.name = 'Push Test'
      )
    `).run()
    db.prepare("DELETE FROM session WHERE name = 'Push Test'").run()
    db.prepare("DELETE FROM session WHERE status = 'in_progress'").run()
  })

  it('1. Crée un programme et un template', async () => {
    const db = getDb()
    const pRes = db.prepare(
      "INSERT INTO program (name, goal, level, days_per_week, progression_model) VALUES ('Test', 'strength', 'beginner', 3, 'linear')"
    ).run()
    programId = pRes.lastInsertRowid

    const tRes = await request(app)
      .post(`/api/v1/programs/${programId}/templates`)
      .send({ name: 'Push Test' })
    templateId = tRes.body.id

    await request(app).post(`/api/v1/templates/${templateId}/exercises`).send({
      exercise_id: 'barbell_bench_press_medium_grip', target_sets: 3,
      target_reps_min: 5, target_reps_max: 5
    })
  })

  it('2. Crée une séance depuis le template', async () => {
    const res = await request(app)
      .post(`/api/v1/sessions/from-template/${templateId}`)
      .send({ scheduled_date: '2025-07-10' })
    assert.equal(res.status, 201)
    assert.equal(res.body.workout_template_id, templateId)
    sessionId = res.body.id
    seId = res.body.exercises[0].id
  })

  it('3. Démarre la séance', async () => {
    const res = await request(app).post(`/api/v1/sessions/${sessionId}/start`)
    assert.equal(res.status, 200)
    assert.equal(res.body.status, 'in_progress')
  })

  it('4. Ajoute 3 séries validées', async () => {
    for (let i = 1; i <= 3; i++) {
      const res = await request(app)
        .post(`/api/v1/session-exercises/${seId}/sets`)
        .send({ set_number: i, weight_kg: 60, reps: 5, is_completed: true })
      assert.equal(res.status, 201)
    }
  })

  it('5. Complète la séance', async () => {
    const res = await request(app).post(`/api/v1/sessions/${sessionId}/complete`)
    assert.equal(res.status, 200)
    assert.equal(res.body.status, 'completed')
    // volume = 60 * 5 * 3 = 900 kg
    assert.equal(res.body.total_volume_kg, 900)
    // Backup auto-créé à la complétion
    const today = new Date().toISOString().slice(0, 10)
    assert.ok(
      fs.existsSync(path.join(path.dirname(getDbPath()), 'backups', `workoutbuddy_${today}.db`)),
      'le backup du jour doit exister'
    )
  })

  it("6. La séance est dans l'historique", async () => {
    const res = await request(app)
      .get(`/api/v1/exercises/barbell_bench_press_medium_grip/history?limit=1`)
    assert.equal(res.status, 200)
    assert.equal(res.body.history.length, 1)
    assert.equal(res.body.history[0].sets.length, 3)
  })

  it('7. Un PR a été enregistré', async () => {
    // Endpoint /stats/personal-records sera implémenté en T4.1 — vérification directe en DB
    const db = getDb()
    const pr = db.prepare(
      "SELECT * FROM personal_record WHERE exercise_id = 'barbell_bench_press_medium_grip' ORDER BY id DESC LIMIT 1"
    ).get()
    assert.ok(pr, 'un personal_record doit exister')
    assert.equal(pr.reps, 5)
    assert.equal(pr.weight_kg, 60)
    // Epley : 60 * (1 + 5/30) = 70
    assert.equal(pr.estimated_1rm_kg, 70)
  })
})
