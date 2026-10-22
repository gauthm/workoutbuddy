import {test,expect} from './fixtures.js'
import {L,get,planned,trainThroughUI} from './helpers.js'

test('deleting a completed workout from details persists after return, reload and restart',async({page,request,app})=>{
 const p=await planned(request),session=await trainThroughUI(page,request,p)
 await page.goto('/#/session/history')
 await page.getByRole('button',{name:L('session.filter_completed'),exact:true}).click()
 await page.locator('.history-row__main').first().click()
 await page.waitForURL(`**/#/session/${session.id}`)
 await page.getByRole('button',{name:new RegExp(L('session.delete'))}).click()
 await page.getByRole('dialog').getByRole('button',{name:L('common.delete'),exact:true}).click()
 await expect(page).not.toHaveURL(new RegExp(`#/session/${session.id}$`))
 await page.reload();await app.restart();await page.reload()
 const sessions=(await get(request,'/sessions')).sessions
 expect(sessions.some(s=>s.id===session.id)).toBe(false)
 const exported=(await get(request,'/export')).data
 expect(exported.exercise_progressions).toEqual([])
 expect(exported.personal_records).toEqual([])
 await expect(page.getByText('SESSION_NOT_FOUND',{exact:true})).toHaveCount(0)
})

test('mark skipped → restore planned → reschedule in calendar without duplicates',async({page,request})=>{
 await planned(request)
 const session=(await get(request,'/sessions?active_program=1')).sessions.find(s=>s.status==='planned')
 await page.goto('/#/calendar')
 await page.getByRole('button',{name:session.scheduled_date,exact:true}).click()
 const panel=page.locator('.calendar-day-session').filter({hasText:session.name})
 await panel.getByRole('button',{name:L('calendar.mark_skipped'),exact:true}).click()
 await page.getByRole('dialog').getByRole('button',{name:L('common.confirm'),exact:true}).click()
 await page.getByRole('button',{name:session.scheduled_date,exact:true}).click()
 await panel.getByRole('button',{name:L('calendar.restore'),exact:true}).click()
 await expect(panel.getByRole('button',{name:L('calendar.start'),exact:true})).toBeVisible()
 await page.reload();await page.getByRole('button',{name:session.scheduled_date,exact:true}).click()
 await panel.getByRole('button',{name:L('calendar.reschedule'),exact:true}).click()
 const dialog=page.getByRole('dialog')
 const future=new Date(session.scheduled_date+'T12:00:00');future.setDate(future.getDate()+1)
 const date=`${future.getFullYear()}-${String(future.getMonth()+1).padStart(2,'0')}-${String(future.getDate()).padStart(2,'0')}`
 await dialog.locator('input[type="date"]').fill(date)
 await dialog.getByRole('button',{name:L('common.confirm'),exact:true}).click()
 await expect(dialog).toHaveCount(0)
 expect((await get(request,`/sessions/${session.id}`)).scheduled_date).toBe(date)
 expect((await get(request,'/sessions')).sessions.filter(s=>s.id===session.id)).toHaveLength(1)
})

test('resetting a completed workout removes results and allows restarting',async({page,request,app})=>{
 const p=await planned(request),session=await trainThroughUI(page,request,p)
 await page.goto(`/#/session/${session.id}`)
 await page.getByRole('button',{name:L('session.reset_workout'),exact:true}).click()
 const dialog=page.getByRole('dialog')
 await dialog.getByRole('button',{name:L('common.cancel'),exact:true}).click()
 expect((await get(request,`/sessions/${session.id}`)).status).toBe('completed')
 await page.getByRole('button',{name:L('session.reset_workout'),exact:true}).click()
 await dialog.getByRole('button',{name:L('session.reset_workout'),exact:true}).click()
 await expect(dialog).toHaveCount(0)
 await expect(page.getByRole('button',{name:L('calendar.start'),exact:true})).toBeVisible()
 await app.restart();await page.reload()
 const exported=(await get(request,'/export')).data
 expect(exported.set_logs).toEqual([]);expect(exported.exercise_progressions).toEqual([])
 expect(exported.personal_records).toEqual([])
 await page.getByRole('button',{name:L('calendar.start'),exact:true}).click()
 await page.waitForURL('**/#/session')
 await expect(page.locator('.exercise-block').first()).toBeVisible()
 expect((await get(request,`/sessions/${session.id}`)).status).toBe('in_progress')
})
