async page => {
  const writes=[],errors=[],assert=(ok,message)=>{if(!ok)throw new Error(message)}
  let profile={display_name:'Alex',sex:'male',date_of_birth:'1990-02-01',fitness_level:'advanced',primary_goal:'hypertrophy',injury_notes:'Retained legacy limitation'}
  page.on('pageerror',e=>errors.push(e.message))
  await page.route('http://workoutbuddy.test/api/v1/**',async route=>{
    const req=route.request(),path=new URL(req.url()).pathname,method=req.method();let body={}
    if(method!=='GET')writes.push({path,method,body:req.postDataJSON()})
    if(path==='/api/v1/settings')body={language:'fr',theme:'dark'}
    else if(path==='/api/v1/user-profile'){
      if(method==='PUT')profile={...profile,...req.postDataJSON()}
      if(method==='DELETE')profile={display_name:null,sex:null,date_of_birth:null}
      body=profile
    } else if(path==='/api/v1/equipment')body={items:[]}
    else if(['/api/v1/reset-stats','/api/v1/reset-all'].includes(path))body={reset:true}
    else return route.fallback()
    return route.fulfill({status:200,json:body})
  })
  await page.setViewportSize({width:390,height:844});await page.goto('http://workoutbuddy.test/#/settings')
  await page.getByRole('button',{name:'Mon profil',exact:true}).click()
  await page.locator('#profile-birth-date').waitFor()
  assert(await page.locator('.profile-settings .setting-row').count()===3,'Only identity fields')
  assert(await page.locator('#ProfileSettings-state-form-prefers_exercise_variation').count()===0,'Variation removed')
  await page.locator('#profile-birth-date').fill('1992-03-04')
  await page.locator('.profile-settings').getByRole('button',{name:'Enregistrer',exact:true}).click()
  await page.waitForTimeout(80)
  assert(Object.keys(writes.at(-1).body).sort().join(',')==='date_of_birth,display_name,sex','Only personal identity saved')
  assert(profile.injury_notes==='Retained legacy limitation'&&profile.primary_goal==='hypertrophy','No legacy training/health overwrite')
  await page.getByRole('button',{name:'Réinitialiser mon profil',exact:true}).click()
  await page.getByRole('dialog').getByRole('button',{name:'Annuler',exact:true}).click()
  assert(writes.filter(w=>w.method==='DELETE').length===0,'Cancel profile reset makes no request')
  await page.getByRole('button',{name:'Données',exact:true}).click()
  await page.getByRole('button',{name:'Réinitialiser stats et historique',exact:true}).click()
  const input=page.getByRole('dialog').locator('input')
  assert(await page.getByRole('dialog').getByRole('button',{name:'Effacer les stats',exact:true}).isDisabled(),'Stats reset requires typed confirmation')
  await input.fill('reset')
  assert(await page.getByRole('dialog').getByRole('button',{name:'Effacer les stats',exact:true}).isDisabled(),'Lowercase confirmation refused')
  await input.fill('RESET');await page.getByRole('dialog').getByRole('button',{name:'Effacer les stats',exact:true}).click()
  await page.waitForTimeout(80)
  assert(writes.filter(w=>w.path==='/api/v1/reset-stats').length===1,'Stats reset endpoint wired')
  await page.waitForTimeout(1400)
  await page.getByRole('button',{name:'Données',exact:true}).click()
  await page.getByRole('button',{name:'Effacer toutes mes données',exact:true}).click()
  await page.getByRole('dialog').getByRole('button',{name:'Annuler',exact:true}).click()
  assert(writes.filter(w=>w.path==='/api/v1/reset-all').length===0,'Cancel full reset makes no request')
  await page.getByRole('button',{name:'Effacer toutes mes données',exact:true}).click()
  await page.getByRole('dialog').getByRole('button',{name:'Effacer toutes mes données',exact:true}).click()
  await page.waitForTimeout(80)
  assert(writes.filter(w=>w.path==='/api/v1/reset-all').length===1,'Full reset uses dedicated endpoint')
  assert(!writes.some(w=>w.path==='/api/v1/import'),'No empty import reset')
  assert(errors.length===0,errors.join('\n'))
  return {checks:['Personal identity only, birth date saved','Profile reset cancellation','Stats typed confirmation and endpoint','Full reset cancellation and dedicated endpoint'],writes,errors}
}
