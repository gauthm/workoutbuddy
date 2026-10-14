import {test,expect} from './fixtures.js'
import {L,get,pending} from './helpers.js'
async function fixedRow(page){
 await page.goto('/#/exercises/material')
 await page.locator('[data-family="free_weights"] > summary').click()
 const group=page.locator('[data-category="dumbbell_fixed"]')
 await group.getByRole('button').last().click()
 return group.locator('.dumbbell-row').last()
}
test('ajouter des haltères → sauvegarder → retrouver quantité et poids après redémarrage',async({page,request,app})=>{
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
test('une ligne invalide ne sauvegarde rien, puis Annuler retire tout le brouillon',async({page,request})=>{
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
