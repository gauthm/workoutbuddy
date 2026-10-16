// A shared dependency or an unknown source file triggers the complete suite.
export const SUITES=['programs','sessions','history','equipment','settings','data','exercises','stats','motion','security','updates','theme','dashboard','coach']
const rules=[
 [/^public\/js\/components\/coach\//,['coach']],
 [/^src\/routes\/ai\.js$|^src\/services\/(?:aiProvider|aiActions|coachChat|chatHistory|systemPromptBuilder)/,['coach','settings']],
 [/^public\/js\/views\/DashboardView\.js$/,['dashboard']],
 [/^public\/js\/utils\/screenWakeLock\.js$/,['settings']],
 [/^public\/js\/components\/exercises\/(?:ExerciseMotion|ExerciseDetailView)\.js$/,['exercises','sessions','motion']],
 [/^public\/js\/components\/session\/(?:ExerciseHelp|ExerciseBlock)\.js$/,['sessions','motion']],
 [/^src\/routes\/(?:programs|templates)\.js$|^src\/services\/program(?:Generator|Planner|ExerciseCatalog|Lifecycle|WeeklyProgress)\.js$|^public\/js\/(?:components\/programs\/|utils\/programMuscles)/,['programs','sessions','history']],
 [/^src\/routes\/(?:sessions|sets)\.js$|^public\/js\/(?:components\/session\/|timer-worker)|^src\/services\/(?:progressionEngine|exerciseProgression|firstTimeSuggestion|warmup|deloadEngine|programReview|plateauDetector|rmCalculator|personalRecords)\.js$/,['sessions','history','data','stats']],
 [/^src\/services\/(?:sessionScheduler|date)\.js$|^public\/js\/components\/calendar\//,['programs','sessions','history','dashboard']],
 [/^src\/routes\/equipment\.js$|^src\/services\/(?:equipmentCalc|rotationEngine|exerciseEquipment)\.js$|^public\/js\/components\/equipment\//,['equipment','programs','sessions','exercises']],
 [/^src\/routes\/exercises\.js$|^src\/services\/(?:exerciseReplacement|exerciseConstraints|catalogueCleanup)\.js$|^public\/js\/components\/exercises\//,['exercises','programs','sessions']],
 [/^src\/routes\/userProfile\.js$|^public\/js\/components\/settings\/ProfileSettings\.js$/,['settings','programs','data']],
 [/^src\/routes\/exportImport\.js$|^public\/js\/components\/settings\/ExportImport\.js$/,['data','history','sessions','equipment','settings']],
 [/^src\/routes\/settings\.js$|^public\/js\/components\/settings\//,['settings','data']],
 [/^src\/routes\/(?:stats|bodyweight)\.js$|^src\/services\/streakCalculator\.js$|^public\/js\/components\/stats\//,['stats','sessions','history']],
]
export function selectSuites(paths){
 const selected=new Set()
 for(const path of paths){
  if(/\.md$|^docs\/|^tests\/(?:unit|integration|journeys)\/|^\.gitignore$/.test(path))continue
  const spec=path.match(/^tests\/e2e\/([a-z]+)\.spec\.js$/)
  if(spec && SUITES.includes(spec[1])){selected.add(spec[1]);continue}
  if(/^scripts\/(?:test-selection|e2e-selection|test-affected|test-e2e-affected|pre-push)\.js$/.test(path))continue
  if(path==='public/sw.js'){selected.add('updates');continue}
  const rule=rules.find(([re])=>re.test(path))
  if(!rule)return [...SUITES]
  rule[1].forEach(s=>selected.add(s))
 }
 return SUITES.filter(s=>selected.has(s))
}

// A release-number-only bump does not change service-worker behavior.
// Missing Git content stays conservative (the updates suite will run).
export function filterReleaseBump(paths, before, after) {
 return paths.filter(path=>{
  if(path!=='public/sw.js')return true
  try{
   const old=before(path),current=after(path)
   const normalize=s=>s.replace(/workoutbuddy-v\d+/, 'workoutbuddy-vN')
   return !old || !current || normalize(old)!==normalize(current)
  }catch{return true}
 })
}
