#!/usr/bin/python3
"""Disposable Authelia/Caddy/Redis integration test. No production config or DB."""
import base64
import copy
import hashlib
import hmac
import http.cookiejar
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
import threading
import json
import os
from pathlib import Path
import re
import secrets
import shutil
import socket
import ssl
import struct
import subprocess
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request

os.umask(0o077)
os.environ['PATH']=os.environ.get('PATH',os.defpath)+os.pathsep+'/usr/local/bin'
template=Path(__file__).with_name('authelia.yml.template')
for binary in ['authelia','caddy','redis-server','node']:
    if not shutil.which(binary):raise SystemExit('Missing test binary: '+binary)

def port():
    with socket.socket() as server:
        server.bind(('127.0.0.1',0));return server.getsockname()[1]

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self,*args,**kwargs):return None

def check(name,condition):
    if not condition:raise RuntimeError('Failed: '+name)
    print(name+': OK',flush=True)

with tempfile.TemporaryDirectory(prefix='workoutbuddy-auth-test-') as directory:
    root=Path(directory);processes=[];streams=[]
    domain='app.workoutbuddy-test.test';authport,tlsport,appport=port(),port(),port()
    base=f'https://{domain}:{tlsport}';auth=f'https://auth.{domain}:{tlsport}'
    lookup=socket.getaddrinfo
    def resolve(host,p,*args,**kwargs):
        return lookup('127.0.0.1' if host in (domain,'auth.'+domain) else host,p,*args,**kwargs)
    socket.getaddrinfo=resolve
    jar=http.cookiejar.CookieJar()
    def opener(cookies):
        return urllib.request.build_opener(urllib.request.ProxyHandler({}),urllib.request.HTTPSHandler(context=ssl._create_unverified_context()),urllib.request.HTTPCookieProcessor(cookies),NoRedirect())
    client=opener(jar)
    def request(url,body=None,other=None,headers=None):
        req=urllib.request.Request(url,data=None if body is None else json.dumps(body).encode(),headers={'Content-Type':'application/json','Accept':'application/json',**(headers or {})})
        try:response=(other or client).open(req,timeout=10)
        except urllib.error.HTTPError as error:response=error
        with response:return response.code,response.read(),response.headers
    def spawn(name,args,env=None,cwd=None):
        log=(root/(name+'.log')).open('ab');streams.append(log)
        process=subprocess.Popen(args,stdout=log,stderr=log,cwd=cwd,env={**os.environ,'XDG_DATA_HOME':str(root/'caddy-data'),'XDG_CONFIG_HOME':str(root/'caddy-config'),**(env or {})})
        processes.append(process);return process
    def stop(process):
        process.terminate()
        try:process.wait(timeout=15)
        except subprocess.TimeoutExpired:process.kill();process.wait();raise
    redis_password=secrets.token_hex(32)
    socketpath=str(root/'redis.sock')
    def redis_ready():
        with socket.socket(socket.AF_UNIX) as connection:
            connection.settimeout(2);connection.connect(socketpath)
            body=f'*2\r\n$4\r\nAUTH\r\n${len(redis_password)}\r\n{redis_password}\r\n'.encode()
            connection.sendall(body);assert connection.recv(128).startswith(b'+OK')
    def wait(predicate):
        for _ in range(100):
            try:
                if predicate():return
            except (OSError,AssertionError):pass
            time.sleep(.1)
        raise RuntimeError('Isolated service startup failed; private logs in temporary test directory')
    try:
        project=template.parents[2]
        spawn('app',['node',str(project/'server.js')],env={'NODE_ENV':'production','HOST':'127.0.0.1','PORT':str(appport),'DB_PATH':str(root/'app.db'),'PUBLIC_ORIGIN':base,'TRUST_PROXY':'loopback'},cwd=project)
        wait(lambda:urllib.request.urlopen(urllib.request.Request(f'http://127.0.0.1:{appport}/api/v1/settings',headers={'Host':f'{domain}:{tlsport}'}),timeout=2).status==200)
        redisconfig=root/'redis.conf'
        redisconfig.write_text(f'port 0\nunixsocket {socketpath}\nunixsocketperm 600\nrequirepass {redis_password}\ndir {root}\nsave ""\nappendonly yes\nappendfsync everysec\n')
        redis=spawn('redis',['redis-server',str(redisconfig)]);wait(lambda:(redis_ready() or True))
        output=subprocess.run(['authelia','crypto','hash','generate','argon2','--random'],capture_output=True,text=True,check=True).stdout
        password=re.search(r'Password:\s*(\S+)',output)[1];digest=re.search(r'Digest:\s*(\S+)',output)[1]
        users=root/'users.yml';users.write_text('users:\n  synthetic:\n    displayname: Synthetic\n    password: '+json.dumps(digest)+'\n    email: synthetic@example.invalid\n')
        config=root/'authelia.yml';text=template.read_text()
        for key,value in {'DOMAIN':domain,'SECRET':secrets.token_hex(32),'JWT_SECRET':secrets.token_hex(32),'ENCRYPTION_KEY':secrets.token_hex(32),'REDIS_PASSWORD':redis_password}.items():text=text.replace('__'+key+'__',value)
        text=text.replace('tcp://127.0.0.1:9091/',f'tcp://127.0.0.1:{authport}/').replace('/etc/authelia/users.yml',str(users)).replace('/run/workoutbuddy-sessions/redis.sock',socketpath).replace('/var/lib/authelia/db.sqlite3',str(root/'authelia.db')).replace('/var/lib/authelia/notifications.txt',str(root/'notifications.txt'))
        text=text.replace('inactivity: 15m','inactivity: 2s').replace('expiration: 1h','expiration: 5s').replace('https://auth.'+domain,'https://auth.'+domain+':'+str(tlsport)).replace('default_redirection_url: https://'+domain,'default_redirection_url: '+base)
        config.write_text(text)
        subprocess.run(['authelia','config','validate','--config',str(config)],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,check=True)
        authelia=spawn('authelia',['authelia','--config',str(config)])
        wait(lambda:urllib.request.urlopen(f'http://127.0.0.1:{authport}/api/health',timeout=2).status==200)
        output=subprocess.run(['authelia','storage','user','totp','generate','synthetic','--config',str(config)],capture_output=True,text=True,check=True).stdout
        secret=urllib.parse.parse_qs(urllib.parse.urlsplit(re.search(r"URI '(otpauth[^']+)'",output)[1]).query)['secret'][0]
        caddyfile=root/'Caddyfile'
        snippet=re.search(r'\(security_headers\) \{.*?\n\}',template.with_name('Caddyfile.template').read_text(),re.S)[0]
        class Echo(BaseHTTPRequestHandler):
            def do_GET(self):
                self.send_response(200);self.end_headers();self.wfile.write(json.dumps({'forwarded':self.headers.get('X-Forwarded-For')}).encode())
            def log_message(self,*args):pass
        echo=ThreadingHTTPServer(('127.0.0.1',0),Echo)
        threading.Thread(target=echo.serve_forever,daemon=True).start()
        caddyfile.write_text('''{
 admin off
 auto_https disable_redirects
 skip_install_trust
}
'''+snippet+'\n'+f'''{base} {{
 bind 127.0.0.1
 tls internal
 import security_headers
 route {{
 handle /sw.js {{
  reverse_proxy 127.0.0.1:{appport} {{
   header_up Host {domain}:{tlsport}
   header_up X-Forwarded-Proto https
  }}
 }}
 handle /auth/login {{
  redir {auth}/?rd={base}/ 302
 }}
 handle {{
 request_header -X-Forwarded-For
 forward_auth 127.0.0.1:{authport} {{
  uri /api/authz/forward-auth
 }}
 @echo path /_check/headers
 reverse_proxy @echo 127.0.0.1:{echo.server_port} {{
  header_up X-Forwarded-For {{remote_host}}
 }}
 reverse_proxy 127.0.0.1:{appport} {{
  header_up Host {domain}:{tlsport}
  header_up X-Forwarded-Proto https
 }}
 }}
 }}
}}
{auth} {{
 bind 127.0.0.1
 tls internal
 import security_headers
 reverse_proxy 127.0.0.1:{authport}
}}
''')
        spawn('caddy',['caddy','run','--config',str(caddyfile),'--adapter','caddyfile'])
        wait(lambda:request(auth+'/api/health')[0]==200)
        check('Authelia nonce CSP preserved by Caddy fallback',"'nonce-" in request(auth+'/')[2].get('Content-Security-Policy',''))
        if os.environ.get('WB_PLAYWRIGHT_PATH'):
            subprocess.run(['node',str(template.with_name('test-auth-recovery.mjs')),base,auth],check=True,timeout=45)
        last_step=0
        def login(remember):
            global last_step
            jar.clear()
            check('Password accepted',request(auth+'/api/firstfactor',{'username':'synthetic','password':password,'keepMeLoggedIn':remember,'targetURL':base})[0]==200)
            check('Password alone cannot access protected app',request(base+'/')[0] in (302,401,403))
            step=max(int(time.time()//30),last_step+1);last_step=step
            key=base64.b32decode(secret+'='*((-len(secret))%8));digest=hmac.new(key,struct.pack('>Q',step),hashlib.sha1).digest();offset=digest[-1]&15
            token=str((struct.unpack('>I',digest[offset:offset+4])[0]&0x7fffffff)%1000000).zfill(6)
            check('TOTP accepted',request(auth+'/api/secondfactor/totp',{'token':token,'targetURL':base})[0]==200)
        login(True)
        app_headers=request(base+'/')[2]
        check('Application Vue CSP preserved by Caddy fallback',"script-src 'self' 'unsafe-eval'" in app_headers.get('Content-Security-Policy',''))
        check('Authentication works with no-referrer policy',app_headers.get('Referrer-Policy')=='no-referrer')
        check('HSTS covers subdomains',app_headers.get('Strict-Transport-Security')=='max-age=31536000; includeSubDomains')
        check('remote_host sends a pure IP and rejects forged forwarded IP',json.loads(request(base+'/_check/headers',headers={'X-Forwarded-For':'192.0.2.44:54321'})[1])['forwarded']=='127.0.0.1')
        cookie=next(c for c in jar if c.name=='__Secure-workoutbuddy_session')
        check('Remembered cookie is Secure, HttpOnly and expires after 60 days',cookie.secure and cookie.has_nonstandard_attr('HttpOnly') and abs(cookie.expires-time.time()-60*86400)<60)
        time.sleep(2.5)
        check('Remembered login survives ordinary inactivity timeout',request(base+'/')[0]==200)
        stop(authelia);authelia=spawn('authelia',['authelia','--config',str(config)])
        wait(lambda:urllib.request.urlopen(f'http://127.0.0.1:{authport}/api/health',timeout=2).status==200)
        check('Remembered login survives Authelia restart',request(base+'/')[0]==200)
        stop(redis);redis=spawn('redis',['redis-server',str(redisconfig)]);wait(lambda:(redis_ready() or True))
        wait(lambda:request(base+'/')[0]==200)
        check('Remembered login survives persistent Redis restart',True)
        copied=http.cookiejar.CookieJar()
        for item in jar:copied.set_cookie(copy.copy(item))
        check('Persisted browser cookie resumes the authenticated session',request(base+'/',other=opener(copied))[0]==200)
        check('Logout succeeds',request(auth+'/api/logout',{'targetURL':base})[0]==200)
        check('Logout revokes even a previous copy of the cookie',request(base+'/',other=opener(copied))[0] in (302,401,403))
        login(False)
        check('Ordinary authenticated session initially works',request(base+'/')[0]==200)
        time.sleep(2.5)
        check('Ordinary session expires after inactivity',request(base+'/')[0] in (302,401,403))
    finally:
        if 'echo' in locals():echo.shutdown();echo.server_close()
        socket.getaddrinfo=lookup
        for process in reversed(processes):
            if process.poll() is None:stop(process)
        for stream in streams:stream.close()
