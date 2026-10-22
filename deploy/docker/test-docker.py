#!/usr/bin/python3
"""Smoke test a built image using disposable containers and a fresh volume only."""
import argparse
import json
import subprocess
import time
import uuid


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--image',default='workoutbuddy:local')
    parser.add_argument('--docker',default='docker',help='Docker CLI executable')
    args=parser.parse_args()
    def run(*cmd,data=None,check=True):
        return subprocess.run([args.docker,*cmd],input=data,stdout=subprocess.PIPE,stderr=subprocess.PIPE,check=check)
    volume='wb-docker-test-'+uuid.uuid4().hex
    containers=[]
    host=''
    def start(production):
        nonlocal host
        host='workoutbuddy.example.test' if production else 'localhost:3000'
        env=['-e','NODE_ENV='+('production' if production else 'development')]
        if production:env+=['-e','PUBLIC_ORIGIN=https://'+host]
        container=run('run','-d','--network','none','--read-only','--cap-drop','ALL',
                      '--security-opt','no-new-privileges:true','--tmpfs','/tmp:rw,noexec,nosuid,size=32m',
                      '--health-interval','1s','--health-start-period','2s',
                      '--mount','type=volume,src='+volume+',dst=/app/data',*env,args.image).stdout.decode().strip()
        containers.append(container)
        for _ in range(40):
            state=json.loads(run('inspect',container).stdout)[0]['State']
            if state.get('Health',{}).get('Status')=='healthy':return container
            if not state['Running']:raise RuntimeError(run('logs',container).stdout.decode())
            time.sleep(.5)
        raise RuntimeError('Container failed its health check')
    def request(container,path,method='GET',body=None):
        script="""import http from 'node:http';
const [host,path,method,body]=process.argv.slice(1);
await new Promise((resolve,reject)=>{
 const req=http.request({hostname:'127.0.0.1',port:3000,path,method,headers:{Host:host,'Content-Type':'application/json'}},res=>{
  const chunks=[];res.on('data',chunk=>chunks.push(chunk));res.on('end',()=>{console.log(JSON.stringify({status:res.statusCode,body:Buffer.concat(chunks).toString()}));resolve()});
 });req.on('error',reject);req.end(body||undefined);
})"""
        result=json.loads(run('exec',container,'node','--input-type=module','-e',script,host,path,method,'' if body is None else json.dumps(body)).stdout)
        assert result['status']==200,result
        return result['body']
    def stop(container):
        run('stop','--time','35',container)
        assert json.loads(run('inspect',container).stdout)[0]['State']['ExitCode']==0,'Unclean shutdown'
    def oneoff(*command,data=None,check=True):
        return run('run','--rm','-i','--network','none','--read-only','--cap-drop','ALL',
                   '--mount','type=volume,src='+volume+',dst=/app/data',args.image,
                   *command,data=data,check=check)
    run('volume','create',volume)
    try:
        config=json.loads(run('image','inspect',args.image).stdout)[0]['Config']
        assert config['User']=='node',config['User']
        app=start(True)
        script="""import fs from 'node:fs';
if(process.getuid()===0)throw Error('Root user');
if(!fs.readFileSync('/app/LICENSE','utf8').includes('Copyright (c) 2026'))throw Error('Missing license');
if((fs.statSync('/app/data/workoutbuddy.db').mode&0o777)!==0o600)throw Error('DB permissions');
try{fs.writeFileSync('/app/should-be-readonly','x');throw Error('Writable root')}catch(e){if(e.code!=='EROFS')throw e;}"""
        run('exec',app,'node','--input-type=module','-e',script)
        assert '<html' in request(app,'/').lower()
        assert json.loads(request(app,'/api/v1/exercises'))['exercises']
        photo_script="""import http from 'node:http';
await new Promise((resolve,reject)=>http.get({hostname:'127.0.0.1',port:3000,path:'/exercises/images/dumbbell_bench_press/0.jpg',headers:{Host:process.argv[1]}},res=>{
 const chunks=[];res.on('data',chunk=>chunks.push(chunk));res.on('end',()=>{const bytes=Buffer.concat(chunks);if(res.statusCode!==200||bytes[0]!==255||bytes[1]!==216)reject(Error('Missing photo'));else resolve()});
}).on('error',reject));"""
        run('exec',app,'node','--input-type=module','-e',photo_script,host)
        request(app,'/api/v1/user-profile','PUT',{'display_name':'Docker backup test'})
        backup_path=run('exec',app,'node','deploy/docker/backup.mjs').stdout.decode().strip()
        backup=run('exec',app,'node','-e',"process.stdout.write(require('fs').readFileSync(process.argv[1]))",backup_path).stdout
        assert backup.startswith(b'SQLite format 3')
        stop(app)
        app=start(False)
        assert json.loads(request(app,'/api/v1/user-profile'))['display_name']=='Docker backup test'
        request(app,'/api/v1/user-profile','PUT',{'display_name':'Changed after backup'})
        stop(app)
        invalid_script="""import {spawnSync} from 'node:child_process';import Database from 'better-sqlite3';
const result=spawnSync(process.execPath,['deploy/docker/restore.mjs'],{input:Buffer.from('not a SQLite database')});
if(result.status===0)throw Error('Accepted invalid backup');
const db=new Database('/app/data/workoutbuddy.db',{readonly:true});
if(db.prepare('SELECT display_name FROM user_profile WHERE id=1').get().display_name!=='Changed after backup')throw Error('Invalid restore changed data');db.close();"""
        oneoff('node','--input-type=module','-e',invalid_script)
        oneoff('node','deploy/docker/restore.mjs',data=backup)
        app=start(True)
        assert json.loads(request(app,'/api/v1/user-profile'))['display_name']=='Docker backup test'
        stop(app)
        print('Docker image: non-root, read-only root, API, production/local health, persistence, graceful shutdown, backup and restore OK')
    finally:
        for container in containers:run('rm','-f',container,check=False)
        run('volume','rm',volume,check=False)


if __name__=='__main__':main()
