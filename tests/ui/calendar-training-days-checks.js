async page => {
 page.setDefaultTimeout(4000)
 const errors=[],previews=[],sessionRequests=[],layouts=[]
 const assert=(ok,message)=>{if(!ok)throw Error(message)}
 const onError=e=>errors.push(e.message);page.on('pageerror',onError)
 const preview=async route=>{const input=route.request().postDataJSON();previews.push(input);await route.fulfill({json:{name:'Test',...input,templates:[],warnings:[]}})}
 const sessions=async route=>{sessionRequests.push(new URL(route.request().url()).searchParams.toString());await route.fulfill({json:{sessions:[]}})}
 await page.route('http://workoutbuddy.test/api/v1/programs/preview',preview)
 await page.route('http://workoutbuddy.test/api/v1/sessions?*',sessions)
 try {
  await page.goto('http://workoutbuddy.test/#/programs/new')
  const next=page.getByRole('button',{name:'Continuer',exact:true});await next.waitFor()
  await next.click();await next.click()
  const choices=page.locator('.program-wizard__choices')
  assert(await choices.getByRole('checkbox').count()===7,'Sept jours attendus')
  assert(await choices.getByRole('radio').count()===0,'Old numeric choice still present')
  for(const name of ['Lundi','Mercredi','Vendredi'])await page.getByRole('checkbox',{name,exact:true}).uncheck()
  await next.click()
  assert(await page.getByRole('heading',{name:'Quels jours veux-tu t’entraîner ?',exact:true}).isVisible(),'Empty choice accepted')
  for(const name of ['Mardi','Dimanche'])await page.getByRole('checkbox',{name,exact:true}).check()
  for(const width of [320,390,768,1280]){
   await page.setViewportSize({width,height:844})
   assert(!await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),'Day overflow')
   layouts.push(width)
  }
  await next.click()
  for(let step=3;step<7;step++)await next.click()
  await next.click();await page.locator('.program-wizard__review').waitFor()
  assert(JSON.stringify(previews.at(-1).training_days)===JSON.stringify([1,6]),'Days not sent')
  assert(previews.at(-1).days_per_week===2,'Workout count not inferred')
  assert((await page.locator('.program-wizard__review').innerText()).includes('Mardi, Dimanche'),'Days missing from summary')
  await page.goto('http://workoutbuddy.test/#/')
  await page.locator('.calendar-grid').waitFor()
  assert(sessionRequests.some(q=>q.includes('active_program=1')),'Calendar not limited to active program')
  assert(!errors.length,'Erreur JavaScript')
  return {days:[1,6],sessionsPerWeek:2,calendarActiveOnly:true,layouts,errors}
 } finally {page.removeListener('pageerror',onError);await page.unroute('http://workoutbuddy.test/api/v1/programs/preview',preview);await page.unroute('http://workoutbuddy.test/api/v1/sessions?*',sessions)}
}
