import {test,expect} from './fixtures.js'
import {L,get,pending} from './helpers.js'
async function fixedRow(page){
 await page.goto('/#/exercises/material')
 await page.locator('[data-family="free_weights"] > summary').click()
 const group=page.locator('[data-category="dumbbell_fixed"]')
 await group.getByRole('button').last().click()
 return group.locator('.dumbbell-row').last()
}
test('add dumbbells → save → recover count and weight after restart',async({page,request,app})=>{
 const row=await fixedRow(page)
 await row.locator('input').nth(0).fill('2');await row.locator('input').nth(1).fill('8')
 await pending(page).getByRole('button',{name:L('common.save'),exact:true}).click()
 await expect(pending(page)).toHaveCount(0)
 const items=(await get(request,'/equipment')).items
 expect(items.filter(i=>i.category==='dumbbell_fixed')).toMatchObject([{count:2,weight_kg:8}])
 await app.restart();await page.reload()
 await page.locator('[data-family="free_weights"] > summary').click()
 await expect(page.locator('[data-category="dumbbell_fixed"] input').nth(0)).toHaveValue('2')
 await expect(page.locator('[data-category="dumbbell_fixed"] input').nth(1)).toHaveValue('8')
})
test('an invalid row saves nothing, then Cancel removes the entire draft',async({page,request})=>{
 const row=await fixedRow(page)
 await row.locator('input').nth(0).fill('0');await row.locator('input').nth(1).fill('8')
 await pending(page).getByRole('button',{name:L('common.save'),exact:true}).click()
 await expect(pending(page)).toBeVisible()
 expect((await get(request,'/equipment')).items).toEqual([])
 await pending(page).getByRole('button',{name:L('common.cancel'),exact:true}).click()
 await expect(page.locator('[data-category="dumbbell_fixed"] .dumbbell-row')).toHaveCount(0)
 await expect(pending(page)).toHaveCount(0)
 await page.reload()
 expect((await get(request,'/equipment')).items).toEqual([])
})

test('custom equipment sheet keeps actions reachable with keyboard, rotation and a long pasted name',async({page},info)=>{
 const mobile=info.project.name==='mobile'
 await page.addInitScript(()=>{
  let height=null,top=0
  Object.defineProperties(visualViewport,{height:{get:()=>height??innerHeight},offsetTop:{get:()=>top}})
  window.sheetViewport=(value=null,offset=0)=>{
   height=value;top=offset
   visualViewport.dispatchEvent(new Event('resize'))
   visualViewport.dispatchEvent(new Event('scroll'))
  }
 })
 for(const viewport of [{width:320,height:568},{width:844,height:390},{width:390,height:844}]){
  await page.setViewportSize(viewport)
  await page.goto('/#/exercises/material')
  await page.getByRole('button',{name:L('equipment.add_other'),exact:true}).click()
  const dialog=page.getByRole('dialog'),name=dialog.getByRole('textbox',{name:L('equipment.name'),exact:true})
  const pasted='Custom equipment '.repeat(20)
  await name.fill(pasted)
  const height=Math.max(200,viewport.height-300),offset=mobile?24:0
  await page.evaluate(({height,offset})=>sheetViewport(height,offset),{height,offset})
  if(mobile)await expect(page.locator('.bottom-nav')).toBeHidden()
  // Both keyboard resize and panning must leave the action buttons inside the visible area.
  await dialog.locator('.modal__actions').evaluate(el=>el.scrollIntoView({block:'end'}))
  const actions=await dialog.locator('.modal__actions').boundingBox()
  expect(actions.y).toBeGreaterThanOrEqual(offset)
  expect(actions.y+actions.height).toBeLessThanOrEqual(mobile?height+offset:viewport.height)
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(viewport.width)
  await expect(name).toHaveValue(pasted)
  await page.screenshot({path:info.outputPath(`equipment-sheet-${viewport.width}.png`)})
  await page.evaluate(()=>sheetViewport())
  await dialog.getByRole('button',{name:L('common.cancel'),exact:true}).click()
  await expect(dialog).toHaveCount(0)
  await expect(pending(page)).toHaveCount(0)
  await expect(page.locator('.bottom-nav')).toBeVisible()
  await page.getByRole('button',{name:L('equipment.add_other'),exact:true}).click()
  await expect(page.getByRole('dialog').getByRole('textbox')).toHaveValue('')
  await page.keyboard.press('Escape')
 }
})
