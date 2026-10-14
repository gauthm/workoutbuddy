async page => {
 page.setDefaultTimeout(4000)
 const errors=[],writes=[];const onError=e=>errors.push(e.message);page.on('pageerror',onError)
 const assert=(ok,message)=>{if(!ok)throw Error(message)}
 const settings=await page.evaluate(async()=> (await fetch('/api/v1/settings')).json())
 settings.painful_muscles=[]
 let fail=false
 const settingsHandler=route=>{
  if(route.request().method()==='PUT') {
   writes.push(route.request().postDataJSON())
   if(fail){fail=false;return route.fulfill({status:500,json:{error:'TEST_FAILURE'}})}
   Object.assign(settings,route.request().postDataJSON())
  }
  return route.fulfill({json:settings})
 }
 const exercisesHandler=route=>route.fulfill({json:{exercises:[
  {id:'safe',name_fr:'Exercice sûr',primary_muscles:['quads'],secondary_muscles:[],equipment_required:[],is_excluded:false},
  {id:'pain',name_fr:'Exercice épaules',primary_muscles:['chest'],secondary_muscles:['shoulders'],equipment_required:[],is_excluded:false}
 ]}})
 const finished={id:900,name:'Programme terminé test',goal:'general_fitness',level:'beginner',days_per_week:2,duration_weeks:1,is_active:true,is_finished:true,ends_on:'2026-10-13',templates:[]}
 const programHandler=route=>route.fulfill({json:finished})
 await page.route('http://workoutbuddy.test/api/v1/settings**',settingsHandler)
 await page.route('http://workoutbuddy.test/api/v1/exercises?**',exercisesHandler)
 await page.route('http://workoutbuddy.test/api/v1/exercises',exercisesHandler)
 await page.route('http://workoutbuddy.test/api/v1/programs/900',programHandler)
 try {
  await page.evaluate(()=>localStorage.setItem('wb_painful_muscles','["shoulders","unknown","shoulders"]'))
  await page.goto('http://workoutbuddy.test/?audit-pain=1#/exercises/pain')
  await page.reload()
  await page.locator('.pain-grid').waitFor()
  assert(writes.length===1 && JSON.stringify(writes[0].painful_muscles)==='["shoulders"]','Migration douleur invalide')
  assert(await page.evaluate(()=>localStorage.getItem('wb_painful_muscles'))===null,'Ancienne préférence non supprimée')
  const shoulders=page.locator('.pain-chip').filter({hasText:'Épaules'}).locator('input')
  assert(await shoulders.isChecked(),'Douleur non restaurée')
  fail=true;await shoulders.uncheck();await page.waitForTimeout(100)
  assert(await shoulders.isChecked(),'Une erreur de sauvegarde perd la préférence')
  assert(await page.evaluate(()=>JSON.stringify(window.__store.settings.painful_muscles))==='["shoulders"]','Store changé après erreur')
  await shoulders.uncheck();await page.waitForTimeout(100)
  assert(settings.painful_muscles.length===0,'Changement non enregistré')
  await shoulders.check();await page.waitForTimeout(100)
  await page.reload();await page.locator('.pain-grid').waitFor()
  assert(await shoulders.isChecked(),'Préférence perdue au rechargement')
  assert(writes.length===4,'Migration répétée après rechargement')
  await page.locator('.exercise-tabs__btn').filter({hasText:'Exercices'}).click()
  await page.getByText('Exercice sûr',{exact:true}).waitFor()
  assert(await page.getByText('Exercice sûr',{exact:true}).count()===1,'Exercice sûr masqué')
  assert(await page.getByText('Exercice épaules',{exact:true}).count()===0,'Muscle secondaire douloureux non filtré')
  await page.goto('http://workoutbuddy.test/#/programs/900')
  const start=page.getByRole('button',{name:'Démarrer une séance',exact:true})
  await page.locator('.program-tag--active').waitFor()
  assert(await page.locator('.program-tag--active').textContent().then(s=>s.trim())==='Terminé','Statut terminé non affiché')
  const primary=page.locator('.btn--primary').filter({hasText:'séance'})
  assert(await primary.isDisabled(),'Séance terminée reste démarrable')
  assert(await page.getByText('Fin du programme : 2026-10-13',{exact:true}).count()===1,'Date de fin absente')
  for (const width of [320,390,768,1280]) {
   await page.setViewportSize({width,height:844})
   assert(!await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),'Débordement de la fiche')
  }
  assert(!errors.length,'Erreur JavaScript')
  return {painMigrated:true,painPersistent:true,errorRollback:true,secondaryMuscleFiltered:true,finishedProgram:true,layouts:[320,390,768,1280],errors}
 } finally {
  page.removeListener('pageerror',onError)
  await page.unroute('http://workoutbuddy.test/api/v1/settings**',settingsHandler)
  await page.unroute('http://workoutbuddy.test/api/v1/exercises?**',exercisesHandler)
  await page.unroute('http://workoutbuddy.test/api/v1/exercises',exercisesHandler)
  await page.unroute('http://workoutbuddy.test/api/v1/programs/900',programHandler)
 }
}
