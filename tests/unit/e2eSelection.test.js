import{test}from'node:test'
import assert from'node:assert/strict'
import{selectSuites,SUITES}from'../../scripts/e2e-selection.js'
test('browser selection includes dependent session/history cases for progression changes',()=>{
 assert.deepEqual(selectSuites(['src/services/progressionEngine.js']),['sessions','history','data','stats'])
 assert.deepEqual(selectSuites(['src/routes/equipment.js']),['programs','sessions','equipment','exercises'])
 assert.deepEqual(selectSuites(['public/js/components/exercises/ExerciseMotion.js']),['sessions','exercises','motion'])
})
test('shared and unknown application dependencies cannot silently skip browser coverage',()=>{
 for(const file of ['server.js','src/db/migrations/017_example.sql','public/js/api.js','public/css/components.css','src/services/newFeature.js','tests/e2e/helpers.js'])assert.deepEqual(selectSuites([file]),SUITES,file)
})
test('docs alone select no browser tests and several domains combine without duplicates',()=>{
 assert.deepEqual(selectSuites(['README.md','TASKS.md']),[])
 assert.deepEqual(selectSuites(['src/routes/settings.js','public/js/components/settings/AIProviderForm.js']),['settings','data'])
})
