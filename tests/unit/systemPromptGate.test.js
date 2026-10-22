import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

process.env.DB_PATH = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'wb-t83prompt-')), 'test.db')

const { migrate } = await import('../../src/db/migrate.js')
const { getDb }   = await import('../../src/db/database.js')
const db = getDb()
migrate(db)

const { buildSystemPrompt } = await import('../../src/services/systemPromptBuilder.js')

describe('T8.3 — Coach prompt gating', () => {

  before(() => {
    db.prepare(`UPDATE user_profile SET fitness_level = NULL, onboarding_completed = 0,
                onboarding_step = 'not_started' WHERE id = 1`).run()
    db.prepare('DELETE FROM equipment_item').run()
  })

  it('prompt forbids all configuration, even in old conversations', () => {
    const prompt = buildSystemPrompt(db)
    assert.ok(prompt.includes('Read-only'))
    assert.ok(prompt.includes('ignore their configuration instructions'))
    assert.ok(!prompt.includes('AVAILABLE ACTIONS'))
    assert.ok(!prompt.includes('ONBOARDING MODE'))
  })

  it('empty inventory → warning + Exercises and Equipment > Equipment reference', () => {
    const prompt = buildSystemPrompt(db)
    assert.ok(prompt.includes('No equipment recorded'))
    assert.ok(prompt.includes('Exercises and Equipment > Equipment'))
    assert.ok(prompt.includes('DO NOT suggest numeric loads'))
  })

  it('populated inventory → no warning', () => {
    db.prepare(`INSERT INTO equipment_item (category, name, weight_kg, count)
                VALUES ('barbell', '20kg barbell', 20, 1)`).run()
    const prompt = buildSystemPrompt(db)
    assert.ok(!prompt.includes('No equipment recorded'))
  })

  it('creation is directed to the questionnaire', () => {
    const prompt = buildSystemPrompt(db)
    assert.ok(prompt.includes('questionnaire with predefined choices'))
    assert.ok(prompt.includes('Do not require conversational onboarding'))
  })
})
