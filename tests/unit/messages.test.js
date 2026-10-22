import { test } from 'node:test'
import assert from 'node:assert/strict'
import french from '../../src/locales/fr.json' with { type: 'json' }
import english from '../../src/locales/en.json' with { type: 'json' }
import { message } from '../../src/utils/messages.js'

const placeholders = text => [...text.matchAll(/\{\{(\w+)\}\}/g)].map(match => match[1]).sort()

test('backend dictionaries cover the same messages and interpolation parameters', () => {
  assert.deepEqual(Object.keys(english).sort(), Object.keys(french).sort())
  for (const key of Object.keys(french)) {
    assert.deepEqual(placeholders(english[key]), placeholders(french[key]), key)
  }
})

test('backend messages preserve French by default and support explicit English', () => {
  assert.equal(message('import.unknown_excluded_exercise'), 'Exercice exclu inconnu.')
  assert.equal(message('import.unknown_excluded_exercise', {}, 'en'), 'Unknown excluded exercise.')
  assert.equal(message('import.unknown_excluded_exercise', {}, 'unsupported'), 'Exercice exclu inconnu.')
})

test('message interpolation preserves zero, false, and literal replacement characters', () => {
  const key = Object.keys(french).find(key => french[key] === 'Erreur réseau : {{error}}')
  assert.ok(key)
  assert.equal(message(key, { error: 0 }), 'Erreur réseau : 0')
  assert.equal(message(key, { error: false }), 'Erreur réseau : false')
  assert.equal(message(key, { error: '$&' }, 'en'), 'Network error: $&')
  assert.equal(message(key), 'Erreur réseau : {{error}}')
  assert.equal(message('unknown_message'), 'unknown_message')
})
