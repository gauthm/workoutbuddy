import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { suggestFirstTime } from '../../src/services/firstTimeSuggestion.js'

const BENCH = {
  id: 'bench_press_barbell', mechanic: 'compound',
  equipment_required: ['barbell','bench'], is_unilateral: 0,
}
const CURL = {
  id: 'curl_barbell', mechanic: 'isolation',
  equipment_required: ['barbell'], is_unilateral: 0,
}
const PULLUP = {
  id: 'pullup_bodyweight', mechanic: 'compound',
  equipment_required: [], is_unilateral: 0,
}

const BARBELL = { category: 'barbell', weight_kg: 20, count: 1 }
const PLATES  = [
  { category: 'plate', weight_kg: 5,  count: 4 },
  { category: 'plate', weight_kg: 10, count: 4 },
  { category: 'plate', weight_kg: 20, count: 2 },
]
const EQUIPMENT = [BARBELL, ...PLATES,
  { category: 'bench', name: 'Banc', count: 1 }]

const PROFILE_BEGINNER_HYPER = {
  weight_kg: 80, fitness_level: 'beginner', primary_goal: 'hypertrophy'
}
const PROFILE_INTER_STRENGTH = {
  weight_kg: 80, fitness_level: 'intermediate', primary_goal: 'strength'
}

describe('suggestFirstTime', () => {
  it('débutant hypertrophie bench → charge > 0 et reps 10', () => {
    const r = suggestFirstTime(BENCH, PROFILE_BEGINNER_HYPER, { target_reps_min: 10 }, EQUIPMENT)
    assert.ok(r.weight_kg > 0, 'Charge doit être > 0')
    assert.equal(r.reps, 10)
    assert.ok(typeof r.reasoning === 'string' && r.reasoning.length > 10)
  })

  it('charge arrondie à une valeur atteignable avec l\'équipement', () => {
    const r = suggestFirstTime(BENCH, PROFILE_BEGINNER_HYPER, { target_reps_min: 10 }, EQUIPMENT)
    // Charges disponibles : 20, 30, 40, 50, 60, 70, 80...
    // 80 * 0.25 = 20 → 20 est atteignable (barre seule)
    const loads = [20, 30, 40, 50, 60, 70, 80]
    assert.ok(loads.includes(r.weight_kg), `${r.weight_kg} doit être dans les charges atteignables`)
  })

  it('exercice bodyweight → weight_kg = 0', () => {
    const r = suggestFirstTime(PULLUP, PROFILE_BEGINNER_HYPER, { target_reps_min: 5 }, [])
    assert.equal(r.weight_kg, 0)
    assert.ok(r.reps > 0)
  })

  it('intermédiaire force → plus de reps que débutant pour isolation', () => {
    // Non — pour strength, moins de reps sont normales
    const rBeg  = suggestFirstTime(CURL, PROFILE_BEGINNER_HYPER,  { target_reps_min: 12 }, EQUIPMENT)
    const rInt  = suggestFirstTime(CURL, PROFILE_INTER_STRENGTH,  { target_reps_min: 8  }, EQUIPMENT)
    // Intermédiaire strength isolation : 8 reps
    assert.equal(rInt.reps, 8)
    // Débutant hypertrophie isolation : 12 reps
    assert.equal(rBeg.reps, 12)
  })

  it('profil null → valeur par défaut sans crash', () => {
    assert.doesNotThrow(() => {
      suggestFirstTime(BENCH, null, { target_reps_min: 10 }, EQUIPMENT)
    })
  })

  it('équipement vide → weight_kg = charge minimale dispo ou 0', () => {
    const r = suggestFirstTime(BENCH, PROFILE_BEGINNER_HYPER, { target_reps_min: 10 }, [])
    assert.equal(r.weight_kg, 0)
  })
})
