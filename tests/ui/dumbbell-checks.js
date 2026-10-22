async (page) => {
  page.setDefaultTimeout(4000)
  const items = [
    {id:1,category:'dumbbell_fixed',name:'Ancien nom',count:2,weight_kg:10,notes:'catalog:dumbbell_fixed'},
    {id:2,category:'dumbbell_loadable',name:'Poignées',count:3,weight_kg:2.5,notes:'catalog:dumbbell_loadable'},
    {id:3,category:'dumbbell_plate',name:'Disques',count:5,weight_kg:1.25,notes:'catalog:db_plate_1'},
    {id:4,category:'barbell',name:'Barre',count:1,weight_kg:20,notes:'catalog:barbell'},
  ]
  let nextId=5
  const writes=[], errors=[], checks=[]
  const assert=(value,message)=>{if(!value)throw new Error(message)}
  const onError=error=>errors.push(error.message)
  page.on('pageerror',onError)
  const handler=async route=>{
    const req=route.request(),url=new URL(req.url()),method=req.method()
    if(method==='GET')return route.fulfill({json:{items}})
    const id=Number(url.pathname.split('/').at(-1))
    const data=req.postDataJSON()
    writes.push({method,id,body:data})
    if(method==='DELETE'){
      items.splice(items.findIndex(item=>item.id===id),1)
      return route.fulfill({status:204,body:''})
    }
    if(method==='POST'){
      const item={id:nextId++,...data};items.push(item)
      return route.fulfill({status:201,json:item})
    }
    const index=items.findIndex(item=>item.id===id)
    items[index]={...items[index],...data}
    return route.fulfill({json:items[index]})
  }
  const group=category=>page.locator(`.dumbbell-rows[data-category="${category}"]:visible`)
  const update=async(row,count,weight)=>{
    await row.locator('input').nth(0).fill(String(count))
    await row.locator('input').nth(1).fill(String(weight))
    await row.getByRole('button',{name:/Enregistrer/}).click()
    await page.waitForTimeout(60)
  }
  try {
    await page.route('http://workoutbuddy.test/api/v1/equipment**',handler)
    await page.goto('http://workoutbuddy.test/#/equipment')
    await page.evaluate(async()=>{const r=await navigator.serviceWorker?.getRegistration();await r?.update()})
    await page.waitForTimeout(1200)
    await page.reload()
    await page.evaluate(()=>location.hash='#/equipment')
    await page.locator('.dumbbell-section').first().waitFor()
    assert(await page.locator('.dumbbell-inventory > .dumbbell-section').count()===2,'Deux sections attendues')
    assert(await page.locator('.equip-section [data-category="dumbbell_loadable"]').count()===0,'Handles present in other equipment')
    checks.push('Two categories, handles grouped with plates')
    await update(group('dumbbell_fixed').locator('.dumbbell-row').first(),3,12.5)
    assert(items[0].count===3&&items[0].weight_kg===12.5,'Modification fixe perdue')
    await group('dumbbell_fixed').getByRole('button',{name:/Ajouter une ligne/}).click()
    await group('dumbbell_fixed').getByRole('button',{name:/Ajouter une ligne/}).click()
    const fixed=group('dumbbell_fixed').locator('.dumbbell-row')
    assert(await fixed.count()===3,'Cannot add multiple rows')
    await fixed.nth(2).locator('input').nth(1).fill('20')
    await update(fixed.nth(1),1,15)
    assert(await fixed.nth(2).locator('input').nth(1).inputValue()==='20','Enregistrer une ligne efface un autre brouillon')
    await update(fixed.nth(2),2,20)
    checks.push('Add multiple fixed rows, quantity and weight, preserve drafts')
    await update(group('dumbbell_loadable').locator('.dumbbell-row').first(),1,3)
    await update(group('dumbbell_plate').locator('.dumbbell-row').first(),7,1.25)
    await group('dumbbell_plate').getByRole('button',{name:/Ajouter une ligne/}).click()
    await update(group('dumbbell_plate').locator('.dumbbell-row').last(),1,0.75)
    assert(items.find(item=>item.id===2).count===1,'Handle quantity forced')
    assert(items.find(item=>item.id===3).count===7,'Plate quantity forced')
    checks.push('Handles and plate rows with actual quantities')
    await fixed.last().getByRole('button',{name:/Supprimer/}).click()
    await page.getByRole('dialog').getByRole('button',{name:'Supprimer',exact:true}).click()
    await page.getByRole('dialog').waitFor({state:'hidden'})
    assert(await fixed.count()===2,'Deletion not applied')
    checks.push('Confirmed row deletion')
    await page.evaluate(()=>location.hash='#/settings')
    await page.getByRole('button',{name:'Matériel',exact:true}).click()
    await group('dumbbell_fixed').locator('.dumbbell-row').first().waitFor()
    assert(await page.locator('.equipment-settings .dumbbell-inventory > .dumbbell-section').count()===2,'Inconsistent settings')
    assert(await page.locator('.equipment-settings .equip-row').filter({hasText:'Paire d\'haltères fixes'}).count()===0,'Old catalog row duplicated')
    await group('dumbbell_fixed').locator('input').nth(1).fill('16')
    await page.getByRole('button',{name:/Enregistrer l.inventaire/}).click()
    await page.waitForTimeout(200)
    assert(items.find(item=>item.id===1).weight_kg===16,'Global save omits dumbbells')
    checks.push('Same editor in settings and global save')
    const layouts=[]
    for(const hash of ['#/equipment','#/settings']){
      await page.evaluate(hash=>location.hash=hash,hash)
      await page.waitForTimeout(150)
      if(hash==='#/settings')await page.getByRole('button',{name:'Matériel',exact:true}).click()
      for(const width of [320,390,768,1280]){
        await page.setViewportSize({width,height:844})
        for(const theme of ['dark','light']){
          await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme)
          layouts.push(await page.evaluate(()=>({hash:location.hash,width:innerWidth,theme:document.documentElement.dataset.theme,overflow:document.documentElement.scrollWidth>innerWidth})))
        }
      }
    }
    assert(layouts.every(item=>!item.overflow),'Responsive overflow')
    const sourceBorders=await page.evaluate(()=>[...document.querySelectorAll('.dumbbell-section')].map(el=>({top:getComputedStyle(el).borderTopWidth,bottom:getComputedStyle(el).borderBottomWidth})))
    assert(sourceBorders.every(item=>item.bottom==='0px'),'Duplicate section borders')
    return{checks,layouts:layouts.length,writes:writes.length,errors}
  } finally {
    await page.unroute('http://workoutbuddy.test/api/v1/equipment**',handler)
    page.removeListener('pageerror',onError)
    await page.setViewportSize({width:390,height:844})
    await page.evaluate(()=>document.documentElement.dataset.theme='dark')
    await page.goto('http://workoutbuddy.test/#/equipment')
    await page.reload()
  }
}
