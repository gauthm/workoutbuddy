import {test,expect} from './fixtures.js'
import {L,call,get,planned} from './helpers.js'
import {readFileSync} from 'node:fs'

const screens=[
 ['se',320,568,20,0],['safari-small',375,548,0,0],
 ['iphone',390,844,59,34],['safari',390,664,0,0],
 ['landscape',844,390,0,21],
 ['iphone-landscape',812,375,0,21],
 ['large-iphone',430,932,59,34],['desktop',1280,900,0,0],
]
const sixWeekDate='2026-11-15'

test('dashboard: day panel remains selected after skipped or rescheduled workout',async({page,request})=>{
 const program=await planned(request)
 await call(request,'post','/sessions',{name:'Persistent selection workout',scheduled_date:sixWeekDate,
  program_id:program.id,workout_template_id:program.templates[0].id},201)
 await page.clock.setFixedTime(new Date(sixWeekDate+'T12:00:00'))
 await page.goto('/#/')
 const panel=page.locator('.calendar-day-panel')
 await expect(panel).toContainText('Persistent selection workout')
 await panel.getByRole('button',{name:L('calendar.mark_skipped'),exact:true}).click()
 await page.getByRole('dialog').getByRole('button',{name:L('common.confirm'),exact:true}).click()
 await expect(panel.getByRole('button',{name:L('calendar.restore'),exact:true})).toBeVisible()
 await expect(page.getByRole('button',{name:sixWeekDate,exact:true})).toHaveAttribute('aria-pressed','true')
 await panel.getByRole('button',{name:L('calendar.restore'),exact:true}).click()
 await panel.getByRole('button',{name:L('calendar.reschedule'),exact:true}).click()
 const dialog=page.getByRole('dialog')
 await dialog.locator('input[type="date"]').fill('2026-11-16')
 await dialog.getByRole('button',{name:L('common.confirm'),exact:true}).click()
 await expect(panel.locator('.calendar-day-panel__date')).toHaveText(sixWeekDate)
 await expect(panel).toContainText(L('calendar.no_session'))
 await expect(page.getByRole('button',{name:sixWeekDate,exact:true})).toHaveAttribute('aria-pressed','true')
 await page.getByRole('button',{name:'2026-11-16',exact:true}).click()
 await expect(panel).toContainText('Persistent selection workout')
})

test('dashboard: day always selected, first of month elsewhere and current day on return',async({page})=>{
 await page.clock.setFixedTime(new Date(sixWeekDate+'T12:00:00'))
 await page.goto('/#/')
 const selected=page.locator('.calendar-cell[aria-pressed="true"]')
 async function selection(date) {
  await expect(selected).toHaveCount(1)
  await expect(selected).toHaveAttribute('aria-label',date)
  await expect(page.locator('.calendar-day-panel')).toBeVisible()
  await expect(page.locator('.calendar-day-panel__date')).toHaveText(date)
 }
 await selection(sixWeekDate)
 await selected.click()
 await selection(sixWeekDate)
 await page.getByRole('button',{name:'2026-11-14',exact:true}).click()
 await selection('2026-11-14')
 await selected.click()
 await selection('2026-11-14')
 await page.getByRole('button',{name:L('calendar.previous_month'),exact:true}).click()
 await selection('2026-10-01')
 await page.getByRole('button',{name:L('calendar.next_month'),exact:true}).click()
 await selection(sixWeekDate)
 await page.getByRole('button',{name:L('calendar.next_month'),exact:true}).click()
 await selection('2026-12-01')
 await page.getByRole('button',{name:L('calendar.next_month'),exact:true}).click()
 await selection('2027-01-01')
 await page.getByRole('button',{name:L('calendar.previous_month'),exact:true}).click()
 await selection('2026-12-01')
 await page.clock.setFixedTime(new Date('2026-11-16T12:00:00'))
 await page.getByRole('button',{name:L('calendar.previous_month'),exact:true}).click()
 await selection('2026-11-16')
})

async function fits(page,info,state){
 const cdp=await page.context().newCDPSession(page)
 try{
  for(const [name,width,height,top,bottom] of screens){
   await page.setViewportSize({width,height})
   await cdp.send('Emulation.setSafeAreaInsetsOverride',{insets:{top,bottom,left:0,right:0}})
   await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}))
   await expect.poll(()=>page.evaluate(top=>{
    const errors=[],nav=document.querySelector('.bottom-nav').getBoundingClientRect()
    const shortScreen=innerHeight<=700
    if(!shortScreen && document.documentElement.scrollHeight>innerHeight+1)errors.push('vertical scroll')
    if(document.documentElement.scrollWidth>innerWidth)errors.push('horizontal scroll')
    if(scrollY!==0)errors.push('page already scrolled')
    const grid=document.querySelector('.calendar-grid').getBoundingClientRect(),legend=document.querySelector('.calendar-legend').getBoundingClientRect()
    if(grid.bottom>legend.top+.5)errors.push('calendar overlaps its legend')
    const calendar=document.querySelector('.calendar-embedded').getBoundingClientRect()
    if(!shortScreen && Math.abs(calendar.bottom-nav.top)>2)errors.push('calendar leaves unused space above navigation')
    const header=document.querySelector('.dashboard-view .page-header').getBoundingClientRect()
    const shortcuts=document.querySelector('.dashboard-shortcuts').getBoundingClientRect()
    const program=document.querySelector('.dashboard-program,.dashboard-view .empty-state').getBoundingClientRect()
    if(document.querySelector('.page-header .dashboard-shortcuts'))errors.push('shortcuts still in header')
    if(shortcuts.top<program.bottom-.5)errors.push('shortcuts not below program')
    if(shortcuts.bottom>calendar.top+.5)errors.push('shortcuts overlap calendar')
    if(program.height<56 && document.querySelector('.dashboard-program'))errors.push('program bar too small')
    if(document.querySelector('.calendar-day-panel').getBoundingClientRect().height<140)errors.push('day panel too small')
    const programElement=document.querySelector('.dashboard-program')
    if(programElement && parseFloat(getComputedStyle(programElement).borderBottomWidth)!==0)errors.push('border under active program')
    if(programElement?.querySelector('.badge'))errors.push('redundant active program badge')
    const legendStyle=getComputedStyle(document.querySelector('.calendar-legend'))
    if(parseFloat(legendStyle.borderTopWidth)!==0)errors.push('border above legend')
    if(parseFloat(legendStyle.marginBottom)<6)errors.push('legend too close to day panel')
    const panelStyle=getComputedStyle(document.querySelector('.calendar-day-panel'))
    const headerStyle=getComputedStyle(document.querySelector('.dashboard-view .page-header'))
    const edge=parseFloat(panelStyle.borderTopWidth)>0?'Top':'Left'
    if(panelStyle['border'+edge+'Color']!==headerStyle.borderBottomColor || panelStyle['border'+edge+'Width']!==headerStyle.borderBottomWidth)errors.push('day border differs from header')
    for(const button of document.querySelectorAll('.dashboard-shortcuts .btn')){
     const style=getComputedStyle(button)
     if(parseFloat(style.borderTopWidth)<1 || style.borderTopStyle==='none' || style.backgroundColor==='rgba(0, 0, 0, 0)')errors.push('shortcut lacks a visible button surface')
    }
    for(const element of document.querySelectorAll('.dashboard-view button,.dashboard-view .empty-state__message,.dashboard-view .weekly-complete,.dashboard-view .calendar-legend,.dashboard-view .calendar-day-session__name,.dashboard-view .calendar-day-session__status,.dashboard-view .calendar-day-panel__date')){
     if(!element.getClientRects().length)continue
     if(shortScreen)element.scrollIntoView({block:'center',behavior:'instant'})
     const r=element.getBoundingClientRect()
     if(r.bottom>nav.top+.5 || r.top<(shortScreen?header.bottom:top)-.5 || r.left<-.5 || r.right>innerWidth+.5)errors.push(element.className+': outside usable screen')
     if(element.scrollHeight>element.clientHeight+1)errors.push(element.className+': clipped text')
    }
    window.scrollTo({top:0,behavior:'instant'})
    return errors
   },top),{message:state+' on '+name}).toEqual([])
   await page.screenshot({path:info.outputPath(`${state}-${name}.png`)})
  }
 }finally{await cdp.detach()}
}

test('dashboard without program: six weeks, shortcuts below program and light theme',async({page,request},info)=>{
 await page.clock.setFixedTime(new Date(sixWeekDate+'T12:00:00'))
 for(const theme of ['dark','light']){
  await call(request,'put','/settings',{theme})
  await page.goto('/#/');await page.reload()
  await expect(page.locator('.calendar-cell')).toHaveCount(42)
  await expect(page.getByText(L('session.no_program'),{exact:true})).toBeVisible()
  await expect(page.getByRole('button',{name:L('programs.new'),exact:true})).toBeVisible()
  await fits(page,info,'empty-'+theme)
 }
 const shortcuts=page.locator('.dashboard-shortcuts')
 await shortcuts.getByRole('button',{name:L('programs.title'),exact:true}).click()
 await page.waitForURL('**/#/programs')
 await page.getByRole('button',{name:L('nav.home'),exact:true}).click()
 await shortcuts.getByRole('button',{name:L('session.history_title'),exact:true}).click()
 await page.waitForURL('**/#/session/history')
 await page.getByRole('button',{name:L('nav.home'),exact:true}).click()
 await page.getByRole('button',{name:L('programs.new'),exact:true}).click()
 await page.waitForURL('**/#/programs/new')
})

test('dashboard with program: completed week, multiple workouts and all day actions visible',async({page,request},info)=>{
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
  const session=await call(request,'post','/sessions',{name:`Full body ${n+1} — pushing, pulling and strengthening`,scheduled_date:sixWeekDate,program_id:program.id,workout_template_id:program.templates[0].id},201)
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
 await page.getByRole('button',{name:sixWeekDate,exact:true}).click()
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

test('dashboard: exact labels for all five form goals, in French and English',async({page,request})=>{
 test.setTimeout(60000)
 for(const goal of ['strength','hypertrophy','endurance','weight_loss','general_fitness']){
  const program=await planned(request,{goal,name:'Custom name distinct from the goal'})
  for(const language of ['fr','en']){
   await call(request,'put','/settings',{language})
   const labels=JSON.parse(readFileSync(new URL(`../../public/locales/${language}.json`,import.meta.url),'utf8'))
   await page.goto('/#/');await page.reload()
   const label=labels['programs.goal_'+(goal==='general_fitness'?'general':goal)]
   await expect(page.locator('.dashboard-program__goal')).toHaveText(label)
   await page.locator('.dashboard-program').click()
   await expect(page.locator('.page-header__title')).toHaveText(label)
   await expect(page.locator('.program-activation-hint')).toHaveText(labels['programs.single_active_hint'])
   expect((await get(request,`/programs/${program.id}`)).name).toBe('Custom name distinct from the goal')
  }
 }
})

test('dashboard without program but with history: resumable and completed workouts accessible',async({page,request},info)=>{
 const today=new Date().toLocaleDateString('en-CA',{timeZone:'Europe/Paris'})
 for(const [name,complete] of [['Completed workout with a name long enough to wrap onto another line',true],['Workout to resume with all its information visible',false]]){
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
