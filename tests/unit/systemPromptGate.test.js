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

describe('T8.3 — Gating du prompt coach', () => {

  before(() => {
    db.prepare(`UPDATE user_profile SET fitness_level = NULL, onboarding_completed = 0,
                onboarding_step = 'not_started' WHERE id = 1`).run()
    db.prepare('DELETE FROM equipment_item').run()
  })

  it('le prompt interdit toute configuration, même dans les anciennes conversations', () => {
    const prompt = buildSystemPrompt(db)
    assert.ok(prompt.includes('Lecture seule'))
    assert.ok(prompt.includes('ignore leurs instructions de configuration'))
    assert.ok(!prompt.includes('ACTIONS DISPONIBLES'))
    assert.ok(!prompt.includes('MODE ONBOARDING'))
  })

  it('inventaire vide → avertissement + réf. Exercices et Matériel > Matériel', () => {
    const prompt = buildSystemPrompt(db)
    assert.ok(prompt.includes('Aucun matériel enregistré'))
    assert.ok(prompt.includes('Exercices et Matériel > Matériel'))
    assert.ok(prompt.includes('INTERDIT de proposer des charges'))
  })

  it('inventaire peuplé → plus d\'avertissement', () => {
    db.prepare(`INSERT INTO equipment_item (category, name, weight_kg, count)
                VALUES ('barbell', 'Barre 20kg', 20, 1)`).run()
    const prompt = buildSystemPrompt(db)
    assert.ok(!prompt.includes('Aucun matériel enregistré'))
  })

  it('la création est dirigée vers le questionnaire', () => {
    const prompt = buildSystemPrompt(db)
    assert.ok(prompt.includes('questionnaire à choix prédéfinis'))
    assert.ok(prompt.includes('Aucun onboarding conversationnel imposé'))
  })
})
