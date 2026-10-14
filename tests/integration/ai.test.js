import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import request from 'supertest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

// DB isolée (la DB fichier partagée serait écrasée : settings IA, profil, programmes)
process.env.DB_PATH = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'wb-t53-')), 'test.db')

const { migrate }       = await import('../../src/db/migrate.js')
const { getDb }         = await import('../../src/db/database.js')
const { seedExercises } = await import('../../src/seed/seed.js')
migrate(getDb())
seedExercises(getDb())

const { app } = await import('../../server.js')

describe('T5.3 — API Chat Expert', () => {
  it('POST /ai/chat sans message → 400', async () => {
    const res = await request(app).post('/api/v1/ai/chat').send({})
    assert.equal(res.status, 400)
  })

  it('POST /ai/chat provider non configuré → 503', async () => {
    await request(app).put('/api/v1/settings').send({ ai_base_url: '', ai_model: '' })
    const res = await request(app).post('/api/v1/ai/chat').send({ message: 'Bonjour' })
    assert.equal(res.status, 503)
  })

  for (const action of ['complete_user_profile','create_program','update_program','activate_program',
    'create_session','schedule_sessions','add_equipment','swap_exercise','update_progression_state',
    'update_settings','trigger_deload','exclude_exercises']) {
    it(`le conseiller ne peut pas exécuter ${action}`, async () => {
      const db = getDb()
      const snapshot = () => ['program','user_profile','equipment_item','settings','exercise','progression_state','session']
        .map(table => db.prepare(`SELECT * FROM ${table}`).all())
      const before = snapshot()
      const res = await request(app).post('/api/v1/ai/apply-action').send({ action:{ action,
        explanation:'Ancienne conversation',data:{ name:'Test', goal:'strength',level:'beginner',days_per_week:3,age:35,category:'bench',theme:'light' } } })
      assert.equal(res.status,403)
      assert.equal(res.body.error,'COACH_READ_ONLY')
      assert.deepEqual(snapshot(),before)
    })
  }
  it('les anciens lots sont refusés sans aucune écriture', async () => {
    const db = getDb(), before = db.prepare('SELECT * FROM user_profile').get()
    const res = await request(app).post('/api/v1/ai/apply-actions').send({actions:[
      {action:'complete_user_profile',explanation:'Ancien onboarding',data:{age:40}},
      {action:'update_settings',explanation:'Ancien réglage',data:{theme:'light'}}
    ]})
    assert.equal(res.status,403)
    assert.equal(res.body.error,'COACH_READ_ONLY')
    assert.deepEqual(db.prepare('SELECT * FROM user_profile').get(),before)
  })
})
