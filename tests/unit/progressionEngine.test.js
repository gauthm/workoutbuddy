import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  computeNextState,
  roundDownToAchievable,
  resolveProgressionModel,
} from '../../src/services/progressionEngine.js'

const LOADS = [20, 22.5, 25, 27.5, 30, 32.5, 35, 40, 45, 50,
               55, 60, 62.5, 65, 70, 75, 77.5, 80, 82.5, 85, 90, 100]

const SETTINGS = { progression_failure_threshold: 2, progression_weight_reduction_pct: 10 }

// ── roundDownToAchievable ───────────────────────────────────────────────
describe('roundDownToAchievable', () => {
  it('retourne la charge exacte si disponible', () => {
    assert.equal(roundDownToAchievable(80, LOADS), 80)
  })
  it('arrondit vers le bas', () => {
    assert.equal(roundDownToAchievable(81, LOADS), 80)
  })
  it('retourne le minimum si cible < minimum', () => {
    assert.equal(roundDownToAchievable(10, LOADS), 20)
  })
  it('retourne 0 si liste vide', () => {
    assert.equal(roundDownToAchievable(50, []), 0)
  })
})

// ── Linéaire ────────────────────────────────────────────────────────────
describe('linear progression', () => {
  const te = {
    progression_model: 'linear', target_sets: 4, target_reps: 5,
    target_reps_min: 5, target_reps_max: 5,
    progression_weight_increment_kg: 2.5,
  }
  const state = { current_weight_kg: 80, consecutive_failures: 0 }

  it('succès → +2.5 kg', () => {
    const sets = Array(4).fill({ reps: 5, rpe: null })
    const r = computeNextState(state, sets, te, { progression_model: 'linear' }, LOADS, SETTINGS)
    assert.equal(r.current_weight_kg, 82.5)
    assert.equal(r.consecutive_failures, 0)
  })

  it('1 échec < threshold → maintien', () => {
    const sets = [{ reps: 4, rpe: null }]
    const r = computeNextState(state, sets, te, { progression_model: 'linear' }, LOADS, SETTINGS)
    assert.equal(r.current_weight_kg, 80)
    assert.equal(r.consecutive_failures, 1)
  })

  it('2 échecs = threshold → -10%', () => {
    const stateF = { current_weight_kg: 100, consecutive_failures: 1 }
    const sets = [{ reps: 3, rpe: null }]
    const r = computeNextState(stateF, sets, te, { progression_model: 'linear' }, LOADS, SETTINGS)
    // 100 * 0.9 = 90 → roundDown(90, LOADS) = 90
    assert.equal(r.current_weight_kg, 90)
    assert.equal(r.consecutive_failures, 0)
  })
})

// ── Double progression ──────────────────────────────────────────────────
describe('double_progression', () => {
  const te = {
    progression_model: 'double_progression',
    target_sets: 3, target_reps_min: 8, target_reps_max: 12,
    progression_weight_increment_kg: 2.5,
  }
  const state = { current_weight_kg: 60, current_target_reps: 8, consecutive_failures: 0 }

  it('toutes séries ≥ max_reps → +poids, retour min_reps', () => {
    const sets = Array(3).fill({ reps: 12, rpe: null })
    const r = computeNextState(state, sets, te, { progression_model: 'double_progression' }, LOADS, SETTINGS)
    assert.equal(r.current_weight_kg, 62.5)
    assert.equal(r.current_target_reps, 8)
  })

  it('toutes séries dans la fourchette → +1 rep', () => {
    const sets = Array(3).fill({ reps: 10, rpe: null })
    const r = computeNextState(state, sets, te, { progression_model: 'double_progression' }, LOADS, SETTINGS)
    assert.equal(r.current_weight_kg, 60)
    assert.equal(r.current_target_reps, 9)
  })

  it('current_target_reps = max-1, reps atteints → passe à max', () => {
    const stateNear = { ...state, current_target_reps: 11 }
    const sets = Array(3).fill({ reps: 11, rpe: null })
    const r = computeNextState(stateNear, sets, te, { progression_model: 'double_progression' }, LOADS, SETTINGS)
    assert.equal(r.current_target_reps, 12)
  })

  it('échec threshold → réduction poids', () => {
    const stateF = { current_weight_kg: 60, current_target_reps: 8, consecutive_failures: 1 }
    const sets = [{ reps: 5, rpe: null }]  // < min_reps
    const r = computeNextState(stateF, sets, te, { progression_model: 'double_progression' }, LOADS, SETTINGS)
    // 60 * 0.9 = 54 → roundDown(54, LOADS) = 50
    assert.equal(r.current_weight_kg, 50)
    assert.equal(r.current_target_reps, 8)
    assert.equal(r.consecutive_failures, 0)
  })
})

// ── RPE ─────────────────────────────────────────────────────────────────
describe('rpe_based', () => {
  const te = {
    progression_model: 'rpe_based', rpe_target: 8.0,
    target_sets: 3, target_reps_min: 8, target_reps_max: 12,
  }
  const state = { current_weight_kg: 80, consecutive_failures: 0 }

  it('RPE << cible → augmentation', () => {
    const sets = [{ reps: 8, rpe: 6.0 }]  // diff = -2 → pct = 5%
    const r = computeNextState(state, sets, te, { progression_model: 'rpe_based' }, LOADS, SETTINGS)
    assert.ok(r.current_weight_kg > 80, `Attendu > 80, obtenu ${r.current_weight_kg}`)
  })

  it('RPE >> cible → réduction', () => {
    const sets = [{ reps: 8, rpe: 10.0 }]  // diff = +2 → pct = 5%
    const r = computeNextState(state, sets, te, { progression_model: 'rpe_based' }, LOADS, SETTINGS)
    assert.ok(r.current_weight_kg < 80, `Attendu < 80, obtenu ${r.current_weight_kg}`)
  })

  it('RPE ≈ cible (±0.9) → maintien', () => {
    const sets = [{ reps: 8, rpe: 8.5 }]
    const r = computeNextState(state, sets, te, { progression_model: 'rpe_based' }, LOADS, SETTINGS)
    assert.equal(r.current_weight_kg, 80)
  })

  it('RPE non renseigné → pas de changement', () => {
    const sets = [{ reps: 8, rpe: null }]
    const r = computeNextState(state, sets, te, { progression_model: 'rpe_based' }, LOADS, SETTINGS)
    assert.equal(r.current_weight_kg, 80)
  })
})

// ── resolveProgressionModel ─────────────────────────────────────────────
describe('resolveProgressionModel', () => {
  it('inherit → utilise le modèle du programme', () => {
    const te = { progression_model: 'inherit' }
    const prog = { progression_model: 'linear' }
    assert.equal(resolveProgressionModel(te, prog), 'linear')
  })
  it('modèle explicite → ignoré le programme', () => {
    const te = { progression_model: 'rpe_based' }
    const prog = { progression_model: 'linear' }
    assert.equal(resolveProgressionModel(te, prog), 'rpe_based')
  })
  it('inherit + pas de programme → double_progression par défaut', () => {
    const te = { progression_model: 'inherit' }
    assert.equal(resolveProgressionModel(te, null), 'double_progression')
  })
})

describe('Progression à charge fixe',()=>{
  it('conserve les répétitions atteintes lorsque le matériel ne permet pas de monter la charge',()=>{
    for(const weight of [0,20]){
      const result=computeNextState({current_weight_kg:weight,current_target_reps:12,consecutive_failures:0},
        Array.from({length:3},()=>({weight_kg:weight,reps:12})),
        {progression_model:'double_progression',target_sets:3,target_reps_min:8,target_reps_max:12},
        null,[weight],{})
      assert.equal(result.current_weight_kg,weight)
      assert.equal(result.current_target_reps,12)
    }
  })
})
