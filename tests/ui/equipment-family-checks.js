async page => {
  page.setDefaultTimeout(4000)
  const errors=[], items=[], writes=[], requests=[], layouts=[]
  const assert=(ok,message)=>{if(!ok)throw Error(message)}
  const onError=e=>errors.push(e.message)
  page.on('pageerror',onError)
  const equipment=async route=>{
    const method=route.request().method()
    if(method==='GET')return route.fulfill({json:{items}})
    const data=route.request().postDataJSON(); writes.push({method,data})
    if(new URL(route.request().url()).pathname.endsWith('/inventory')){const saved=data.items.map((item,index)=>({...item,id:item.id||index+1}));items.splice(0,items.length,...saved);return route.fulfill({json:{items}})}
    if(method==='POST'){const item={id:items.length+1,...data};items.push(item);return route.fulfill({status:201,json:item})}
    const id=Number(new URL(route.request().url()).pathname.split('/').at(-1))
    if(method==='DELETE'){items.splice(items.findIndex(i=>i.id===id),1);return route.fulfill({status:204,body:''})}
    const i=items.findIndex(item=>item.id===id);items[i]={...items[i],...data};return route.fulfill({json:items[i]})
  }
  const exercises=async route=>{requests.push(new URL(route.request().url()).searchParams.toString());return route.fulfill({json:{exercises:[]}})}
  await page.route('http://workoutbuddy.test/api/v1/equipment**',equipment)
  await page.route('http://workoutbuddy.test/api/v1/exercises?*',exercises)
  try {
    await page.goto('http://workoutbuddy.test/#/equipment')
    await page.reload()
    await page.locator('.inventory-family').first().waitFor()
    assert(await page.locator('.inventory-family').count()===8,'8 familles attendues')
    assert(await page.locator('.inventory-family[open]').count()===0,'Families open at startup')
    const open=async id=>{const el=page.locator(`[data-family="${id}"]`);if(!await el.evaluate(e=>e.open))await el.locator('summary').evaluate(e=>e.click())}
    await open('free_weights')
    const kb=page.locator('[data-category="kettlebell"]')
    await kb.getByRole('button',{name:/Ajouter une ligne/}).click()
    const row=kb.locator('.dumbbell-row')
    await row.locator('input').nth(0).fill('2');await row.locator('input').nth(1).fill('16')
    // Save a draft in a collapsed family, then restore it using search.
    await page.locator('[data-family="free_weights"] > summary').evaluate(e=>e.click())
    await page.locator('.equipment-editor .settings-save-dock').getByRole('button',{name:'Enregistrer',exact:true}).click()
    await page.waitForTimeout(150)
    assert(items.some(i=>i.category==='kettlebell'&&i.count===2&&i.weight_kg===16),'Closed draft not saved')
    assert((await page.locator('[data-family="free_weights"] > summary').innerText()).includes('1 équipement renseigné'),'Incorrect summary')
    const search=page.getByRole('searchbox',{name:'Rechercher du matériel…'})
    await search.fill('elastiques');await page.waitForTimeout(80)
    assert(await page.locator('.inventory-family:visible').count()===1,'Incorrect accent-insensitive search')
    await search.fill('presse');await page.waitForTimeout(80)
    assert((await page.locator('.inventory-checkbox:visible').allTextContents()).every(s=>s.toLowerCase().includes('presse')),'Search returns too many checkboxes')
    await page.getByRole('checkbox',{name:'Presse à cuisses',exact:true}).check();await page.waitForTimeout(100)
    assert(!items.some(i=>i.category==='leg_press'),'Checkbox saved before confirmation')
    await page.locator('.equipment-editor .settings-save-dock').getByRole('button',{name:'Enregistrer',exact:true}).click();await page.locator('.equipment-editor .settings-save-dock').waitFor({state:'hidden'})
    assert(items.some(i=>i.category==='leg_press'),'Checkbox not saved')
    await search.fill('aucun-resultat');await page.waitForTimeout(80)
    assert(await page.getByText('Aucun matériel ne correspond à cette recherche.',{exact:true}).isVisible(),'Empty state missing')
    await search.fill('')
    await page.getByRole('button',{name:'Ajouter un équipement personnalisé',exact:true}).click()
    const dialog=page.getByRole('dialog');await dialog.getByLabel('Nom',{exact:true}).fill('Mon accessoire')
    await dialog.getByRole('button',{name:'Enregistrer',exact:true}).click();await dialog.waitFor({state:'hidden'})
    await page.locator('.equipment-editor .settings-save-dock').getByRole('button',{name:'Enregistrer',exact:true}).click();await page.locator('.equipment-editor .settings-save-dock').waitFor({state:'hidden'})
    assert(await page.locator('[data-family="custom"]').getByRole('checkbox',{name:'Mon accessoire',exact:true}).count()===1,'Custom equipment misclassified')
    assert(await page.locator('[data-family="specialized"]').getByRole('checkbox',{name:'Mon accessoire',exact:true}).count()===0,'Custom equipment in Strongman')
    for(const hash of ['#/equipment','#/exercises/material']){
      await page.evaluate(hash=>location.hash=hash,hash);await page.waitForTimeout(100)

      await page.locator('.inventory-family').first().waitFor()
      for(const summary of await page.locator('.inventory-family > summary').all())await summary.evaluate(e=>{if(!e.parentElement.open)e.click()})
      for(const width of [320,390,768,1280])for(const theme of ['light','dark']){
        await page.setViewportSize({width,height:844});await page.evaluate(t=>document.documentElement.dataset.theme=t,theme)
        layouts.push(await page.evaluate(()=>({width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth})))
      }
      assert(await page.locator('[data-family="custom"]').getByRole('checkbox',{name:'Mon accessoire',exact:true}).count()===1,'Different inventory between views')
    }
    await page.evaluate(()=>location.hash='#/exercises');await page.locator('.exercise-filter').waitFor()
    await page.locator('.exercise-filter__panel > summary').click()
    const family=page.getByRole('combobox',{name:'Matériel',exact:true})
    assert(await family.locator('option').count()===10,'Families missing from exercises')
    await family.selectOption('machines');await page.waitForTimeout(100)
    await page.getByRole('checkbox',{name:'Réalisables avec mon matériel',exact:true}).check();await page.waitForTimeout(100)
    assert(requests.some(q=>q.includes('equipment_family=machines')&&q.includes('available=1')),'Filters not sent')
    await page.getByRole('button',{name:/Réinitialiser|Effacer/}).click();await page.waitForTimeout(100)
    assert(await family.inputValue()===''&&!await page.getByRole('checkbox',{name:'Réalisables avec mon matériel',exact:true}).isChecked(),'Filters not reset')
    assert(layouts.every(l=>!l.overflow),'Overflow')
    assert(!errors.length,'Erreur JavaScript: '+errors.join(', '))
    return {families:8,layouts:layouts.length,writes:writes.length,requests,errors}
  } finally {
    page.removeListener('pageerror',onError)
    await page.unroute('http://workoutbuddy.test/api/v1/equipment**',equipment)
    await page.unroute('http://workoutbuddy.test/api/v1/exercises?*',exercises)
  }
}
