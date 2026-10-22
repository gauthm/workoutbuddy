async (page) => {
  page.setDefaultTimeout(3000)
  const report = []
  const errors = []
  page.on('pageerror', e => errors.push(e.message))
  const assert = (value, message) => { if (!value) throw new Error(message) }
  const check = async (name, fn) => { try { await fn(); report.push({ name, passed: true }) } catch (e) { report.push({ name, passed: false, error: e.message }) } }
  const go = async hash => { await page.evaluate(hash => location.hash = hash, hash); await page.waitForTimeout(200) }
  const program = {id:1,name:'Strength and progression program with a particularly long name',goal:'hypertrophy',level:'intermediate',is_active:true,days_per_week:3,templates:[{id:1,name:'Full workout',exercises:[{id:1,exercise_id:'ab_roller',name_fr:'Roulette abdominale',target_sets:3,target_reps_min:8,target_reps_max:12}]}]}
  const exercise = {id:'ab_roller',name_fr:'Roulette abdominale avec un nom très long pour vérifier le retour à la ligne',name_en:'Ab Roller',is_custom:true,primary_muscles:['core'],secondary_muscles:[],equipment_required:[],instructions_fr:['Instructions de test.'],instructions_en:['Test instructions.'],image_paths:[]}
  const active = {id:1,name:'Workout with a very long name to check buttons',status:'in_progress',started_at:new Date().toISOString(),scheduled_date:'2026-10-13',exercises:[{id:1,exercise_id:'ab_roller',name_fr:exercise.name_fr,rest_seconds:90,template_exercise_id:1,sets:[{id:1,set_number:1,weight_kg:40,reps:10,rpe:8,is_completed:1},{id:2,set_number:2,weight_kg:40,reps:8,rpe:null,is_completed:0}]}]}
  const planned = {id:2,name:'Planned workout',status:'planned',scheduled_date:'2026-10-14',exercises:[],duration_seconds:0,total_sets:0,total_volume_kg:0}
  const completed = {...active,id:3,status:'completed',scheduled_date:'2026-10-12',duration_seconds:1800,total_sets:2,total_volume_kg:720}
  let entries = [{id:1,date:'2026-10-10',weight_kg:75},{id:2,date:'2026-10-12',weight_kg:74.5}]
  let messages = [{role:'assistant',content:'A very long response '+ 'mot'.repeat(180)}]
  const records = Array.from({length:8},(_,i)=>({id:i+1,exercise_id:'ab_roller',exercise_name_fr:'Roulette abdominale '+(i+1),weight_kg:40,reps:10,estimated_1rm_kg:53.3}))
  const fixture = async route => {
    const request=route.request(), u=new URL(request.url()), method=request.method()
    const data=request.postDataJSON() || {}
    let body
    if (u.pathname==='/api/v1/programs') body={programs:[program]}
    else if (u.pathname==='/api/v1/programs/1') body=program
    else if (u.pathname==='/api/v1/programs/1/next-session') body={template_id:1,suggested_date:'2026-10-13'}
    else if (u.pathname==='/api/v1/sessions') {
      let sessions=[active,planned,completed]
      if(u.searchParams.get('status'))sessions=sessions.filter(s=>s.status===u.searchParams.get('status'))
      body={sessions,total:sessions.length}
    }
    else if (/\/sessions\/\d+\/target\//.test(u.pathname)) body={weight_kg:40,reps_min:8,reps_max:12,is_first_time:true,first_time_suggestion:{reasoning:'Test suggestion: '+ 'explication '.repeat(30)}}
    else if (/\/sessions\/\d+$/.test(u.pathname)) body=[active,planned,completed].find(s=>String(s.id)===u.pathname.split('/').at(-1))
    else if (/\/sets\/\d+$/.test(u.pathname)||u.pathname==='/api/v1/session-exercises/1/sets') body={id:method==='POST'?4:2,...data,is_completed:1}
    else if(u.pathname==='/api/v1/exercises/ab_roller') body=exercise
    else if(u.pathname==='/api/v1/exercises/ab_roller/history') body={history:[]}
    else if(u.pathname==='/api/v1/exercises'&&method==='POST') body={id:'custom_ui_test',...data,is_custom:true}
    else if(u.pathname==='/api/v1/stats/personal-records')body={records}
    else if(u.pathname==='/api/v1/stats/volume')body={data:[{period:'2026-W41',volume_kg:720,muscle:'core'},{period:'2026-W42',volume_kg:840,muscle:'back'}]}
    else if(u.pathname==='/api/v1/stats/exercises/ab_roller/progress')body={formula:'epley',data:[{date:'2026-10-10',weight_kg:40,reps:8,estimated_1rm_kg:50.67},{date:'2026-10-12',weight_kg:40,reps:10,estimated_1rm_kg:53.33}]}
    else if(u.pathname==='/api/v1/bodyweight') {
      if(method==='POST')entries.push({id:3,...data})
      body=method==='POST'?entries.at(-1):{entries}
    }
    else if(u.pathname==='/api/v1/ai/conversations')body={conversations:[{id:1,title:'Test conversation',is_active:1,message_count:messages.length,last_message_at:'2026-10-13'}]}
    else if(u.pathname==='/api/v1/ai/conversations/1/messages')body={messages}
    else if(u.pathname==='/api/v1/ai/chat') {
      messages.push({role:'user',content:data.message},{role:'assistant',content:'Test response.'})
      return route.fulfill({contentType:'text/event-stream',body:'data: {"type":"token","content":"Test response."}\n\ndata: {"type":"done","conversation_id":1}\n\n'})
    }
    else if(u.pathname==='/api/v1/equipment'&&method==='POST')body={id:1000,...data}
    if(body===undefined)return route.fallback()
    return route.fulfill({contentType:'application/json',body:JSON.stringify(body)})
  }
  await page.route('http://workoutbuddy.test/api/**',fixture)
  await page.reload()
  await page.setViewportSize({width:390,height:844})
  await check('Home: program and shortcuts',async()=>{await go('#/');assert(await page.locator('.dashboard-program').count()===1,'Program missing');await page.getByRole('button',{name:'Calendrier',exact:true}).click();await page.locator('.calendar-grid').waitFor()})
  await check('Calendar: local date and rescheduling',async()=>{await go('#/calendar');await page.getByRole('button',{name:'2026-10-14',exact:true}).click();assert((await page.locator('.calendar-day-panel').innerText()).includes('Planned workout'),'Workout assigned to wrong day');await page.getByRole('button',{name:/Replanifier/}).click();await page.getByRole('dialog').waitFor();await page.keyboard.press('Escape');assert(await page.getByRole('dialog').count()===0,'Escape does not close modal')})
  await check('Program: details and exercise names',async()=>{await go('#/programs/1');assert((await page.locator('.template-block').innerText()).includes('Roulette abdominale'),'Raw name displayed');await page.getByRole('button',{name:'Supprimer',exact:true}).click();await page.getByRole('dialog').waitFor();await page.keyboard.press('Escape')})
  await check('Workout: grid/RPE/tooltip/validation',async()=>{await page.evaluate(()=>window.__store.setSettings({...window.__store.settings,show_rpe_field:true}));await go('#/session');await page.locator('.set-row').first().waitFor();for(const width of [320,390,768,1280]){await page.setViewportSize({width,height:844});assert(await page.evaluate(()=>[...document.querySelectorAll('.set-row')].every(e=>e.scrollWidth<=e.clientWidth+1)),'Grid overflows at '+width)}await page.locator('.exercise-block__add-set').click();await page.locator('.ai-tooltip-btn').first().click();assert(await page.evaluate(()=>{const r=document.querySelector('.ai-tooltip-bubble').getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight}),'Tooltip offscreen');await page.keyboard.press('Escape');await page.locator('.set-row__btn').last().click();await page.waitForTimeout(150);assert(await page.locator('.rest-timer').count()===1,'Rest missing after validation');await page.waitForFunction(()=>parseInt(document.querySelector('.rest-timer text')?.textContent)<90,{},{timeout:4000})})
  await check('Workout: help and keyboard confirmation',async()=>{await page.getByRole('button',{name:/Aide/}).first().click();await page.getByRole('dialog').waitFor();await page.keyboard.press('Tab');assert(await page.evaluate(()=>document.querySelector('[role="dialog"]').contains(document.activeElement)),'Focus outside dialog');await page.keyboard.press('Escape');await page.getByRole('button',{name:'Terminer la séance',exact:true}).click();await page.getByRole('dialog').waitFor();await page.keyboard.press('Escape')})
  await check('History and workout details',async()=>{await go('#/session/history');await page.locator('.history-row').first().waitFor();await go('#/session/3');assert((await page.locator('.view').innerText()).includes('40'),'Sets missing')})
  await check('Statistics: all records and volume',async()=>{await go('#/stats');assert(await page.locator('.pr-row').count()===5,'Incorrect initial limit');await page.getByRole('button',{name:/Tous les records/}).click();assert(await page.locator('.pr-row').count()===8,'Records not expanded');await page.getByRole('button',{name:/Voir moins/}).click();assert(await page.locator('.pr-row').count()===5,'Records not collapsed');assert(await page.evaluate(()=>!!Chart.getChart('volume-chart-main')),'Chart missing')})
  await check('Progression: chart and formula',async()=>{await go('#/stats/exercise/ab_roller');assert(await page.evaluate(()=>!!Chart.getChart('exercise-progress-chart')),'Chart missing on load');const before=await page.locator('.progress-row__rm').last().innerText();await page.locator('.formula-selector select').selectOption('brzycki');assert(await page.locator('.progress-row__rm').last().innerText()!==before,'Formula has no effect');await page.locator('.period-btn').first().click();assert(await page.locator('.formula-selector select').inputValue()==='brzycki','Formula reset')})
  await check('Weight: chart and addition',async()=>{await go('#/stats/bodyweight');assert(await page.evaluate(()=>!!Chart.getChart('bodyweight-chart')),'Chart missing on load');await page.getByRole('button',{name:'Ajouter',exact:true}).first().click();await page.locator('.bw-form input[type="number"]').fill('74');await page.getByRole('button',{name:'Enregistrer',exact:true}).click();await page.waitForTimeout(150);assert(await page.locator('.bw-list-row').count()===3,'Weight not added');assert(await page.evaluate(()=>!!Chart.getChart('bodyweight-chart')),'Chart lost after addition')})
  await check('Coach: conversation, long input, and sending',async()=>{await go('#/coach');await page.locator('.chat-msg').first().waitFor();await page.setViewportSize({width:320,height:700});assert(await page.evaluate(()=>document.documentElement.scrollWidth===innerWidth),'Message overflows');const input=page.getByRole('textbox');await input.fill('Question\nwith multiple\nlines');await input.dispatchEvent('input');assert(await page.evaluate(()=>document.querySelector('.coach-view__input-area').getBoundingClientRect().bottom<=document.querySelector('.bottom-nav').getBoundingClientRect().top+1),'Input obscured');await page.getByRole('button',{name:'Envoyer',exact:true}).click();await page.getByText('Test response.',{exact:true}).waitFor()})
  await check('Coach: accessible history and focus',async()=>{await page.getByRole('button',{name:'Historique des conversations',exact:true}).click();await page.getByRole('dialog').waitFor();await page.keyboard.press('Shift+Tab');assert(await page.evaluate(()=>document.querySelector('[role="dialog"]').contains(document.activeElement)),'Focus leaves dialog');await page.keyboard.press('Escape');assert(await page.getByRole('dialog').count()===0,'History not closed')})
  await check('Equipment: adding in a modal',async()=>{await go('#/equipment');await page.locator('.page-header__actions button').click();await page.getByRole('dialog').waitFor();await page.getByLabel('Nom', {exact:true}).fill('Test bar');await page.getByRole('button',{name:'Enregistrer',exact:true}).click();await page.waitForTimeout(100);assert(await page.getByRole('dialog').count()===0,'Form not closed')})
  await check('Settings: all accordions and confirmations',async()=>{await go('#/settings');const toggles=page.locator('.settings-section__toggle');for(let i=1;i<await toggles.count();i++)await toggles.nth(i).click();assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Settings overflow');await page.getByRole('button',{name:'Réinitialiser mon profil',exact:true}).click();await page.getByRole('dialog').waitFor();assert(await page.getByRole('button',{name:'Effacer mon profil',exact:true}).isDisabled(),'Reset without confirmation');await page.keyboard.press('Escape')})
  await check('Exercises: search, filters, and pain',async()=>{await go('#/exercises');await page.locator('input[type="search"]').fill('Ab');await page.locator('.exercise-filter select').first().selectOption('core');await page.locator('.exercise-filter select').last().selectOption('core');await page.getByRole('button',{name:'Douleurs',exact:true}).click();await page.locator('.pain-chip').first().click();assert(await page.locator('.pain-chip--active').count()===1,'Pain not selected');await page.locator('.pain-chip').first().click();await page.getByRole('button',{name:'Exercices',exact:true}).first().click();assert(await page.locator('.exercise-filter input').inputValue()==='Ab','Search lost')})
  await check('Exercises: creation and editing',async()=>{await go('#/exercises/new');await page.getByLabel('Nom (français) *',{exact:true}).fill('Test exercise');await page.locator('.muscle-chips').first().getByRole('button',{name:'Abdominaux',exact:true}).click();await page.getByRole('button',{name:'Enregistrer',exact:true}).click();await page.waitForTimeout(100);assert(await page.evaluate(()=>location.hash!=='#/exercises/new'),'Creation without return navigation');await go('#/exercises/ab_roller/edit');await page.getByLabel('Nom (français) *',{exact:true}).fill('Edited exercise');await page.getByRole('button',{name:'Enregistrer',exact:true}).click();await page.waitForTimeout(100);assert(await page.evaluate(()=>location.hash!=='#/exercises/ab_roller/edit'),'Edit without return navigation')})
  await check('Language: immediate screen translation',async()=>{await go('#/settings');await page.evaluate(async()=>{const {i18n}=await import('/js/i18n.js');await i18n.setLocale('en');window.__store.settings.language='en'});assert(await page.locator('h1').innerText()==='Settings','Language is not reactive');await go('#/exercises/new');assert(await page.getByLabel('Name (French) *',{exact:true}).count()===1,'Form not translated');await page.evaluate(async()=>{const {i18n}=await import('/js/i18n.js');await i18n.setLocale('fr');window.__store.settings.language='fr'})})
  return {report,errors}
}
