async page => {
  const checks=[],errors=[],calls=[];let empty=false
  const assert=(ok,message)=>{if(!ok)throw new Error(message)}
  const today=new Date().toISOString().slice(0,10)
  const program={id:106,name:'Programme de test avec un nom suffisamment long',is_active:true,goal:'general_fitness',level:'beginner',days_per_week:2,templates:[]}
  const fixtures=async route=>{
    const req=route.request(),url=new URL(req.url())
    if(req.method()!=='GET')throw new Error('Une écriture a été tentée dans cet audit en lecture seule')
    calls.push(url.pathname+url.search)
    let body
    if(url.pathname==='/api/v1/programs')body={programs:[program]}
    else if(url.pathname==='/api/v1/programs/106')body=program
    else if(url.pathname==='/api/v1/sessions')body={sessions:url.searchParams.get('status')?[]:[{id:1,name:'Séance prévue',scheduled_date:today,status:'planned'}]}
    else if(url.pathname==='/api/v1/stats/overview')body=empty?{total_sessions:0,total_volume_kg:0,current_week_streak:0,longest_week_streak:0,total_weeks_trained:0,personal_records_count:0}:{total_sessions:24,total_volume_kg:12345.6,current_week_streak:3,longest_week_streak:6,total_weeks_trained:8,personal_records_count:7,active_program_name:program.name,last_session_date:today}
    else if(url.pathname==='/api/v1/stats/volume'){
      const weeks=Number(url.searchParams.get('weeks')),muscle=url.searchParams.get('group_by')==='muscle'
      if(weeks===24)await new Promise(resolve=>setTimeout(resolve,180))
      body={data:empty?[]:muscle?[{period:'2026-W40',muscle:'chest',volume_kg:weeks*50,sets:weeks/2},{period:'2026-W40',muscle:'back',volume_kg:weeks*50,sets:weeks/2}]:[{period:'2026-W40',volume_kg:weeks*100,sets:weeks}]}
    }
    else if(url.pathname==='/api/v1/stats/personal-records')body={records:empty?[]:Array.from({length:7},(_,n)=>({id:n+1,exercise_id:'ab_roller',exercise_name_fr:'Exercice avec un nom long '+n,reps:8+n,weight_kg:40,estimated_1rm_kg:50+n}))}
    else return route.fallback()
    await route.fulfill({json:body})
  }
  const onError=e=>errors.push(e.message);page.on('pageerror',onError)
  try{
    await page.route('http://workoutbuddy.test/api/v1/**',fixtures)
    await page.goto('http://workoutbuddy.test/#/');await page.reload()
    await page.locator('.calendar-embedded .calendar-cell').first().waitFor()
    assert(await page.locator('.calendar-cell').count()>=28,'Calendrier non intégré')
    assert(await page.getByRole('button',{name:'Calendrier',exact:true}).count()===0,'Bouton calendrier encore présent')
    assert(await page.getByRole('button',{name:'Historique',exact:true}).count()===1,'Historique absent de l’accueil')
    assert((await page.locator('.calendar-day-panel').innerText()).includes('Séance prévue'),'Séance du jour absente du calendrier')
    const month=await page.locator('.calendar-nav__label').innerText()
    await page.getByRole('button',{name:'Mois suivant',exact:true}).click()
    assert(await page.locator('.calendar-nav__label').innerText()!==month,'Navigation du calendrier inactive')
    await page.getByRole('button',{name:'Mois précédent',exact:true}).click()
    checks.push('Calendrier permanent sur l’accueil et historique accessible depuis l’accueil')
    await page.evaluate(()=>location.hash='#/session');await page.waitForTimeout(120)
    assert(await page.getByRole('button',{name:'Historique',exact:true}).count()===0,'Historique encore proposé en séance')
    assert(await page.getByRole('button',{name:'Calendrier',exact:true}).count()===0,'Calendrier encore proposé en séance')
    await page.evaluate(()=>location.hash='#/programs/106');await page.locator('.program-tag').first().waitFor()
    const badges=await page.locator('.program-tag').evaluateAll(tags=>tags.map(tag=>({height:tag.getBoundingClientRect().height,radius:getComputedStyle(tag).borderRadius,alignment:getComputedStyle(tag).alignItems,justify:getComputedStyle(tag).justifyContent})))
    assert(badges.length===4&&badges.every(b=>b.height>=32&&b.radius==='999px'&&b.alignment==='center'&&b.justify==='center'),'Badges de programme incohérents')
    checks.push('Objectif, niveau, fréquence et Actif utilisent les mêmes badges centrés')
    await page.evaluate(()=>location.hash='#/stats');await page.locator('.stats-metric').first().waitFor()
    assert(await page.locator('.stats-metric').count()===4,'Synthèse absente')
    assert(await page.locator('.pr-row').count()===5,'Limite des records incorrecte')
    await page.getByRole('button',{name:/Tous les records|Voir tous/}).click()
    assert(await page.locator('.pr-row').count()===7,'Records non développés')
    await page.getByRole('button',{name:'Séries',exact:true}).click()
    await page.waitForTimeout(100)
    assert((await page.locator('.stats-period-total').innerText()).includes('12 séries'),'Compteur de séries incorrect')
    const chart=await page.evaluate(()=>window.Chart.getChart('volume-chart-main').data.datasets[0].data)
    assert(chart[0]===12,'Le graphique conserve des kilogrammes en mode séries')
    const period=page.getByLabel('Période',{exact:true})
    await period.selectOption('24');await period.selectOption('4');await page.waitForTimeout(250)
    assert((await page.locator('.stats-period-total').innerText()).includes('4 séries'),'Réponse lente remplace la période courante')
    await page.getByLabel('Répartition',{exact:true}).selectOption('muscle');await page.waitForTimeout(100)
    assert(await page.evaluate(()=>window.Chart.getChart('volume-chart-main').data.datasets.length)===2,'Répartition par muscle incorrecte')
    checks.push('Statistiques lisibles, période, volume/séries, muscles et records')
    const layouts=[]
    for(const hash of ['#/','#/stats','#/programs/106']){
      await page.evaluate(hash=>location.hash=hash,hash);await page.waitForTimeout(150)
      for(const width of [320,390,768,1280])for(const theme of ['dark','light']){
        await page.setViewportSize({width,height:844});await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme)
        assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Débordement horizontal')
        layouts.push({hash,width,theme})
      }
    }
    await page.setViewportSize({width:390,height:844});await page.evaluate(()=>document.documentElement.dataset.theme='dark')
    await page.evaluate(()=>location.hash='#/stats');await page.waitForTimeout(150)
    await page.screenshot({path:'/Users/gauthier.merlin/workoutbuddy/docs/stats-ui-mobile.png',fullPage:true})
    empty=true;await page.reload();await page.locator('.stats-empty').waitFor()
    assert(await page.locator('.chart-container canvas').count()===0,'Graphique fictif sur stats vides')
    assert((await page.locator('.stats-metric').first().innerText()).includes('0'),'Statistiques vides non expliquées')
    checks.push('État vide explicite sans données fictives')
    assert(errors.length===0,'Erreur JavaScript '+errors.join(', '))
    return{checks,layouts:layouts.length,errors}
  }finally{
    await page.unroute('http://workoutbuddy.test/api/v1/**',fixtures)
    page.removeListener('pageerror',onError)
    await page.goto('http://workoutbuddy.test/#/');await page.reload()
  }
}
