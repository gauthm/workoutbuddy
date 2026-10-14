async page => {
 const errors=[],layouts=[];const errorHandler=e=>errors.push(e.message)
 page.on('pageerror',errorHandler);page.setDefaultTimeout(4000)
 const assert=(ok,message)=>{if(!ok)throw Error(message)}
 let complete=true
 const program={id:900,name:'Programme test',goal:'general_fitness',level:'beginner',is_active:true,is_finished:false,duration_weeks:null,days_per_week:2,templates:[]}
 const handler=route=>{
  program.weekly_progress={completed_sessions:complete?2:1,target_sessions:2,is_complete:complete}
  return route.fulfill({json:new URL(route.request().url()).pathname.endsWith('/900')?program:{programs:[program]}})
 }
 await page.route('http://workoutbuddy.test/api/v1/programs**',handler)
 try {
  await page.goto('http://workoutbuddy.test/?weekly-test=1#/')
  await page.locator('.weekly-complete').waitFor()
  assert((await page.locator('.weekly-complete').textContent()).includes('Toutes les séances de la semaine sont faites'),'Message absent sur accueil')
  for(const width of [320,390,768,1280]) {
   await page.setViewportSize({width,height:844})
   assert(!await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),'Débordement mobile')
   layouts.push(width)
  }
  await page.goto('http://workoutbuddy.test/?weekly-test=1#/programs/900')
  await page.locator('.weekly-complete').waitFor()
  assert(await page.locator('.btn--primary').filter({hasText:'séance'}).isEnabled(),'Limite de séances ajoutée sans demande')
  complete=false;await page.reload()
  await page.locator('.program-summary-tags').first().waitFor()
  assert(await page.locator('.weekly-complete').count()===0,'Message présent avant objectif atteint')
  await page.goto('http://workoutbuddy.test/?weekly-test=1#/')
  await page.locator('.dashboard-program').waitFor()
  assert(await page.locator('.weekly-complete').count()===0,'Message incorrect sur accueil')
  assert(!errors.length,'Erreur JavaScript')
  return {homeAndProgram:true,onlyAfterCompletion:true,noExtraLimit:true,layouts,errors}
 } finally {page.removeListener('pageerror',errorHandler);await page.unroute('http://workoutbuddy.test/api/v1/programs**',handler)}
}
