async page => {
 page.setDefaultTimeout(4000)
 const errors=[],writes=[],layouts=[]
 const assert=(ok,message)=>{if(!ok)throw Error(message)}
 const onError=e=>errors.push(e.message);page.on('pageerror',onError)
 const program={id:900,name:'Test modification',goal:'general_fitness',level:'beginner',days_per_week:2,duration_weeks:8,is_active:false,templates:[],plan:{parameters:{session_duration_min:45,duration_weeks:8,training_days:[0,3]},warnings:[]}}
 const handler=async route=>{
  if(route.request().method()==='PUT'){const body=route.request().postDataJSON();writes.push(body);program.duration_weeks=body.duration_weeks;Object.assign(program.plan.parameters,body)}
  return route.fulfill({json:program})
 }
 await page.route('http://workoutbuddy.test/api/v1/programs/900',handler)
 try {
  await page.goto('http://workoutbuddy.test/#/programs/900')
  const edit=page.getByRole('button',{name:'Modifier le programme',exact:true});await edit.click()
  let dialog=page.getByRole('dialog')
  const save=()=>dialog.getByRole('button',{name:'Enregistrer',exact:true})
  assert(await dialog.getByRole('checkbox').count()===8,'Days missing from form')
  assert(await dialog.getByRole('spinbutton').count()===1&&await dialog.getByRole('combobox').count()===0,'Parameters other than days/duration are editable')
  await dialog.getByRole('checkbox',{name:'Lundi',exact:true}).uncheck()
  assert(await save().isDisabled(),'One day accepted for a two-day program')
  await dialog.getByRole('checkbox',{name:'Mardi',exact:true}).check()
  assert(await save().isEnabled(),'Two days rejected')
  await dialog.getByRole('checkbox',{name:'Dimanche',exact:true}).check()
  assert(await save().isDisabled(),'Three days accepted for a two-day program')
  await dialog.getByRole('checkbox',{name:'Jeudi',exact:true}).uncheck()
  await dialog.getByRole('checkbox',{name:'Durée illimitée',exact:true}).check()
  for(const width of [320,390,768,1280]){
   await page.setViewportSize({width,height:844})
   assert(!await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),'Mobile overflow')
   const contained=await dialog.locator('.program-edit-days label').evaluateAll(els=>els.every(e=>e.querySelector('span').getBoundingClientRect().right<=e.getBoundingClientRect().right))
   assert(contained,'Day name exceeds its cell');layouts.push(width)
  }
  await save().click();await dialog.waitFor({state:'hidden'})
  assert(JSON.stringify(writes[0])===JSON.stringify({duration_weeks:null,training_days:[1,6]}),'Incorrect fields sent')
  assert(await page.getByText('Mardi, Dimanche',{exact:true}).isVisible(),'Days not updated')
  assert(await page.getByText('Durée illimitée',{exact:true}).isVisible(),'Duration not updated')
  for(const label of ['Forme générale','Débutant','2j/sem','45 minutes'])assert(await page.getByText(label,{exact:true}).isVisible(),'Fixed parameter changed')
  await edit.click();dialog=page.getByRole('dialog')
  await dialog.getByRole('checkbox',{name:'Mardi',exact:true}).uncheck()
  await dialog.getByRole('button',{name:'Annuler',exact:true}).click()
  assert(writes.length===1,'Cancellation writes data')
  await edit.click();dialog=page.getByRole('dialog')
  assert(await dialog.getByRole('checkbox',{name:'Mardi',exact:true}).isChecked(),'Cancellation does not restore days')
  await dialog.getByRole('checkbox',{name:'Durée illimitée',exact:true}).uncheck()
  await dialog.getByLabel('Durée totale (semaines)',{exact:true}).fill('12')
  await save().click();await dialog.waitFor({state:'hidden'})
  assert(writes[1].duration_weeks===12&&writes[1].training_days.length===2,'Invalid combined save')
  assert(!errors.length,'Erreur JavaScript')
  return {exactDayCountEnforced:true,onlyDaysAndDurationEditable:true,trainingChoicesPreserved:true,cancelPreserved:true,layouts,errors}
 }finally{page.removeListener('pageerror',onError);await page.unroute('http://workoutbuddy.test/api/v1/programs/900',handler)}
}
