import {test as base,expect} from './fixtures.js'
import {isolatedApp} from './environment.js'
import {readFile,writeFile} from 'node:fs/promises'
import {join} from 'node:path'
import {L} from './helpers.js'
import {authenticationProxy} from './authProxy.js'

const test=base.extend({
  app:async({},use)=>{
    const app=await isolatedApp({snapshotAssets:true})
    try {await use(app)} finally {await app.dispose()}
  },
})
test.use({serviceWorkers:'allow'})

async function controlled(page,path='/#/stats') {
  await page.goto(path)
  await page.waitForFunction(()=>navigator.serviceWorker.controller && window.__store,null,{timeout:20000})
  await page.evaluate(()=>{window.updateTestMarker=true})
}
async function publish(app) {
  const sw=join(app.assetDirectory,'sw.js'),css=join(app.assetDirectory,'css/components.css')
  const old=await readFile(sw,'utf8')
  const next=old.replace(/workoutbuddy-v(\d+)/,(_,n)=>`workoutbuddy-v${Number(n)+1}`)
  await writeFile(css,(await readFile(css,'utf8'))+'\n:root { --update-test-release: deployed; }\n')
  await writeFile(sw,next)
}
async function update(page) {
  await page.evaluate(async()=>{await(await navigator.serviceWorker.getRegistration()).update()})
}
const release=page=>page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--update-test-release').trim())

test('automatic update without hard refresh, API outside cache and foreign caches preserved',async({page,app,context})=>{
  await controlled(page)
  await page.evaluate(async()=>{await caches.open('unrelated-app-cache')})
  await publish(app)
  // Returning from iOS's background/BFCache must trigger a fresh version check.
  await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})))
  await expect(page.locator('html')).toHaveCSS('--update-test-release',/deployed/)
  expect(await page.evaluate(()=>window.updateTestMarker)).toBeUndefined()
  const cacheState=await page.evaluate(async()=>({keys:await caches.keys(),urls:(await(await caches.open((await caches.keys()).find(k=>k.startsWith('workoutbuddy-v')))).keys()).map(r=>r.url)}))
  expect(cacheState.keys).toContain('unrelated-app-cache')
  expect(cacheState.urls.some(url=>new URL(url).pathname.startsWith('/api/'))).toBe(false)
  await context.setOffline(true)
  expect(await page.evaluate(async()=>{const response=await fetch('/api/v1/settings');return {status:response.status,body:await response.json()}})).toEqual({status:503,body:{error:'OFFLINE'}})
  await context.setOffline(false)
})

test('one update banner saves settings before reload',async({page,request,app})=>{
  await controlled(page,'/#/settings')
  await page.getByText(L('settings.section_profile'),{exact:true}).click()
  const name=page.getByLabel(L('settings.profile_display_name'),{exact:true})
  await name.fill('Synthetic update draft')
  await publish(app);await update(page)
  const banner=page.locator('.app-update')
  await expect(banner).toContainText(L('updates.will_save'))
  await expect(banner.getByRole('button')).toHaveText(L('updates.save_apply'))
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await banner.getByRole('button').click()
  await expect(page.locator('html')).toHaveCSS('--update-test-release',/deployed/)
  expect((await(await request.get('/api/v1/user-profile')).json()).display_name).toBe('Synthetic update draft')
  expect(await page.evaluate(()=>window.updateTestMarker)).toBeUndefined()
})

test('failed settings save keeps the draft and allows retry without reload',async({page,app,context})=>{
  await controlled(page,'/#/settings')
  await page.getByText(L('settings.section_profile'),{exact:true}).click()
  const name=page.getByLabel(L('settings.profile_display_name'),{exact:true})
  await name.fill('Retry update draft')
  await publish(app);await update(page)
  await context.route('**/api/v1/settings/save',route=>route.abort())
  await page.locator('.app-update button').click()
  await expect(page.locator('.app-update')).toContainText(L('updates.save_failed'))
  await expect(name).toHaveValue('Retry update draft')
  expect(await page.evaluate(()=>window.updateTestMarker)).toBe(true)
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await context.unroute('**/api/v1/settings/save')
  await page.locator('.app-update button').click()
  await expect(page.locator('html')).toHaveCSS('--update-test-release',/deployed/)
})

test('update saves inventory and hides behind an open custom form',async({page,request,app})=>{
  await controlled(page,'/#/exercises/material')
  await page.locator('[data-family="free_weights"] > summary').click()
  const group=page.locator('[data-category="dumbbell_fixed"]')
  await group.getByRole('button').last().click()
  const row=group.locator('.dumbbell-row').last()
  await row.locator('input').nth(0).fill('2')
  await row.locator('input').nth(1).fill('8')
  await publish(app);await update(page)
  await expect(page.locator('.app-update button')).toHaveText(L('updates.save_apply'))
  await page.getByRole('button',{name:L('equipment.add_other'),exact:true}).click()
  await expect(page.getByRole('dialog')).toHaveCount(1)
  await expect(page.locator('.app-update')).toBeHidden()
  await page.getByRole('dialog').getByRole('button',{name:L('common.cancel'),exact:true}).click()
  await page.locator('.app-update button').click()
  await expect(page.locator('html')).toHaveCSS('--update-test-release',/deployed/)
  const items=(await(await request.get('/api/v1/equipment')).json()).items
  expect(items.filter(item=>item.category==='dumbbell_fixed')).toMatchObject([{count:2,weight_kg:8}])
})

test('an invalid inventory cannot reload and an unsupported form waits',async({page,app})=>{
  await controlled(page,'/#/exercises/material')
  await page.locator('[data-family="free_weights"] > summary').click()
  const group=page.locator('[data-category="dumbbell_fixed"]')
  await group.getByRole('button').last().click()
  const row=group.locator('.dumbbell-row').last()
  await row.locator('input').nth(0).fill('0')
  await row.locator('input').nth(1).fill('8')
  await publish(app);await update(page)
  await page.locator('.app-update button').click()
  await expect(page.locator('.app-update')).toContainText(L('updates.save_failed'))
  await expect(row.locator('input').nth(0)).toHaveValue('0')
  expect(await page.evaluate(()=>window.updateTestMarker)).toBe(true)
  await page.goto('/#/programs/new')
  await page.evaluate(()=>import('/js/appUpdates.js').then(({appUpdates})=>{appUpdates.ready=true}))
  await expect(page.locator('.app-update')).toContainText(L('updates.finish'))
  await expect(page.locator('.app-update button')).toBeDisabled()
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('an authentication redirect does not replace assets and blocks an incomplete version',async({page,app,context})=>{
  await controlled(page)
  const old=await page.evaluate(async()=>(await caches.keys()).find(k=>k.startsWith('workoutbuddy-v')))
  await context.route('**/js/router.js',route=>route.fulfill({status:302,headers:{location:'/login'}}))
  await publish(app)
  await page.evaluate(async()=>{
    const reg=await navigator.serviceWorker.getRegistration()
    await new Promise(async(resolve,reject)=>{
      reg.addEventListener('updatefound',()=>{
        const worker=reg.installing
        worker.addEventListener('statechange',()=>{if(worker.state==='redundant')resolve();if(worker.state==='activated')reject(new Error('Incomplete update activated'))})
      },{once:true})
      try{await reg.update()}catch(error){reject(error)}
    })
  })
  expect(await page.evaluate(async()=>await caches.keys())).toContain(old)
  expect(await page.evaluate(()=>window.updateTestMarker)).toBe(true)
  expect(await page.locator('.app-update').count()).toBe(0)
  await context.unroute('**/js/router.js')
  await update(page)
  await expect(page.locator('html')).toHaveCSS('--update-test-release',/deployed/)
})

for(const scenario of ['navigation','api','foreground','legacy']) {
  test(`expired session: return to portal without false offline state (${scenario})`,async({page,app})=>{
    const proxy=await authenticationProxy(app)
    try {
      if(scenario==='legacy') {
        const path=join(app.assetDirectory,'sw.js')
        const current=await readFile(path,'utf8')
        // An older worker used a cached page on every navigation and lacked a
        // controllerchange handler. Upgrade must recover it even when logged out.
        const legacy="self.addEventListener('install', e=>e.waitUntil(caches.open('workoutbuddy-vlegacy').then(c=>c.add('/')).then(()=>self.skipWaiting())));self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));self.addEventListener('fetch',e=>{if(e.request.mode==='navigate')e.respondWith(caches.match('/'))})"
        await writeFile(path,legacy)
        await controlled(page,proxy.url+'/#/stats')
        await page.evaluate(()=>document.body.innerHTML='<h1>Legacy cached page</h1>')
        proxy.expire();await writeFile(path,current)
        await update(page)
      } else {
        await controlled(page,proxy.url+'/#/stats')
        proxy.expire()
        if(scenario==='navigation') await page.goto(proxy.url+'/')
        if(scenario==='api') await page.evaluate(()=>import('/js/api.js').then(api=>api.settings.get()).catch(()=>{}))
        if(scenario==='foreground') await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})))
      }
      await expect(page).toHaveURL(proxy.loginURL)
      await expect(page.getByRole('heading',{name:'Authentication portal'})).toBeVisible()
    } finally {await proxy.dispose()}
  })
}
