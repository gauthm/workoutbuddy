import {createServer,request as proxyRequest} from 'node:http'

// Real HTTP redirects on another origin reproduce the identity provider/CORS
// boundary. Authorized requests always reach the real, isolated application.
export async function authenticationProxy(app) {
  let expired=false
  const login=createServer((_req,res)=>{res.writeHead(200,{'Content-Type':'text/html'});res.end('<h1>Authentication portal</h1>')})
  await new Promise(resolve=>login.listen(0,'127.0.0.1',resolve))
  const loginURL=`http://127.0.0.1:${login.address().port}/`
  const proxy=createServer((req,res)=>{
    res.setHeader('X-WorkoutBuddy-Logout','/auth/logout')
    if(req.url==='/auth/logout'){expired=true;res.writeHead(302,{'Location':loginURL});res.end();return}
    if(req.url==='/auth/login' || (expired && req.url!=='/sw.js')) {
      if(req.url.startsWith('/api/') && req.headers.accept==='application/json') {
        res.writeHead(401,{'Content-Type':'application/json','Location':loginURL});res.end(JSON.stringify({error:'AUTH_REQUIRED'}))
      } else {res.writeHead(302,{'Location':loginURL});res.end()}
      return
    }
    const upstream=proxyRequest(new URL(req.url,app.url),{method:req.method,headers:req.headers},response=>{
      res.writeHead(response.statusCode,response.headers);response.pipe(res)
    })
    upstream.on('error',()=>{res.writeHead(502);res.end()});req.pipe(upstream)
  })
  await new Promise(resolve=>proxy.listen(0,'127.0.0.1',resolve))
  return {url:`http://127.0.0.1:${proxy.address().port}`,loginURL,expire:()=>{expired=true},
    async dispose(){await Promise.all([proxy,login].map(server=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections()})))} }
}
