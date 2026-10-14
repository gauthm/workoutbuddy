import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import Database from 'better-sqlite3'
import { migrate } from '../../src/db/migrate.js'
import { seedExercises } from '../../src/seed/seed.js'
import { ALL_EQUIPMENT_CATEGORIES,SIMPLE_CATEGORIES } from '../../public/js/components/equipment/inventoryCatalog.js'
import { isEquipmentAvailable } from '../../src/services/rotationEngine.js'
import { requiredExerciseEquipment } from '../../src/services/exerciseEquipment.js'

test('every declared exercise requirement is selectable, localized and accepted by SQLite',()=>{
  const db=new Database(':memory:');migrate(db);seedExercises(db)
  const selectable=new Set(ALL_EQUIPMENT_CATEGORIES)
  for(const lang of ['fr','en']) {
    const locale=JSON.parse(fs.readFileSync(`public/locales/${lang}.json`))
    for(const category of selectable)assert.ok(locale['equipment.category_'+category],`${lang}: ${category}`)
  }
  for(const ex of db.prepare('SELECT id,equipment_required FROM exercise').all())
    for(const category of JSON.parse(ex.equipment_required))assert.ok(selectable.has(category),`${ex.id}: ${category}`)
  for(const category of SIMPLE_CATEGORIES)assert.doesNotThrow(()=>db.prepare('INSERT INTO equipment_item(category,name) VALUES (?,?)').run(category,category))
  assert.equal(ALL_EQUIPMENT_CATEGORIES.length,new Set(ALL_EQUIPMENT_CATEGORIES).size)
  db.close()
})

test('specific machines, omitted support and bodyweight accessories have accurate requirements',()=>{
  const check=(id,source,expected)=>assert.deepEqual(requiredExerciseEquipment({id,equipment_required:source==='machine'?['cable_machine']:[]},source),expected)
  check('leg_press','machine',['leg_press'])
  check('lying_leg_curls','machine',['leg_curl'])
  check('smith_machine_bench_press','machine',['smith_machine','bench'])
  check('ab_roller','other',['ab_wheel'])
  check('pullups','body only',['pullup_bar'])
  check('band_assisted_pull_up','other',['pullup_bar','resistance_band'])
  check('suspended_row','other',['suspension_trainer'])
  check('pushups','body only',[])
  check('adductor','foam roll',['foam_roller'])
  check('medicine_ball_chest_pass','medicine ball',['medicine_ball'])
  assert.deepEqual(requiredExerciseEquipment({id:'dumbbell_flyes',instructions_en:['Lie on a flat bench.']},'dumbbell'),['dumbbell_fixed','bench'])
  assert.equal(isEquipmentAvailable(['leg_press'],[{category:'cable_machine'}]),false)
  assert.equal(isEquipmentAvailable(['lat_pulldown'],[{category:'cable_machine'}]),true)
  assert.equal(isEquipmentAvailable(['seated_row'],[{category:'seated_row'}]),true)
})

test('catalog migrations preserve inventory and custom exercise metadata',()=>{
  const db=new Database(':memory:');db.pragma('foreign_keys=ON')
  db.exec("CREATE TABLE schema_version(version INTEGER PRIMARY KEY,applied_at TEXT DEFAULT (datetime('now')))")
  for(const file of fs.readdirSync('src/db/migrations').filter(f=>f.endsWith('.sql')&&parseInt(f)<=10).sort()) {
    db.exec(fs.readFileSync('src/db/migrations/'+file,'utf8'));db.prepare('INSERT INTO schema_version(version) VALUES (?)').run(parseInt(file))
  }
  db.prepare("INSERT INTO equipment_item(category,name,count,weight_kg,notes) VALUES ('dumbbell_fixed','Existing',2,14,'{\"inventory_section\":\"gym\"}')").run()
  db.prepare("INSERT INTO exercise(id,name_fr,name_en,category,movement_pattern,primary_muscles,equipment_required,is_custom) VALUES ('leg_press','User exercise','User exercise','strength','squat','[\"quads\"]','[\"dumbbell_fixed\"]',1)").run()
  const inventory=db.prepare('SELECT * FROM equipment_item').all()
  migrate(db);migrate(db)
  assert.deepEqual(db.prepare('SELECT * FROM equipment_item').all(),inventory)
  assert.equal(db.prepare("SELECT equipment_required FROM exercise WHERE id='leg_press'").get().equipment_required,'["dumbbell_fixed"]')
  db.close()
})
