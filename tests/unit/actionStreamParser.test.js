import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createActionStreamParser } from '../../src/services/actionStreamParser.js'

test('action blocks are recognized at every chunk boundary',()=>{
  const text='Before ```action\n{"action":"update_settings","data":{"theme":"light"}}\n``` After'
  for(let split=0;split<=text.length;split++) {
    const parse=createActionStreamParser()
    const events=[...parse(text.slice(0,split)),...parse(text.slice(split)),...parse('',true)]
    assert.equal(events.filter(x=>x.type==='token').map(x=>x.content).join(''),'Before  After')
    assert.equal(events.filter(x=>x.type==='action').length,1)
    assert.equal(events.find(x=>x.type==='action').action.data.theme,'light')
  }
})
test('multiple blocks in one chunk and JSON errors remain delimited',()=>{
  const parse=createActionStreamParser()
  const events=parse('```action\n{"action":"one"}\n``` texte ```action\n{"action":"two"}\n```',true)
  assert.equal(events.filter(x=>x.type==='action').length,2)
  const invalid=createActionStreamParser()('```action nope``` fin',true)
  assert.equal(invalid[0].type,'error')
  assert.equal(invalid[1].content,' fin')
})
