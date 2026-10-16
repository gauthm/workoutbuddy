import {test as base,expect} from './fixtures.js'
import {isolatedApp} from './environment.js'
import {readFile,writeFile} from 'node:fs/promises'
import {join} from 'node:path'
import {L,pending} from './helpers.js'

const test=base.extend({
  app:async({},use)=>{
    const app=await isolatedApp({snapshotAssets:true})
    try {await use(app)} finally {await app.dispose()}
  },
})
test.use({serviceWorkers:'allow'})

async function controlled(page,path='/#/stats') {
  await page.goto(path)
  await page.waitForFunction(()=>navigator.serviceWorker.controller && window.__store)
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

test('mise à jour automatique sans hard refresh, API hors cache et caches étrangers conservés',async({page,app,context})=>{
  await controlled(page)
  await page.evaluate(async()=>{await caches.open('unrelated-app-cache')})
  await publish(app)
  // Returning from iOS's background/BFCache must trigger a fresh version check.
  await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})))
  await expect.poll(()=>release(page)).toBe('deployed')
  expect(await page.evaluate(()=>window.updateTestMarker)).toBeUndefined()
  const cacheState=await page.evaluate(async()=>({keys:await caches.keys(),urls:(await(await caches.open((await caches.keys()).find(k=>k.startsWith('workoutbuddy-v')))).keys()).map(r=>r.url)}))
  expect(cacheState.keys).toContain('unrelated-app-cache')
  expect(cacheState.urls.some(url=>new URL(url).pathname.startsWith('/api/'))).toBe(false)
  await context.setOffline(true)
  expect(await page.evaluate(async()=>{const response=await fetch('/api/v1/settings');return {status:response.status,body:await response.json()}})).toEqual({status:503,body:{error:'OFFLINE'}})
  await page.reload()
  await expect(page.locator('.bottom-nav')).toBeVisible()
  expect(await release(page)).toBe('deployed')
  await context.setOffline(false)
})

test('une saisie reste intacte, annulation possible, puis mise à jour après sauvegarde et navigation',async({page,request,app})=>{
  await controlled(page,'/#/settings')
  await page.getByText(L('settings.section_profile'),{exact:true}).click()
  const name=page.getByLabel(L('settings.profile_display_name'),{exact:true})
  await name.fill('Synthetic update draft')
  await publish(app);await update(page)
  await expect(page.locator('.app-update')).toBeVisible()
  await page.locator('.app-update button').click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('dialog').getByRole('button',{name:L('common.cancel'),exact:true}).click()
  await expect(name).toHaveValue('Synthetic update draft')
  expect(await page.evaluate(()=>window.updateTestMarker)).toBe(true)
  expect(await release(page)).toBe('')
  await pending(page).getByRole('button',{name:L('common.save'),exact:true}).click()
  await expect(pending(page)).toHaveCount(0)
  expect((await(await request.get('/api/v1/user-profile')).json()).display_name).toBe('Synthetic update draft')
  await page.locator('.bottom-nav button').first().click()
  await expect.poll(()=>release(page)).toBe('deployed')
})

test('une redirection d’authentification ne remplace pas les assets et bloque une version incomplète',async({page,app,context})=>{
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
  await expect.poll(()=>release(page)).toBe('deployed')
})
