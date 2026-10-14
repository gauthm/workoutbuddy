async page => {
 page.setDefaultTimeout(4000)
 const errors=[],writes=[],layouts=[];let fail=false,empty=false,locked=false
 const assert=(ok,message)=>{if(!ok)throw Error(message)}
 const onError=e=>errors.push(e.message);page.on('pageerror',onError)
 const exercise={id:901,workout_template_id:902,exercise_id:'barbell_bench_press_medium_grip',name_fr:'Développé couché barre',target_sets:3,target_reps_min:8,target_reps_max:12,rest_seconds:90}
 const template={id:902,name:'Séance A',is_in_progress:false,exercises:[exercise]}
 const program={id:900,name:'Programme test',goal:'general_fitness',level:'beginner',days_per_week:2,duration_weeks:8,is_active:false,templates:[template],plan:{parameters:{session_duration_min:45,duration_weeks:8,training_days:[0,3]},warnings:[]}}
 const options=[{id:'dumbbell_bench_press',name_fr:'Développé couché haltères',name_en:'Dumbbell bench press',primary_muscles:['chest'],equipment_required:['dumbbell_fixed','bench'],has_history:true},{id:'pushups',name_fr:'Pompes',name_en:'Push-ups',primary_muscles:['chest'],equipment_required:[],has_history:false}]
 const programHandler=route=>{template.is_in_progress=locked;return route.fulfill({json:program})}
 const choices=route=>route.fulfill({json:{exercise_id:exercise.exercise_id,alternatives:empty?[]:options}})
 const replace=async route=>{
  const body=route.request().postDataJSON();writes.push(body)
  if(fail){fail=false;return route.fulfill({status:409,json:{error:'EXERCISE_CHANGED'}})}
  const selected=options.find(ex=>ex.id===body.exercise_id);Object.assign(exercise,{exercise_id:selected.id,name_fr:selected.name_fr,name_en:selected.name_en});return route.fulfill({json:exercise})
 }
 await page.route('http://workoutbuddy.test/api/v1/programs/900',programHandler)
 await page.route('http://workoutbuddy.test/api/v1/template-exercises/901/alternatives',choices)
 await page.route('http://workoutbuddy.test/api/v1/template-exercises/901/replace',replace)
 try {
  await page.goto('http://workoutbuddy.test/#/programs/900')
  const row=page.locator('.template-block__exercise--editable')
  await row.getByRole('button',{name:'Remplacer Développé couché barre',exact:true}).click()
  let dialog=page.getByRole('dialog');await dialog.getByRole('radio').first().waitFor()
  assert(await dialog.getByText('Déjà pratiqué : progression conservée',{exact:true}).isVisible(),'Historique non signalé')
  assert(await dialog.getByRole('button',{name:'Remplacer',exact:true}).isDisabled(),'Remplacement autorisé sans sélection')
  await dialog.getByRole('searchbox').fill('halteres')
  assert(await dialog.getByRole('radio').count()===1,'Recherche sans accents incorrecte')
  await dialog.getByRole('radio').check()
  await dialog.getByRole('button',{name:'Annuler',exact:true}).click()
  assert(writes.length===0,'Annulation modifie le programme')
  await row.getByRole('button').click();dialog=page.getByRole('dialog');await dialog.getByRole('radio').first().waitFor()
  await dialog.getByRole('radio').first().check()
  for(const width of [320,390,768,1280]){
   await page.setViewportSize({width,height:844})
   assert(!await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),'Débordement mobile')
   layouts.push(width)
  }
  fail=true
  await dialog.getByRole('button',{name:'Remplacer',exact:true}).click();await page.waitForTimeout(100)
  assert(await dialog.isVisible()&&(await row.innerText()).includes('Développé couché barre'),'Échec modifie le programme')
  await dialog.getByRole('button',{name:'Remplacer',exact:true}).click();await dialog.waitFor({state:'hidden'})
  assert((await row.innerText()).includes('Développé couché haltères'),'Remplacement non affiché')
  assert(writes[1].expected_exercise_id==='barbell_bench_press_medium_grip'&&writes[1].exercise_id==='dumbbell_bench_press','Payload incorrect')
  assert((await row.innerText()).includes('3×8–12'),'Prescription modifiée')
  empty=true
  await row.getByRole('button').click();dialog=page.getByRole('dialog')
  await dialog.getByText('Aucune alternative similaire compatible avec ton matériel et tes zones douloureuses.',{exact:true}).waitFor()
  assert(await dialog.getByRole('button',{name:'Remplacer',exact:true}).isDisabled(),'Liste vide permet remplacer')
  await dialog.getByRole('button',{name:'Annuler',exact:true}).click()
  locked=true;await page.reload();await row.waitFor()
  assert(await row.getByRole('button').isDisabled(),'Séance lancée encore modifiable')
  assert(!errors.length,'Erreur JavaScript')
  return {similarAlternatives:true,search:true,historyBadge:true,cancelPreserved:true,errorPreserved:true,futureReplacement:true,lockedDuringWorkout:true,layouts,errors}
 }finally{page.removeListener('pageerror',onError);await page.unroute('http://workoutbuddy.test/api/v1/programs/900',programHandler);await page.unroute('http://workoutbuddy.test/api/v1/template-exercises/901/alternatives',choices);await page.unroute('http://workoutbuddy.test/api/v1/template-exercises/901/replace',replace)}
}
