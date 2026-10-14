import {test,expect} from './fixtures.js'
import {L,get,planned,trainThroughUI} from './helpers.js'
test('une séance terminée alimente les compteurs et le graphique, puis le regroupement musculaire',async({page,request})=>{
 const program=await planned(request);await trainThroughUI(page,request,program)
 await page.goto('/#/stats')
 const overview=await get(request,'/stats/overview')
 await expect(page.locator('.stats-metric').filter({hasText:L('stats.sessions_total')}).locator('strong')).toHaveText(String(overview.total_sessions))
 await expect(page.locator('canvas')).toBeVisible()
 await page.getByRole('combobox',{name:L('stats.grouping'),exact:true}).selectOption('muscle')
 await expect(page.locator('canvas')).toBeVisible()
 await page.reload()
 await expect(page.locator('.stats-metric').first().locator('strong')).toHaveText('1')
})
test('statistiques vierges : compteurs à zéro et état vide sans erreur de graphique',async({page})=>{
 await page.goto('/#/stats')
 await expect(page.locator('.stats-metric').first().locator('strong')).toHaveText('0')
 await expect(page.getByText(L('stats.no_data'),{exact:true})).toBeVisible()
 await expect(page.locator('canvas')).toHaveCount(0)
 await expect(page.locator('.stats-dashboard')).not.toContainText('NaN')
})
