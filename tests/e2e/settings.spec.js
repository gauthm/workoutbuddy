import {test,expect} from './fixtures.js'
import {L,get,pending} from './helpers.js'
import {authenticationProxy} from './authProxy.js'
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

test('écran allumé : préférence enregistrée, conservée en navigation et libérée après désactivation',async({page,request})=>{
 await page.addInitScript(()=>{
  window.__screenLock={requests:0,releases:0}
  Object.defineProperty(navigator,'wakeLock',{configurable:true,value:{request:async()=>{
   window.__screenLock.requests++
   const lock=new EventTarget()
   lock.released=false
   lock.release=async()=>{
    if(lock.released)return
    lock.released=true;window.__screenLock.releases++
    lock.dispatchEvent(new Event('release'))
   }
   return lock
  }}})
 })
 await page.goto('/#/settings')
 await page.getByText(L('settings.section_general'),{exact:true}).click()
 const toggle=page.getByRole('checkbox',{name:L('settings.keep_screen_awake'),exact:false})
 await expect(toggle).not.toBeChecked()
 await toggle.check()
 expect(await page.evaluate(()=>window.__screenLock.requests)).toBe(0)
 await pending(page).getByRole('button',{name:L('common.cancel'),exact:true}).click()
 await expect(toggle).not.toBeChecked()
 await toggle.check()
 await pending(page).getByRole('button',{name:L('common.save'),exact:true}).click()
 await expect(page.getByText(L('settings.keep_screen_awake_active'),{exact:true})).toBeVisible()
 expect((await get(request,'/settings')).keep_screen_awake).toBe(true)
 await page.getByRole('button',{name:L('nav.home'),exact:true}).click()
 expect(await page.evaluate(()=>window.__screenLock)).toEqual({requests:1,releases:0})
 await page.reload()
 await expect.poll(()=>page.evaluate(()=>window.__screenLock.requests)).toBe(1)
 await page.getByRole('button',{name:L('nav.settings'),exact:true}).click()
 await page.getByText(L('settings.section_general'),{exact:true}).click()
 await expect(toggle).toBeChecked()
 await toggle.uncheck()
 await pending(page).getByRole('button',{name:L('common.save'),exact:true}).click()
 await expect.poll(()=>page.evaluate(()=>window.__screenLock.releases)).toBe(1)
 expect((await get(request,'/settings')).keep_screen_awake).toBe(false)
})

for(const mode of ['unsupported','denied']) {
 test(`écran allumé : navigateur ${mode}, indication claire et réglages utilisables`,async({page})=>{
  await page.addInitScript(mode=>{
   Object.defineProperty(navigator,'wakeLock',{configurable:true,value:mode==='unsupported'?undefined:{request:async()=>{throw new DOMException('Unavailable','NotAllowedError')}}})
  },mode)
  await page.goto('/#/settings')
  await page.getByText(L('settings.section_general'),{exact:true}).click()
  await page.getByRole('checkbox',{name:L('settings.keep_screen_awake'),exact:false}).check()
  await pending(page).getByRole('button',{name:L('common.save'),exact:true}).click()
  await expect(pending(page)).toHaveCount(0)
  await expect(page.getByText(L(mode==='unsupported'?'settings.keep_screen_awake_unsupported':'settings.keep_screen_awake_unavailable'),{exact:true})).toBeVisible()
  await expect(page.getByText(L('settings.keep_screen_awake_active'),{exact:true})).toHaveCount(0)
 })
}
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

test('la déconnexion reste masquée pour une installation locale sans authentification',async({page})=>{
 await page.goto('/#/settings')
 await expect(page.locator('.settings-section')).toHaveCount(5)
 await expect(page.getByRole('button',{name:L('settings.logout'),exact:true})).toHaveCount(0)
})

test('déconnexion : confirmation des brouillons, annulation puis retour au portail sans modifier les données',async({page,app,request})=>{
 const proxy=await authenticationProxy(app)
 try {
  const before=await get(request,'/user-profile')
  await page.goto(proxy.url+'/#/settings')
  await expect(page.locator('.settings-account').getByRole('heading')).toHaveCount(0)
  await expect(page.locator('.settings-account')).toHaveText(L('settings.logout'))
  await page.getByText(L('settings.section_profile'),{exact:true}).click()
  const name=page.getByLabel(L('settings.profile_display_name'),{exact:true})
  await name.fill('Draft before logout')
  const logout=page.getByRole('button',{name:L('settings.logout'),exact:true})
  await logout.click()
  await expect(page.getByRole('dialog')).toContainText(L('settings.logout_unsaved'))
  await page.getByRole('dialog').getByRole('button',{name:L('common.cancel'),exact:true}).click()
  await expect(name).toHaveValue('Draft before logout')
  await logout.click()
  await page.getByRole('dialog').getByRole('button',{name:L('settings.logout'),exact:true}).click()
  await expect(page).toHaveURL(proxy.loginURL)
  await expect(page.getByRole('heading',{name:'Authentication portal'})).toBeVisible()
  expect((await request.get(proxy.url+'/api/v1/settings',{headers:{Accept:'application/json'},maxRedirects:0})).status()).toBe(401)
  expect(await get(request,'/user-profile')).toEqual(before)
 } finally {await proxy.dispose()}
})
