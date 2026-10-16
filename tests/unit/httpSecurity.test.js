import {test} from 'node:test'
import assert from 'node:assert/strict'
import {EventEmitter} from 'node:events'
import {securityConfig,securityHeaders,rateLimit,expensiveRequests} from '../../src/services/httpSecurity.js'
function response(){const res=new EventEmitter();res.headers={};res.statusCode=200
 res.set=(key,value)=>{if(typeof key==='object')Object.assign(res.headers,key);else res.headers[key]=value;return res}
 res.status=code=>{res.statusCode=code;return res};res.json=body=>{res.body=body;return res};return res}
function invoke(fn,{ip='127.0.0.1',path='/',method='POST',...rest}={}){
 const res=response();let passed=false;fn({ip,path,method,...rest},res,()=>{passed=true});return {res,passed}
}
test('production : origine HTTPS explicite, sans identifiants ni chemin, et proxy restreint',()=>{
 for(const env of [{NODE_ENV:'production'},{NODE_ENV:'production',PUBLIC_ORIGIN:'http://example.com'},
  {PUBLIC_ORIGIN:'https://user:pwd@example.com'},{PUBLIC_ORIGIN:'https://example.com/path'},
  {PUBLIC_ORIGIN:'https://example.com?x=1'},{PUBLIC_ORIGIN:'javascript:alert(1)'},{TRUST_PROXY:'true'}])assert.throws(()=>securityConfig(env))
 assert.deepEqual(securityConfig({NODE_ENV:'production',PUBLIC_ORIGIN:'https://example.com/',TRUST_PROXY:'loopback'}),{origin:'https://example.com',trustProxy:'loopback'})
 assert.deepEqual(securityConfig({}),{origin:null,trustProxy:false})
})
test('hôte public contrôlé et HSTS sur HTTPS, sans forcer le HTTPS du réseau local',()=>{
 const secure=securityHeaders({origin:'https://app.example.com'})
 let result=invoke(secure,{get:key=>key==='host'?'app.example.com':undefined})
 assert.equal(result.passed,true);assert.match(result.res.headers['Strict-Transport-Security'],/31536000/)
 result=invoke(secure,{get:()=> 'attacker.example'})
 assert.equal(result.res.statusCode,403);assert.equal(result.res.body.error,'HOST_NOT_ALLOWED')
 result=invoke(securityHeaders(),{get:()=> 'localhost',secure:false})
 assert.equal(result.res.headers['Strict-Transport-Security'],undefined)
 for(const host of ['127.0.0.1:3000','192.168.1.10:3000','[::1]:3000'])assert.equal(invoke(securityHeaders(),{get:()=>host}).passed,true)
 for(const host of ['attacker.example','localhost.attacker.example','user@localhost','localhost/path'])assert.equal(invoke(securityHeaders(),{get:()=>host}).res.body.error,'HOST_NOT_ALLOWED')
})
test('limite par IP : réponse 429, Retry-After, expiration et mémoire bornée',()=>{
 let time=0;const limit=rateLimit({limit:2,windowMs:1000,maxEntries:2,now:()=>time})
 assert.equal(invoke(limit).passed,true);assert.equal(invoke(limit).passed,true)
 const denied=invoke(limit);assert.equal(denied.res.statusCode,429);assert.equal(denied.res.headers['Retry-After'],'1')
 assert.equal(invoke(limit,{ip:'other'}).passed,true)
 assert.equal(invoke(limit,{ip:'overflow'}).res.statusCode,429)
 time=1000;assert.equal(invoke(limit,{ip:'overflow'}).passed,true)
 assert.equal(invoke(limit).passed,true)
})
test('IA : deux requêtes simultanées au maximum, libération après fin ou déconnexion une seule fois',()=>{
 const gate=expensiveRequests(),request={path:'/ai/chat'}
 const one=invoke(gate,request),two=invoke(gate,request)
 assert.equal(one.passed,true);assert.equal(two.passed,true)
 assert.equal(invoke(gate,request).res.body.error,'AI_BUSY')
 one.res.emit('finish');one.res.emit('close')
 const three=invoke(gate,request);assert.equal(three.passed,true)
 assert.equal(invoke(gate,request).res.body.error,'AI_BUSY')
 two.res.emit('close');assert.equal(invoke(gate,request).passed,true)
})
test('limites coûteuses couvrent les chemins avec slash final et les appels de modèles en GET',()=>{
 const gate=expensiveRequests()
 for(let i=0;i<12;i++){const r=invoke(gate,{path:'/settings/ai-models/',method:'GET'});assert.equal(r.passed,true);r.res.emit('finish')}
 assert.equal(invoke(gate,{path:'/SETTINGS/TEST-AI/'}).res.body.error,'RATE_LIMITED')
 for(let i=0;i<30;i++){const r=invoke(gate,{path:'/import'});assert.equal(r.passed,true);r.res.emit('finish')}
 assert.equal(invoke(gate,{path:'/backup'}).res.body.error,'RATE_LIMITED')
 assert.equal(invoke(gate,{path:'/sessions/12/complete'}).passed,true)
})

test('un seul import peut réserver un corps volumineux ; sa déconnexion libère la place',()=>{
 const gate=expensiveRequests()
 const first=invoke(gate,{path:'/import'})
 assert.equal(first.passed,true)
 assert.equal(invoke(gate,{path:'/IMPORT/'}).res.body.error,'IMPORT_BUSY')
 assert.equal(invoke(gate,{path:'/sessions/1/complete'}).passed,true)
 first.res.emit('close');first.res.emit('finish')
 assert.equal(invoke(gate,{path:'/import'}).passed,true)
 assert.equal(invoke(gate,{path:'/import'}).res.body.error,'IMPORT_BUSY')
})
