async page => {
 page.setDefaultTimeout(4000)
 const errors=[],saves=[],otherWrites=[],tests=[],layouts=[]
 let failNext=false
 const assert=(ok,message)=>{if(!ok)throw Error(message)}
 const onError=e=>errors.push(e.message);page.on('pageerror',onError)
 const settings=await page.evaluate(async()=> (await fetch('/api/v1/settings')).json())
 Object.assign(settings,{unit:'kg',language:'fr',theme:'dark',ai_base_url:'http://saved.test/v1',ai_model:'saved-model',ai_api_key_set:true})
 const identity={display_name:'Alex',sex:'male',date_of_birth:'1991-03-05'}
 const handler=async route=>{
  const req=route.request(),path=new URL(req.url()).pathname
  if(path.endsWith('/test-ai')){tests.push(req.postDataJSON());return route.fulfill({json:{success:true,latency_ms:10}})}
  if(path.endsWith('/save')){
   const body=req.postDataJSON();saves.push(body)
   if(failNext){failNext=false;return route.fulfill({status:400,json:{error:'VALIDATION_ERRORS',details:['Invalid test field']}})}
   const {ai_api_key,...rest}=body.settings;Object.assign(settings,rest);if(ai_api_key)settings.ai_api_key_set=true
   if(body.profile)Object.assign(identity,body.profile)
   return route.fulfill({json:{settings,profile:identity,restart_required:false}})
  }
  if(req.method()!=='GET')otherWrites.push(req.method())
  return route.fulfill({json:settings})
 }
 const profile=route=>route.fulfill({json:identity})
 await page.route('http://workoutbuddy.test/api/v1/settings**',handler)
 await page.route('http://workoutbuddy.test/api/v1/user-profile',profile)
 try {
  await page.goto('http://workoutbuddy.test/#/settings')
  const section=name=>page.locator('.settings-section__toggle').filter({hasText:name})
  await section('Général').waitFor()
  const names=await page.locator('.settings-section__title').allTextContents()
  assert(names.join('|')==='Général|Profil|Séance|Coach IA|Réglages avancés','Incorrect section order')
  const dock=page.locator('.settings-save-dock')
  assert(await dock.count()===0,'Button visible without changes')
  assert(await page.getByRole('button',{name:'Enregistrer',exact:true}).count()===0,'Local button still present')
  await section('Général').click()
  await page.locator('#SettingsView-state-settings-unit').selectOption('lb')
  await dock.waitFor()
  assert(saves.length===0&&otherWrites.length===0,'Sauvegarde automatique')
  assert(await page.evaluate(()=>window.__store.settings.unit)==='kg','Le brouillon modifie le store avant sauvegarde')
  await page.locator('#SettingsView-state-settings-unit').selectOption('kg')
  await dock.waitFor({state:'hidden'})
  await page.locator('#SettingsView-state-settings-unit').selectOption('lb')
  await section('Coach IA').click()
  const key=page.locator('#ai-provider-key')
  assert(await key.inputValue()===''&&await key.getAttribute('placeholder')==='••••••••','Key incorrectly masked')
  await page.locator('#ai-provider-model').fill('new-model')
  await key.fill('ui-fake-key')
  await page.locator('.ai-form').getByRole('button',{name:'Tester la connexion',exact:true}).click();await page.waitForTimeout(100)
  assert(tests.at(-1).ai_model==='new-model'&&saves.length===0,'Test persists draft')
  await section('Profil').click()
  await page.locator('#ProfileSettings-state-form-display_name').fill('Alexandre')
  assert(await page.getByRole('button',{name:'Enregistrer',exact:true}).count()===1,'Multiple save buttons')
  for(const width of [320,390,768,1280]){
   await page.setViewportSize({width,height:844})
   const position=await dock.boundingBox()
   await page.evaluate(()=>window.scrollTo(0,document.body.scrollHeight));await page.waitForTimeout(80)
   const bounds=await dock.boundingBox(),nav=await page.locator('.bottom-nav').boundingBox()
   assert(Math.abs(bounds.y-position.y)<1&&bounds.y+bounds.height<nav.y,'Button not fixed above navigation')
   assert(await dock.evaluate(el=>Number(getComputedStyle(el).zIndex))>10,'Bouton sous le contenu')
   assert(!await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),'Mobile overflow')
   layouts.push(width)
  }
  failNext=true
  await dock.getByRole('button',{name:'Enregistrer',exact:true}).click();await page.waitForTimeout(100)
  assert(await dock.isVisible(),'Draft lost after error')
  const toast=await page.locator('.toast').boundingBox(),bar=await dock.boundingBox()
  assert(toast&&toast.y+toast.height<=bar.y,'Message hides save buttons')
  assert(await page.locator('#ProfileSettings-state-form-display_name').inputValue()==='Alexandre','Profile lost after error')
  await dock.getByRole('button',{name:'Enregistrer',exact:true}).click();await dock.waitFor({state:'hidden'})
  assert(await page.evaluate(()=>window.__store.settings.unit)==='lb','Save does not update store')
  const saved=saves.at(-1)
  assert(saved.settings.unit==='lb'&&saved.settings.ai_model==='new-model'&&saved.settings.ai_api_key==='ui-fake-key'&&saved.profile.display_name==='Alexandre','Incomplete grouped save')
  assert(otherWrites.length===0,'Individual saves still present')
  assert(await key.inputValue()===''&&await key.getAttribute('placeholder')==='••••••••','Key not masked after save')
  await page.locator('#SettingsView-state-settings-unit').selectOption('kg')
  assert(await page.evaluate(()=>window.__store.settings.unit)==='lb','Store follows the draft to cancel')
  await page.locator('#ProfileSettings-state-form-display_name').fill('Unwanted')
  await dock.getByRole('button',{name:'Annuler',exact:true}).click();await dock.waitFor({state:'hidden'})
  assert(await page.locator('#ProfileSettings-state-form-display_name').inputValue()==='Alexandre','Cancel does not restore profile')
  assert(await page.evaluate(()=>window.__store.settings.unit)==='lb','Cancel leaves an edited unit in the store')
  await page.locator('#ai-provider-model').fill('third-model')
  await dock.getByRole('button',{name:'Enregistrer',exact:true}).click();await dock.waitFor({state:'hidden'})
  assert(!Object.hasOwn(saves.at(-1).settings,'ai_api_key'),'Existing key overwritten by an empty field')
  assert(saves.length===3,'Unexpected save count')
  assert(!errors.length,'Erreur JavaScript')
  return {sections:names,conditionalSave:true,groupedSave:true,draftKeptOnError:true,revertAndCancel:true,keyMasked:true,layouts,errors}
 }finally{page.removeListener('pageerror',onError);await page.unroute('http://workoutbuddy.test/api/v1/settings**',handler);await page.unroute('http://workoutbuddy.test/api/v1/user-profile',profile)}
}
