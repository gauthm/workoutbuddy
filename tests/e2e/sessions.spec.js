import {test,expect} from './fixtures.js'
import {L,get,planned,startThroughUI,trainThroughUI} from './helpers.js'

test('saisir → annuler une série → reprendre après rechargement et redémarrage du vrai serveur',async({page,request,app})=>{
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

test('terminer toutes les séries → progression conservée → prochaines cibles proposées en séance',async({page,request})=>{
 const p=await planned(request)
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

test('une sauvegarde de série interrompue laisse la saisie réessayable sans doublon',async({page,request})=>{
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
