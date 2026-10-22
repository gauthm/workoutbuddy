import { estimate10RM as client10RM } from '../../public/js/utils/rm.js'
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { estimate1RM, rmTable, FORMULAS, estimate10RM } from '../../src/services/rmCalculator.js'

describe('rmCalculator', () => {
  it('Epley: 100kg×3 → 110kg', () => {
    assert.equal(estimate1RM(100, 3, 'epley'), 110)
  })
  it('Epley: 1 rep → weight itself', () => {
    assert.equal(estimate1RM(80, 1, 'epley'), 80)
  })
  it('weight=0 → 0', () => {
    assert.equal(estimate1RM(0, 5, 'epley'), 0)
  })
  it('reps=0 → 0', () => {
    assert.equal(estimate1RM(100, 0, 'epley'), 0)
  })
  it('Brzycki: consistent result', () => {
    const rm = estimate1RM(100, 5, 'brzycki')
    assert.ok(rm > 100 && rm < 140, `RM=${rm} hors plage attendue`)
  })
  it('rmTable: 15 entries for RM=110', () => {
    const table = rmTable(110, 'epley')
    assert.equal(table.length, 15)
    assert.equal(table[0].reps, 1)
    assert.equal(table[0].weight_kg, 110)
    assert.equal(table[14].reps, 15)
  })
  it('rmTable: 3 reps ≈ 100kg for RM=110', () => {
    const table = rmTable(110, 'epley')
    const row3 = table.find(r => r.reps === 3)
    assert.ok(Math.abs(row3.weight_kg - 100) < 1, `Attendu ~100, obtenu ${row3.weight_kg}`)
  })
  it('rmTable empty when RM=0', () => {
    assert.deepEqual(rmTable(0), [])
  })
})

// Every model must invert its own curve, rather than always dividing by Epley.
describe('RM conversion using the selected formula',()=>{
  for(const formula of Object.keys(FORMULAS)) {
    it(`${formula}: ten reps at 40 kg correspond to a 10RM of 40 kg`,()=>{
      assert.equal(rmTable(estimate1RM(40,10,formula),formula)[9].weight_kg,40)
    })
    it(`${formula}: round-trip consistency from 1 to 15 reps`,()=>{
      for(let reps=1;reps<=15;reps++) {
        const table=rmTable(estimate1RM(50,reps,formula),formula)
        assert.ok(Math.abs(table[reps-1].weight_kg-50)<=0.1)
      }
    })
  }
})

it('client and server 10RM agree for all five formulas and invalid inputs',()=>{
  for(const formula of Object.keys(FORMULAS)) for(const [weight,reps] of [[40,10],[55,8],[20,1],[0,10],[NaN,8],[50,0],[Infinity,8],[40,8.5]]) {
    assert.equal(client10RM(weight,reps,formula),estimate10RM(weight,reps,formula))
    assert.ok(Number.isFinite(client10RM(weight,reps,formula)))
  }
})
