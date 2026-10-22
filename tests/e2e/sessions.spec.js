import {test,expect} from './fixtures.js'
import {L,get,planned,startThroughUI,trainThroughUI} from './helpers.js'

test('enter data → undo a set → resume after reload and real server restart',async({page,request,app})=>{
 const p=await planned(request)
 await startThroughUI(page,p)
 const row=page.locator('.exercise-block--active .set-row').first()
 await row.locator('input').nth(0).fill('10');await row.locator('input').nth(1).fill('12')
 await row.getByRole('button',{name:/Valider la série/}).click()
 await expect(row.getByRole('button',{name:/Annuler la série/})).toBeVisible()
 await row.getByRole('button',{name:/Annuler la série/}).click()
 await expect(row.getByRole('button',{name:/Valider la série/})).toBeVisible()
 await row.getByRole('button',{name:/Valider la série/}).click()
 await expect(row.getByRole('button',{name:/Annuler la série/})).toBeVisible()
 await page.reload()
 await expect(page.locator('.set-row input').first()).toHaveValue('10')
 await app.restart();await page.reload()
 await expect(page.getByRole('button',{name:/Annuler la série/}).first()).toBeVisible()
 const active=(await get(request,'/sessions?status=in_progress')).sessions
 expect(active).toHaveLength(1)
 const detail=await get(request,`/sessions/${active[0].id}`)
 expect(detail.exercises[0].sets.filter(s=>s.is_completed)).toHaveLength(1)
 expect((await get(request,'/export')).data.exercise_progressions).toEqual([])
})

test('complete all sets → progression preserved → next targets suggested during workout',async({page,request})=>{
 // Include today: on a Friday, a Mon/Thu program only has next week's slots,
 // and performing its first workout early legitimately occupies its original slot.
 const weekday=(new Date().getDay()+6)%7
 const p=await planned(request,{training_days:[weekday,(weekday+3)%7].sort((a,b)=>a-b)})
 const session=await trainThroughUI(page,request,p)
 const exported=(await get(request,'/export')).data
 expect(exported.exercise_progressions.length).toBeGreaterThan(0)
 const learned=exported.exercise_progressions.find(e=>e.exercise_id===session.exercises[0].exercise_id)
 expect(learned.current_weight_kg).toBe(11)
 const next=(await get(request,'/sessions?active_program=1')).sessions.find(s=>s.status==='planned' && s.workout_template_id===session.workout_template_id)
 expect(next).toBeTruthy()
 await page.goto('/#/calendar')
 await expect(page.locator('.calendar-grid')).toBeVisible()
 const day=page.getByRole('button',{name:next.scheduled_date,exact:true})
 if(!await day.count())await page.getByRole('button',{name:L('calendar.next_month'),exact:true}).click()
 await day.click()
 await page.locator('.calendar-day-session').filter({hasText:next.name}).getByRole('button',{name:L('calendar.start'),exact:true}).click()
 await expect(page.locator('.exercise-block').first()).toBeVisible()
 const active=(await get(request,'/sessions?status=in_progress')).sessions[0]
 const detail=await get(request,`/sessions/${active.id}`)
 const target=await get(request,`/sessions/${active.id}/target/${detail.exercises[0].template_exercise_id}`)
 expect(target.weight_kg).toBe(learned.current_weight_kg)
 await expect(page.locator('.exercise-block--active .set-row input').first()).toHaveValue(String(target.weight_kg))
})

test('an interrupted set save leaves input retryable without duplicates',async({page,request})=>{
 const p=await planned(request);await startThroughUI(page,p)
 const row=page.locator('.exercise-block--active .set-row').first()
 await row.locator('input').nth(0).fill('10');await row.locator('input').nth(1).fill('12')
 await page.route('**/api/v1/session-exercises/*/sets',route=>route.abort('connectionfailed'),{times:1})
 await row.getByRole('button',{name:/Valider la série/}).click()
 await expect(page.locator('.toast--error')).toBeVisible()
 await expect(row.locator('input').first()).toHaveValue('10')
 await row.getByRole('button',{name:/Valider la série/}).click()
 await expect(row.getByRole('button',{name:/Annuler la série/})).toBeVisible()
 const active=(await get(request,'/sessions?status=in_progress')).sessions[0]
 const detail=await get(request,`/sessions/${active.id}`)
 expect(detail.exercises[0].sets).toHaveLength(1)
})

test('finishing offers continue or leave without saving, returning to an empty workout',async({page,request,app})=>{
 const p=await planned(request);await startThroughUI(page,p)
 const active=(await get(request,'/sessions?status=in_progress')).sessions[0]
 const row=page.locator('.exercise-block--active .set-row').first()
 await row.locator('input').nth(0).fill('10');await row.locator('input').nth(1).fill('12')
 await row.getByRole('button',{name:/Valider la série/}).click()
 await expect(row.getByRole('button',{name:/Annuler la série/})).toBeVisible()
 await page.getByRole('banner').getByRole('button',{name:L('session.complete'),exact:true}).click()
 const dialog=page.getByRole('dialog')
 await dialog.getByRole('button',{name:L('session.continue_workout'),exact:true}).click()
 await expect(dialog).toHaveCount(0)
 expect((await get(request,`/sessions/${active.id}`)).status).toBe('in_progress')
 await page.getByRole('banner').getByRole('button',{name:L('session.complete'),exact:true}).click()
 await dialog.getByRole('button',{name:L('session.discard_exit'),exact:true}).click()
 await page.waitForURL('**/#/')
 await app.restart();await page.reload()
 const reset=await get(request,`/sessions/${active.id}`)
 expect(reset.status).toBe('planned');expect(reset.started_at).toBeNull()
 expect(reset.exercises.every(ex=>!ex.sets.length)).toBe(true)
 expect((await get(request,'/export')).data.personal_records).toEqual([])
 expect((await get(request,'/sessions?status=in_progress')).sessions).toHaveLength(0)
})

test('set response lost after write: retry retains one set',async({page,request})=>{
 const p=await planned(request);await startThroughUI(page,p)
 const row=page.locator('.exercise-block--active .set-row').first()
 await row.locator('input').nth(0).fill('10');await row.locator('input').nth(1).fill('12')
 await page.route('**/api/v1/session-exercises/*/sets',async route=>{await route.fetch();await route.abort('connectionfailed')},{times:1})
 await row.getByRole('button',{name:/Valider la série/}).click()
 await expect(page.locator('.toast--error')).toBeVisible()
 await row.getByRole('button',{name:/Valider la série/}).click()
 await expect(row.getByRole('button',{name:/Annuler la série/})).toBeVisible()
 const s=(await get(request,'/sessions?status=in_progress')).sessions[0],detail=await get(request,`/sessions/${s.id}`)
 expect(detail.exercises[0].sets).toHaveLength(1)
})

test('cannot finish during a set save, then recover lost completion response',async({page,request})=>{
 const p=await planned(request);await startThroughUI(page,p)
 const row=page.locator('.exercise-block--active .set-row').first()
 await row.locator('input').nth(0).fill('10');await row.locator('input').nth(1).fill('12')
 let release;const gate=new Promise(resolve=>{release=resolve})
 await page.route('**/api/v1/session-exercises/*/sets',async route=>{await gate;await route.continue()},{times:1})
 await row.getByRole('button',{name:/Valider la série/}).click()
 const finish=page.getByRole('banner').getByRole('button',{name:L('session.complete'),exact:true})
 try {await expect(finish).toBeDisabled()} finally {release()}
 await expect(row.getByRole('button',{name:/Annuler la série/})).toBeVisible()
 await expect(finish).toBeEnabled()
 await page.route('**/api/v1/sessions/*/complete',async route=>{await route.fetch();await route.abort('connectionfailed')},{times:1})
 await finish.click()
 await page.getByRole('dialog').getByRole('button',{name:L('session.save_exit'),exact:true}).click()
 await page.waitForURL('**/#/session/history')
 expect((await get(request,'/sessions?status=completed')).sessions).toHaveLength(1)
 const saved=(await get(request,'/export')).data
 expect(saved.set_logs).toHaveLength(1)
 expect(saved.exercise_progression_events).toHaveLength(1)
})

test('abrupt shutdown after completion: workout and set recovered without duplicates',async({page,request,app})=>{
 const p=await planned(request);await startThroughUI(page,p)
 const row=page.locator('.exercise-block--active .set-row').first()
 await row.locator('input').nth(0).fill('10');await row.locator('input').nth(1).fill('12')
 await row.getByRole('button',{name:/Valider la série/}).click()
 await expect(row.getByRole('button',{name:/Annuler la série/})).toBeVisible()
 const before=(await get(request,'/sessions?status=in_progress')).sessions[0]
 await app.restart({abrupt:true});await page.reload()
 await expect(page.locator('.exercise-block--active .set-row--done')).toHaveCount(1)
 const after=(await get(request,'/sessions?status=in_progress')).sessions
 expect(after).toHaveLength(1);expect(after[0].id).toBe(before.id);expect(after[0].started_at).toBe(before.started_at)
 const detail=await get(request,`/sessions/${before.id}`)
 expect(detail.exercises[0].sets).toHaveLength(1)
 expect(detail.exercises[0].sets[0].weight_kg).toBe(10)
})

test('retry with a different value after lost response: explicit conflict and no silent write',async({page,request})=>{
 const p=await planned(request);await startThroughUI(page,p)
 const row=page.locator('.exercise-block--active .set-row').first()
 await row.locator('input').nth(0).fill('10');await row.locator('input').nth(1).fill('12')
 await page.route('**/api/v1/session-exercises/*/sets',async route=>{await route.fetch();await route.abort('connectionfailed')},{times:1})
 await row.getByRole('button',{name:/Valider la série/}).click()
 await expect(page.locator('.toast--error')).toBeVisible()
 await row.locator('input').nth(0).fill('20')
 await row.getByRole('button',{name:/Valider la série/}).click()
 await expect(page.locator('.toast--error').filter({hasText:L('session.set_conflict')})).toBeVisible()
 await page.reload()
 await expect(page.locator('.exercise-block--active .set-row--done input').first()).toHaveValue('10')
 const active=(await get(request,'/sessions?status=in_progress')).sessions[0]
 expect((await get(request,`/sessions/${active.id}`)).exercises[0].sets).toHaveLength(1)
})

test('leave without saving recovers a lost response after reset',async({page,request})=>{
 const p=await planned(request);await startThroughUI(page,p)
 const active=(await get(request,'/sessions?status=in_progress')).sessions[0]
 const row=page.locator('.exercise-block--active .set-row').first()
 await row.locator('input').nth(0).fill('10');await row.locator('input').nth(1).fill('12')
 await row.getByRole('button',{name:/Valider la série/}).click()
 await expect(row.getByRole('button',{name:/Annuler la série/})).toBeVisible()
 await page.route('**/api/v1/sessions/*/reset',async route=>{await route.fetch();await route.abort('connectionfailed')},{times:1})
 await page.getByRole('banner').getByRole('button',{name:L('session.complete'),exact:true}).click()
 await page.getByRole('dialog').getByRole('button',{name:L('session.discard_exit'),exact:true}).click()
 await page.waitForURL('**/#/')
 const reset=await get(request,`/sessions/${active.id}`)
 expect(reset.status).toBe('planned');expect(reset.started_at).toBeNull()
 expect(reset.exercises.every(ex=>!ex.sets.length)).toBe(true)
 expect((await get(request,'/sessions?status=in_progress')).sessions).toHaveLength(0)
})
