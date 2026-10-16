import {test,expect} from './fixtures.js'
import {L,call,get,planned} from './helpers.js'
import {readFileSync} from 'node:fs'

const screens=[
 ['se',320,568,20,0],['safari-small',375,548,0,0],
 ['iphone',390,844,59,34],['safari',390,664,0,0],
 ['landscape',844,390,0,21],
 ['iphone-landscape',812,375,0,21],
]
const sixWeekDate='2026-11-15'

async function fits(page,info,state){
 const cdp=await page.context().newCDPSession(page)
 try{
  for(const [name,width,height,top,bottom] of screens){
   await page.setViewportSize({width,height})
   await cdp.send('Emulation.setSafeAreaInsetsOverride',{insets:{top,bottom,left:0,right:0}})
   await expect.poll(()=>page.evaluate(top=>{
    const errors=[],nav=document.querySelector('.bottom-nav').getBoundingClientRect()
    if(document.documentElement.scrollHeight>innerHeight+1)errors.push('vertical scroll')
    if(document.documentElement.scrollWidth>innerWidth)errors.push('horizontal scroll')
    if(scrollY!==0)errors.push('page already scrolled')
    const grid=document.querySelector('.calendar-grid').getBoundingClientRect(),legend=document.querySelector('.calendar-legend').getBoundingClientRect()
    if(grid.bottom>legend.top+.5)errors.push('calendar overlaps its legend')
    if(grid.height>240)errors.push('calendar stretched beyond compact height')
    for(const button of document.querySelectorAll('.dashboard-shortcuts .btn')){
     const style=getComputedStyle(button)
     if(parseFloat(style.borderTopWidth)<1 || style.borderTopStyle==='none' || style.backgroundColor==='rgba(0, 0, 0, 0)')errors.push('shortcut lacks a visible button surface')
    }
    for(const element of document.querySelectorAll('.dashboard-view button,.dashboard-view .empty-state__message,.dashboard-view .weekly-complete,.dashboard-view .calendar-legend,.dashboard-view .calendar-day-session__name,.dashboard-view .calendar-day-session__status,.dashboard-view .calendar-day-panel__date')){
     if(!element.getClientRects().length)continue
     const r=element.getBoundingClientRect()
     if(r.bottom>nav.top+.5 || r.top<top-.5 || r.left<-.5 || r.right>innerWidth+.5)errors.push(element.className+': outside usable screen')
     if(element.scrollHeight>element.clientHeight+1)errors.push(element.className+': clipped text')
    }
    return errors
   },top),{message:state+' on '+name}).toEqual([])
   await page.screenshot({path:info.outputPath(`${state}-${name}.png`)})
  }
 }finally{await cdp.detach()}
}

test('accueil sans programme : mois de six semaines, journée vide et thème clair sans défilement',async({page,request},info)=>{
 await page.clock.setFixedTime(new Date(sixWeekDate+'T12:00:00'))
 for(const theme of ['dark','light']){
  await call(request,'put','/settings',{theme})
  await page.goto('/#/');await page.reload()
  await expect(page.locator('.calendar-cell')).toHaveCount(42)
  await expect(page.getByText(L('session.no_program'),{exact:true})).toBeVisible()
  await expect(page.getByRole('button',{name:L('programs.new'),exact:true})).toBeVisible()
  await fits(page,info,'empty-'+theme)
 }
 await page.getByRole('button',{name:L('programs.new'),exact:true}).click()
 await page.waitForURL('**/#/programs/new')
})

test('accueil avec programme : semaine accomplie, plusieurs séances et toutes les actions du jour visibles',async({page,request},info)=>{
 test.setTimeout(60000)
 const program=await planned(request,{duration_weeks:null})
 const scheduled=(await get(request,'/sessions?active_program=1')).sessions.filter(s=>s.status==='planned')
 for(const session of scheduled.slice(0,2)){
  await call(request,'post',`/sessions/${session.id}/start`)
  await call(request,'post',`/sessions/${session.id}/complete`)
 }
 expect((await get(request,'/programs')).programs.find(p=>p.id===program.id).weekly_progress.is_complete).toBe(true)
 const sessionIds=[]
 for(let n=0;n<3;n++){
  const session=await call(request,'post','/sessions',{name:`Corps entier ${n+1} — poussée, tirage et renforcement`,scheduled_date:sixWeekDate,program_id:program.id,workout_template_id:program.templates[0].id},201)
  sessionIds.push(session.id)
 }
 await call(request,'post',`/sessions/${sessionIds[2]}/skip`)
 await page.clock.setFixedTime(new Date(sixWeekDate+'T12:00:00'))
 await page.goto('/#/')
 await expect(page.locator('.calendar-cell')).toHaveCount(42)
 await expect(page.locator('.weekly-complete')).toBeVisible()
 const panel=page.locator('.calendar-day-panel')
 await expect(panel.getByRole('button',{name:L('calendar.start'),exact:true})).toBeVisible()
 await expect(panel.locator('[role="status"]')).toHaveText(/1\s*\/\s*3/)
 await panel.getByRole('button',{name:L('calendar.next_session'),exact:true}).click()
 await panel.getByRole('button',{name:L('calendar.next_session'),exact:true}).click()
 await expect(panel.getByRole('button',{name:L('calendar.restore'),exact:true})).toBeVisible()
 await expect(panel.locator('[role="status"]')).toHaveText(/3\s*\/\s*3/)
 await fits(page,info,'skipped-week-complete')
 await panel.getByRole('button',{name:L('calendar.previous_session'),exact:true}).click()
 await expect(panel.locator('.calendar-day-session')).toHaveCount(1)
 for(const key of ['calendar.start','calendar.reschedule','calendar.mark_skipped'])await expect(panel.getByRole('button',{name:L(key),exact:true})).toBeVisible()
 await fits(page,info,'planned-week-complete')
 await panel.getByRole('button',{name:L('calendar.reschedule'),exact:true}).click()
 await expect(page.getByRole('dialog')).toBeVisible()
 await page.getByRole('dialog').getByRole('button',{name:L('common.cancel'),exact:true}).click()
 await panel.getByRole('button',{name:L('calendar.start'),exact:true}).click()
 await page.waitForURL('**/#/session')
 expect((await get(request,`/sessions/${sessionIds[1]}`)).status).toBe('in_progress')
})

test('accueil : libellé exact des cinq objectifs du formulaire, en français et en anglais',async({page,request})=>{
 test.setTimeout(60000)
 for(const goal of ['strength','hypertrophy','endurance','weight_loss','general_fitness']){
  const program=await planned(request,{goal,name:'Nom personnalisé distinct de l’objectif'})
  for(const language of ['fr','en']){
   await call(request,'put','/settings',{language})
   const labels=JSON.parse(readFileSync(new URL(`../../public/locales/${language}.json`,import.meta.url),'utf8'))
   await page.goto('/#/');await page.reload()
   const label=labels['programs.goal_'+(goal==='general_fitness'?'general':goal)]
   await expect(page.locator('.dashboard-program__goal')).toHaveText(label)
   await page.locator('.dashboard-program').click()
   await expect(page.locator('.page-header__title')).toHaveText(label)
   await expect(page.locator('.program-activation-hint')).toHaveText(labels['programs.single_active_hint'])
   expect((await get(request,`/programs/${program.id}`)).name).toBe('Nom personnalisé distinct de l’objectif')
  }
 }
})

test('accueil sans programme avec historique : reprise et séance terminée accessibles sans scroll',async({page,request},info)=>{
 const today=new Date().toLocaleDateString('en-CA',{timeZone:'Europe/Paris'})
 for(const [name,complete] of [['Séance terminée avec un nom assez long pour revenir à la ligne',true],['Séance à reprendre avec toutes ses informations visibles',false]]){
  const session=await call(request,'post','/sessions',{name,scheduled_date:today},201)
  await call(request,'post',`/sessions/${session.id}/start`)
  if(complete)await call(request,'post',`/sessions/${session.id}/complete`)
 }
 await page.goto('/#/')
 const panel=page.locator('.calendar-day-panel')
 await expect(panel.getByRole('button',{name:L('calendar.resume'),exact:true})).toBeVisible()
 await fits(page,info,'resume-without-program')
 await panel.getByRole('button',{name:L('calendar.next_session'),exact:true}).click()
 await expect(panel.getByRole('button',{name:L('calendar.view'),exact:true})).toBeVisible()
 await fits(page,info,'completed-without-program')
 await panel.getByRole('button',{name:L('calendar.view'),exact:true}).click()
 await page.waitForURL(/#\/session\/\d+$/)
})
