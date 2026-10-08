import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import request from 'supertest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

// DB isolée (DB fichier partagée sinon → course avec les autres fichiers de tests)
process.env.DB_PATH = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'wb-t74-')), 'test.db')

const { migrate } = await import('../../src/db/migrate.js')
const { getDb }   = await import('../../src/db/database.js')
const { seedExercises } = await import('../../src/seed/seed.js')
migrate(getDb())
seedExercises(getDb())

const { app } = await import('../../server.js')

describe('T7.4 — Historique, suppression, reset stats', () => {

  // ── GET /sessions ──────────────────────────────────────────
  it('GET /sessions retourne la liste triée par date DESC', async () => {
    await request(app).post('/api/v1/sessions')
      .send({ name: 'A', scheduled_date: '2025-07-01' })
    await request(app).post('/api/v1/sessions')
      .send({ name: 'B', scheduled_date: '2025-07-10' })

    const res = await request(app).get('/api/v1/sessions?limit=200')
    assert.equal(res.status, 200)
    assert.ok(Array.isArray(res.body.sessions))
    if (res.body.sessions.length >= 2) {
      const dates = res.body.sessions.map(s => s.scheduled_date)
      for (let i = 1; i < dates.length; i++) {
        assert.ok(dates[i] <= dates[i - 1],
          `Ordre DESC attendu : ${dates[i-1]} ≥ ${dates[i]}`)
      }
    }
  })

  // ── DELETE /sessions/:id ───────────────────────────────────
  it('DELETE /sessions/:id (planned) → 204', async () => {
    const s = await request(app).post('/api/v1/sessions')
      .send({ name: 'À supprimer', scheduled_date: '2025-08-01' })
    const res = await request(app).delete(`/api/v1/sessions/${s.body.id}`)
    assert.equal(res.status, 204)
  })

  it('DELETE /sessions/:id (completed) → 204', async () => {
    const s = await request(app).post('/api/v1/sessions')
      .send({ name: 'Complétée', scheduled_date: '2025-07-05' })
    await request(app).post(`/api/v1/sessions/${s.body.id}/start`)
    await request(app).post(`/api/v1/sessions/${s.body.id}/complete`)
    const res = await request(app).delete(`/api/v1/sessions/${s.body.id}`)
    assert.equal(res.status, 204)
  })

  it('DELETE /sessions/:id (in_progress) → 409', async () => {
    const s = await request(app).post('/api/v1/sessions')
      .send({ name: 'En cours', scheduled_date: new Date().toISOString().slice(0, 10) })
    await request(app).post(`/api/v1/sessions/${s.body.id}/start`)
    const res = await request(app).delete(`/api/v1/sessions/${s.body.id}`)
    assert.equal(res.status, 409)
    assert.equal(res.body.error, 'CANNOT_DELETE_IN_PROGRESS_SESSION')
    await request(app).post(`/api/v1/sessions/${s.body.id}/complete`)
  })

  it('DELETE /sessions/9999 → 404', async () => {
    const res = await request(app).delete('/api/v1/sessions/9999')
    assert.equal(res.status, 404)
  })

  // ── POST /reset-stats ──────────────────────────────────────
  it('POST /reset-stats efface séances et body_weight', async () => {
    await request(app).post('/api/v1/sessions')
      .send({ name: 'Test reset', scheduled_date: '2025-06-01' })
    await request(app).post('/api/v1/bodyweight')
      .send({ date: '2025-06-01', weight_kg: 75 })

    const res = await request(app).post('/api/v1/reset-stats')
    assert.equal(res.status, 200)
    assert.ok(res.body.cleared.includes('sessions'))

    const sessionsRes = await request(app).get('/api/v1/sessions')
    assert.equal(sessionsRes.body.sessions.length, 0)

    const bwRes = await request(app).get('/api/v1/bodyweight')
    assert.equal(bwRes.body.entries.length, 0)
  })

  it('POST /reset-stats fonctionne quand un personal_record référence un set_log', async () => {
    const db = getDb()
    const ex = db.prepare('SELECT id FROM exercise LIMIT 1').get()
    const s = db.prepare(
      "INSERT INTO session (name, scheduled_date, status) VALUES ('Avec PR', '2025-06-05', 'completed')"
    ).run()
    const se = db.prepare(
      'INSERT INTO session_exercise (session_id, exercise_id) VALUES (?, ?)'
    ).run(s.lastInsertRowid, ex.id)
    const sl = db.prepare(
      'INSERT INTO set_log (session_exercise_id, set_number, weight_kg, reps, is_completed) VALUES (?, 1, 100, 5, 1)'
    ).run(se.lastInsertRowid)
    db.prepare(
      'INSERT INTO personal_record (exercise_id, reps, weight_kg, estimated_1rm_kg, achieved_date, set_log_id) VALUES (?, 5, 100, 116.5, ?, ?)'
    ).run(ex.id, '2025-06-05', sl.lastInsertRowid)

    const res = await request(app).post('/api/v1/reset-stats')
    assert.equal(res.status, 200)

    assert.equal(db.prepare('SELECT COUNT(*) c FROM personal_record').get().c, 0)
    assert.equal(db.prepare('SELECT COUNT(*) c FROM set_log').get().c, 0)
    assert.equal(db.prepare('SELECT COUNT(*) c FROM session').get().c, 0)
  })

  it('POST /reset-stats conserve les programmes et exercices', async () => {
    const db = getDb()
    db.prepare(
      "INSERT INTO program (name, goal, level, days_per_week) VALUES ('PPL', 'strength', 'beginner', 3)"
    ).run()
    await request(app).post('/api/v1/reset-stats')

    const progRes = await request(app).get('/api/v1/programs')
    assert.ok(progRes.body.programs.length >= 1)

    const exRes = await request(app).get('/api/v1/exercises')
    assert.ok(exRes.body.exercises.length > 0)
  })

  it('POST /reset-stats remet progression_state à 0', async () => {
    const db = getDb()

    // S'assurer qu'au moins un état de progression existe
    let row = db.prepare('SELECT id FROM progression_state LIMIT 1').get()
    if (!row) {
      const prog = db.prepare(
        "INSERT INTO program (name, goal, level, days_per_week) VALUES ('P', 'strength', 'beginner', 3)"
      ).run()
      const tpl = db.prepare(
        "INSERT INTO workout_template (program_id, name, order_index) VALUES (?, 'T', 0)"
      ).run(prog.lastInsertRowid)
      const ex = db.prepare('SELECT id FROM exercise LIMIT 1').get()
      const te = db.prepare(
        'INSERT INTO template_exercise (workout_template_id, exercise_id, order_index, target_sets, target_reps_min, target_reps_max) VALUES (?,?,0,3,8,12)'
      ).run(tpl.lastInsertRowid, ex.id)
      db.prepare(
        'INSERT INTO progression_state (template_exercise_id, current_weight_kg) VALUES (?, 20)'
      ).run(te.lastInsertRowid)
      row = db.prepare('SELECT id FROM progression_state LIMIT 1').get()
    }
    db.prepare('UPDATE progression_state SET current_weight_kg = 100').run()

    await request(app).post('/api/v1/reset-stats')

    const states = db.prepare(
      'SELECT current_weight_kg FROM progression_state WHERE current_weight_kg > 0'
    ).all()
    assert.equal(states.length, 0, 'Tous les progression_state doivent être à 0')
  })
})
