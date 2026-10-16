import {test as base,expect} from './fixtures.js'
import {isolatedApp} from './environment.js'
import {readFile,writeFile} from 'node:fs/promises'
import {join} from 'node:path'
import {L,pending} from './helpers.js'
import {createServer,request as proxyRequest} from 'node:http'

// Real HTTP redirects on another origin reproduce the identity provider/CORS
// boundary. Authorized requests always reach the real, isolated application.
async function authenticationProxy(app) {
  let expired=false
  const login=createServer((_req,res)=>{res.writeHead(200,{'Content-Type':'text/html'});res.end('<h1>Authentication portal</h1>')})
  await new Promise(resolve=>login.listen(0,'127.0.0.1',resolve))
  const loginURL=`http://127.0.0.1:${login.address().port}/`
  const proxy=createServer((req,res)=>{
    if(req.url==='/auth/login' || (expired && req.url!=='/sw.js')) {
      if(req.url.startsWith('/api/') && req.headers.accept==='application/json') {
        res.writeHead(401,{'Content-Type':'application/json','Location':loginURL});res.end(JSON.stringify({error:'AUTH_REQUIRED'}))
      } else {res.writeHead(302,{'Location':loginURL});res.end()}
      return
    }
    const upstream=proxyRequest(new URL(req.url,app.url),{method:req.method,headers:req.headers},response=>{
      res.writeHead(response.statusCode,response.headers);response.pipe(res)
    })
    upstream.on('error',()=>{res.writeHead(502);res.end()});req.pipe(upstream)
  })
  await new Promise(resolve=>proxy.listen(0,'127.0.0.1',resolve))
  return {url:`http://127.0.0.1:${proxy.address().port}`,loginURL,expire:()=>{expired=true},
    async dispose(){await Promise.all([proxy,login].map(server=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections()})))} }
}

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
  await expect(page.locator('html')).toHaveCSS('--update-test-release',/deployed/)
  expect(await page.evaluate(()=>window.updateTestMarker)).toBeUndefined()
  const cacheState=await page.evaluate(async()=>({keys:await caches.keys(),urls:(await(await caches.open((await caches.keys()).find(k=>k.startsWith('workoutbuddy-v')))).keys()).map(r=>r.url)}))
  expect(cacheState.keys).toContain('unrelated-app-cache')
  expect(cacheState.urls.some(url=>new URL(url).pathname.startsWith('/api/'))).toBe(false)
  await context.setOffline(true)
  expect(await page.evaluate(async()=>{const response=await fetch('/api/v1/settings');return {status:response.status,body:await response.json()}})).toEqual({status:503,body:{error:'OFFLINE'}})
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
  await expect(page.locator('html')).toHaveCSS('--update-test-release',/deployed/)
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
  await expect(page.locator('html')).toHaveCSS('--update-test-release',/deployed/)
})

for(const scenario of ['navigation','api','foreground','legacy']) {
  test(`session expirée : retour au portail sans faux hors ligne (${scenario})`,async({page,app})=>{
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
