import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeBaseUrl } from '../../src/services/aiProvider.js'

describe('normalizeBaseUrl', () => {
  const cases = [
    ['https://api.openai.com',       'https://api.openai.com/v1'],
    ['https://api.openai.com/',      'https://api.openai.com/v1'],
    ['https://api.openai.com/v1',    'https://api.openai.com/v1'],
    ['https://api.openai.com/v1/',   'https://api.openai.com/v1'],
    ['http://localhost:11434',       'http://localhost:11434/v1'],
    ['https://api.groq.com/openai',  'https://api.groq.com/openai/v1'],
    ['',                             ''],
    [null,                           ''],
  ]
  for (const [input, expected] of cases) {
    it(`"${input}" → "${expected}"`, () => {
      assert.equal(normalizeBaseUrl(input), expected)
    })
  }
})
