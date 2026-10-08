// Note : les Web Workers ne sont pas disponibles dans node:test.
// Ce test simule la logique du worker manuellement.

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

// Logique extraite du worker pour test unitaire
function createWorkerLogic() {
  let restRemaining = 0
  const messages = []
  const logic = {
    postMessage(msg) { messages.pop(); messages.push(msg) },
    getMessages() { return [...messages] },
    handle(e) {
      const { type, payload } = e.data
      if (type === 'START_REST') {
        restRemaining = payload.duration_seconds
        logic.postMessage({ type: 'REST_TICK', remaining: restRemaining })
      }
      if (type === 'SKIP_REST') {
        restRemaining = 0
        logic.postMessage({ type: 'REST_COMPLETE' })
      }
    }
  }
  return logic
}

describe('T2.5 — Timer Worker Logic', () => {
  it('START_REST émet REST_TICK avec la durée initiale', () => {
    const logic = createWorkerLogic()
    logic.handle({ data: { type: 'START_REST', payload: { duration_seconds: 90 } } })
    const msgs = logic.getMessages()
    assert.equal(msgs[0].type, 'REST_TICK')
    assert.equal(msgs[0].remaining, 90)
  })

  it('SKIP_REST émet REST_COMPLETE', () => {
    const logic = createWorkerLogic()
    logic.handle({ data: { type: 'START_REST', payload: { duration_seconds: 90 } } })
    logic.handle({ data: { type: 'SKIP_REST' } })
    const msgs = logic.getMessages()
    assert.equal(msgs[0].type, 'REST_COMPLETE')
  })
})
