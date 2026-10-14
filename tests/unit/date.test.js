import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isoDate, parseUtcTimestamp } from '../../public/js/utils/date.js'

test('isoDate conserve le jour local à minuit, sans conversion UTC', () => {
  assert.equal(isoDate(new Date(2026, 9, 13, 0, 30)), '2026-10-13')
  assert.equal(isoDate(new Date(2026, 0, 1, 0, 30)), '2026-01-01')
  assert.equal(isoDate(new Date(2026, 11, 31, 23, 30)), '2026-12-31')
})

test('les timestamps SQLite et ISO conservent le même instant',()=>{
  const expected=Date.parse('2026-10-13T12:30:00Z')
  assert.equal(parseUtcTimestamp('2026-10-13 12:30:00'),expected)
  assert.equal(parseUtcTimestamp('2026-10-13T12:30:00Z'),expected)
  assert.equal(parseUtcTimestamp('2026-10-13T14:30:00+02:00'),expected)
})
