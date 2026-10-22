import {test} from 'node:test'
import assert from 'node:assert/strict'
import request from '../helpers/in-process-request.js'
process.env.DB_PATH=':memory:'
const {getDb}=await import('../../src/db/database.js')
const {migrate}=await import('../../src/db/migrate.js');migrate(getDb())
const {app}=await import('../../server.js'),api=request(app)
test('private API: no-store and headers also apply to errors, no permissive CORS',async()=>{
 const res=await api.get('/api/v1/does-not-exist')
 assert.equal(res.status,404);assert.equal(res.headers['cache-control'],'no-store')
 assert.equal(res.headers['x-powered-by'],undefined)
 assert.equal(res.headers['access-control-allow-origin'],undefined)
 assert.equal(res.headers['x-frame-options'],'DENY')
 assert.equal(res.headers['x-content-type-options'],'nosniff')
 assert.match(res.headers['content-security-policy'],/frame-ancestors 'none'/)
 assert.match(res.headers['content-security-policy'],/script-src 'self' 'unsafe-eval'/)
 assert.doesNotMatch(res.headers['content-security-policy'],/script-src [^;]*'unsafe-inline'/)
})
test('foreign origins, null Origin and hostile Fetch Metadata rejected before mutation',async()=>{
 const before=(await api.get('/api/v1/settings')).body
 for(const origin of ['https://attacker.example','http://localhost.attacker.example','null','http://localhost:9999']){
  const res=await api.put('/api/v1/settings').set('Origin',origin).send({theme:'light'})
  assert.equal(res.status,403);assert.equal(res.body.error,'CROSS_ORIGIN_FORBIDDEN')
 }
 assert.equal((await api.get('/api/v1/export').set('Sec-Fetch-Site','cross-site')).status,403)
 assert.equal((await api.get('/api/v1/settings')).body.theme,before.theme)
 assert.equal((await api.get('/api/v1/settings').set('Origin','http://localhost')).status,200)
})
test('writes require JSON; no compressed body or oversized request',async()=>{
 assert.equal((await api.put('/api/v1/settings').set('Content-Type','text/plain').send({theme:'light'})).status,415)
 assert.equal((await api.put('/api/v1/settings').set('Content-Type','application/x-www-form-urlencoded').send({theme:'light'})).status,415)
 assert.equal((await api.put('/api/v1/settings').set('Content-Encoding','gzip').send({theme:'light'})).status,415)
 assert.equal((await api.put('/api/v1/settings').send({theme:'x'.repeat(105000)})).status,413)
})
test('a forged proxy address does not trigger HSTS on local HTTP',async()=>{
 const res=await api.get('/api/v1/settings').set('X-Forwarded-Proto','https').set('X-Forwarded-For','1.2.3.4')
 assert.equal(res.status,200);assert.equal(res.headers['strict-transport-security'],undefined)
 assert.equal((await api.get('/api/v1/settings').set('Host','attacker.example').set('Origin','http://attacker.example')).status,403)
})
