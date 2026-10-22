async page => {
  page.setDefaultTimeout(4000)
  const assert=(ok,message)=>{if(!ok)throw new Error(message)}
  const errors=[],checks=[]
  let exists=true,detailRequests=0,deletes=0
  const yesterday=await page.evaluate(()=>{const d=new Date();d.setDate(d.getDate()-1);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`})
  const session={id:801,name:'Navigation test workout',status:'completed',scheduled_date:yesterday,duration_seconds:1200,total_volume_kg:0,exercises:[]}
  const handler=async route=>{
    const req=route.request(),url=new URL(req.url())
    if(url.pathname==='/api/v1/programs')return route.fulfill({json:{programs:[]}})
    if(url.pathname==='/api/v1/sessions')return route.fulfill({json:{sessions:exists?[session]:[]}})
    if(url.pathname==='/api/v1/sessions/801'){
      if(req.method()==='DELETE'){exists=false;deletes++;return route.fulfill({status:204,body:''})}
      detailRequests++
      return route.fulfill(exists?{json:session}:{status:404,json:{error:'SESSION_NOT_FOUND'}})
    }
    return route.fallback()
  }
  const onError=e=>errors.push(e.message);page.on('pageerror',onError)
  try{
    await page.route('http://workoutbuddy.test/api/v1/**',handler)
    await page.goto('http://workoutbuddy.test/#/');await page.reload()
    await page.locator('.calendar-embedded .calendar-cell').first().waitFor()
    await page.getByRole('button',{name:yesterday,exact:true}).click()
    await page.getByRole('button',{name:'Voir',exact:true}).click()
    await page.locator('.view__content').getByRole('button',{name:/Supprimer/}).click()
    await page.getByRole('dialog').getByRole('button',{name:'Supprimer',exact:true}).click()
    await page.waitForFunction(()=>location.hash==='#/session/history')
    await page.getByRole('button',{name:'Retour',exact:true}).click()
    await page.waitForTimeout(200)
    assert(await page.evaluate(()=>location.hash==='#/'),'Back after deletion does not return home: '+page.url())
    assert(detailRequests===1,'Back reloads deleted workout')
    await page.locator('.calendar-embedded .calendar-cell').first().waitFor()
    await page.getByRole('button',{name:yesterday,exact:true}).click()
    assert(await page.locator('.calendar-day-session').count()===0,'Calendar still displays the deleted workout')
    checks.push('Home → yesterday → view → delete → return home, calendar refreshed')
    await page.goForward();await page.waitForTimeout(120)
    assert(await page.evaluate(()=>location.hash==='#/session/history'),'Forward navigation reopens deleted details')
    assert(detailRequests===1,'Forward navigation reloads the deleted workout')
    checks.push('Forward navigation without reopening deleted details')
    exists=true;detailRequests=0
    await page.goto('http://workoutbuddy.test/#/');await page.reload()
    await page.getByRole('button',{name:'Historique',exact:true}).click()
    await page.locator('.history-row__main').first().waitFor()
    await page.locator('.history-row__main').first().click()
    await page.locator('.view__content').getByRole('button',{name:/Supprimer/}).click()
    await page.getByRole('dialog').getByRole('button',{name:'Supprimer',exact:true}).click()
    await page.waitForFunction(()=>location.hash==='#/session/history')
    await page.getByRole('button',{name:'Retour',exact:true}).click();await page.waitForTimeout(120)
    assert(await page.evaluate(()=>location.hash==='#/session/history'),'Back from history reloads details')
    assert(detailRequests===1,'Deleted workout reloaded from history')
    checks.push('Delete from history, return without deleted workout')
    await page.evaluate(()=>location.hash='#/session/801');await page.waitForTimeout(200)
    assert(await page.evaluate(()=>location.hash==='#/session/history'),'Stale link remains on SESSION_NOT_FOUND')
    assert(!(await page.locator('body').innerText()).includes('SESSION_NOT_FOUND'),'Raw error still visible')
    checks.push('Stale link redirected to history')
    assert(errors.length===0,'Erreurs JavaScript : '+errors.join(', '))
    return {checks,deletes,errors}
  }finally{
    await page.unroute('http://workoutbuddy.test/api/v1/**',handler)
    page.removeListener('pageerror',onError)
    await page.goto('http://workoutbuddy.test/#/');await page.reload()
  }
}
