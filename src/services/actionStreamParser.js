import { message } from '../utils/messages.js'
const OPEN = '```action'

// Network chunk boundaries do not match Markdown block boundaries.
export function createActionStreamParser() {
  let buffer = '', inAction = false
  return function push(chunk = '', final = false) {
    buffer += chunk
    const events = []
    while (buffer) {
      if (inAction) {
        const end = buffer.indexOf('```')
        if (end < 0) {
          if (final) { events.push({type:'error',message:message('action.incomplete_block')}); buffer=''; inAction=false }
          break
        }
        try { events.push({type:'action',action:JSON.parse(buffer.slice(0,end).trim())}) }
        catch { events.push({type:'error',message:message('action.invalid_json')}) }
        buffer = buffer.slice(end + 3)
        inAction = false
      } else {
        const start = buffer.indexOf(OPEN)
        if (start >= 0) {
          if (start) events.push({type:'token',content:buffer.slice(0,start)})
          buffer = buffer.slice(start + OPEN.length)
          inAction = true
          continue
        }
        let keep = 0
        if (!final) for (let n=1; n<OPEN.length; n++) if (buffer.endsWith(OPEN.slice(0,n))) keep=n
        const text = buffer.slice(0,buffer.length-keep)
        if (text) events.push({type:'token',content:text})
        buffer = buffer.slice(buffer.length-keep)
        break
      }
    }
    if (final && inAction && !buffer) {
      events.push({type:'error',message:message('action.incomplete_block')})
      inAction=false
    }
    return events
  }
}
