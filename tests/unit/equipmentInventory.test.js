import fs from 'node:fs'
import { computeNextState } from '../../src/services/progressionEngine.js'
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { migrate } from '../../src/db/migrate.js'
import { calculateAchievableLoads } from '../../src/services/equipmentCalc.js'
import { forecastEquipmentLimit, runAllSignalChecks } from '../../src/services/coachingAdvisor.js'
import { isEquipmentAvailable } from '../../src/services/rotationEngine.js'
import { SIMPLE_CATEGORIES } from '../../public/js/components/equipment/inventoryCatalog.js'

const calc=(items,requirements)=>calculateAchievableLoads(items,{equipment_required:requirements,is_unilateral:1})
function fixture(category,max){
 const db=new Database(':memory:'); migrate(db)
 db.prepare(`INSERT INTO exercise(id,name_fr,name_en,category,movement_pattern,primary_muscles,equipment_required) VALUES ('fixture','Test','Test','strength','hinge','["glutes"]',?)`).run(JSON.stringify([category]))
 db.prepare(`INSERT INTO program(id,name,goal,level,days_per_week,progression_model,is_active) VALUES(1,'P','strength','beginner',3,'linear',1)`).run()
 db.prepare(`INSERT INTO workout_template(id,program_id,name) VALUES(1,1,'T')`).run()
 db.prepare(`INSERT INTO template_exercise(id,workout_template_id,exercise_id,target_reps_max) VALUES(1,1,'fixture',12)`).run()
 db.prepare(`INSERT INTO equipment_item(category,name,count,weight_kg,resistance_min_kg,resistance_max_kg) VALUES(?,'E',1,?,?,?)`).run(category,category==='kettlebell'?max:null,category==='resistance_band'?5:null,category==='resistance_band'?max:null)
 return db
}
function session(db,index,weight,sets=3){
 const date=`2026-10-${String(index).padStart(2,'0')}`
 db.prepare(`INSERT INTO session(id,program_id,name,scheduled_date,completed_at,status) VALUES(?,1,'S',?,?,'completed')`).run(index,date,date+' 10:00:00')
 db.prepare(`INSERT INTO session_exercise(id,session_id,exercise_id,template_exercise_id) VALUES(?,?,'fixture',1)`).run(index,index)
 for(let n=1;n<=sets;n++)db.prepare(`INSERT INTO set_log(session_exercise_id,set_number,weight_kg,reps,is_completed) VALUES(?,?,?,12,1)`).run(index,n,weight)
}
describe('Inventaire cohérent et anticipation des limites',()=>{
 it('la progression automatique ne traite pas une bande comme une pile de disques',()=>{
  const result=computeNextState({current_weight_kg:10,consecutive_failures:0},[{reps:12,weight_kg:10}],{progression_model:'linear',target_sets:1,target_reps:12},null,[5,16],{resistance_is_approximate:true})
  assert.equal(result.current_weight_kg,10)
 })
 it('la migration préserve un inventaire et un conseil existants',()=>{
  const db=new Database(':memory:');try{
   for(const name of fs.readdirSync('src/db/migrations').filter(n=>parseInt(n)<=6&&n.endsWith('.sql')).sort()) db.exec(fs.readFileSync('src/db/migrations/'+name,'utf8'))
   db.exec('CREATE TABLE IF NOT EXISTS schema_version(version INTEGER PRIMARY KEY,applied_at TEXT DEFAULT (datetime(\'now\'))); INSERT INTO schema_version(version) VALUES(1),(2),(3),(4),(5),(6)')
   db.prepare("INSERT INTO equipment_item(category,name,count,weight_kg) VALUES('kettlebell','Avant',2,16)").run()
   db.prepare("INSERT INTO equipment_advice(signal_type,signal_data) VALUES('no_exercise_available','{}')").run()
   const equipment=db.prepare('SELECT * FROM equipment_item').all(),advice=db.prepare('SELECT * FROM equipment_advice').all()
   migrate(db);assert.deepEqual(db.prepare('SELECT * FROM equipment_item').all(),equipment);assert.deepEqual(db.prepare('SELECT * FROM equipment_advice').all(),advice)
  }finally{db.close()}
 })

 it('les kettlebells utilisent les poids réellement possédés',()=>{
  const result=calc([{category:'kettlebell',count:1,weight_kg:12},{category:'kettlebell',count:2,weight_kg:16}],['kettlebell'])
  assert.deepEqual(result.loads_kg,[12,16]);assert.equal(result.min_increment_kg,4);assert.equal(result.max_load_kg,16)
 })
 it('les bandes exposent des fourchettes, jamais un faux pas de progression',()=>{
  const result=calc([{category:'resistance_band',count:2,resistance_min_kg:5,resistance_max_kg:16},{category:'resistance_band',count:1,resistance_min_kg:10,resistance_max_kg:25}],['resistance_band'])
  assert.equal(result.max_load_kg,25);assert.equal(result.min_increment_kg,0);assert.equal(result.resistance_is_approximate,true);assert.equal(result.resistance_ranges.length,2)
 })
 it('une bande invalide ne crée pas de charge réalisable',()=>assert.deepEqual(calc([{category:'resistance_band',count:1,resistance_min_kg:16,resistance_max_kg:5}],['resistance_band']).loads_kg,[]))
 it('le matériel complémentaire requis reste nécessaire',()=>assert.deepEqual(calc([{category:'kettlebell',count:1,weight_kg:16}],['kettlebell','bench']).loads_kg,[]))
 it('la chaise romaine permet la traction et les dips',()=>{
  assert.equal(isEquipmentAvailable(['pullup_bar'],[{category:'roman_chair'}]),true)
  assert.equal(isEquipmentAvailable(['dip_station'],[{category:'roman_chair'}]),true)
  assert.deepEqual(calc([{category:'roman_chair',count:1}],['roman_chair']).loads_kg,[0])
 })
 it('chaque case de la liste unique possède une catégorie acceptée par SQLite',()=>{
  const db=new Database(':memory:');try{migrate(db);for(const category of SIMPLE_CATEGORIES)db.prepare('INSERT INTO equipment_item(category,name) VALUES(?,?)').run(category,category)}finally{db.close()}
 })
 it('prévoit un plafond proche à partir de trois séances distinctes',()=>assert.equal(forecastEquipmentLimit({max_load_kg:20},[{weight_kg:12},{weight_kg:14},{weight_kg:16}]).estimated_sessions,2))
 it('ne prédit rien sans historique suffisant ou en recul',()=>{
  assert.equal(forecastEquipmentLimit({max_load_kg:20},[{weight_kg:16},{weight_kg:18}]),null)
  assert.equal(forecastEquipmentLimit({max_load_kg:20},[{weight_kg:16},{weight_kg:14},{weight_kg:16}]),null)
 })
 it('ne prédit rien pour une stagnation ou un plafond éloigné',()=>{
  assert.equal(forecastEquipmentLimit({max_load_kg:20},[{weight_kg:16},{weight_kg:16},{weight_kg:16}]),null)
  assert.equal(forecastEquipmentLimit({max_load_kg:40},[{weight_kg:12},{weight_kg:14},{weight_kg:16}]),null)
 })
 it('ne promet pas un nombre de séances pour une résistance élastique',()=>{
  const result=forecastEquipmentLimit({max_load_kg:16,resistance_is_approximate:true},[{weight_kg:10},{weight_kg:12},{weight_kg:14}])
  assert.equal(result.estimated_sessions,null);assert.equal(result.resistance_is_approximate,true)
 })
 for(const category of ['kettlebell','resistance_band']){
  it(`le coach anticipe le plafond pour ${category}, sans doublon`,()=>{
   const db=fixture(category,20);try{
    session(db,1,14);session(db,2,16);session(db,3,18)
    runAllSignalChecks(db,{});runAllSignalChecks(db,{})
    const advice=db.prepare("SELECT * FROM equipment_advice WHERE signal_type='equipment_limit_approaching'").all()
    assert.equal(advice.length,1);const data=JSON.parse(advice[0].signal_data);assert.equal(data.max_load_kg,20)
    assert.equal(data.resistance_is_approximate,category==='resistance_band')
   }finally{db.close()}
  })
  it(`le plafond de ${category} exige trois séances, pas trois séries`,()=>{
   const db=fixture(category,20);try{
    session(db,1,20,4);runAllSignalChecks(db,{})
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM equipment_advice WHERE signal_type='max_load_reached'").get().n,0)
    session(db,2,20);session(db,3,20);runAllSignalChecks(db,{})
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM equipment_advice WHERE signal_type='max_load_reached'").get().n,1)
   }finally{db.close()}
  })
 }
 it('les nouvelles migrations conservent les données et sont idempotentes',()=>{
  const db=fixture('kettlebell',16);try{
   session(db,1,16);session(db,2,16);session(db,3,16);runAllSignalChecks(db,{})
   const inventory=db.prepare('SELECT * FROM equipment_item').all(),advice=db.prepare('SELECT * FROM equipment_advice').all()
   migrate(db);assert.deepEqual(db.prepare('SELECT * FROM equipment_item').all(),inventory);assert.deepEqual(db.prepare('SELECT * FROM equipment_advice').all(),advice)
  }finally{db.close()}
 })
})
