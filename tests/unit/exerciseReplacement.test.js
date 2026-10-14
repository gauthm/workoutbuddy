import { test } from 'node:test'
import assert from 'node:assert/strict'
import { findSimilarExercises } from '../../src/services/exerciseReplacement.js'

test('bench alternatives retain the movement and main muscle, excluding flyes, duplicates and unavailable paired weights',()=>{
 const base={id:'bench',name_fr:'Développé',category:'strength',primary_muscles:['chest'],movement_pattern:'push_horizontal',mechanic:'compound',force:'push',equipment_required:['barbell'],is_unilateral:0}
 const dumbbell={...base,id:'dumbbell',name_fr:'Haltères',equipment_required:['dumbbell_fixed']}
 const machine={...base,id:'machine',name_fr:'Machine',equipment_required:['chest_press']}
 const candidates=[dumbbell,machine,{...base,id:'fly',mechanic:'isolation'},{...base,id:'row',primary_muscles:['back'],force:'pull'},{...base,id:'overhead',movement_pattern:'push_vertical'},{...base,id:'excluded',is_excluded:1},{...base,id:'duplicate'},{...base,id:'cardio',category:'cardio'}]
 const inventory=[{category:'dumbbell_fixed',count:1,weight_kg:12},{category:'chest_press',count:1}]
 assert.deepEqual(findSimilarExercises(base,candidates,inventory,['duplicate']).map(ex=>ex.id),['machine'])
 inventory.push({category:'dumbbell_adjustable',count:1,weight_min_kg:2,weight_max_kg:20,weight_step_kg:2})
 assert.deepEqual(findSimilarExercises(base,candidates,inventory,['duplicate']).map(ex=>ex.id),['machine'])
 inventory[0].count=2
 assert.deepEqual(new Set(findSimilarExercises(base,candidates,inventory,['duplicate']).map(ex=>ex.id)),new Set(['dumbbell','machine']))
})
