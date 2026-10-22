async page => {
 page.setDefaultTimeout(4000)
 const errors=[],writes=[],tests=[],lists=[],layouts=[]
 const assert=(ok,message)=>{if(!ok)throw Error(message)}
 const onError=e=>errors.push(e.message);page.on('pageerror',onError)
 const saved=await page.evaluate(async()=> (await fetch('/api/v1/settings')).json())
 Object.assign(saved,{ai_base_url:'http://saved.test/v1',ai_model:'saved-model',ai_api_key_set:true})
 const handler=async route=>{
  const r=route.request(),path=new URL(r.url()).pathname
  if(path.endsWith('/test-ai')){tests.push(r.postDataJSON());return route.fulfill({json:{success:true,latency_ms:10}})}
  if(path.endsWith('/ai-models')){lists.push(r.postDataJSON());return route.fulfill({json:{models:[{id:'listed-model'}]}})}
  if(r.method()==='PUT'){const body=r.postDataJSON();writes.push(body);const {ai_api_key,...rest}=body;Object.assign(saved,rest);if(ai_api_key)saved.ai_api_key_set=true}
  return route.fulfill({json:saved})
 }
 await page.route('http://workoutbuddy.test/api/v1/settings**',handler)
 try {
  await page.goto('http://workoutbuddy.test/#/settings')
  await page.getByRole('button',{name:'Coach IA',exact:true}).filter({has:page.locator('.settings-section__title')}).click()
  const form=page.locator('.ai-form'),key=form.locator('#ai-provider-key')
  assert(await form.getByRole('button',{name:'Enregistrer',exact:true}).count()===1,'Plusieurs boutons Enregistrer')
  assert(await key.getAttribute('type')==='password'&&await key.inputValue()===''&&await key.getAttribute('placeholder')==='••••••••','Configured key incorrectly masked')
  await form.locator('#ai-provider-url').fill('http://draft.test/v1')
  await form.locator('#ai-provider-model').fill('draft-model')
  await key.fill('ui-fake-key')
  await key.press('Tab');await page.waitForTimeout(80)
  assert(writes.length===0,'Autosave still present')
  await form.getByRole('button',{name:/Lister/}).click()
  await form.getByRole('button',{name:'listed-model',exact:true}).click()
  assert(writes.length===0,'Selecting a template saves automatically')
  await form.getByRole('button',{name:'Tester la connexion',exact:true}).click();await page.waitForTimeout(80)
  assert(tests.at(-1).ai_base_url==='http://draft.test/v1'&&tests.at(-1).ai_model==='listed-model'&&tests.at(-1).ai_api_key==='ui-fake-key','Test ignores draft')
  assert(writes.length===0&&lists.length===1,'Test or templates persist draft')
  await form.getByRole('button',{name:'Enregistrer',exact:true}).click();await page.waitForTimeout(100)
  assert(writes.length===1&&Object.keys(writes[0]).sort().join(',')==='ai_api_key,ai_base_url,ai_model','Incorrect grouped save')
  assert(await key.inputValue()===''&&await key.getAttribute('placeholder')==='••••••••','Key not masked after save')
  await form.locator('#ai-provider-model').fill('new-model')
  await form.getByRole('button',{name:'Enregistrer',exact:true}).click();await page.waitForTimeout(100)
  assert(writes.length===2&&!Object.hasOwn(writes[1],'ai_api_key'),'Existing key overwritten with an empty value')
  for(const width of [320,390,768,1280]){
   await page.setViewportSize({width,height:844})
   const layout=await form.locator('.ai-form__actions .btn').evaluateAll(els=>els.map(e=>e.getBoundingClientRect().toJSON()))
   assert(layout[1].left>=layout[0].right&&layout[1].top===layout[0].top,'Save is not to the right of test')
   assert(!await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),'Mobile overflow')
   layouts.push(width)
  }
  assert(!errors.length,'Erreur JavaScript')
  return {singleSave:true,draftTest:true,keyMasked:true,existingKeyPreserved:true,writes:writes.length,layouts,errors}
 }finally{page.removeListener('pageerror',onError);await page.unroute('http://workoutbuddy.test/api/v1/settings**',handler)}
}
