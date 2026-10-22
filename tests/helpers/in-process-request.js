import { Readable, Duplex } from 'node:stream'
import { ServerResponse } from 'node:http'

// Run Express, its JSON parser and routes without opening a TCP port.
export default function request(app) {
  const builder = {}
  for (const method of ['get','post','put','patch','delete','options','head']) {
    builder[method] = url => {
      let payload
      let promise
      const extraHeaders = {}
      const chain = {
        set(name, value) {extraHeaders[name.toLowerCase()] = value; return this},
        send(value) { payload = value; return this },
        then(resolve, reject) {
          promise ||= new Promise((done, fail) => {
            const raw = payload === undefined ? '' : JSON.stringify(payload)
            const req = Readable.from(raw ? [Buffer.from(raw)] : [])
            const socket = new Duplex({ read() {}, write(_chunk, _encoding, callback) { callback() } })
            Object.assign(req, { method: method.toUpperCase(), url, socket, connection: socket,
              headers: {...(raw ? { 'content-type':'application/json', 'content-length':Buffer.byteLength(raw), host:'localhost' } : {host:'localhost'}), ...extraHeaders} })
            const res = new ServerResponse(req)
            const chunks = []
            res.write = chunk => { chunks.push(Buffer.from(chunk)); return true }
            res.flushHeaders = () => {}
            res.end = chunk => {
              if (chunk) chunks.push(Buffer.from(chunk))
              const text = Buffer.concat(chunks).toString('utf8')
              const headers = res.getHeaders()
              let body = {}
              if (String(headers['content-type']).includes('application/json') && text) {
                try { body = JSON.parse(text) } catch (error) { fail(error); return res }
              }
              res.finished = true
              res.emit('finish')
              done({status:res.statusCode,headers,body,text})
              return res
            }
            app.handle(req, res, error => {
              if (error) fail(error)
              else { res.statusCode=404; res.end() }
            })
          })
          return promise.then(resolve,reject)
        },
      }
      return chain
    }
  }
  return builder
}
