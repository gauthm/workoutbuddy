import {expect} from './fixtures.js'
import {readFileSync} from 'node:fs'
export const labels=JSON.parse(readFileSync(new URL('../../public/locales/fr.json',import.meta.url),'utf8'))
export const L=key=>labels[key]
export const params={goal:'general_fitness',level:'beginner',days_per_week:2,training_days:[0,3],session_duration_min:20,duration_weeks:8,priority_muscles:[],language:'fr'}
export async function call(request,method,path,data,status=200){
  const response=await request[method]('/api/v1'+path,{data})
  expect(response.status(),`${method} ${path}: ${await response.text()}`).toBe(status)
  return response.status()===204?null:response.json()
}
export const get=(r,path)=>call(r,'get',path)
export async function homeGym(request){
  for(const item of[{category:'dumbbell_adjustable',name:'Paire test',count:2,weight_min_kg:2,weight_max_kg:30,weight_step_kg:1},
    {category:'bench_adjustable',name:'Banc test',count:1}])await call(request,'post','/equipment',item,201)
}
export async function planned(request,overrides={}){
  await homeGym(request)
  const result=await call(request,'post','/programs/generate',{...params,...overrides},201)
  await call(request,'post',`/programs/${result.id}/activate`)
  return get(request,`/programs/${result.id}`)
}
export async function startThroughUI(page,program){
  await page.goto(`/#/programs/${program.id}`)
  await page.getByRole('button',{name:L('programs.start_session'),exact:true}).click()
  await expect(page.locator('.exercise-block').first()).toBeVisible()
}
export async function trainThroughUI(page,request,program){
  await startThroughUI(page,program)
  const active=(await get(request,'/sessions?status=in_progress')).sessions[0]
  const detail=await get(request,`/sessions/${active.id}`)
  for(const ex of detail.exercises){
    const block=page.locator(`[data-exercise-id="${ex.id}"]`)
    if(!await block.locator('.set-row').first().isVisible())await block.locator('.exercise-block__toggle').click()
    const rows=block.locator('.set-row:not(.set-row--warmup)')
    for(let i=0;i<await rows.count();i++){
      const row=rows.nth(i)
      await row.locator('input').nth(0).fill(ex.exercise_id.includes('dumbbell')?'10':'0')
      await row.locator('input').nth(1).fill(String(ex.target_reps_max))
      await row.getByRole('button',{name:/Valider la série/}).click()
      await expect(row.getByRole('button',{name:/Annuler la série/})).toBeVisible()
    }
  }
  await page.getByRole('banner').getByRole('button',{name:L('session.complete'),exact:true}).click()
  await page.getByRole('dialog').getByRole('button',{name:L('session.save_exit'),exact:true}).click()
  await expect.poll(async()=>(await get(request,`/sessions/${active.id}`)).status).toBe('completed')
  await page.waitForURL('**/#/session/history')
  return get(request,`/sessions/${active.id}`)
}
export async function dataSettings(page){
 await page.goto('/#/settings')
 await page.getByText(L('settings.section_advanced'),{exact:true}).click()
}
export const pending=page=>page.getByRole('region',{name:L('settings.pending_changes'),exact:true})
