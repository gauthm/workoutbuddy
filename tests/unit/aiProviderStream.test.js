import { test } from 'node:test'
import assert from 'node:assert/strict'
import { streamChat } from '../../src/services/aiProvider.js'

test('le provider accepte data: sans espace et ferme le lecteur à DONE',async t=>{
  const encoder=new TextEncoder()
  let cancelled=false
  const body=new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode('data:{"choices":[{"delta":{"content":"Salut"}}]}\n'))
      controller.enqueue(encoder.encode('data: [DONE]\n\n'))
    },
    cancel() { cancelled=true },
  })
  t.mock.method(globalThis,'fetch',async()=>new Response(body))
  const events=[]
  for await(const event of streamChat([],{base_url:'http://mock.invalid',model:'mock'}))events.push(event)
  assert.equal(events[0].content,'Salut')
  assert.equal(events[1].type,'done')
  assert.equal(cancelled,true)
})
