import {it} from 'node:test'
import assert from 'node:assert/strict'
import {warmupLoads} from '../../public/js/utils/warmup.js'
it('warm-up proposes only owned weights, increasing and below target',()=>{
 assert.deepEqual(warmupLoads(50,[50,10,20,30,40,20]),[20,30])
 assert.deepEqual(warmupLoads(25,[20,25]),[20])
})
it('no fictitious weight when inventory is missing or contains no lighter weight',()=>{
 assert.deepEqual(warmupLoads(20,[]),[])
 assert.deepEqual(warmupLoads(20,[20,25]),[])
 assert.deepEqual(warmupLoads(0,[5,10]),[])
})
it('does not treat variable band resistance as a fixed load',()=>{
 assert.deepEqual(warmupLoads(16,[5,16],['resistance_band']),[])
})
