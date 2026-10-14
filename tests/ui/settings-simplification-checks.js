async page => {
  const checks=[],writes=[],errors=[]
  const assert=(condition,message)=>{if(!condition)throw new Error(message)}
  const settings={unit:'kg',language:'fr',theme:'dark',rm_formula:'epley',network_host:'127.0.0.1',network_port:3000,
    show_rpe_field:false,timer_sound_enabled:true,timer_vibration_enabled:true,ai_api_key_set:false,
    progression_failure_threshold:4,progression_weight_reduction_pct:15,plateau_detection_sessions:6,
    equipment_advice_cooldown_days:20,equipment_advice_max_load_sessions:4,equipment_advice_min_increment_pct:7,
    deload_auto_enabled:false,warmup_sets_count:3,show_rir_field:true,default_rest_seconds:180}
  const internalBefore=JSON.stringify(settings)
  page.on('pageerror',e=>errors.push(e.message))
  await page.route('http://workoutbuddy.test/api/v1/**',async route=>{
    const req=route.request(),path=new URL(req.url()).pathname;let result
    if(path==='/api/v1/settings'){
      if(req.method()==='PUT'){const body=req.postDataJSON();writes.push(body);Object.assign(settings,body)}
      result=settings
    }else if(path==='/api/v1/equipment')result={items:[]}
    else if(path==='/api/v1/user-profile')result={display_name:'Test',sex:null,date_of_birth:null}
    else return route.fallback()
    await route.fulfill({status:200,json:result})
  })
  await page.setViewportSize({width:390,height:844});await page.goto('http://workoutbuddy.test/#/settings');await page.reload()
  const advanced=page.getByRole('button',{name:'Réglages avancés',exact:true})
  await advanced.waitFor()
  assert(await advanced.getAttribute('aria-expanded')==='false','Advanced settings open by default')
  for(const title of ['Signaux matériel','Progression','Deload','Réseau'])assert(await page.getByRole('button',{name:title,exact:true}).count()===0,'Obsolete section: '+title)
  for(const key of ['warmup_sets_count','show_rir_field','default_rest_seconds','linear_increment_kg','linear_dumbbell_increment_kg','bodyweight_display_days',
    'progression_failure_threshold','progression_weight_reduction_pct','plateau_detection_sessions','deload_auto_enabled','deload_min_sets','equipment_advice_cooldown_days'])
    assert(await page.locator('[id="SettingsView-state-settings-'+key+'"]').count()===0,'Obsolete control remains: '+key)
  assert(writes.length===0&&JSON.stringify(settings)===internalBefore,'Opening settings modifies engine configuration')
  await page.getByRole('button',{name:'En séance',exact:true}).click()
  await page.getByLabel('Afficher l’effort ressenti (RPE)',{exact:false}).check()
  await page.waitForFunction(()=>window.__store.settings.show_rpe_field===true)
  assert(writes.length===1&&Object.keys(writes[0]).join(',')==='show_rpe_field','RPE writes unrelated settings')
  await page.getByLabel('Son du timer',{exact:true}).uncheck()
  await page.waitForFunction(()=>window.__store.settings.timer_sound_enabled===false)
  assert(Object.keys(writes[1]).join(',')==='timer_sound_enabled','Timer preference writes unrelated settings')
  assert(settings.progression_failure_threshold===4&&settings.equipment_advice_cooldown_days===20&&settings.warmup_sets_count===3,'Hidden configuration changed')
  checks.push('Obsolete controls removed; engine settings preserved; working session preferences')
  await advanced.click();await page.locator('.rm-formula-help summary').click()
  assert(await page.locator('.rm-formula-help dt').count()===5,'RM explanations missing')
  assert(await page.locator('.setting-row--rm').evaluate(el=>el.getBoundingClientRect().bottom>el.querySelector('summary').getBoundingClientRect().bottom),'RM explanation below separator')
  await page.locator('#SettingsView-state-settings-rm_formula').selectOption('lombardi')
  await page.waitForFunction(()=>window.__store.settings.rm_formula==='lombardi')
  assert(Object.keys(writes[2]).join(',')==='rm_formula','RM selection writes unrelated settings')
  const layouts=[]
  for(const width of [320,390,768,1280])for(const theme of ['dark','light']){
    await page.setViewportSize({width,height:844});await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme)
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)
    assert(!overflow,'Settings overflow at '+width+' '+theme);layouts.push({width,theme})
  }
  checks.push('RM help grouped before separator; advanced controls; eight layouts')
  await page.evaluate(async()=>{const {i18n}=await import('/js/i18n.js');await i18n.setLocale('en')})
  assert(await page.getByRole('button',{name:'Advanced settings',exact:true}).count()===1,'English advanced section missing')
  assert(await page.getByRole('button',{name:'During workouts',exact:true}).count()===1,'English session section missing')
  await page.getByRole('button',{name:'AI advisor',exact:true}).click()
  assert(await page.getByText('Optional conversational advisor setup.',{exact:false}).count()===1,'Advisor optional description missing')
  checks.push('French and English sections, optional advisor clearly described')
  assert(errors.length===0,errors.join('\n'))
  return {checks,layouts:layouts.length,writes,errors}
}
