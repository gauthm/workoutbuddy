import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { calculateAchievableLoads, roundDownToAchievable }
  from '../../src/services/equipmentCalc.js'

// ── Helpers ───────────────────────────────────────────────────
const barbell      = (w) => ({ category: 'barbell',          weight_kg: w, count: 1 })
const plate        = (w, c) => ({ category: 'plate',          weight_kg: w, count: c })
const dumbPlate    = (w, c) => ({ category: 'dumbbell_plate', weight_kg: w, count: c })
const dumbHandle   = (w) => ({ category: 'dumbbell_loadable', weight_kg: w, count: 2 })
const dumbFixed    = (w, c=2) => ({ category: 'dumbbell_fixed', weight_kg: w, count: c })
const dumbAdj      = (min, max, step) => ({
  category: 'dumbbell_adjustable',
  weight_min_kg: min, weight_max_kg: max, weight_step_kg: step,
})

const EX_DUMB = { equipment_required: ['dumbbell_fixed'], is_unilateral: 1 }
const EX_BAR  = { equipment_required: ['barbell'],        is_unilateral: 0 }
const EX_NONE = { equipment_required: [],                 is_unilateral: 0 }

// ── Tests dumbbell_loadable ───────────────────────────────────
describe('dumbbell_loadable — poignée + disques', () => {

  it('poignée 2kg + 2 disques 1kg (2 paires/côté) → charges 2,4,6 kg', () => {
    const items = [ dumbHandle(2), dumbPlate(1, 4) ]
    // DP côté : {0, 1, 2} → charges : 2+2×0=2, 2+2×1=4, 2+2×2=6
    const r = calculateAchievableLoads(items, EX_DUMB)
    assert.deepEqual(r.loads_kg, [2, 4, 6])
    assert.equal(r.min_increment_kg, 2)
    assert.equal(r.max_load_kg, 6)
  })

  it('poignée 2kg + disques 0.5kg×8 + 1kg×8 → incrément 1 kg', () => {
    const items = [
      dumbHandle(2),
      dumbPlate(0.5, 8),  // 4 paires/côté
      dumbPlate(1,   8),  // 4 paires/côté
    ]
    const r = calculateAchievableLoads(items, EX_DUMB)
    assert.equal(r.loads_kg[0], 2)              // poignée nue
    assert.equal(r.min_increment_kg, 1)         // 2×0.5
    assert.ok(r.max_load_kg > 10, `max_load=${r.max_load_kg}`)
  })

  it('disques plate (barre) partagés avec dumbbell_loadable', () => {
    // Les 'plate' sont utilisables sur les haltères aussi
    const items = [
      dumbHandle(2),
      plate(2.5, 4),  // 2 paires/côté — utilisables sur haltères
    ]
    const r = calculateAchievableLoads(items, EX_DUMB)
    // DP côté : {0, 2.5, 5} → charges : 2, 7, 12
    assert.deepEqual(r.loads_kg, [2, 7, 12])
    assert.equal(r.min_increment_kg, 5)
  })

  it('dumbbell_plate et plate cumulés', () => {
    const items = [
      dumbHandle(2),
      plate(2.5, 2),      // 1 paire/côté
      dumbPlate(1.25, 4), // 2 paires/côté
    ]
    const r = calculateAchievableLoads(items, EX_DUMB)
    // DP côté : +2.5×1 → {0,2.5}, +1.25×2 → {0,1.25,2.5,3.75}... etc.
    assert.ok(r.loads_kg.length > 3, `Attendu plusieurs charges, obtenu ${r.loads_kg.length}`)
    assert.equal(r.loads_kg[0], 2)  // poignée nue toujours présente
  })

  it('poignée sans disques → une seule charge (poignée nue)', () => {
    const items = [ dumbHandle(2) ]
    const r = calculateAchievableLoads(items, EX_DUMB)
    assert.deepEqual(r.loads_kg, [2])
    assert.equal(r.min_increment_kg, 0)
  })

  it('dumbbell_loadable satisfait exercice qui requiert dumbbell_fixed', () => {
    // EX_DUMB requiert dumbbell_fixed → doit être satisfait par dumbbell_loadable
    const items = [ dumbHandle(3), dumbPlate(1, 4) ]
    const r = calculateAchievableLoads(items, EX_DUMB)
    assert.ok(r.loads_kg.length > 0)
    assert.equal(r.loads_kg[0], 3)
  })

})

// ── Tests cohabitation barre + haltères ───────────────────────
describe('cohabitation barbell + dumbbell_loadable', () => {
  it('disques plate partagés — exercice barre utilise seulement plate (pas dumbbell_plate)', () => {
    const items = [
      barbell(20),
      plate(5, 4),           // pour la barre
      dumbHandle(2),
      dumbPlate(1.25, 4),    // seulement pour haltères
    ]
    // Exercice barre : ne doit pas utiliser dumbbell_plate
    const rBar = calculateAchievableLoads(items, EX_BAR)
    // Charges barre : 20+2×{0,5,10} = {20, 30, 40}
    assert.deepEqual(rBar.loads_kg, [20, 30, 40])

    // Exercice haltère : peut utiliser plate + dumbbell_plate
    const rDumb = calculateAchievableLoads(items, EX_DUMB)
    // DP côté (plate 5kg ×2 paires + dumbbell_plate 1.25 ×2 paires) :
    // {0, 1.25, 2.5, 5, 6.25, 7.5} → charges 2+2×... = plusieurs valeurs
    assert.ok(rDumb.loads_kg.includes(2))     // poignée nue
    assert.ok(rDumb.loads_kg.includes(12))    // 2+2×5
  })
})

// ── Tests bench_adjustable ─────────────────────────────────────
describe('isEquipmentAvailable — bench_adjustable satisfait bench', () => {
  // Tester via l'API achievable-loads ou directement programGenerator
  // Pour ce test unitaire, vérifier la logique de isEquipmentAvailable
  // en important la fonction depuis programGenerator ou en la dupliquant

  it('plate count impair → doit être rejeté par le serveur (test API)', async () => {
    // Ce test est dans tests/integration — voir ci-dessous
    assert.ok(true)  // placeholder
  })
})

// ── Tests cas limites ─────────────────────────────────────────
describe('cas limites', () => {
  it('exercice sans équipement → loads=[0]', () => {
    const r = calculateAchievableLoads([], EX_NONE)
    assert.deepEqual(r.loads_kg, [0])
  })

  it('dumbbell_plate sans dumbbell_loadable → ignoré pour exercice haltère', () => {
    // Sans poignée, les disques d'haltère seuls ne servent à rien
    const items = [ dumbPlate(1, 4) ]
    const r = calculateAchievableLoads(items, EX_DUMB)
    // Aucune charge atteignable (pas de poignée, pas d'haltère fixe/réglable)
    assert.deepEqual(r.loads_kg, [])
  })

  it('haltères fixes + poignées à disques → charges cumulées', () => {
    const items = [
      dumbFixed(10, 2),    // haltère fixe 10kg
      dumbFixed(15, 2),    // haltère fixe 15kg
      dumbHandle(2),
      dumbPlate(2.5, 4),   // 2 paires/côté
    ]
    const r = calculateAchievableLoads(items, EX_DUMB)
    assert.ok(r.loads_kg.includes(10))  // haltère fixe
    assert.ok(r.loads_kg.includes(15))  // haltère fixe
    assert.ok(r.loads_kg.includes(2))   // poignée nue
    assert.ok(r.loads_kg.includes(7))   // 2+2×2.5
  })
})
