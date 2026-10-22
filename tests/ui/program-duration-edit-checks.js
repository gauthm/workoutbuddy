async page => {
 page.setDefaultTimeout(4000)
 const errors=[],writes=[]
 const assert=(ok,message)=>{if(!ok)throw Error(message)}
 const onError=e=>errors.push(e.message);page.on('pageerror',onError)
 const original={id:900,name:'Duration test',goal:'general_fitness',level:'beginner',days_per_week:2,duration_weeks:8,is_active:false,templates:[],plan:{parameters:{session_duration_min:45,duration_weeks:8},warnings:[]}}
 const program=structuredClone(original)
 const handler=async route=>{if(route.request().method()==='GET')return route.fulfill({json:program});const data=route.request().postDataJSON();writes.push(data);Object.assign(program,data);return route.fulfill({json:{...program,plan:undefined,templates:undefined}})}
 await page.route('http://workoutbuddy.test/api/v1/programs/900',handler)
 try {
  await page.goto('http://workoutbuddy.test/#/programs/900')
  const edit=page.getByRole('button',{name:'Modifier la durée du programme',exact:true});await edit.click()
  let dialog=page.getByRole('dialog')
  assert(await dialog.getByRole('combobox').count()===0,'Inconsistent settings present')
  assert(await dialog.locator('input').count()===2,'Fields other than duration present')
  await dialog.getByLabel('Durée totale (semaines)',{exact:true}).fill('16')
  await dialog.getByRole('button',{name:'Enregistrer',exact:true}).click();await dialog.waitFor({state:'hidden'})
  assert(JSON.stringify(writes.at(-1))===JSON.stringify({duration_weeks:16}),'Additional fields sent')
  assert(await page.getByText('16 semaines',{exact:true}).isVisible(),'Duration not updated')
  await edit.click();dialog=page.getByRole('dialog')
  await dialog.getByRole('checkbox',{name:'Durée illimitée',exact:true}).check()
  await dialog.getByRole('button',{name:'Enregistrer',exact:true}).click();await dialog.waitFor({state:'hidden'})
  assert(writes.at(-1).duration_weeks===null,'Unlimited duration not saved')
  assert(await page.getByText('Durée illimitée',{exact:true}).isVisible(),'Unlimited duration not displayed')
  await edit.click();dialog=page.getByRole('dialog');await dialog.getByRole('checkbox',{name:'Durée illimitée',exact:true}).uncheck()
  await dialog.getByLabel('Durée totale (semaines)',{exact:true}).fill('0')
  assert(await dialog.getByRole('button',{name:'Enregistrer',exact:true}).isDisabled(),'Zero duration accepted')
  await dialog.getByRole('button',{name:'Annuler',exact:true}).click()
  assert(writes.length===2,'Cancellation writes data')
  for(const label of ['Forme générale','Débutant','2j/sem','45 minutes'])assert(await page.getByText(label,{exact:true}).isVisible(),'Initial parameter changed: '+label)
  assert(!errors.length,'Erreur JavaScript')
  return {writes,trainingChoicesPreserved:true,invalidDurationBlocked:true,cancelPreserved:true,errors}
 } finally {page.removeListener('pageerror',onError);await page.unroute('http://workoutbuddy.test/api/v1/programs/900',handler)}
}
