async page => {
  page.setDefaultTimeout(5000)
  await page.setViewportSize({width:390,height:844})
  const assert=(ok,message)=>{if(!ok)throw new Error(message)}
  const errors=[],writes=[],checks=[];let nextId=700
  const detail=id=>({id,name_fr:id==='press'?'Développé avec haltères':'Roulette abdominale',name_en:id,primary_muscles:['chest'],secondary_muscles:[],equipment_required:id==='press'?['dumbbell_fixed']:[],image_paths:[],movement_pattern:'push_horizontal',instructions_fr:['Instruction de test'],instructions_en:['Test instruction']})
  const session={id:501,name:'UI test workout',status:'in_progress',scheduled_date:'2026-10-13',started_at:new Date().toISOString(),exercises:[
    {id:601,exercise_id:'press',name_fr:'Développé avec haltères',template_exercise_id:1,target_sets:3,rest_seconds:90,sets:[]},
    {id:602,exercise_id:'roller',name_fr:'Roulette abdominale',template_exercise_id:2,target_sets:2,rest_seconds:60,sets:[]},
  ]}
  let profile={display_name:'Test',age:30,sex:'male',weight_kg:80,height_cm:180,fitness_level:'intermediate',primary_goal:'hypertrophy',sessions_per_week:3,session_duration_min:60,prefers_exercise_variation:true,sport_practiced:null,injury_notes:'Preserved information',onboarding_completed:true}
  const handler=async route=>{
    const req=route.request(),u=new URL(req.url()),method=req.method()
    const body=method==='GET'?null:req.postDataJSON()
    let result
    if(u.pathname==='/api/v1/settings')result={language:'fr',theme:'dark',show_rpe_field:false,timer_sound_enabled:false,timer_vibration_enabled:false}
    else if(u.pathname==='/api/v1/programs')result={programs:[]}
    else if(u.pathname==='/api/v1/user-profile'){
      if(method==='PUT'){writes.push({path:u.pathname,body});profile={...profile,...body}}
      result=profile
    }
    else if(u.pathname==='/api/v1/sessions')result={sessions:u.searchParams.get('status')===session.status?[session]:[],total:1}
    else if(u.pathname==='/api/v1/sessions/501')result=session
    else if(u.pathname==='/api/v1/sessions/501/complete'){writes.push({path:u.pathname,body});session.status='completed';result=session}
    else if(u.pathname.includes('/target/'))result={weight_kg:u.pathname.endsWith('/1')?50:0,reps_min:8,reps_max:12,achievable_loads_kg:[10,20,30,40,50,55],explanation:'Target calculated from the previous workout and double progression.',is_first_time:false}
    else if(/\/session-exercises\/\d+\/sets$/.test(u.pathname)){
      const exercise=session.exercises.find(e=>e.id===Number(u.pathname.split('/')[4]));result={id:nextId++,session_exercise_id:exercise.id,...body};exercise.sets.push(result);writes.push({path:u.pathname,body})
    }
    else if(/\/sets\/\d+$/.test(u.pathname)){
      const id=Number(u.pathname.split('/').at(-1)),exercise=session.exercises.find(e=>e.sets.some(s=>s.id===id)),index=exercise.sets.findIndex(s=>s.id===id)
      result={...exercise.sets[index],...body};exercise.sets[index]=result;writes.push({path:u.pathname,body})
    }
    else if(u.pathname.endsWith('/history'))result={history:[{session_id:100,scheduled_date:'2026-10-10',sets:[{weight_kg:40,reps:10,is_completed:true},{weight_kg:40,reps:9,is_completed:true}]}]}
    else if(u.pathname.startsWith('/api/v1/exercises/'))result=detail(u.pathname.split('/').at(-1))
    else return route.fallback()
    await route.fulfill({status:method==='POST'?201:200,json:result})
  }
  const onError=e=>errors.push(e.message);page.on('pageerror',onError)
  const first=()=>page.locator('[data-exercise-id="601"]')
  const work=()=>first().locator('.set-row:not(.set-row--warmup)')
  const setValues=async(row,weight,reps)=>{await row.locator('input').nth(0).fill(String(weight));await row.locator('input').nth(1).fill(String(reps))}
  const log=async(row)=>{await row.getByRole('button',{name:/Valider la série/}).click();await page.waitForTimeout(80)}
  try{
    await page.route('http://workoutbuddy.test/api/v1/**',handler)
    await page.goto('http://workoutbuddy.test/#/session');await page.reload()
    await work().first().waitFor()
    assert(await work().count()===3,'Planned sets missing')
    assert(writes.length===0,'Planned sets written before validation')
    assert(await first().locator('.exercise-previous tbody tr').count()===2 && (await first().locator('.exercise-previous tbody tr').first().innerText()).includes('40'),'Previous-performance table missing')
    assert(await work().locator('.set-row__previous').count()===0,'Old previous-performance column still present')
    assert(await work().first().locator('.set-row__10rm').count()===1,'Colonne 10RM absente')
    assert((await first().locator('.set-row-header').innerText()).replace(/\s+/g,' ').includes('KG REPS 10RM'),'Incorrect column order')
    assert(await first().locator('.exercise-block__tools').evaluate(el=>el.nextElementSibling.classList.contains('exercise-previous')),'History not below warmup')
    await setValues(work().first(),60,10)
    assert((await work().first().locator('.set-row__10rm').innerText()).trim()==='60','10 reps doivent conserver la charge')
    await setValues(work().first(),60,8)
    assert((await work().first().locator('.set-row__10rm').innerText()).trim()==='57','10RM does not follow field values')
    await page.evaluate(()=>window.__store.settings.rm_formula='lombardi')
    await page.waitForTimeout(30)
    assert((await work().first().locator('.set-row__10rm').innerText()).trim()==='58.7','10RM ignores the selected formula')
    await setValues(work().first(),0,8)
    assert((await work().first().locator('.set-row__10rm').innerText()).trim()==='—','Invented RM without external load')
    await page.evaluate(()=>window.__store.settings.rm_formula='epley')
    assert(await page.locator('[data-exercise-id="602"] .set-row:visible').count()===0,'All exercises open')
    await first().locator('.exercise-block__explanation summary').click()
    assert((await first().innerText()).includes('double progression'),'Target explanation missing')
    checks.push('Planned sets without writes, previous performance, and target explanation')
    await setValues(work().first(),55,9);await log(work().first())
    await page.locator('.session-rest-dock').waitFor()
    assert((await page.locator('.session-progress').innerText()).includes('1 / 5'),'Incorrect progress')
    assert(await work().nth(1).locator('input').first().inputValue()==='55','Next set not prefilled')
    await setValues(work().nth(2),52.5,10)
    await page.getByRole('button',{name:/Roulette abdominale.*séries validées/}).evaluate(el=>el.scrollIntoView({block:'center'}))
    await page.getByRole('button',{name:/Roulette abdominale.*séries validées/}).click()
    assert(await page.locator('.session-rest-dock').isVisible(),'Repos disparu au changement d’exercice')
    await page.getByRole('button',{name:/Développé avec haltères.*séries validées/}).evaluate(el=>el.scrollIntoView({block:'center'}))
    await page.getByRole('button',{name:/Développé avec haltères.*séries validées/}).click()
    assert(await work().nth(2).locator('input').first().inputValue()==='52.5','Draft lost when switching exercises')
    await page.getByRole('button',{name:'Ajouter 15 secondes de repos'}).click()
    await page.waitForTimeout(60)
    const seconds=await page.evaluate(()=>Math.ceil((window.__store.activeRest.deadline-Date.now())/1000))
    assert(seconds>=103&&seconds<=105,'Rest not adjusted')
    const oldDeadline=await page.evaluate(()=>window.__store.activeRest.deadline)
    await work().first().locator('input').first().fill('54')
    await work().first().getByRole('button',{name:/Enregistrer la correction/}).click();await page.waitForTimeout(80)
    assert(session.exercises[0].sets.length===1&&session.exercises[0].sets[0].weight_kg===54,'Correction creates a duplicate set')
    assert(await page.evaluate(()=>window.__store.activeRest.deadline)===oldDeadline,'Correction relance le repos')
    checks.push('Validation, prefill, preserved drafts, adjustable global rest, correction without duplicates')
    await page.locator('.rest-timer').getByRole('button',{name:/Passer/}).click()
    await page.locator('.session-rest-dock').waitFor({state:'hidden'})
    assert(await first().getByRole('button',{name:/Ajouter une série/}).count()===0,'Unrestricted addition still available')
    const beforeWarmup=writes.length
    await first().getByRole('button',{name:'Échauffement',exact:true}).click()
    const warmup=page.getByRole('dialog')
    assert((await warmup.innerText()).includes('20 kg')&&(await warmup.innerText()).includes('30 kg'),'Load instructions missing')
    await warmup.getByRole('button',{name:'Fermer',exact:true}).last().click()
    assert(writes.length===beforeWarmup&&await work().count()===3,'Warmup adds data')
    checks.push('Fixed program and collapsible warmup instructions without adding sets')
    await work().first().getByRole('button',{name:'Annuler la série 1',exact:true}).click();await page.waitForTimeout(80)
    assert(!session.exercises[0].sets[0].is_completed,'Set still completed after undo')
    assert((await page.locator('.session-progress').innerText()).includes('0 / 5'),'Progress not corrected')
    await log(work().first())
    assert(session.exercises[0].sets.length===1,'Revalidation creates a duplicate')
    await page.locator('.session-rest-dock').waitFor()
    await work().first().getByRole('button',{name:'Annuler la série 1',exact:true}).click()
    await page.locator('.session-rest-dock').waitFor({state:'hidden'})
    await log(work().first())
    checks.push('Undo and revalidate preserves values and corrects progress and rest')
    await page.locator('header').getByRole('button',{name:'Terminer la séance',exact:true}).click()
    assert((await page.getByRole('dialog').innerText()).includes('4 séries'),'Early completion without warning')
    await page.getByRole('dialog').getByRole('button',{name:'Annuler',exact:true}).click()
    await page.evaluate(()=>location.hash='#/settings')
    await page.getByRole('button',{name:'Réglages avancés',exact:true}).click()
    await page.locator('.rm-formula-help summary').click()
    assert((await page.locator('.rm-formula-help').innerText()).includes('Lombardi') && (await page.locator('.rm-formula-help').innerText()).includes('10RM'),'Formula explanations missing')
    await page.getByRole('button',{name:'Mon profil',exact:true}).click()
    await page.locator('.profile-settings input').first().waitFor()
    assert(await page.locator('#ProfileSettings-state-form-injury_notes').count()===0,'Injury field still present')
    await page.locator('#ProfileSettings-state-form-display_name').fill('Nouveau nom')
    await page.locator('.profile-settings').getByRole('button',{name:'Enregistrer',exact:true}).click();await page.waitForTimeout(80)
    assert(!('injury_notes' in writes.at(-1).body)&&profile.injury_notes==='Preserved information','Profile save rewrites injuries')
    checks.push('Injury field removed, data preserved when saving profile')
    await page.evaluate(()=>location.hash='#/session');await work().first().waitFor()
    assert(await work().count()===3,'Resume adds extra sets')
    assert((await work().locator('.set-row__num').allTextContents()).join(',')==='1,2,3','Inconsistent set numbers after resume')
    assert(await work().first().locator('input').first().inputValue()==='54','Saved performance lost on resume')
    const layouts=[]
    for(const width of [320,390,768,1280])for(const rpe of [false,true])for(const theme of ['dark','light']){
      await page.setViewportSize({width,height:844})
      await page.evaluate(({rpe,theme})=>{window.__store.settings.show_rpe_field=rpe;document.documentElement.dataset.theme=theme},{rpe,theme})
      await page.waitForTimeout(30)
      const result=await page.evaluate(()=>({width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth,fields:[...document.querySelectorAll('.set-row input')].filter(e=>e.offsetParent).every(e=>{const r=e.getBoundingClientRect();return r.width>=40&&r.right<=innerWidth}),theme:document.documentElement.dataset.theme}))
      assert(!result.overflow&&result.fields,'Fields too small or offscreen');layouts.push(result)
    }
    await page.setViewportSize({width:390,height:844})
    await page.evaluate(()=>{window.__store.settings.show_rpe_field=false;window.__store.dismissToast();document.documentElement.dataset.theme='dark'})
    await log(work().nth(1));await log(work().nth(2))
    const lastRest=await page.evaluate(()=>window.__store.activeRest.deadline)
    await work().first().getByRole('button',{name:'Annuler la série 1',exact:true}).click();await page.waitForTimeout(60)
    assert(await page.evaluate(()=>window.__store.activeRest.deadline)===lastRest,'Undoing an old set stops another set\'s rest')
    await log(work().first())
    assert((await page.locator('.session-progress').innerText()).includes('3 / 5'),'Incomplete progress after sets')
    const next=first().getByRole('button',{name:'Exercice suivant',exact:true})
    await next.evaluate(el=>el.scrollIntoView({block:'center'}));await next.click()
    const second=page.locator('[data-exercise-id="602"]')
    assert(await second.locator('.set-row:visible').count()===2,'Next exercise not opened')
    const rows=second.locator('.set-row')
    for(let n=0;n<2;n++){await rows.nth(n).getByRole('button',{name:/Valider la série/}).evaluate(el=>el.scrollIntoView({block:'center'}));await log(rows.nth(n))}
    assert((await page.locator('.session-progress').innerText()).includes('5 / 5'),'Not all sets counted')
    const finish=second.getByRole('button',{name:'Terminer la séance',exact:true})
    await finish.evaluate(el=>el.scrollIntoView({block:'center'}));await finish.click()
    assert((await page.getByRole('dialog').innerText()).includes('Toutes les séries prévues'),'Incorrect final summary')
    await page.getByRole('dialog').getByRole('button',{name:'Terminer la séance',exact:true}).click()
    await page.waitForTimeout(100)
    assert(session.status==='completed'&&page.url().endsWith('#/session/history'),'Workout not completed')
    assert(await page.locator('.session-rest-dock').count()===0,'Rest active after workout completion')
    checks.push('Next exercise, five validated sets, and confirmed workout completion')
    assert(errors.length===0,'Erreur JavaScript : '+errors.join(', '))
    await page.setViewportSize({width:390,height:844})
    await page.evaluate(()=>{window.__store.settings.show_rpe_field=false;document.documentElement.dataset.theme='dark'})
    return {checks,layouts:layouts.length,writes:writes.length,errors}
  }finally{
    await page.unroute('http://workoutbuddy.test/api/v1/**',handler)
    page.removeListener('pageerror',onError)
    await page.setViewportSize({width:390,height:844})
    await page.evaluate(()=>{window.__store.clearActiveSession();document.documentElement.dataset.theme='dark'})
    await page.goto('http://workoutbuddy.test/#/session');await page.reload()
  }
}
