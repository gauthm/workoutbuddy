import {test,expect} from './fixtures.js'
import {get,planned,trainThroughUI,startThroughUI} from './helpers.js'

test('mobile : pincement et double tap sans zoom, défilement tactile et champs de séance lisibles',async({browser,app,request})=>{
 const context=await browser.newContext({baseURL:app.url,viewport:{width:390,height:844},isMobile:true,hasTouch:true,locale:'fr-FR'})
 try{
  const page=await context.newPage(),screen=await context.newCDPSession(page)
  await request.put('/api/v1/settings',{data:{show_rpe_field:true}})
  await page.goto('/#/exercises')
  await expect(page.locator('.exercise-card').first()).toBeVisible()
  expect(await page.evaluate(()=>matchMedia('(pointer: coarse)').matches)).toBe(true)
  await expect(page.locator('html')).toHaveCSS('touch-action','pan-x pan-y')
  const viewport=await page.locator('meta[name="viewport"]').getAttribute('content')
  expect(viewport).toContain('user-scalable=no')
  expect(viewport).toContain('viewport-fit=cover')
  await screen.send('Input.synthesizePinchGesture',{x:190,y:350,scaleFactor:2,gestureSourceType:'touch'})
  expect(await page.evaluate(()=>visualViewport.scale)).toBe(1)
  await page.locator('.page-header h1').tap()
  await page.locator('.page-header h1').tap()
  expect(await page.evaluate(()=>visualViewport.scale)).toBe(1)
  await screen.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:190,y:650}]})
  for(let y=600;y>=250;y-=50){
   await screen.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:190,y}]})
   await page.evaluate(()=>new Promise(requestAnimationFrame))
  }
  await screen.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]})
  await expect.poll(()=>page.evaluate(()=>scrollY)).toBeGreaterThan(50)
  const program=await planned(request)
  await startThroughUI(page,program)
  const block=page.locator('.exercise-block').first()
  if(!await block.locator('.set-row').first().isVisible())await block.locator('.exercise-block__toggle').click()
  const effort=block.locator('.set-row__input--rpe').first()
  await expect(effort).toBeVisible()
  await expect(effort).toHaveCSS('font-size','16px')
  await effort.tap();await effort.fill('8')
  expect(await page.evaluate(()=>visualViewport.scale)).toBe(1)
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false)
  await screen.detach()
 }finally{await context.close()}
})

test('icônes navigateur et écran d’accueil : liens, décodage et PNG opaques aux dimensions prévues',async({page,request})=>{
 await page.goto('/')
 const apple=page.locator('link[rel="apple-touch-icon"]')
 await expect(apple).toHaveAttribute('sizes','180x180')
 const sources=[{src:await apple.getAttribute('href'),size:180}]
 const manifest=await(await request.get('/manifest.json')).json()
 for(const icon of manifest.icons){
  expect(icon.purpose).toContain('maskable')
  sources.push({src:icon.src,size:Number(icon.sizes.split('x')[0])})
 }
 for(const {src,size} of sources){
  const actual=await page.evaluate(async src=>{
   const image=new Image();image.src=src;await image.decode()
   const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight
   const context=canvas.getContext('2d');context.drawImage(image,0,0)
   return {width:image.naturalWidth,height:image.naturalHeight,cornerAlpha:context.getImageData(0,0,1,1).data[3]}
  },src)
  expect(actual).toEqual({width:size,height:size,cornerAlpha:255})
 }
 const svg=page.locator('link[rel="icon"][type="image/svg+xml"]')
 const decoded=await page.evaluate(async src=>{const image=new Image();image.src=src;await image.decode();return image.naturalWidth>0},await svg.getAttribute('href'))
 expect(decoded).toBe(true)
 const ico=await request.get(await page.locator('link[rel="icon"]:not([type])').getAttribute('href'))
 expect(ico.status()).toBe(200)
 expect([...(await ico.body()).subarray(0,6)]).toEqual([0,0,1,0,2,0])
})

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
