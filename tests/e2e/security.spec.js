import {test,expect} from './fixtures.js'
import {get,planned,trainThroughUI} from './helpers.js'

test('la barre de titre respecte la zone de sécurité iOS au chargement, au défilement et après rotation',async({page})=>{
 const screen=await page.context().newCDPSession(page)
 await screen.send('Emulation.setSafeAreaInsetsOverride',{insets:{top:59,bottom:34,left:0,right:0}})
 await page.goto('/#/exercises')
 const header=page.locator('.page-header'),title=header.locator('h1')
 await expect(title).toBeVisible()
 async function safeHeader(inset){
  await expect.poll(async()=>Math.round((await header.boundingBox()).height)).toBe(52+inset)
  expect((await title.boundingBox()).y).toBeGreaterThanOrEqual(inset)
 }
 await safeHeader(59)
 await page.evaluate(()=>window.scrollTo(0,500))
 await safeHeader(59)
 expect(Math.round((await header.boundingBox()).y)).toBe(0)
 await page.goto('/#/settings')
 await safeHeader(59)
 await screen.send('Emulation.setSafeAreaInsetsOverride',{insets:{top:0,bottom:0,left:0,right:0}})
 await safeHeader(0)
 await screen.detach()
})

test('CSP active : interface Vue, séance complète, progression et statistiques fonctionnent',async({page,request})=>{
 const violations=[]
 await page.addInitScript(()=>{window.__cspViolations=[];document.addEventListener('securitypolicyviolation',e=>window.__cspViolations.push(e.violatedDirective+': '+e.blockedURI))})
 page.on('console',message=>{if(message.type()==='error' && /Content Security Policy|Refused to/.test(message.text()))violations.push(message.text())})
 const p=await planned(request)
 await trainThroughUI(page,request,p)
 await page.goto('/#/stats')
 await expect(page.locator('canvas').first()).toBeVisible()
 expect(await page.evaluate(()=>window.__cspViolations)).toEqual([])
 expect(violations).toEqual([])
 const response=await request.get('/')
 expect(response.headers()['content-security-policy']).toContain("script-src 'self' 'unsafe-eval'")
 expect(response.headers()['x-frame-options']).toBe('DENY')
 expect(response.headers()['x-powered-by']).toBeUndefined()
})

test('vrai HTTP : origine étrangère refusée sans changement, JSON obligatoire, limite IA et no-store',async({request,app})=>{
 const before=await get(request,'/settings')
 const forbidden=await request.put('/api/v1/settings',{headers:{Origin:'https://attacker.example'},data:{theme:'light'}})
 expect(forbidden.status()).toBe(403)
 expect((await get(request,'/settings')).theme).toBe(before.theme)
 const same=await request.get('/api/v1/settings',{headers:{Origin:app.url}})
 expect(same.status()).toBe(200);expect(same.headers()['cache-control']).toBe('no-store')
 const form=await request.post('/api/v1/settings/save',{form:{theme:'light'}})
 expect(form.status()).toBe(415)
 for(let i=0;i<12;i++){
  const attempt=await request.post('/api/v1/settings/test-ai',{data:{}})
  expect(attempt.status()).toBe(400)
 }
 const limited=await request.post('/api/v1/SETTINGS/test-ai/',{data:{},headers:{'X-Forwarded-For':'198.51.100.1'}})
 expect(limited.status()).toBe(429);expect((await limited.json()).error).toBe('RATE_LIMITED')
 expect(Number(limited.headers()['retry-after'])).toBeGreaterThan(0)
 // Limiting an expensive endpoint never blocks saving a workout or reading settings.
 expect((await request.get('/api/v1/settings')).status()).toBe(200)
})

test('service worker autorisé : installation et rechargement fonctionnent avec la CSP',async({browser,app})=>{
 const context=await browser.newContext({serviceWorkers:'allow'})
 try{
  const page=await context.newPage(),errors=[]
  page.on('pageerror',error=>errors.push(error.message))
  await page.goto(app.url+'/#/')
  await expect.poll(()=>page.evaluate(()=>navigator.serviceWorker.getRegistration().then(r=>!!r?.active))).toBe(true)
  await page.reload()
  await expect(page.locator('.bottom-nav')).toBeVisible()
  expect(await page.evaluate(()=>!!navigator.serviceWorker.controller)).toBe(true)
  const status=await page.evaluate(()=>fetch('/api/v1/settings').then(r=>r.status))
  expect(status).toBe(200);expect(errors).toEqual([])
 }finally{await context.close()}
})

test('un import HTTP interrompu ne monopolise pas la place et un second corps volumineux est refusé',async({request,app})=>{
 const {request:httpRequest}=await import('node:http')
 const slow=httpRequest(app.url+'/api/v1/import',{method:'POST',headers:{'Content-Type':'application/json','Content-Length':'1000000'}})
 slow.on('error',()=>{})
 try{
  slow.write('{');slow.flushHeaders()
  await expect.poll(async()=>{
   const response=await request.post('/api/v1/import',{data:{}})
   return (await response.json()).error
  }).toBe('IMPORT_BUSY')
 }finally{slow.destroy()}
 await expect.poll(async()=>{
  const response=await request.post('/api/v1/import',{data:{}})
  return response.status()
 }).toBe(400)
 expect((await get(request,'/settings')).theme).toBe('dark')
})
