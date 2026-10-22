import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'

function createWorkerLogic() {
  let clock = 0, nextId = 0
  const messages = []
  const intervals = new Map()
  const self = { postMessage(message) { messages.push(message) } }
  const context = vm.createContext({ self, Date: { now: () => clock },
    setInterval(fn) { const id = ++nextId; intervals.set(id,fn); return id },
    clearInterval(id) { intervals.delete(id) },
  })
  vm.runInContext(fs.readFileSync(new URL('../../public/js/timer-worker.js',import.meta.url),'utf8'),context)
  return {
    handle: event => self.onmessage(event),
    getMessages: () => messages.slice(-1),
    allMessages: () => messages,
    advance(ms) { clock += ms; for(const fn of [...intervals.values()]) fn() },
  }
}

describe('T2.5 — Timer Worker Logic', () => {
  it('START_REST emits REST_TICK with initial duration', () => {
    const logic = createWorkerLogic()
    logic.handle({ data: { type: 'START_REST', payload: { duration_seconds: 90 } } })
    const msgs = logic.getMessages()
    assert.equal(msgs[0].type, 'REST_TICK')
    assert.equal(msgs[0].remaining, 90)
  })

  it('SKIP_REST emits REST_COMPLETE', () => {
    const logic = createWorkerLogic()
    logic.handle({ data: { type: 'START_REST', payload: { duration_seconds: 90 } } })
    logic.handle({ data: { type: 'SKIP_REST' } })
    const msgs = logic.getMessages()
    assert.equal(msgs[0].type, 'REST_COMPLETE')
  })
  it('a delayed tick uses actual elapsed time',()=>{
    const logic=createWorkerLogic()
    logic.handle({data:{type:'START_REST',payload:{duration_seconds:90}}})
    logic.advance(30000)
    assert.equal(logic.getMessages()[0].remaining,60)
    logic.advance(60000)
    assert.equal(logic.getMessages()[0].type,'REST_COMPLETE')
  })
  it('workout timer catches up on missed ticks',()=>{
    const logic=createWorkerLogic()
    logic.handle({data:{type:'START_SESSION',payload:{elapsed_seconds:60}}})
    logic.advance(120000)
    assert.equal(logic.getMessages()[0].elapsed,180)
  })
  it('adjusting rest preserves elapsed time',()=>{
    const logic=createWorkerLogic()
    logic.handle({data:{type:'START_REST',payload:{duration_seconds:90}}})
    logic.advance(30000)
    logic.handle({data:{type:'ADJUST_REST',payload:{seconds:15}}})
    assert.equal(logic.getMessages()[0].remaining,75)
    logic.advance(10000)
    logic.handle({data:{type:'ADJUST_REST',payload:{seconds:-15}}})
    assert.equal(logic.getMessages()[0].remaining,50)
  })
  it('removing remaining rest completes the timer once',()=>{
    const logic=createWorkerLogic()
    logic.handle({data:{type:'START_REST',payload:{duration_seconds:10}}})
    logic.handle({data:{type:'ADJUST_REST',payload:{seconds:-15}}})
    assert.equal(logic.getMessages()[0].type,'REST_COMPLETE')
    logic.advance(10000)
    assert.equal(logic.allMessages().filter(m=>m.type==='REST_COMPLETE').length,1)
  })

})
