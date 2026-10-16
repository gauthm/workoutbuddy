import {test,expect} from './fixtures.js'
import {L,call,get} from './helpers.js'
import {createServer} from 'node:http'

test('champ du Coach : Entrée envoie sur desktop, nouvelle ligne sur mobile ; Maj+Entrée et taille du champ',async({page},testInfo)=>{
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
 await input.fill('Une ligne de test')
 expect((await metrics()).scroll).toBeLessThanOrEqual((await metrics()).client)
 await input.press(mobile?'Enter':'Shift+Enter');await input.press('Shift+Enter')
 await input.pressSequentially('Troisième ligne')
 await expect(input).toHaveValue('Une ligne de test\n\nTroisième ligne')
 expect(sent).toHaveLength(0)
 const expanded=await metrics()
 expect(expanded.height).toBeGreaterThan(initial.height)
 expect(expanded.height).toBeLessThan(120)
 expect(expanded.scroll).toBeLessThanOrEqual(expanded.client)
 expect(expanded.overflow).toBe('hidden')
 await input.fill(Array.from({length:30},(_,i)=>`Ligne synthétique ${i+1} du message long`).join('\n'))
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
 await input.fill('Premier paragraphe\nDeuxième paragraphe\nTroisième paragraphe')
 expect((await metrics()).height).toBeGreaterThan(initial.height)
 const response=page.waitForResponse(r=>r.url().endsWith('/api/v1/ai/chat') && r.request().method()==='POST')
 if(mobile){
  await input.press('Enter')
  await expect(input).toHaveValue('Premier paragraphe\nDeuxième paragraphe\nTroisième paragraphe\n')
  expect(sent).toHaveLength(0)
  await page.getByRole('button',{name:L('coach.send'),exact:true}).click()
 }else{
  await input.press('Enter')
 }
 // The real isolated API rejects an unconfigured provider; no paid/external AI.
 expect((await(await response).json()).error).toBe('AI_NOT_CONFIGURED')
 expect(sent).toHaveLength(1)
 expect(sent[0].postDataJSON().message).toBe('Premier paragraphe\nDeuxième paragraphe\nTroisième paragraphe')
 await expect(input).toHaveValue('')
 await expect(input).toHaveCSS('overflow-y','hidden')
 expect((await metrics()).height).toBe(initial.height)
 const nav=await page.locator('.bottom-nav').boundingBox()
 expect((await input.boundingBox()).y+(await input.boundingBox()).height).toBeLessThanOrEqual(nav.y)
})

test('Entrée respecte la composition du clavier et ne soumet pas un message vide',async({page},testInfo)=>{
 test.skip(testInfo.project.name==='mobile','Raccourci réservé au clavier desktop')
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

test('le Coach continue hors écran avant et pendant la réponse, puis revient au dernier message',async({page,request})=>{
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
  await input.fill('Question conservée pendant la navigation')
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
  await expect(page.getByText('Question conservée pendant la navigation',{exact:true})).toHaveCount(1)
  await expect(page.getByRole('button',{name:L('coach.new_conversation'),exact:true})).toBeDisabled()

  response.writeHead(200,{'Content-Type':'text/event-stream'})
  token('Début de réponse conservé.\n')
  await expect(page.getByText('Début de réponse conservé.',{exact:true})).toBeVisible()
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
  token(Array.from({length:50},(_,i)=>`Conseil de test ${i+1}.\n\n`).join('')+'Dernier conseil conservé.')
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
  await expect(page.locator('.chat-msg--assistant .chat-msg__bubble')).toContainText('Dernier conseil conservé.')
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
  await expect(page.locator('.chat-msg--assistant .chat-msg__bubble')).toContainText('Dernier conseil conservé.')
  await expect.poll(bottom).toBeLessThan(2)

  await expect(page.locator('.chat-msg__avatar')).toHaveCount(0)
 } finally {
  provider.closeAllConnections()
  await new Promise(resolve=>provider.close(resolve))
 }
})
