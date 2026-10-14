import { beforeEach, test } from 'node:test'
import assert from 'node:assert/strict'
import request from '../helpers/in-process-request.js'

// Set isolation before importing any application module; never use the running app.
process.env.DB_PATH = ':memory:'
const { getDb, getDbPath } = await import('../../src/db/database.js')
assert.equal(getDbPath(), ':memory:')
const db = getDb()
const { migrate } = await import('../../src/db/migrate.js')
const { seedExercises } = await import('../../src/seed/seed.js')
migrate(db)
seedExercises(db)
const { app } = await import('../../server.js')
const { localIsoDate } = await import('../../src/services/date.js')
const api = request(app)
const prefix = '/api/v1'
const questionnaire = {
  goal: 'hypertrophy', level: 'beginner', days_per_week: 2,
  training_days: [0, 3], session_duration_min: 60, duration_weeks: 8,
  priority_muscles: [], weight_kg: 75, height_cm: 175, language: 'fr',
}

async function call(method, path, body, status = 200) {
  const req = api[method](prefix + path)
  const res = await (body === undefined ? req : req.send(body))
  assert.equal(res.status, status, `${method.toUpperCase()} ${path}: ${res.text}`)
  return res.body
}
const get = path => call('get', path)
const post = (path, body, status = 200) => call('post', path, body, status)
const put = (path, body, status = 200) => call('put', path, body, status)
const remove = path => call('delete', path, undefined, 204)
const exported = async () => (await get('/export')).data

beforeEach(async () => {
  await post('/reset-all')
  await put('/settings', {
    unit: 'kg', rm_formula: 'epley', painful_muscles: [],
    ai_api_key: '', ai_base_url: '', ai_model: '',
  })
  for (const item of [
    { category: 'dumbbell_adjustable', name: 'Pair', count: 2, weight_min_kg: 2, weight_max_kg: 40, weight_step_kg: 1 },
    { category: 'bench', name: 'Bench', count: 1 },
    { category: 'pullup_bar', name: 'Pull-up bar', count: 1 },
  ]) await post('/equipment', item, 201)
})

async function createProgram(overrides = {}) {
  const result = await post('/programs/generate', { ...questionnaire, ...overrides }, 201)
  return get(`/programs/${result.id}`)
}
async function activate(program) { await post(`/programs/${program.id}/activate`) }
async function startTemplate(template) {
  const session = await post(`/sessions/from-template/${template.id}`, { scheduled_date: localIsoDate() }, 201)
  await post(`/sessions/${session.id}/start`)
  return get(`/sessions/${session.id}`)
}
async function train(program) {
  // Use a real generated dumbbell movement, with enough inventory for progression.
  const catalog = (await get('/exercises')).exercises
  let chosen
  for (const template of program.templates) {
    const slot = template.exercises.find(slot => catalog.find(ex => ex.id === slot.exercise_id)
      ?.equipment_required.some(category => category.startsWith('dumbbell')))
    if (slot) { chosen = { template, slot }; break }
  }
  assert.ok(chosen, 'The home-gym program must contain a dumbbell movement')
  const session = await startTemplate(chosen.template)
  const targets = await get(`/sessions/${session.id}/target/${chosen.slot.id}`)
  const se = session.exercises.find(ex => ex.exercise_id === chosen.slot.exercise_id)
  assert.ok(se)
  const logs = []
  for (let n = 1; n <= chosen.slot.target_sets; n++) {
    logs.push(await post(`/session-exercises/${se.id}/sets`, {
      set_number: n, weight_kg: 10, reps: chosen.slot.target_reps_max, is_completed: true,
    }, 201))
  }
  await post(`/sessions/${session.id}/complete`)
  return { ...chosen, session: await get(`/sessions/${session.id}`), se, logs, targets }
}

// These tests go through Express and its JSON parser, validation, database and real
// algorithm. No mocked API responses or direct SQL writes set up the scenarios.
test('programme : questionnaire → activation → jours modifiés → calendrier à jour', async () => {
  const before = await exported()
  const preview = await post('/programs/preview', questionnaire)
  assert.deepEqual(await exported(), before, 'Preview must never persist a program')
  const program = await createProgram()
  assert.equal(program.templates.length, 2)
  assert.deepEqual(program.templates.map(t => t.exercises.map(e => e.exercise_id)),
    preview.templates.map(t => t.exercises.map(e => e.exercise_id)))
  await activate(program)
  const next = await get(`/programs/${program.id}/next-session`)
  await post(`/sessions/${next.session_id}/skip`)
  const updated = await put(`/programs/${program.id}`, { duration_weeks: null, training_days: [1, 5] })
  assert.equal(updated.duration_weeks, null)
  const calendar = (await get('/sessions?active_program=1&limit=200')).sessions
  assert.ok(calendar.some(s => s.id === next.session_id && s.status === 'skipped'))
  const planned = calendar.filter(s => s.status === 'planned')
  assert.ok(planned.length)
  for (const session of planned) {
    const weekday = (new Date(session.scheduled_date + 'T12:00:00Z').getUTCDay() + 6) % 7
    assert.ok([1, 5].includes(weekday))
    assert.equal(session.program_id, program.id)
  }
  const saved = await get(`/programs/${program.id}`)
  assert.deepEqual(saved.templates.map(t => t.exercises), program.templates.map(t => t.exercises))
  const snapshot = await exported()
  await put(`/programs/${program.id}`, { training_days: [1] }, 400)
  await put(`/programs/${program.id}`, { level: 'advanced' }, 403)
  assert.deepEqual(await exported(), snapshot, 'Rejected edits must leave all data unchanged')
})

test('séance : démarrer → annuler une série → compléter → progression suivante et statistiques', async () => {
  const program = await createProgram()
  await activate(program)
  const run = await train(program)
  assert.equal(run.session.status, 'completed')
  assert.equal(run.session.total_volume_kg, run.slot.target_sets * 10 * run.slot.target_reps_max)
  assert.equal((await get('/stats/overview')).total_sessions, 1)
  assert.ok((await get(`/stats/exercises/${run.slot.exercise_id}/progress`)).data.length)
  assert.ok((await get(`/stats/personal-records?exercise_id=${run.slot.exercise_id}`)).records.length)
  const second = await startTemplate(run.template)
  const target = await get(`/sessions/${second.id}/target/${run.slot.id}`)
  assert.ok(target.weight_kg > 10, 'Successful top-range work must increase the next load')
  const se = second.exercises.find(ex => ex.exercise_id === run.slot.exercise_id)
  const log = await post(`/session-exercises/${se.id}/sets`, {
    set_number: 1, weight_kg: target.weight_kg, reps: run.slot.target_reps_max, is_completed: true,
  }, 201)
  await put(`/sets/${log.id}`, { is_completed: false })
  const detail = await get(`/sessions/${second.id}`)
  assert.equal(detail.exercises.find(ex => ex.id === se.id).sets.find(s => s.id === log.id).is_completed, 0)
  await put(`/sets/${log.id}`, { is_completed: true })
  await post(`/session-exercises/${se.id}/sets`, {
    set_number: 2, weight_kg: 100, reps: 100, is_completed: false,
  }, 201)
  await post(`/session-exercises/${se.id}/sets`, {
    set_number: 3, weight_kg: 100, reps: 100, is_completed: true, is_warmup: true,
  }, 201)
  await post(`/sessions/${second.id}/complete`)
  assert.equal((await get(`/sessions/${second.id}`)).total_volume_kg, target.weight_kg * run.slot.target_reps_max,
    'Uncompleted and warm-up sets must not inflate work volume')
  assert.ok((await get(`/stats/personal-records?exercise_id=${run.slot.exercise_id}`)).records.every(r => r.weight_kg < 100))
  const snapshot = await exported()
  await post(`/sessions/${second.id}/complete`, undefined, 409)
  assert.deepEqual(await exported(), snapshot, 'Double completion must not advance progression twice')
})

test('historique : supprimer le programme → recréer → reprendre les acquis → supprimer la performance', async () => {
  const old = await createProgram()
  await activate(old)
  const run = await train(old)
  const learned = (await exported()).exercise_progressions.find(p => p.exercise_id === run.slot.exercise_id)
  await remove(`/programs/${old.id}`)
  assert.equal((await get(`/sessions/${run.session.id}`)).status, 'completed')
  assert.equal((await get('/sessions?active_program=1')).sessions.length, 0)
  const program = await createProgram({ priority_muscles: ['chest'] })
  await activate(program)
  const slot = program.templates.flatMap(t => t.exercises).find(e => e.exercise_id === run.slot.exercise_id)
  assert.ok(slot, 'The new focus must retain the trained movement in this fixture')
  const state = (await exported()).progression_states.find(s => s.template_exercise_id === slot.id)
  assert.equal(state.last_session_id, run.session.id)
  assert.equal(state.current_weight_kg, learned.current_weight_kg)
  assert.equal(state.current_target_reps, learned.current_target_reps)
  assert.ok((await get('/sessions?active_program=1')).sessions.every(s => s.program_id === program.id))
  await remove(`/sessions/${run.session.id}`)
  await call('get', `/sessions/${run.session.id}`, undefined, 404)
  const data = await exported()
  assert.equal(data.exercise_progressions.some(p => p.exercise_id === run.slot.exercise_id), false)
  assert.equal(data.progression_states.find(s => s.template_exercise_id === slot.id).last_session_id, null)
  assert.equal((await get('/stats/overview')).total_sessions, 0)
  assert.equal((await get(`/stats/personal-records?exercise_id=${run.slot.exercise_id}`)).records.length, 0)
})

test('données : exporter → réinitialiser → importer → retrouver les mêmes données et poursuivre', async () => {
  const program = await createProgram()
  await activate(program)
  const run = await train(program)
  await post('/bodyweight', { date: localIsoDate(), weight_kg: 75 }, 201)
  await post('/settings/save', { settings: { rm_formula: 'brzycki', painful_muscles: ['neck'] }, profile: { display_name: 'Test', sex: 'male', date_of_birth: '1990-02-15' } })
  const backup = await get('/export')
  const before = backup.data
  for (const key of ['sessions', 'set_logs', 'body_weights', 'personal_records', 'exercise_progressions', 'exercise_progression_events']) assert.ok(before[key].length, key)
  assert.equal(Object.hasOwn(before.settings, 'ai_api_key'), false)
  await post('/reset-all')
  assert.equal((await get('/stats/overview')).total_sessions, 0)
  await post('/import', backup)
  assert.deepEqual(await exported(), before, 'Full JSON round trip must preserve the entire payload')
  const next = await startTemplate(run.template)
  const target = await get(`/sessions/${next.id}/target/${run.slot.id}`)
  assert.ok(target.weight_kg > 10)
  assert.equal((await get('/stats/overview')).total_sessions, 1)
})

test('réglages : erreur atomique → correction → sauvegarde groupée → conservation de la clé', async () => {
  const before = await exported()
  const draft = { settings: { unit: 'lb', rm_formula: 'brzycki', ai_model: 'test-model', ai_base_url: 'http://unused.invalid/v1', ai_api_key: 'test-secret' }, profile: { display_name: 'Alex', date_of_birth: 'invalid' } }
  await post('/settings/save', draft, 400)
  assert.deepEqual(await exported(), before, 'Invalid profile must not partially save settings or credentials')
  draft.profile.date_of_birth = '1990-02-15'
  const saved = await post('/settings/save', draft)
  assert.equal(saved.profile.display_name, 'Alex')
  assert.equal(saved.settings.unit, 'lb')
  assert.equal(saved.settings.rm_formula, 'brzycki')
  assert.equal(saved.settings.ai_api_key_set, true)
  assert.equal(JSON.stringify(saved).includes('test-secret'), false)
  await post('/settings/save', { settings: { ai_model: 'changed-model' } })
  const reloaded = await get('/settings')
  assert.equal(reloaded.ai_model, 'changed-model')
  assert.equal(reloaded.ai_api_key_set, true)
  assert.equal(JSON.stringify(await get('/export')).includes('test-secret'), false)
})

test('exercices : remplacement avant séance → historique préservé → remplacement bloqué pendant séance', async () => {
  const program = await createProgram()
  await activate(program)
  const run = await train(program)
  const { alternatives } = await get(`/template-exercises/${run.slot.id}/alternatives`)
  assert.ok(alternatives.length, 'The inventory must offer a similar alternative')
  const replacement = alternatives[0]
  await post(`/template-exercises/${run.slot.id}/replace`, {
    exercise_id: replacement.id, expected_exercise_id: run.slot.exercise_id,
  })
  const saved = await get(`/programs/${program.id}`)
  const slot = saved.templates.flatMap(t => t.exercises).find(e => e.id === run.slot.id)
  assert.equal(slot.exercise_id, replacement.id)
  assert.equal(slot.target_sets, run.slot.target_sets)
  assert.equal(slot.target_reps_min, run.slot.target_reps_min)
  const historical = await get(`/sessions/${run.session.id}`)
  const oldExercise = historical.exercises.find(e => e.exercise_id === run.slot.exercise_id)
  assert.ok(oldExercise)
  assert.equal(oldExercise.sets.length, run.logs.length)
  assert.ok(oldExercise.sets.every(s => s.weight_kg === 10))
  const next = await startTemplate(run.template)
  assert.ok(next.exercises.some(e => e.exercise_id === replacement.id))
  assert.equal(next.exercises.some(e => e.exercise_id === run.slot.exercise_id), false)
  const snapshot = await exported()
  await post(`/template-exercises/${slot.id}/replace`, {
    exercise_id: run.slot.exercise_id, expected_exercise_id: replacement.id,
  }, 409)
  assert.deepEqual(await exported(), snapshot)
  await post(`/sessions/${next.id}/complete`)
})

test('import invalide : échec pendant la restauration → rollback complet → application encore utilisable', async () => {
  const program = await createProgram()
  await activate(program)
  const run = await train(program)
  const backup = await get('/export')
  const corrupted = structuredClone(backup)
  // This passes format validation but fails a real foreign-key check during inserts,
  // after the importer has already started clearing tables within its transaction.
  corrupted.data.set_logs[0].session_exercise_id = 999999999
  await post('/import', corrupted, 400)
  assert.deepEqual(await exported(), backup.data, 'A failed import must roll back every deleted and inserted row')
  assert.equal((await get(`/sessions/${run.session.id}`)).status, 'completed')
  assert.equal((await get('/stats/overview')).total_sessions, 1)
  const next = await startTemplate(run.template)
  assert.ok((await get(`/sessions/${next.id}/target/${run.slot.id}`)).weight_kg > 10)
})
