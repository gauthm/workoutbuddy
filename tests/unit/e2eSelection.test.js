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
 assert.deepEqual(selectSuites(['README.md','docs/TASKS.md']),[])
 assert.deepEqual(selectSuites(['src/routes/settings.js','public/js/components/settings/AIProviderForm.js']),['settings','data'])
})

test('coach, dashboard and journey changes remain in their domains',()=>{
 assert.deepEqual(selectSuites(['public/js/components/coach/ChatMessage.js']),['coach'])
 assert.deepEqual(selectSuites(['public/js/views/DashboardView.js']),['dashboard'])
 assert.deepEqual(selectSuites(['tests/e2e/exercises.spec.js']),['exercises'])
 assert.deepEqual(selectSuites(['public/js/components/calendar/CalendarView.js']),['programs','sessions','history','dashboard'])
 assert.deepEqual(selectSuites(['public/sw.js']),['updates'])
 assert.deepEqual(selectSuites(['scripts/test-selection.js']),[])
})

import {filterReleaseBump} from '../../scripts/e2e-selection.js'
import {selectNodeTests,NODE_TESTS} from '../../scripts/test-selection.js'
test('cache version alone does not rerun all journeys',()=>{
 const old="const CACHE_NAME = 'workoutbuddy-v81'"
 assert.deepEqual(filterReleaseBump(['public/sw.js','README.md'],()=>old,()=>old.replace('81','82')),['README.md'])
 assert.deepEqual(filterReleaseBump(['public/sw.js'],()=>old,()=>old+'; changed()'),['public/sw.js'])
 assert.deepEqual(filterReleaseBump(['public/sw.js'],()=>{throw Error('missing')},()=>old),['public/sw.js'])
})
test('Node selection: documentation, frontend, transitive imports and explicit file',()=>{
 assert.deepEqual(selectNodeTests(['AGENTS.md','tests/e2e/coach.spec.js']),[])
 assert.deepEqual(selectNodeTests(['public/js/views/DashboardView.js']),[])
 assert.deepEqual(selectNodeTests(['public/js/components/coach/CoachView.js']),['tests/integration/apiExports.test.js'])
 assert.deepEqual(selectNodeTests(['tests/unit/date.test.js']),['tests/unit/date.test.js'])
 assert.ok(selectNodeTests(['src/services/rmCalculator.js']).includes('tests/unit/rmCalculator.test.js'))
 assert.ok(selectNodeTests(['public/js/utils/rm.js']).includes('tests/unit/rmCalculator.test.js'))
 assert.deepEqual(selectNodeTests(['scripts/pre-push.js']),['tests/unit/e2eSelection.test.js'])
})
test('Node selection: API domains and conservative global dependency fallback',()=>{
 const equipment=selectNodeTests(['src/routes/equipment.js'])
 assert.ok(equipment.includes('tests/integration/equipmentEnhancements.test.js'))
 assert.ok(equipment.includes('tests/journeys/app.test.js'))
 assert.ok(!equipment.includes('tests/integration/coachChatPersistence.test.js'))
 assert.ok(!equipment.includes('tests/integration/httpSecurity.test.js'))
 for(const path of ['server.js','src/db/migrations/018_test.sql','src/services/newFeature.js','package.json','tests/helpers/in-process-request.js']) assert.deepEqual(selectNodeTests([path]),NODE_TESTS,path)
})
