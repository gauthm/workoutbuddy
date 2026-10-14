import {test,expect} from './fixtures.js'
import {L,get,pending} from './helpers.js'
async function edit(page){
 await page.goto('/#/settings')
 await page.getByText(L('settings.section_general'),{exact:true}).click()
 await page.locator('#SettingsView-state-settings-theme').selectOption('light')
 await page.getByText(L('settings.section_profile'),{exact:true}).click()
 await page.getByLabel(L('settings.profile_display_name'),{exact:true}).fill('Camille test')
}
test('sauvegarde groupée du profil et des préférences persistante après redémarrage',async({page,request,app})=>{
 await edit(page)
 await pending(page).getByRole('button',{name:L('common.save'),exact:true}).click()
 await expect(pending(page)).toHaveCount(0)
 expect((await get(request,'/settings')).theme).toBe('light')
 expect((await get(request,'/user-profile')).display_name).toBe('Camille test')
 await app.restart();await page.reload()
 await page.getByText(L('settings.section_profile'),{exact:true}).click()
 await expect(page.getByLabel(L('settings.profile_display_name'),{exact:true})).toHaveValue('Camille test')
 await expect(page.locator('html')).toHaveAttribute('data-theme','light')
})
test('échec réseau à la sauvegarde → brouillon intact → nouvelle tentative réussie',async({page,request})=>{
 const before=await get(request,'/settings')
 await edit(page)
 await page.route('**/api/v1/settings/save',route=>route.abort('connectionfailed'),{times:1})
 await pending(page).getByRole('button',{name:L('common.save'),exact:true}).click()
 await expect(page.locator('.toast--error')).toBeVisible()
 expect((await get(request,'/settings')).theme).toBe(before.theme)
 expect((await get(request,'/user-profile')).display_name).not.toBe('Camille test')
 await expect(page.getByLabel(L('settings.profile_display_name'),{exact:true})).toHaveValue('Camille test')
 await pending(page).getByRole('button',{name:L('common.save'),exact:true}).click()
 await expect(pending(page)).toHaveCount(0)
 expect((await get(request,'/user-profile')).display_name).toBe('Camille test')
})
