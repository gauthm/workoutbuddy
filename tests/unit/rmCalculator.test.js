import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { estimate1RM, rmTable, FORMULAS } from '../../src/services/rmCalculator.js'

describe('rmCalculator', () => {
  it('Epley: 100kg×3 → 110kg', () => {
    assert.equal(estimate1RM(100, 3, 'epley'), 110)
  })
  it('Epley: 1 rep → poids lui-même', () => {
    assert.equal(estimate1RM(80, 1, 'epley'), 80)
  })
  it('poids=0 → 0', () => {
    assert.equal(estimate1RM(0, 5, 'epley'), 0)
  })
  it('reps=0 → 0', () => {
    assert.equal(estimate1RM(100, 0, 'epley'), 0)
  })
  it('Brzycki: résultat cohérent', () => {
    const rm = estimate1RM(100, 5, 'brzycki')
    assert.ok(rm > 100 && rm < 140, `RM=${rm} hors plage attendue`)
  })
  it('rmTable: 15 entrées pour RM=110', () => {
    const table = rmTable(110, 'epley')
    assert.equal(table.length, 15)
    assert.equal(table[0].reps, 1)
    assert.equal(table[0].weight_kg, 110)
    assert.equal(table[14].reps, 15)
  })
  it('rmTable: 3 reps ≈ 100kg pour RM=110', () => {
    const table = rmTable(110, 'epley')
    const row3 = table.find(r => r.reps === 3)
    assert.ok(Math.abs(row3.weight_kg - 100) < 1, `Attendu ~100, obtenu ${row3.weight_kg}`)
  })
  it('rmTable vide si RM=0', () => {
    assert.deepEqual(rmTable(0), [])
  })
})
