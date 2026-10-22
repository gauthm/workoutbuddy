async page => {
  page.setDefaultTimeout(4000)
  const errors=[], requests=[], layouts=[]
  const assert=(ok,message)=>{if(!ok)throw Error(message)}
  const onError=e=>errors.push(e.message);page.on('pageerror',onError)
  const handler=async route=>{requests.push(new URL(route.request().url()).searchParams.toString());await route.fulfill({json:{exercises:[]}})}
  await page.route('http://workoutbuddy.test/api/v1/exercises?*',handler)
  try {
    await page.goto('http://workoutbuddy.test/#/settings')
    await page.getByRole('button',{name:'Réglages avancés',exact:true}).waitFor()
    assert(await page.getByRole('button',{name:'Données',exact:true}).count()===0,'Data section still at top level')
    assert(await page.getByRole('button',{name:'Coach IA',exact:true}).count()===2,'AI Coach missing from settings or navigation')
    await page.getByRole('button',{name:'Mon profil',exact:true}).click()
    assert(await page.getByRole('button',{name:'Réinitialiser mon profil',exact:true}).count()===0,'Profile reset still displayed')
    const advanced=page.locator('.settings-section').filter({has:page.getByRole('button',{name:'Réglages avancés',exact:true})})
    assert(await advanced.locator('.export-import').count()===1,'Data outside advanced settings')
    await advanced.getByRole('button',{name:'Réglages avancés',exact:true}).click()
    assert(await advanced.locator('.export-import').isVisible(),'Data inaccessible')
    await page.goto('http://workoutbuddy.test/#/exercises')
    const panel=page.locator('.exercise-filter__panel');await panel.waitFor()
    assert(!await panel.evaluate(e=>e.open),'Filters open by default')
    await panel.locator('summary').click()
    assert(await panel.locator('.exercise-filter__rows > *').count()===4,'Filters are not on four rows')
    await page.getByRole('combobox',{name:'Muscle',exact:true}).selectOption('chest')
    await page.getByRole('combobox',{name:'Mouvement',exact:true}).selectOption('push_horizontal')
    await page.getByRole('combobox',{name:'Matériel',exact:true}).selectOption('free_weights')
    await page.getByRole('checkbox',{name:'Réalisables avec mon matériel',exact:true}).check()
    await page.waitForTimeout(150)
    assert(requests.some(q=>['muscle=chest','movement=push_horizontal','equipment_family=free_weights','available=1'].every(s=>q.includes(s))),'Filters not applied')
    await panel.locator('summary').click()
    await page.getByRole('button',{name:'Effacer les filtres',exact:true}).click()
    assert(!await panel.evaluate(e=>e.open),'Effacer ouvre le panneau')
    await panel.locator('summary').click()
    assert(await page.getByRole('combobox',{name:'Muscle',exact:true}).inputValue()==='','Clear does not reset')
    const style=el=>{const s=getComputedStyle(el);return {height:s.height,padding:s.padding,border:s.border,borderRadius:s.borderRadius,background:s.backgroundColor,fontSize:s.fontSize}}
    for(const width of [320,390,768,1280]){
      await page.setViewportSize({width,height:844})
      const rows=await panel.locator('.exercise-filter__rows > *').evaluateAll(els=>els.map(e=>{const r=e.getBoundingClientRect();return {top:r.top,bottom:r.bottom}}))
      assert(rows.every((r,i)=>i===0||r.top>=rows[i-1].bottom),'Filters side by side')
      const exerciseStyle=await page.locator('.exercise-filter .catalog-search input').evaluate(style)
      await page.locator('.exercise-tabs').getByRole('button',{name:'Matériel',exact:true}).click()
      await page.locator('.equipment-editor').waitFor()
      const materialStyle=await page.locator('.equipment-editor .catalog-search input').evaluate(style)
      assert(JSON.stringify(exerciseStyle)===JSON.stringify(materialStyle),'Different search styling')
      assert(!await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),'Mobile overflow')
      layouts.push(width)
      await page.locator('.exercise-tabs').getByRole('button',{name:'Exercices',exact:true}).click()
      await panel.waitFor();if(!await panel.evaluate(e=>e.open))await panel.locator('summary').click()
    }
    assert(!errors.length,'Erreur JavaScript')
    return {dataInAdvanced:true,profileResetRemoved:true,filterRows:4,searchDesignIdentical:true,layouts,errors}
  } finally {page.removeListener('pageerror',onError);await page.unroute('http://workoutbuddy.test/api/v1/exercises?*',handler)}
}
