import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { EQUIPMENT_CATALOG } from '../../public/js/components/settings/equipmentCatalog.js'

const VALID_CATS = ['barbell','ez_bar','plate','dumbbell_plate','dumbbell_fixed',
  'dumbbell_adjustable','dumbbell_loadable','kettlebell','resistance_band',
  'bench','bench_adjustable','rack','pullup_bar','roman_chair','cable_machine','smith_machine','other']

describe('T8.4 — catalogue matériel', () => {
  it('keys d\'instances uniques', () => {
    const keys = EQUIPMENT_CATALOG.flatMap(g => g.items.map(i => i.key))
    assert.equal(keys.length, new Set(keys).size)
  })
  it('catégories valides pour l\'API', () => {
    for (const g of EQUIPMENT_CATALOG)
      for (const i of g.items) assert.ok(VALID_CATS.includes(i.category), i.category)
  })
  it('quantités paires pour les disques', () => {
    for (const g of EQUIPMENT_CATALOG)
      for (const i of g.items)
        if (['plate','dumbbell_plate'].includes(i.category))
          assert.equal(i.defaults.count % 2, 0, i.key)
  })
})
