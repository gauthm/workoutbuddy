import {test,expect} from './fixtures.js'
import {createServer,request as proxyRequest} from 'node:http'
import {readFile} from 'node:fs/promises'
import {join} from 'node:path'
import {L,planned,startThroughUI,call,get,params} from './helpers.js'
const frame=page=>page.locator('.exercise-motion__frame--visible')
async function ready(page){
 await expect(page.locator('.exercise-motion__frame')).toHaveCount(2)
 await expect.poll(()=>page.locator('.exercise-motion__frame').evaluateAll(images=>images.every(i=>i.complete&&i.naturalWidth>0))).toBe(true)
 await expect(frame(page)).toHaveCount(1)
}
test('both real photos alternate, pause/resume work and arrows are removed',async({page})=>{
 const photos=[];page.on('request',request=>{if(request.url().includes('/exercises/images/dumbbell_bench_press/'))photos.push(request.url())})
 await page.emulateMedia({reducedMotion:'no-preference'});await page.clock.install()
 await page.goto('/#/exercises/dumbbell_bench_press');await ready(page)
 const src=await frame(page).getAttribute('src')
 await page.clock.runFor(1200)
 await expect(frame(page)).not.toHaveAttribute('src',src)
 await page.getByRole('button',{name:L('exercises.motion_pause'),exact:true}).click()
 const paused=await frame(page).getAttribute('src')
 await page.clock.runFor(3300)
 await expect(frame(page)).toHaveAttribute('src',paused)
 await page.getByRole('button',{name:L('exercises.motion_play'),exact:true}).click()
 await page.clock.runFor(1200)
 await expect(frame(page)).not.toHaveAttribute('src',paused)
 await expect(page.getByRole('button',{name:L('exercises.image_previous'),exact:true})).toHaveCount(0)
 await expect(page.getByRole('button',{name:L('exercises.image_next'),exact:true})).toHaveCount(0)
 expect(photos).toHaveLength(2)
})
test('reduced-motion preference keeps images initially paused',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await page.clock.install()
 await page.goto('/#/exercises/dumbbell_bench_press');await ready(page)
 await expect(page.getByRole('button',{name:L('exercises.motion_play'),exact:true})).toBeVisible()
 const src=await frame(page).getAttribute('src')
 await page.clock.runFor(3300)
 await expect(frame(page)).toHaveAttribute('src',src)
})
test('the same animation is available in exercise help during a workout',async({page,request})=>{
 const p=await planned(request);await startThroughUI(page,p)
 await page.locator('.exercise-block--active').getByRole('button',{name:L('session.help'),exact:true}).click()
 await ready(page)
 const dialog=page.getByRole('dialog')
 await expect(dialog.locator('ol')).not.toContainText(L('exercises.dumbbell_weight_entry'))
 await expect(dialog.locator('.exercise-help__weight-entry p')).toHaveText(L('session.weight_entry_dumbbell'))
 await expect(dialog.locator('.exercise-help__starting-load li')).toHaveCount(5)
 await expect(dialog.locator('.detail-section__title')).toHaveText([
  L('exercises.instructions'),L('session.weight_entry'),L('session.starting_load'),/Tableau RM/
 ])
 await page.evaluate(async()=>{const {i18n}=await import('/js/i18n.js');await i18n.setLocale('en')})
 await expect(dialog.getByRole('heading',{name:'Weight to enter',exact:true})).toHaveCount(1)
 await expect(dialog.locator('.exercise-help__weight-entry p')).toContainText('enter 8 kg')
 await expect(dialog.locator('.exercise-help__starting-load li')).toContainText([
  'Start light','planned number','2 to 3','smallest available','Reduce the weight'
 ])
 await page.evaluate(async()=>{const {i18n}=await import('/js/i18n.js');await i18n.setLocale('fr')})
 await expect(page.getByRole('dialog').getByRole('button',{name:L('exercises.motion_pause'),exact:true})).toBeVisible()
 await page.getByRole('dialog').getByRole('button',{name:L('common.close'),exact:true}).click()
 await expect(page.locator('.exercise-motion')).toHaveCount(0)
})

test('animation stops off-screen and resumes when photos become visible again',async({page})=>{
 await page.setViewportSize({width:390,height:350})
 await page.emulateMedia({reducedMotion:'no-preference'});await page.clock.install()
 await page.goto('/#/exercises/dumbbell_bench_press');await ready(page)
 await expect(page.locator('.exercise-motion')).toHaveAttribute('data-animating','true')
 await page.locator('.detail-section').last().scrollIntoViewIfNeeded()
 await expect.poll(()=>page.locator('.exercise-motion').evaluate(el=>el.getBoundingClientRect().bottom)).toBeLessThan(0)
 await expect(page.locator('.exercise-motion')).toHaveAttribute('data-animating','false')
 await page.clock.runFor(1200)
 const hidden=await frame(page).getAttribute('src')
 await page.clock.runFor(3300)
 await expect(frame(page)).toHaveAttribute('src',hidden)
 await page.locator('.exercise-motion').scrollIntoViewIfNeeded()
 await expect(page.locator('.exercise-motion')).toHaveAttribute('data-animating','true')
 await page.clock.runFor(1200)
 await expect(frame(page)).not.toHaveAttribute('src',hidden)
})

test('help without equipment suggests starting without added weight',async({page,request})=>{
 const result=await call(request,'post','/programs/generate',params,201)
 await call(request,'post',`/programs/${result.id}/activate`)
 await startThroughUI(page,await get(request,`/programs/${result.id}`))
 await page.locator('.exercise-block--active').getByRole('button',{name:L('session.help'),exact:true}).click()
 const dialog=page.getByRole('dialog')
 await expect(dialog.locator('.exercise-help__weight-entry p')).toHaveText(L('session.weight_entry_bodyweight'))
 await expect(dialog.locator('.exercise-help__starting-load li')).toHaveText([
  L('session.starting_bodyweight'),L('session.starting_reps'),L('session.starting_margin'),L('session.starting_variant')
 ])
 await expect(dialog.getByRole('heading',{name:/Tableau RM/})).toHaveCount(0)
})

// Stream the actual progressive JPEG's first scan, holding the rest of the file.
// Route.fulfill buffers complete responses, so this case uses a disposable HTTP proxy.
async function progressiveProxy(app){
 const pending=new Map(),requests=[]
 const server=createServer(async(req,res)=>{
  if(req.url.startsWith('/exercises/images/')){
   try{
    const bytes=await readFile(join(app.assetDirectory,req.url.split('?')[0]))
    const scan=bytes.indexOf(Buffer.from([0xff,0xda]))
    const next=bytes.indexOf(Buffer.from([0xff,0xda]),scan+2)
    const split=next>0?next:Math.floor(bytes.length/2)
    requests.push(req.url)
    res.writeHead(200,{'Content-Type':'image/jpeg','Content-Length':bytes.length,'Cache-Control':'public, max-age=3600'})
    res.write(bytes.subarray(0,split))
    pending.set(req.url,()=>res.end(bytes.subarray(split)))
   }catch{res.writeHead(404);res.end()}
   return
  }
  const upstream=proxyRequest(new URL(req.url,app.url),{method:req.method,headers:req.headers},response=>{
   res.writeHead(response.statusCode,response.headers);response.pipe(res)
  })
  upstream.on('error',()=>{res.writeHead(502);res.end()});req.pipe(upstream)
 })
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
 return {url:`http://127.0.0.1:${server.address().port}`,pending,requests,
  release(path){pending.get(path)?.();pending.delete(path)},
  async dispose(){await new Promise(resolve=>{server.close(resolve);server.closeAllConnections()})}}
}

for(const context of ['details','workout help'])test(`progressive photos stay hidden until decoded in ${context}, including cached reopen`,async({page,request,app})=>{
 if(context==='workout help')await startThroughUI(page,await planned(request))
 const proxy=await progressiveProxy(app)
 try{
  await page.goto(proxy.url+(context==='details'?'/#/exercises/dumbbell_bench_press':'/#/session'),{waitUntil:'domcontentloaded'})
  const open=async()=>page.locator('.exercise-block--active').getByRole('button',{name:L('session.help'),exact:true}).click()
  if(context==='workout help')await open()
  await expect.poll(()=>proxy.pending.size).toBe(2)
  const photos=page.locator('.exercise-motion__frame')
  await expect(photos).toHaveCount(2)
  expect(await photos.evaluateAll(images=>images.every(image=>!image.complete))).toBe(true)
  await expect(frame(page)).toHaveCount(0)
  await expect(page.locator('.exercise-motion__loading')).toHaveText(L('common.loading'))
  expect(await photos.evaluateAll(images=>images.every(image=>getComputedStyle(image).opacity==='0'))).toBe(true)
  // The second file completes first: use it without exposing the first preview.
  const second=await photos.nth(1).getAttribute('src')
  proxy.release(second)
  await expect(frame(page)).toHaveAttribute('src',second)
  await expect(photos.first()).toHaveAttribute('aria-hidden','true')
  await expect(page.locator('.exercise-motion')).toHaveAttribute('data-animating','false')
  proxy.release(await photos.first().getAttribute('src'))
  await ready(page)
  await expect(page.locator('.exercise-motion')).toHaveAttribute('data-animating','true')
  if(context==='workout help'){
   await page.getByRole('dialog').getByRole('button',{name:L('common.close'),exact:true}).click()
   await open()
  }else{
   await page.goto(proxy.url+'/#/exercises');await page.goto(proxy.url+'/#/exercises/dumbbell_bench_press')
  }
  await ready(page)
  expect(proxy.requests).toHaveLength(2)
 }finally{await proxy.dispose()}
})

test('failed photos keep the other decoded frame, and all failed photos show the fallback',async({page})=>{
 await page.route('**/exercises/images/**/0.jpg',route=>route.abort('connectionfailed'))
 await page.goto('/#/exercises/dumbbell_bench_press')
 await expect(frame(page)).toHaveAttribute('src','/exercises/images/dumbbell_bench_press/1.jpg')
 await expect(page.locator('.exercise-motion')).toHaveAttribute('data-animating','false')
 await expect(page.locator('.exercise-motion__loading')).toHaveCount(0)
 await page.route('**/exercises/images/**',route=>route.abort('connectionfailed'))
 await page.reload()
 await expect(page.locator('.exercise-motion')).toContainText(L('exercises.images_unavailable'))
 await expect(frame(page)).toHaveCount(0)
 await expect(page.locator('.exercise-motion__loading')).toHaveCount(0)
})

test('a loaded photo waits for decoding and a decode failure cannot become visible',async({page})=>{
 await page.addInitScript(()=>{
  const original=HTMLImageElement.prototype.decode
  const waiting=[]
  window.releasePhotoDecodes=()=>waiting.splice(0).forEach(resolve=>resolve())
  HTMLImageElement.prototype.decode=async function(){
   await new Promise(resolve=>waiting.push(resolve))
   if(this.src.endsWith('/0.jpg'))throw new DOMException('Synthetic decode failure','EncodingError')
   return original.call(this)
  }
 })
 await page.goto('/#/exercises/dumbbell_bench_press')
 await expect.poll(()=>page.locator('.exercise-motion__frame').evaluateAll(images=>images.length===2 && images.every(i=>i.complete&&i.naturalWidth>0))).toBe(true)
 await expect(frame(page)).toHaveCount(0)
 await expect(page.locator('.exercise-motion__loading')).toBeVisible()
 await page.evaluate(()=>window.releasePhotoDecodes())
 await expect(frame(page)).toHaveAttribute('src','/exercises/images/dumbbell_bench_press/1.jpg')
 await expect(page.locator('.exercise-motion')).toHaveAttribute('data-animating','false')
})

test('all catalog photos decode successfully in the browser',async({page,request})=>{
 test.setTimeout(120000)
 const paths=[...new Set((await get(request,'/exercises')).exercises.flatMap(exercise=>exercise.image_paths))]
 expect(paths.length).toBe(1746)
 await page.goto('/#/exercises')
 const errors=await page.evaluate(async paths=>{
  const errors=[],queue=[...paths]
  await Promise.all(Array.from({length:2},async()=>{
   while(queue.length){
    const path=queue.shift()
    let bitmap
    try{
     const response=await fetch('/exercises/images/'+path)
     if(!response.ok)throw new Error('Image unavailable')
     bitmap=await createImageBitmap(await response.blob())
     if(bitmap.width<32 || bitmap.height<32)errors.push(path)
    }catch{errors.push(path)}
    finally{bitmap?.close()}
   }
  }))
  return errors
 },paths)
 expect(errors).toEqual([])
})

test('closing help during decoding cannot reveal a stale frame on reopening',async({page,request})=>{
 await page.addInitScript(()=>{
  const original=HTMLImageElement.prototype.decode,waiting=[]
  window.waitingPhotoDecodeCount=()=>waiting.length
  window.finishPhotoDecodes=count=>waiting.splice(0,count).forEach(resolve=>resolve())
  HTMLImageElement.prototype.decode=async function(){
   await original.call(this)
   await new Promise(resolve=>waiting.push(resolve))
  }
 })
 await startThroughUI(page,await planned(request))
 const open=async()=>page.locator('.exercise-block--active').getByRole('button',{name:L('session.help'),exact:true}).click()
 await open()
 await expect.poll(()=>page.evaluate(()=>window.waitingPhotoDecodeCount())).toBe(2)
 await expect(frame(page)).toHaveCount(0)
 await page.getByRole('dialog').getByRole('button',{name:L('common.close'),exact:true}).click()
 await open()
 await expect.poll(()=>page.evaluate(()=>window.waitingPhotoDecodeCount())).toBe(4)
 await page.evaluate(()=>window.finishPhotoDecodes(2))
 await expect(frame(page)).toHaveCount(0)
 await expect(page.locator('.exercise-motion__loading')).toBeVisible()
 await page.evaluate(()=>window.finishPhotoDecodes(2))
 await ready(page)
 await page.screenshot({path:test.info().outputPath('decoded-help.png')})
})
