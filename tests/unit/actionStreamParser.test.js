import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createActionStreamParser } from '../../src/services/actionStreamParser.js'

test('les blocs action sont reconnus à toutes les frontières de chunks',()=>{
  const text='Avant ```action\n{"action":"update_settings","data":{"theme":"light"}}\n``` Après'
  for(let split=0;split<=text.length;split++) {
    const parse=createActionStreamParser()
    const events=[...parse(text.slice(0,split)),...parse(text.slice(split)),...parse('',true)]
    assert.equal(events.filter(x=>x.type==='token').map(x=>x.content).join(''),'Avant  Après')
    assert.equal(events.filter(x=>x.type==='action').length,1)
    assert.equal(events.find(x=>x.type==='action').action.data.theme,'light')
  }
})
test('plusieurs blocs dans un seul chunk et erreurs JSON restent délimités',()=>{
  const parse=createActionStreamParser()
  const events=parse('```action\n{"action":"one"}\n``` texte ```action\n{"action":"two"}\n```',true)
  assert.equal(events.filter(x=>x.type==='action').length,2)
  const invalid=createActionStreamParser()('```action nope``` fin',true)
  assert.equal(invalid[0].type,'error')
  assert.equal(invalid[1].content,' fin')
})
