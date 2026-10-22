import {test,expect} from './fixtures.js'
import {L,call,get} from './helpers.js'
import {createServer} from 'node:http'

test('Coach input: Enter sends on desktop, newline on mobile; Shift+Enter and input size',async({page},testInfo)=>{
 const mobile=testInfo.project.name==='mobile'
 const sent=[]
 page.on('request',request=>{if(request.url().endsWith('/api/v1/ai/chat') && request.method()==='POST')sent.push(request)})
 await page.goto('/#/coach')
 const input=page.getByRole('textbox',{name:L('coach.placeholder'),exact:true})
 await expect(input).toBeEnabled()
 await expect(input).toHaveAttribute('enterkeyhint','enter')
 await expect(page.locator('.coach-view')).not.toContainText('🤖')
 const metrics=()=>input.evaluate(element=>({height:element.getBoundingClientRect().height,client:element.clientHeight,scroll:element.scrollHeight,top:element.scrollTop,overflow:getComputedStyle(element).overflowY}))
 const initial=await metrics()
 expect(initial.overflow).toBe('hidden')
 await input.fill('One test line')
 expect((await metrics()).scroll).toBeLessThanOrEqual((await metrics()).client)
 await input.press(mobile?'Enter':'Shift+Enter');await input.press('Shift+Enter')
 await input.pressSequentially('Third line')
 await expect(input).toHaveValue('One test line\n\nThird line')
 expect(sent).toHaveLength(0)
 const expanded=await metrics()
 expect(expanded.height).toBeGreaterThan(initial.height)
 expect(expanded.height).toBeLessThan(120)
 expect(expanded.scroll).toBeLessThanOrEqual(expanded.client)
 expect(expanded.overflow).toBe('hidden')
 await input.fill(Array.from({length:30},(_,i)=>`Synthetic line ${i+1} of the long message`).join('\n'))
 const capped=await metrics()
 expect(capped.height).toBe(120)
 expect(capped.scroll).toBeGreaterThan(capped.client)
 expect(capped.overflow).toBe('auto')
 await input.press('Control+End')
 expect((await metrics()).top).toBeGreaterThan(0)
 await page.screenshot({path:test.info().outputPath('composer-at-limit.png')})
 await input.fill('Court')
 const shrunk=await metrics()
 expect(shrunk.height).toBe(initial.height)
 expect(shrunk.overflow).toBe('hidden')
 expect(shrunk.top).toBe(0)
 await input.fill('First paragraph\nSecond paragraph\nThird paragraph')
 expect((await metrics()).height).toBeGreaterThan(initial.height)
 const response=page.waitForResponse(r=>r.url().endsWith('/api/v1/ai/chat') && r.request().method()==='POST')
 if(mobile){
  await input.press('Enter')
  await expect(input).toHaveValue('First paragraph\nSecond paragraph\nThird paragraph\n')
  expect(sent).toHaveLength(0)
  await page.getByRole('button',{name:L('coach.send'),exact:true}).click()
 }else{
  await input.press('Enter')
 }
 // The real isolated API rejects an unconfigured provider; no paid/external AI.
 expect((await(await response).json()).error).toBe('AI_NOT_CONFIGURED')
 expect(sent).toHaveLength(1)
 expect(sent[0].postDataJSON().message).toBe('First paragraph\nSecond paragraph\nThird paragraph')
 await expect(input).toHaveValue('')
 await expect(input).toHaveCSS('overflow-y','hidden')
 expect((await metrics()).height).toBe(initial.height)
 const nav=await page.locator('.bottom-nav').boundingBox()
 expect((await input.boundingBox()).y+(await input.boundingBox()).height).toBeLessThanOrEqual(nav.y)
})

test('Enter respects keyboard composition and does not submit an empty message',async({page},testInfo)=>{
 test.skip(testInfo.project.name==='mobile','Shortcut reserved for desktop keyboard')
 const sent=[]
 page.on('request',request=>{if(request.url().endsWith('/api/v1/ai/chat') && request.method()==='POST')sent.push(request)})
 await page.goto('/#/coach')
 const input=page.getByRole('textbox',{name:L('coach.placeholder'),exact:true})
 await expect(input).toBeEnabled()
 await input.press('Enter')
 await expect(input).toHaveValue('')
 await input.fill('Texte en composition')
 const accepted=await input.evaluate(el=>[
  el.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',isComposing:true,bubbles:true,cancelable:true})),
  el.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',keyCode:229,bubbles:true,cancelable:true})),
 ])
 expect(accepted).toEqual([true,true])
 await expect(input).toHaveValue('Texte en composition')
 expect(sent).toHaveLength(0)
 // Resizing a desktop window must not turn the keyboard shortcut into mobile mode.
 await page.setViewportSize({width:390,height:844})
 const response=page.waitForResponse(r=>r.url().endsWith('/api/v1/ai/chat') && r.request().method()==='POST')
 await input.press('Enter')
 expect((await(await response).json()).error).toBe('AI_NOT_CONFIGURED')
 expect(sent).toHaveLength(1)
})

test('Coach continues off-screen before and during response, then returns to the latest message',async({page,request},info)=>{
 // Only the provider is synthetic; chat, persistence and navigation use the real app.
 let response,requests=0,interrupted=false
 const provider=createServer((req,res)=>{
  requests++
  req.resume()
  response=res
  res.on('close',()=>{if(!res.writableEnded)interrupted=true})
 })
 await new Promise(resolve=>provider.listen(0,'127.0.0.1',resolve))
 const token=content=>response.write(`data: ${JSON.stringify({choices:[{delta:{content}}]})}\n\n`)
 const bottom=()=>page.locator('.coach-view__content').evaluate(el=>el.scrollHeight-el.clientHeight-el.scrollTop)
 try {
  await call(request,'put','/settings',{ai_base_url:`http://127.0.0.1:${provider.address().port}`,ai_model:'local-test'})
  await page.goto('/#/coach')
  const input=page.getByRole('textbox',{name:L('coach.placeholder'),exact:true})
  await expect(input).toBeEnabled()
  await input.fill('Question preserved during navigation')
  await page.getByRole('button',{name:L('coach.send'),exact:true}).click()
  await expect.poll(()=>requests).toBe(1)
  const thinking=page.getByRole('status')
  await expect(thinking).toContainText(L('coach.thinking'))
  const dots=thinking.locator('.chat-msg__thinking-dots i')
  await expect(dots).toHaveCount(3)
  await expect(dots.first()).toHaveCSS('animation-name','coach-thinking')
  await page.emulateMedia({reducedMotion:'reduce'})
  await expect(dots.first()).toHaveCSS('animation-name','none')
  await page.emulateMedia({reducedMotion:'no-preference'})
  await expect(dots.first()).toHaveCSS('animation-name','coach-thinking')
  await expect(page.locator('.chat-msg__avatar')).toHaveCount(0)
  await expect(page.locator('.coach-view')).not.toContainText('🤖')
  await page.screenshot({path:test.info().outputPath('coach-thinking.png')})

  // Leave before any provider response, then return while it is still thinking.
  await page.getByRole('button',{name:L('nav.home'),exact:true}).click()
  await expect(page.locator('.coach-view')).toHaveCount(0)
  await page.getByRole('button',{name:L('nav.coach'),exact:true}).click()
  await expect(input).toBeDisabled()
  await expect(page.getByText('Question preserved during navigation',{exact:true})).toHaveCount(1)
  await expect(page.getByRole('button',{name:L('coach.new_conversation'),exact:true})).toBeDisabled()

  response.writeHead(200,{'Content-Type':'text/event-stream'})
  token('Preserved response beginning.\n')
  await expect(page.getByText('Preserved response beginning.',{exact:true})).toBeVisible()
  await expect(thinking).toHaveCount(0)

  // Long answers must stay at the maximum scroll position during streaming,
  // without waiting for a smooth animation to catch up with incoming tokens.
  const viewport=page.viewportSize()
  for(let part=0;part<5;part++) {
   const marker=`Fin du fragment ${part+1}.`
   token(Array.from({length:12},()=>`Texte du fragment ${part+1}.\n`).join('')+marker+'\n')
   await expect(page.locator('.chat-msg--assistant .chat-msg__bubble')).toContainText(marker)
   const gap=await page.locator('.coach-view__content').evaluate(async el=>{
    await new Promise(requestAnimationFrame)
    return el.scrollHeight-el.clientHeight-el.scrollTop
   })
   expect(gap,'latest streamed text must be fully visible').toBeLessThan(2)
  }
  await page.setViewportSize({...viewport,height:viewport.height-180})
  await expect.poll(bottom).toBeLessThan(2)
  const lastBubble=await page.locator('.chat-msg--assistant .chat-msg__bubble').boundingBox()
  const composer=await page.locator('.coach-view__input-area').boundingBox()
  expect(lastBubble.y+lastBubble.height).toBeLessThanOrEqual(composer.y)
  await page.setViewportSize(viewport)

  // Finish while another page is displayed; hidden chat must not scroll that page.
  await page.getByRole('button',{name:L('nav.home'),exact:true}).click()
  const scroll=await page.evaluate(()=>window.scrollY)
  token(Array.from({length:50},(_,i)=>`Test advice ${i+1}.\n\n`).join('')+'Last preserved advice.')
  response.end('data: [DONE]\n\n')
  await expect.poll(async()=>{
   const list=await get(request,'/ai/conversations')
   if(!list.conversations.length)return 0
   return (await get(request,`/ai/conversations/${list.conversations[0].id}/messages`)).messages.length
  }).toBe(2)
  expect(await page.evaluate(()=>window.scrollY)).toBe(scroll)
  expect(interrupted).toBe(false)

  await page.getByRole('button',{name:L('nav.coach'),exact:true}).click()
  await expect(input).toBeEnabled()
  await expect(page.locator('.chat-msg--assistant .chat-msg__bubble')).toContainText('Last preserved advice.')
  await expect.poll(bottom).toBeLessThan(2)
  expect(requests).toBe(1)

  // Returning always shows the end, even after manually reading older messages.
  await page.locator('.coach-view__content').evaluate(el=>{el.scrollTop=0})
  await page.getByRole('button',{name:L('nav.home'),exact:true}).click()
  await page.getByRole('button',{name:L('nav.coach'),exact:true}).click()
  await expect.poll(bottom).toBeLessThan(2)

  // A fresh mount restores the saved answer and also starts at the end.
  await page.reload()
  await expect(input).toBeEnabled()
  await expect(page.locator('.chat-msg--assistant .chat-msg__bubble')).toContainText('Last preserved advice.')
  await expect.poll(bottom).toBeLessThan(2)

  // Reproduce keyboard resize/pan while reading older messages, including at scroll boundaries.
  await input.focus()
  await page.evaluate(()=>{
   let height=null,top=0
   Object.defineProperties(visualViewport,{
    height:{get:()=>height??innerHeight},offsetTop:{get:()=>top},
   })
   window.setChatViewport=(nextHeight,nextTop=0)=>{
    height=nextHeight;top=nextTop
    visualViewport.dispatchEvent(new Event('resize'))
    visualViewport.dispatchEvent(new Event('scroll'))
   }
   window.setChatViewport(innerHeight-320)
  })
  const mobile=info.project.name==='mobile'
  if(mobile)await expect(page.locator('.bottom-nav')).toBeHidden()
  const content=page.locator('.coach-view__content')
  await expect.poll(bottom).toBeLessThan(2)
  await content.evaluate(el=>{el.scrollTop=200})
  await expect.poll(()=>content.evaluate(el=>el.scrollTop)).toBe(200)
  // Let the scroll event record the user's reading position before viewport changes.
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))
  for(const offset of [0,30,60,25,0]){
   await page.evaluate(offset=>window.setChatViewport(innerHeight-320+(offset%7),offset),offset)
   await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))
   expect(await content.evaluate(el=>el.scrollTop)).toBe(200)
   expect(await page.evaluate(()=>scrollY)).toBe(0)
   if(mobile)await expect(page.locator('.bottom-nav')).toBeHidden()
  }
  if(mobile){
   const touch=await page.context().newCDPSession(page)
   const area=await content.boundingBox(),x=area.x+area.width/2,y=area.y+area.height/2+60
   await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]})
   for(let distance=20;distance<=120;distance+=20){
    await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y-distance}]})
    await page.evaluate(()=>new Promise(requestAnimationFrame))
   }
   await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]})
   await expect.poll(()=>content.evaluate(el=>el.scrollTop)).toBeGreaterThan(200)
   expect(await page.evaluate(()=>scrollY)).toBe(0)
   await touch.detach()
  }
  // Gestures at the end of the messages must not escape into the document.
  await content.evaluate(el=>{el.scrollTop=el.scrollHeight})
  const box=await content.boundingBox()
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2)
  await page.mouse.wheel(0,600)
  await page.evaluate(()=>new Promise(requestAnimationFrame))
  expect(await page.evaluate(()=>scrollY)).toBe(0)
  await expect(content).toHaveCSS('overscroll-behavior-y','contain')
  await expect(page.locator('body')).toHaveCSS('position','fixed')
  await page.screenshot({path:info.outputPath('coach-keyboard-scroll.png')})
  await input.evaluate(el=>el.blur())
  await page.evaluate(()=>window.setChatViewport(innerHeight))
  await expect(page.locator('.bottom-nav')).toBeVisible()
  await page.getByRole('button',{name:L('nav.exercises')+' '+L('nav.equipment_line'),exact:true}).click()
  await expect(page.locator('html')).not.toHaveClass(/coach-active/)
  await expect(page.locator('.exercise-card').first()).toBeVisible()
  await page.evaluate(()=>scrollTo(0,500))
  await expect.poll(()=>page.evaluate(()=>scrollY)).toBeGreaterThan(100)
  await expect(page.locator('.chat-msg__avatar')).toHaveCount(0)
 } finally {
  provider.closeAllConnections()
  await new Promise(resolve=>provider.close(resolve))
 }
})

test('history sheet follows the keyboard viewport once even when chat is already panned',async({page},info)=>{
 await page.goto('/#/coach')
 const input=page.locator('.coach-view__input')
 await expect(input).toBeEnabled()
 await input.focus()
 await page.evaluate(()=>{
  Object.defineProperties(visualViewport,{
   height:{configurable:true,get:()=>innerHeight-320},offsetTop:{configurable:true,get:()=>80},
  })
  visualViewport.dispatchEvent(new Event('resize'))
 })
 const mobile=info.project.name==='mobile'
 if(mobile)await expect(page.locator('.bottom-nav')).toBeHidden()
 await page.getByRole('button',{name:L('coach.history_title'),exact:true}).click()
 await expect(page.getByRole('dialog')).toBeVisible()
 const overlay=await page.locator('.modal-overlay').boundingBox()
 expect(Math.round(overlay.y)).toBe(mobile?80:0)
 expect(Math.round(overlay.height)).toBe(page.viewportSize().height-(mobile?320:0))
 const dialog=await page.getByRole('dialog').boundingBox()
 expect(dialog.y).toBeGreaterThanOrEqual(overlay.y)
 expect(dialog.y+dialog.height).toBeLessThanOrEqual(overlay.y+overlay.height)
 await page.getByRole('dialog').getByRole('button',{name:L('common.close'),exact:true}).click()
 await expect(page.getByRole('dialog')).toHaveCount(0)
 await expect(page.getByRole('button',{name:L('coach.history_title'),exact:true})).toBeFocused()
})
