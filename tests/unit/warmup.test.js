import {it} from 'node:test'
import assert from 'node:assert/strict'
import {warmupLoads} from '../../public/js/utils/warmup.js'
it('l’échauffement propose seulement des charges possédées, croissantes et inférieures à la cible',()=>{
 assert.deepEqual(warmupLoads(50,[50,10,20,30,40,20]),[20,30])
 assert.deepEqual(warmupLoads(25,[20,25]),[20])
})
it('aucune charge fictive lorsque l’inventaire manque ou ne contient rien de plus léger',()=>{
 assert.deepEqual(warmupLoads(20,[]),[])
 assert.deepEqual(warmupLoads(20,[20,25]),[])
 assert.deepEqual(warmupLoads(0,[5,10]),[])
})
it('ne traite pas la résistance variable d’un élastique comme une charge fixe',()=>{
 assert.deepEqual(warmupLoads(16,[5,16],['resistance_band']),[])
})
