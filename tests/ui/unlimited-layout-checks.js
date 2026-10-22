async page => {
 page.setDefaultTimeout(4000)
 const errors=[],layouts=[],previews=[]
 const assert=(ok,message)=>{if(!ok)throw Error(message)}
 const onError=e=>errors.push(e.message);page.on('pageerror',onError)
 const handler=async route=>{const input=route.request().postDataJSON();previews.push(input);await route.fulfill({json:{name:'Test',...input,templates:[],warnings:[]}})}
 await page.route('http://workoutbuddy.test/api/v1/programs/preview',handler)
 try {
  await page.goto('http://workoutbuddy.test/#/exercises');await page.locator('.exercise-filter').waitFor()
  assert(await page.locator('.exercise-filter__panel > summary').innerText()==='Filtres','Incorrect panel name')
  const bounds=()=>{const r=[...document.querySelectorAll('.catalog-search')].find(e=>e.offsetParent).getBoundingClientRect();const t=document.querySelector('.exercise-tabs').getBoundingClientRect();return {left:r.left,right:document.documentElement.clientWidth-r.right,gap:r.top-t.bottom}}
  for(const width of [320,390,768,1280]){
   await page.setViewportSize({width,height:844})
   const exercise=await page.evaluate(bounds)
   await page.locator('.exercise-tabs').getByRole('button',{name:'Matériel',exact:true}).click();await page.locator('.equipment-editor').waitFor()
   const material=await page.evaluate(bounds)
   assert(exercise.left===material.left&&exercise.right===material.right&&exercise.gap===material.gap,'Different search spacing')
   layouts.push({width,gap:material.gap})
   await page.locator('.exercise-tabs').getByRole('button',{name:'Exercices',exact:true}).click();await page.locator('.exercise-filter').waitFor()
  }
  await page.goto('http://workoutbuddy.test/#/settings');await page.getByRole('button',{name:'Réglages avancés',exact:true}).click()
  assert(await page.locator('.settings-advanced-card').count()===3,'Advanced blocks missing')
  for(const width of [320,390,768,1280]){
   await page.setViewportSize({width,height:844})
   assert(!await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),'Advanced settings overflow')
  }
  await page.goto('http://workoutbuddy.test/#/programs/new');await page.getByRole('button',{name:'Continuer',exact:true}).waitFor()
  for(let step=0;step<7;step++)await page.getByRole('button',{name:'Continuer',exact:true}).click()
  const unlimited=page.getByRole('radio',{name:'Durée illimitée',exact:true});await unlimited.check()
  assert(await unlimited.isChecked(),'Unlimited duration not selected')
  await page.getByRole('button',{name:'Continuer',exact:true}).click();await page.locator('.program-wizard__review').waitFor()
  assert(previews.at(-1).duration_weeks===null,'Unlimited duration not sent as null')
  assert((await page.locator('.program-wizard__review').innerText()).includes('Durée illimitée'),'Duration missing from summary')
  assert(!errors.length,'Erreur JavaScript')
  return {layouts,advancedCards:3,unlimitedPreview:true,errors}
 } finally {page.removeListener('pageerror',onError);await page.unroute('http://workoutbuddy.test/api/v1/programs/preview',handler)}
}
