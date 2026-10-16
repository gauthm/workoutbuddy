import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createScreenWakeLock } from '../../public/js/utils/screenWakeLock.js'

const tick = () => new Promise(setImmediate)
function environment(request) {
  const document = new EventTarget()
  document.visibilityState = 'visible'
  const locks = [], states = []
  const navigator = { wakeLock: { request: request || (async type => {
    assert.equal(type, 'screen')
    const lock = new EventTarget()
    lock.released = false
    lock.release = async () => { lock.released = true; lock.dispatchEvent(new Event('release')) }
    locks.push(lock)
    return lock
  }) } }
  const controller = createScreenWakeLock({ navigator, document, onChange: state => states.push(state) })
  return { controller, document, locks, state: () => states.at(-1),
    async visibility(value) { document.visibilityState = value; document.dispatchEvent(new Event('visibilitychange')); await tick() },
  }
}

test('wake lock is off by default, retained across repeated enable calls and released when disabled', async () => {
  const e = environment()
  assert.equal(e.locks.length, 0)
  await e.controller.setEnabled(true)
  await e.controller.setEnabled(true)
  assert.equal(e.locks.length, 1)
  assert.equal(e.state().active, true)
  await e.controller.setEnabled(false)
  assert.equal(e.locks[0].released, true)
  assert.equal(e.state().active, false)
  await e.controller.dispose()
})

test('wake lock is released while hidden and requested again on return', async () => {
  const e = environment()
  await e.controller.setEnabled(true)
  await e.visibility('hidden')
  assert.equal(e.locks[0].released, true)
  assert.equal(e.state().active, false)
  await e.visibility('visible')
  assert.equal(e.locks.length, 2)
  assert.equal(e.state().active, true)
  await e.controller.dispose()
  await e.visibility('visible')
  assert.equal(e.locks.length, 2)
})

test('system release is reported without a retry loop, then retried on return', async () => {
  const e = environment()
  await e.controller.setEnabled(true)
  await e.locks[0].release()
  await tick()
  assert.equal(e.state().unavailable, true)
  assert.equal(e.locks.length, 1)
  await e.visibility('hidden')
  await e.visibility('visible')
  assert.equal(e.locks.length, 2)
  await e.controller.dispose()
})

test('unsupported browsers and rejected requests are handled without throwing', async () => {
  const states = []
  const controller = createScreenWakeLock({navigator:{}, document:new EventTarget(), onChange:state=>states.push(state)})
  await controller.setEnabled(true)
  assert.equal(states.at(-1).supported, false)
  await controller.dispose()
  const e = environment(async () => { throw new Error('NotAllowedError') })
  await e.controller.setEnabled(true)
  assert.equal(e.state().unavailable, true)
  assert.equal(e.state().active, false)
  await e.controller.dispose()
})

test('a pending lock arriving after disable or disposal is released', async () => {
  for (const dispose of [false,true]) {
    let resolve
    const e = environment(() => new Promise(done => { resolve = done }))
    const request = e.controller.setEnabled(true)
    await (dispose ? e.controller.dispose() : e.controller.setEnabled(false))
    let released = false
    resolve({ release:async () => { released = true } })
    await request
    assert.equal(released, true)
    assert.equal(e.state().active, false)
    await e.controller.dispose()
  }
})

test('visibility changes during a pending denied request still reacquire on return', async () => {
  let reject, attempts = 0
  const e = environment(() => {
    attempts++
    if (attempts === 1) return new Promise((_, fail) => { reject = fail })
    const lock = new EventTarget()
    lock.release = async () => {}
    return Promise.resolve(lock)
  })
  const first = e.controller.setEnabled(true)
  await e.visibility('hidden')
  await e.visibility('visible')
  reject(new Error('Hidden during request'))
  await first
  await tick()
  assert.equal(attempts, 2)
  assert.equal(e.state().active, true)
  await e.controller.dispose()
})
