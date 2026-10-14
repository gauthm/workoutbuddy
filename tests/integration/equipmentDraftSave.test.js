import { beforeEach, test } from 'node:test'
import assert from 'node:assert/strict'
import request from '../helpers/in-process-request.js'
process.env.DB_PATH=':memory:'
const {getDb}=await import('../../src/db/database.js')
const db=getDb()
const {migrate}=await import('../../src/db/migrate.js')
const {seedExercises}=await import('../../src/seed/seed.js')
migrate(db);seedExercises(db)
const {app}=await import('../../server.js')
const api=request(app)
const list=async()=>(await api.get('/api/v1/equipment')).body.items
const save=body=>api.put('/api/v1/equipment/inventory').send(body)
const fixed={category:'dumbbell_fixed',name:'Fixed',count:2,weight_kg:10}
const band={category:'resistance_band',name:'Band',count:1,resistance_min_kg:5,resistance_max_kg:16}
beforeEach(async()=>{await api.post('/api/v1/reset-all');db.exec('DROP TRIGGER IF EXISTS reject_inventory')})
test('one inventory save adds, modifies and removes items while preserving retained IDs and notes',async()=>{
 const original=(await save({items:[{...fixed,notes:'keep'},band]})).body.items
 const fixedRow=original.find(i=>i.category==='dumbbell_fixed')
 const response=await save({expected:original,items:[{...fixedRow,weight_kg:12},{category:'bench',name:'Bench',count:1},{category:'other',name:'Custom',count:1}]})
 assert.equal(response.status,200)
 assert.equal(response.body.items.length,3)
 assert.equal(response.body.items.find(i=>i.id===fixedRow.id).weight_kg,12)
 assert.equal(response.body.items.find(i=>i.id===fixedRow.id).notes,'keep')
 assert.equal(response.body.items.some(i=>i.category==='resistance_band'),false)
 assert.deepEqual(await list(),response.body.items)
})
test('an invalid draft rejects the entire batch before modifying or removing valid rows',async()=>{
 await save({items:[fixed,band]});const before=await list()
 for(const invalid of [{...fixed,count:0},{...fixed,weight_kg:null},{...band,resistance_max_kg:2},{...fixed,count:1.5},null]) {
  const response=await save({items:[{...before[0],weight_kg:20},invalid]})
  assert.equal(response.status,400);assert.deepEqual(await list(),before)
 }
 assert.equal((await save({items:{}})).status,400)
})
test('unknown or duplicate IDs and a stale baseline cannot overwrite the inventory',async()=>{
 await save({items:[fixed]});const before=await list()
 assert.equal((await save({items:[{...before[0],id:999999}]})).status,409)
 assert.equal((await save({items:[before[0],before[0]]})).status,409)
 assert.equal((await save({expected:[],items:[]})).status,409)
 assert.deepEqual(await list(),before)
})
test('a database error midway through a save rolls back removals and additions',async()=>{
 await save({items:[fixed,band]});const before=await list()
 db.exec("CREATE TRIGGER reject_inventory BEFORE INSERT ON equipment_item WHEN NEW.name='Reject' BEGIN SELECT RAISE(ABORT,'Test rollback'); END;")
 const response=await save({items:[{category:'bench',name:'Bench',count:1},{...fixed,name:'Reject'}]})
 assert.equal(response.status,500)
 assert.deepEqual(await list(),before)
 db.exec('DROP TRIGGER reject_inventory')
 assert.equal((await save({items:[]})).status,200)
 assert.deepEqual(await list(),[])
})
