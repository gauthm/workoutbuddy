import { ALL_MUSCLES } from '../../public/js/utils/muscles.js'
import express from 'express'
import { getDb } from '../db/database.js'
import { validateField as validateProfileField } from './userProfile.js'
import { testConnection, listModels } from '../services/aiProvider.js'

const router = express.Router()
const db     = getDb()

// ── Schéma de validation ──────────────────────────────────────
const SETTINGS_SCHEMA = {
  painful_muscles: { type:'enum_array', enum:ALL_MUSCLES },
  unit:                               { type: 'enum',   enum: ['kg','lb'] },
  rm_formula:                         { type: 'enum',   enum: ['epley','brzycki','lander','oconner','lombardi'] },
  default_rest_seconds:               { type: 'number', min: 10,  max: 600 },
  theme:                              { type: 'enum',   enum: ['dark','light'] },
  language:                           { type: 'enum',   enum: ['fr','en'] },
  keep_screen_awake:                  { type: 'boolean' },
  network_host:                       { type: 'enum',   enum: ['127.0.0.1','0.0.0.0'] },
  network_port:                       { type: 'number', min: 1024, max: 65535 },
  ai_base_url:                        { type: 'string' },
  ai_model:                           { type: 'string' },
  ai_api_key:                         { type: 'string' },
  progression_failure_threshold:      { type: 'number', min: 1,  max: 5 },
  progression_weight_reduction_pct:   { type: 'number', min: 5,  max: 30 },
  plateau_detection_sessions:         { type: 'number', min: 3,  max: 8 },
  deload_auto_enabled:                { type: 'boolean' },
  deload_frequency_weeks:             { type: 'number', min: 2,  max: 16 },
  deload_load_reduction_pct:          { type: 'number', min: 10, max: 40 },
  deload_volume_reduction_pct:        { type: 'number', min: 20, max: 60 },
  deload_min_sets:                    { type: 'number', min: 1,  max: 4 },
  equipment_advice_cooldown_days:     { type: 'number', min: 1,  max: 90 },
  equipment_advice_max_load_sessions: { type: 'number', min: 1,  max: 5 },
  equipment_advice_min_increment_pct: { type: 'number', min: 1,  max: 20 },
  equipment_advice_plateau_sessions:  { type: 'number', min: 3,  max: 10 },
  linear_increment_kg:                { type: 'number', min: 0.5, max: 10 },
  linear_dumbbell_increment_kg:       { type: 'number', min: 0.5, max: 5 },
  bodyweight_display_days:            { type: 'number', min: 30, max: 730 },
  timer_sound_enabled:                { type: 'boolean' },
  timer_vibration_enabled:            { type: 'boolean' },
  show_rpe_field:                     { type: 'boolean' },
  show_rir_field:                     { type: 'boolean' },
  warmup_sets_count:                  { type: 'number', min: 0, max: 3 },
  auto_next_exercise:                 { type: 'boolean' },
}

const HIDDEN_KEYS = new Set(['ai_api_key'])
const NETWORK_KEYS = new Set(['network_host','network_port'])

function getAllSettings(db) {
  const rows = db.prepare('SELECT key, value FROM settings').all()
  const result = {}
  for (const row of rows) {
    if (HIDDEN_KEYS.has(row.key)) continue
    result[row.key] = JSON.parse(row.value)
  }
  const keyRow = db.prepare("SELECT value FROM settings WHERE key='ai_api_key'").get()
  result.ai_api_key_set = keyRow ? JSON.parse(keyRow.value) !== '' : false
  return result
}

export function validateValue(key, value) {
  const schema = SETTINGS_SCHEMA[key]
  if (!schema) return { valid: false, error: `Clé inconnue : ${key}` }
  if (schema.type === 'enum_array') {
    if (!Array.isArray(value) || new Set(value).size !== value.length || value.some(v=>!schema.enum.includes(v))) return {valid:false,error:`${key} : liste invalide.`}
  } else if (schema.type === 'boolean') {
    if (typeof value !== 'boolean') return { valid: false, error: `${key} doit être un booléen.` }
  } else if (schema.type === 'number') {
    const n = value
    if (typeof n !== 'number' || !Number.isFinite(n)) return { valid: false, error: `${key} doit être un nombre.` }
    if (schema.min !== undefined && n < schema.min) return { valid: false, error: `${key} ≥ ${schema.min}.` }
    if (schema.max !== undefined && n > schema.max) return { valid: false, error: `${key} ≤ ${schema.max}.` }
  } else if (schema.type === 'enum') {
    if (!schema.enum.includes(value)) return { valid: false, error: `${key} : valeurs valides = ${schema.enum.join(', ')}.` }
  } else if (schema.type === 'string') {
    if (typeof value !== 'string') return { valid: false, error: `${key} doit être une chaîne.` }
  }
  return { valid: true }
}

// ── GET /settings ──────────────────────────────────────────────
router.get('/', (req, res) => {
  try { res.json(getAllSettings(db)) }
  catch (err) { console.error('[GET /settings]', err.message); res.status(500).json({ error: 'INTERNAL_ERROR' }) }
})

// ── PUT /settings ──────────────────────────────────────────────
router.put('/', (req, res) => {
  try {
    const updates = req.body
    if (!updates || typeof updates !== 'object' || Array.isArray(updates)) return res.status(400).json({ error: 'INVALID_BODY' })
    const errors = []; const valid = []
    for (const [key, value] of Object.entries(updates)) {
      const r = validateValue(key, value)
      if (!r.valid) { errors.push(r.error); continue }
      valid.push({ key, value })
    }
    if (errors.length > 0) return res.status(400).json({ error: 'VALIDATION_ERRORS', details: errors })
    const stmt = db.prepare(
      "INSERT INTO settings (key,value,updated_at) VALUES (?,?,datetime('now')) " +
      "ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at"
    )
    db.transaction(() => { for (const {key,value} of valid) stmt.run(key, JSON.stringify(value)) })()
    const response = getAllSettings(db)
    if (valid.some(v => NETWORK_KEYS.has(v.key))) response.restart_required = true
    res.json(response)
  } catch (err) { console.error('[PUT /settings]', err.message); res.status(500).json({ error: 'INTERNAL_ERROR' }) }
})

// Save the page in one transaction, so a rejected profile never partially saves settings.
router.post('/save', (req,res) => {
  try {
    const body = req.body
    const isObject = value => value && typeof value === 'object' && !Array.isArray(value)
    if (!isObject(body) || Object.keys(body).some(key => !['settings','profile'].includes(key)) ||
        (body.settings !== undefined && !isObject(body.settings)) || (body.profile !== undefined && !isObject(body.profile))) {
      return res.status(400).json({ error:'INVALID_BODY' })
    }
    const settings = Object.entries(body.settings || {}), profile = Object.entries(body.profile || {})
    const errors = []
    for (const [key,value] of settings) { const check=validateValue(key,value); if (!check.valid) errors.push(check.error) }
    for (const [key,value] of profile) {
      if (!['display_name','sex','date_of_birth'].includes(key)) { errors.push('INVALID_PROFILE_FIELD'); continue }
      const check=validateProfileField(key,value); if (!check.valid) errors.push(check.error)
    }
    if (errors.length) return res.status(400).json({ error:'VALIDATION_ERRORS',details:errors })
    if (!settings.length && !profile.length) return res.status(400).json({ error:'NO_FIELDS_TO_UPDATE' })
    db.transaction(() => {
      const stmt=db.prepare("INSERT INTO settings (key,value,updated_at) VALUES (?,?,datetime('now')) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at")
      for (const [key,value] of settings) stmt.run(key,JSON.stringify(value))
      if (profile.length) {
        const current=db.prepare('SELECT display_name,sex,date_of_birth FROM user_profile WHERE id=1').get()
        const updated={...current,...Object.fromEntries(profile)}
        db.prepare("UPDATE user_profile SET display_name=?,sex=?,date_of_birth=?,updated_at=datetime('now') WHERE id=1").run(updated.display_name,updated.sex,updated.date_of_birth)
      }
    })()
    res.json({settings:getAllSettings(db),profile:db.prepare('SELECT display_name,sex,date_of_birth FROM user_profile WHERE id=1').get(),restart_required:settings.some(([key])=>NETWORK_KEYS.has(key))})
  } catch (err) { console.error('[POST /settings/save]',err.message);res.status(500).json({error:'INTERNAL_ERROR'}) }
})

// Preview connection settings without persisting draft credentials.
function getDraftAiSettings(body) {
  const saved = getAiSettings(db)
  if (body === undefined) return saved
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('INVALID_AI_SETTINGS')
  for (const [key,value] of Object.entries(body)) {
    if (!['ai_base_url','ai_model','ai_api_key'].includes(key) || typeof value !== 'string') throw new Error('INVALID_AI_SETTINGS')
    saved[key.replace('ai_','')] = value
  }
  return saved
}

// ── POST /settings/test-ai ─────────────────────────────────────
router.post('/test-ai', async (req, res) => {
  try {
    const s = getDraftAiSettings(req.body)
    if (!s.base_url || !s.model) return res.status(400).json({ success: false, error: 'Provider IA non configuré.' })
    const result = await testConnection(s)
    res.json(result)
  } catch (err) { res.status(400).json({ success: false, error: err.message }) }
})

// ── GET /settings/ai-models ────────────────────────────────────
router.get('/ai-models', async (req, res) => {
  try {
    const s = getAiSettings(db)
    if (!s.base_url) return res.status(400).json({ error: 'URL de base non configurée.' })
    const result = await listModels(s)
    res.json(result)
  } catch (err) { res.status(400).json({ error: err.message }) }
})

router.post('/ai-models', async (req,res) => {
  try {
    const s = getDraftAiSettings(req.body)
    if (!s.base_url) return res.status(400).json({ error: 'URL de base non configurée.' })
    res.json(await listModels(s))
  } catch (err) { res.status(400).json({ error: err.message }) }
})

// ── Export helper ──────────────────────────────────────────────
export function getAiSettings(db) {
  const keys = ['ai_base_url','ai_model','ai_api_key']
  const result = {}
  for (const key of keys) {
    const row = db.prepare('SELECT value FROM settings WHERE key=?').get(key)
    result[key.replace('ai_','')] = row ? JSON.parse(row.value) : ''
  }
  return result  // { base_url, model, api_key }
}

export default router
