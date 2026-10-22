import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import request from 'supertest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

// Isolated DB (otherwise shared file DB → race with other test files)
process.env.DB_PATH = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'wb-t61-')), 'test.db')

const { getDb } = await import('../../src/db/database.js')
const { migrate } = await import('../../src/db/migrate.js')
migrate(getDb())

const { app } = await import('../../server.js')

describe('T6.1 — Complete Settings API', () => {

  // ── GET /settings ──────────────────────────────────────────
  describe('GET /settings', () => {
    it('returns 200 with all expected keys', async () => {
      const res = await request(app).get('/api/v1/settings')
      assert.equal(res.status, 200)
      const REQUIRED_KEYS = [
        'unit', 'rm_formula', 'default_rest_seconds', 'theme', 'language', 'keep_screen_awake',
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
        assert.ok(key in res.body, `Missing key: ${key}`)
      }
    })

    it('NEVER returns ai_api_key', async () => {
      const res = await request(app).get('/api/v1/settings')
      assert.ok(!('ai_api_key' in res.body))
    })

    it('returns correct defaults', async () => {
      const res = await request(app).get('/api/v1/settings')
      assert.equal(res.body.unit,               'kg')
      assert.equal(res.body.rm_formula,         'epley')
      assert.equal(res.body.default_rest_seconds, 90)
      assert.equal(res.body.theme,              'dark')
      assert.equal(res.body.language,           'fr')
      assert.equal(res.body.keep_screen_awake, false)
    })
  })

  // ── PUT /settings ──────────────────────────────────────────
  describe('PUT /settings', () => {
    it('saves screen wake lock and rejects non-boolean values', async () => {
      const saved = await request(app).post('/api/v1/settings/save').send({settings:{keep_screen_awake:true}})
      assert.equal(saved.status, 200)
      assert.equal((await request(app).get('/api/v1/settings')).body.keep_screen_awake, true)
      const invalid = await request(app).put('/api/v1/settings').send({keep_screen_awake:'false'})
      assert.equal(invalid.status, 400)
      assert.equal((await request(app).get('/api/v1/settings')).body.keep_screen_awake, true)
      assert.equal((await request(app).put('/api/v1/settings').send({keep_screen_awake:false})).status, 200)
    })
    it('updates a valid string key', async () => {
      const res = await request(app).put('/api/v1/settings').send({ language: 'en' })
      assert.equal(res.status, 200)
      assert.equal(res.body.language, 'en')
      // Restore the default
      await request(app).put('/api/v1/settings').send({ language: 'fr' })
    })

    it('updates a boolean', async () => {
      const res = await request(app).put('/api/v1/settings').send({ show_rpe_field: true })
      assert.equal(res.status, 200)
      assert.equal(res.body.show_rpe_field, true)
      await request(app).put('/api/v1/settings').send({ show_rpe_field: false })
    })

    it('updates an in-range number', async () => {
      const res = await request(app).put('/api/v1/settings').send({ default_rest_seconds: 120 })
      assert.equal(res.status, 200)
      assert.equal(res.body.default_rest_seconds, 120)
      await request(app).put('/api/v1/settings').send({ default_rest_seconds: 90 })
    })

    it('rejects a value outside the enum → 400', async () => {
      const res = await request(app).put('/api/v1/settings').send({ unit: 'stones' })
      assert.equal(res.status, 400)
      assert.equal(res.body.error, 'VALIDATION_ERRORS')
      assert.ok(Array.isArray(res.body.details))
      assert.ok(res.body.details.length > 0)
    })

    it('rejects an out-of-range number → 400', async () => {
      const res = await request(app).put('/api/v1/settings').send({ default_rest_seconds: 5 })
      assert.equal(res.status, 400)
    })

    it('rejects an unknown key → 400', async () => {
      const res = await request(app).put('/api/v1/settings').send({ foobar_key: 'test' })
      assert.equal(res.status, 400)
    })

    it('updates ai_api_key → returns ai_api_key_set=true without exposing the key', async () => {
      const res = await request(app).put('/api/v1/settings').send({ ai_api_key: 'sk-test-xyz' })
      assert.equal(res.status, 200)
      assert.equal(res.body.ai_api_key_set, true)
      assert.ok(!('ai_api_key' in res.body))
    })

    it('clears ai_api_key with empty string → ai_api_key_set=false', async () => {
      const res = await request(app).put('/api/v1/settings').send({ ai_api_key: '' })
      assert.equal(res.status, 200)
      assert.equal(res.body.ai_api_key_set, false)
    })

    it('network change → restart_required=true', async () => {
      const res = await request(app).put('/api/v1/settings').send({ network_port: 3001 })
      assert.equal(res.status, 200)
      assert.equal(res.body.restart_required, true)
      await request(app).put('/api/v1/settings').send({ network_port: 3000 })
    })

    it('non-network change → no restart_required', async () => {
      const res = await request(app).put('/api/v1/settings').send({ theme: 'light' })
      assert.equal(res.status, 200)
      assert.ok(!res.body.restart_required)
      await request(app).put('/api/v1/settings').send({ theme: 'dark' })
    })

    it('multiple keys in one request → all updated', async () => {
      const res = await request(app).put('/api/v1/settings').send({
        timer_sound_enabled:     true,
        timer_vibration_enabled: false,
        warmup_sets_count:       1,
      })
      assert.equal(res.status, 200)
      assert.equal(res.body.timer_sound_enabled,     true)
      assert.equal(res.body.timer_vibration_enabled, false)
      assert.equal(res.body.warmup_sets_count,        1)
      // Restore defaults
      await request(app).put('/api/v1/settings').send({
        timer_sound_enabled: true, timer_vibration_enabled: true, warmup_sets_count: 0
      })
    })
  })

  // ── POST /settings/test-ai ─────────────────────────────────
  describe('POST /settings/test-ai', () => {
    it('without configured provider → 400', async () => {
      await request(app).put('/api/v1/settings').send({ ai_base_url: '', ai_model: '' })
      const res = await request(app).post('/api/v1/settings/test-ai')
      assert.equal(res.status, 400)
      assert.equal(res.body.success, false)
    })
  })

  // ── GET /settings/ai-models ────────────────────────────────
  describe('GET /settings/ai-models', () => {
    it('without base_url → 400', async () => {
      await request(app).put('/api/v1/settings').send({ ai_base_url: '' })
      const res = await request(app).get('/api/v1/settings/ai-models')
      assert.equal(res.status, 400)
    })
  })
})

describe('Coach draft settings and combined saving', () => {
  it('tests and lists models from draft credentials without persisting them, preserving a saved key when omitted', async () => {
    const { createServer } = await import('node:http')
    const calls=[]
    const provider=createServer(async(req,res)=>{
      let body='';for await(const chunk of req)body+=chunk
      calls.push({path:req.url,key:req.headers.authorization,body:body?JSON.parse(body):null})
      if(req.url==='/v1/models'){
        res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({data:[{id:'draft-model'}]}))
      }else{
        res.writeHead(200,{'Content-Type':'text/event-stream'})
        res.end('data: {"choices":[{"delta":{"content":"OK"}}]}\n\ndata: [DONE]\n\n')
      }
    })
    await new Promise(resolve=>provider.listen(0,'127.0.0.1',resolve))
    try {
      await request(app).put('/api/v1/settings').send({ai_base_url:'http://saved.invalid/v1',ai_model:'saved-model',ai_api_key:'saved-test-key'})
      const db=getDb()
      const snapshot=()=>db.prepare("SELECT * FROM settings WHERE key IN ('ai_base_url','ai_model','ai_api_key') ORDER BY key").all()
      const before=snapshot()
      const draft={ai_base_url:`http://127.0.0.1:${provider.address().port}/v1`,ai_model:'draft-model',ai_api_key:'draft-test-key'}
      const tested=await request(app).post('/api/v1/settings/test-ai').send(draft)
      assert.equal(tested.status,200)
      assert.equal(tested.body.model,'draft-model')
      assert.equal(calls[0].key,'Bearer draft-test-key')
      assert.equal(calls[0].body.model,'draft-model')
      const models=await request(app).post('/api/v1/settings/ai-models').send(draft)
      assert.equal(models.status,200)
      assert.equal(models.body.models[0].id,'draft-model')
      assert.deepEqual(snapshot(),before)
      const fallback=await request(app).post('/api/v1/settings/test-ai').send({ai_base_url:draft.ai_base_url,ai_model:draft.ai_model})
      assert.equal(fallback.status,200)
      assert.equal(calls.at(-1).key,'Bearer saved-test-key')
      assert.deepEqual(snapshot(),before)
      const stored=await request(app).put('/api/v1/settings').send(draft)
      assert.equal(stored.status,200)
      assert.equal(stored.body.ai_api_key_set,true)
      assert.equal(stored.body.ai_api_key,undefined)
      assert.equal(JSON.parse(db.prepare("SELECT value FROM settings WHERE key='ai_api_key'").get().value),'draft-test-key')
      await request(app).put('/api/v1/settings').send({ai_base_url:draft.ai_base_url,ai_model:'another-model'})
      assert.equal(JSON.parse(db.prepare("SELECT value FROM settings WHERE key='ai_api_key'").get().value),'draft-test-key')
    } finally {provider.closeAllConnections();await new Promise(resolve=>provider.close(resolve))}
  })
  it('rejects malformed drafts',async()=>{
    for(const endpoint of ['test-ai','ai-models']){
      for(const input of [{ai_model:5},{unexpected:'value'},[]]){
        const result=await request(app).post('/api/v1/settings/'+endpoint).send(input)
        assert.equal(result.status,400)
        assert.equal(result.body.error,'INVALID_AI_SETTINGS')
      }
    }
  })
})

describe('Atomic settings-page save',()=>{
 it('saves general, coach and personal identity together, redacts the key and preserves unrelated data',async()=>{
  const db=getDb()
  db.prepare("UPDATE user_profile SET injury_notes='Preserve',fitness_level='intermediate',date_of_birth='1991-03-05' WHERE id=1").run()
  const result=await request(app).post('/api/v1/settings/save').send({settings:{unit:'lb',rm_formula:'brzycki',ai_base_url:'http://example.test/v1',ai_model:'model',ai_api_key:'atomic-fake-key'},profile:{display_name:'Alex',sex:'female'}})
  assert.equal(result.status,200)
  assert.equal(result.body.settings.unit,'lb')
  assert.equal(result.body.settings.rm_formula,'brzycki')
  assert.equal(result.body.settings.ai_api_key,undefined)
  assert.equal(result.body.settings.ai_api_key_set,true)
  assert.deepEqual(result.body.profile,{display_name:'Alex',sex:'female',date_of_birth:'1991-03-05'})
  assert.equal(result.body.restart_required,false)
  const identity=db.prepare('SELECT * FROM user_profile WHERE id=1').get()
  assert.equal(identity.injury_notes,'Preserve')
  assert.equal(identity.fitness_level,'intermediate')
  await request(app).post('/api/v1/settings/save').send({settings:{ai_model:'other-model',network_port:3001}})
  assert.equal(JSON.parse(db.prepare("SELECT value FROM settings WHERE key='ai_api_key'").get().value),'atomic-fake-key')
  const network=await request(app).post('/api/v1/settings/save').send({settings:{network_host:'0.0.0.0'}})
  assert.equal(network.body.restart_required,true)
 })
 it('validates every group before any change and keeps all data after rejected saves',async()=>{
  const db=getDb()
  const snapshot=()=>({settings:db.prepare('SELECT * FROM settings ORDER BY key').all(),profile:db.prepare('SELECT * FROM user_profile WHERE id=1').get()})
  const before=snapshot()
  for(const body of [
   {settings:{unit:'kg'},profile:{date_of_birth:'1990-02-30'}},
   {settings:{network_port:0},profile:{display_name:'Unwanted'}},
   {settings:{unknown:1},profile:{display_name:'Unwanted'}},
   {settings:{unit:'kg'},profile:{fitness_level:'beginner'}},
   {settings:[]}, {profile:null}, {unexpected:1}, {}, [],
  ]){
   const result=await request(app).post('/api/v1/settings/save').send(body)
   assert.equal(result.status,400)
   assert.deepEqual(snapshot(),before)
  }
 })
})
