async page => {
  page.setDefaultTimeout(4000)
  const assert=(ok,message)=>{if(!ok)throw new Error(message)}
  const errors=[],checks=[]
  let exists=true,detailRequests=0,deletes=0
  const yesterday=await page.evaluate(()=>{const d=new Date();d.setDate(d.getDate()-1);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`})
  const session={id:801,name:'Séance de test navigation',status:'completed',scheduled_date:yesterday,duration_seconds:1200,total_volume_kg:0,exercises:[]}
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
    assert(await page.evaluate(()=>location.hash==='#/'),'Retour après suppression ne revient pas à l’accueil : '+page.url())
    assert(detailRequests===1,'Retour recharge la séance supprimée')
    await page.locator('.calendar-embedded .calendar-cell').first().waitFor()
    await page.getByRole('button',{name:yesterday,exact:true}).click()
    assert(await page.locator('.calendar-day-session').count()===0,'Calendrier affiche encore la séance supprimée')
    checks.push('Accueil → hier → voir → supprimer → retour à l’accueil, calendrier actualisé')
    await page.goForward();await page.waitForTimeout(120)
    assert(await page.evaluate(()=>location.hash==='#/session/history'),'Avancer rouvre le détail supprimé')
    assert(detailRequests===1,'Navigation avant recharge la séance supprimée')
    checks.push('Navigation avant sans réouverture du détail supprimé')
    exists=true;detailRequests=0
    await page.goto('http://workoutbuddy.test/#/');await page.reload()
    await page.getByRole('button',{name:'Historique',exact:true}).click()
    await page.locator('.history-row__main').first().waitFor()
    await page.locator('.history-row__main').first().click()
    await page.locator('.view__content').getByRole('button',{name:/Supprimer/}).click()
    await page.getByRole('dialog').getByRole('button',{name:'Supprimer',exact:true}).click()
    await page.waitForFunction(()=>location.hash==='#/session/history')
    await page.getByRole('button',{name:'Retour',exact:true}).click();await page.waitForTimeout(120)
    assert(await page.evaluate(()=>location.hash==='#/session/history'),'Retour depuis l’historique recharge le détail')
    assert(detailRequests===1,'Séance supprimée rechargée depuis l’historique')
    checks.push('Suppression depuis l’historique, retour sans séance supprimée')
    await page.evaluate(()=>location.hash='#/session/801');await page.waitForTimeout(200)
    assert(await page.evaluate(()=>location.hash==='#/session/history'),'Lien obsolète reste sur SESSION_NOT_FOUND')
    assert(!(await page.locator('body').innerText()).includes('SESSION_NOT_FOUND'),'Erreur brute encore visible')
    checks.push('Lien obsolète renvoyé vers l’historique')
    assert(errors.length===0,'Erreurs JavaScript : '+errors.join(', '))
    return {checks,deletes,errors}
  }finally{
    await page.unroute('http://workoutbuddy.test/api/v1/**',handler)
    page.removeListener('pageerror',onError)
    await page.goto('http://workoutbuddy.test/#/');await page.reload()
  }
}
