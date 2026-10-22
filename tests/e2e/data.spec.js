import {test,expect} from './fixtures.js'
import {readFile} from 'node:fs/promises'
import {L,get,planned,trainThroughUI,dataSettings} from './helpers.js'
test('downloaded export → stats reset → file import → history and progression restored',async({page,request,app})=>{
 const p=await planned(request);await trainThroughUI(page,request,p)
 await dataSettings(page)
 const event=page.waitForEvent('download')
 await page.getByRole('button',{name:'↓ JSON',exact:true}).click()
 const download=await event,file=await download.path(),backup=JSON.parse(await readFile(file,'utf8'))
 expect(backup.data.exercise_progressions.length).toBeGreaterThan(0)
 await page.getByRole('button',{name:L('settings.reset_stats'),exact:true}).click()
 const dialog=page.getByRole('dialog')
 await expect(dialog.getByRole('button',{name:L('settings.reset_stats_confirm_btn'),exact:true})).toBeDisabled()
 await dialog.locator('input').fill('RESET')
 await dialog.getByRole('button',{name:L('settings.reset_stats_confirm_btn'),exact:true}).click()
 await expect.poll(async()=>(await get(request,'/export')).data.set_logs.length).toBe(0)
 await expect(dialog).toHaveCount(0)
 await page.locator('input[type="file"]').setInputFiles(file)
 await page.getByRole('dialog').getByRole('button',{name:L('common.confirm'),exact:true}).click()
 await expect.poll(async()=>(await get(request,'/export')).data.set_logs.length).toBe(backup.data.set_logs.length)
 await app.restart();await page.goto('/#/session/history')
 const after=(await get(request,'/export')).data
 for(const key of ['set_logs','exercise_progressions','personal_records','user_profile'])expect(after[key]).toEqual(backup.data[key])
 await expect(page.locator('.history-row').first()).toBeVisible()
})
test('an imported file with an unknown reference is rejected without data loss',async({page,request})=>{
 await planned(request)
 const backup=await get(request,'/export'),before=backup.data
 const invalid=structuredClone(backup)
 invalid.data.template_exercises[0].exercise_id='e2e_unknown_exercise'
 await dataSettings(page)
 await page.locator('input[type="file"]').setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(invalid))})
 await page.getByRole('dialog').getByRole('button',{name:L('common.confirm'),exact:true}).click()
 await expect(page.locator('.toast--error')).toBeVisible()
 expect((await get(request,'/export')).data).toEqual(before)
 await page.reload()
 expect((await get(request,'/programs')).programs).toHaveLength(1)
})
