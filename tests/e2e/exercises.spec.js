import {test,expect} from './fixtures.js'
import {L,get,homeGym} from './helpers.js'
test('recherche et filtres conservés en revenant de la fiche, catalogue seul et matériel respecté',async({page,request})=>{
 await homeGym(request)
 await page.goto('/#/exercises')
 await page.getByRole('searchbox',{name:L('exercises.search'),exact:true}).fill('Dumbbell')
 await page.locator('.exercise-filter__panel > summary').click()
 await page.getByRole('combobox',{name:L('exercises.filter_muscle'),exact:true}).selectOption('chest')
 await page.getByLabel(L('exercises.available_equipment'),{exact:true}).check()
 await expect(page.locator('.exercise-card').first()).toContainText(/Dumbbell/i)
 const first=await page.locator('.exercise-card__name').first().textContent()
 await page.locator('.exercise-card').first().click()
 await page.waitForURL(/#\/exercises\/[^/]+$/)
 await page.goBack()
 await expect(page.getByRole('searchbox',{name:L('exercises.search'),exact:true})).toHaveValue('Dumbbell')
 await expect(page.getByRole('combobox',{name:L('exercises.filter_muscle'),exact:true})).toHaveValue('chest')
 await expect(page.getByLabel(L('exercises.available_equipment'),{exact:true})).toBeChecked()
 await expect(page.locator('.exercise-card__name').first()).toHaveText(first)
 expect((await get(request,'/exercises')).exercises.every(e=>!e.is_custom)).toBe(true)
})
test('exclure un exercice persiste après rechargement et met à jour le compteur',async({page,request})=>{
 await page.goto('/#/exercises')
 const available=(await get(request,'/exercises?excluded=0')).exercises.length
 const badge=page.locator('.exercise-tabs__badge')
 await expect(badge).toHaveText(String(available))
 const initial=available
 const name=await page.locator('.exercise-card__name').first().textContent()
 await page.locator('.exercise-card').first().getByRole('button',{name:L('exercises.exclude_btn'),exact:true}).click()
 await expect(badge).toHaveText(String(initial-1))
 await page.reload()
 await expect(badge).toHaveText(String(initial-1))
 expect((await get(request,'/exercises?excluded=1')).exercises.some(e=>e.name_fr===name)).toBe(true)
})
