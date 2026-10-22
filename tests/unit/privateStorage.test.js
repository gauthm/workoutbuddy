import {test} from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {spawnSync} from 'node:child_process'
import {fileURLToPath} from 'node:url'
import {privateCreation,privateDirectory,privateFile,privateBackups} from '../../src/db/privateStorage.js'
const root=fileURLToPath(new URL('../../',import.meta.url))
const mode=file=>fs.statSync(file).mode&0o777
function temporary(fn){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'wb-private-'));try{return fn(dir)}finally{fs.rmSync(dir,{recursive:true,force:true})}}
test('private files and directories: restrictive creation, existing permissions corrected, umask restored even on error',()=>temporary(dir=>{
 const previous=process.umask()
 const folder=path.join(dir,'data');privateDirectory(folder);assert.equal(mode(folder),0o700)
 const file=path.join(folder,'test.db')
 privateCreation(()=>fs.writeFileSync(file,'private'))
 assert.equal(mode(file),0o600);assert.equal(process.umask(),previous)
 fs.chmodSync(file,0o666);privateFile(file);assert.equal(mode(file),0o600)
 fs.chmodSync(folder,0o777);privateDirectory(folder);assert.equal(mode(folder),0o700)
 assert.throws(()=>privateCreation(()=>{throw new Error('failure')}));assert.equal(process.umask(),previous)
}))
test('an existing custom parent remains intact; symlinks are never followed',()=>temporary(dir=>{
 fs.chmodSync(dir,0o755);privateDirectory(dir,{restrictExisting:false});assert.equal(mode(dir),0o755)
 const file=path.join(dir,'outside');fs.writeFileSync(file,'keep');fs.chmodSync(file,0o644)
 const link=path.join(dir,'link');fs.symlinkSync(file,link)
 assert.throws(()=>privateFile(link));assert.equal(mode(file),0o644)
 const linkDir=path.join(dir,'directory-link');fs.symlinkSync(dir,linkDir)
 assert.throws(()=>privateDirectory(linkDir));assert.equal(mode(dir),0o755)
 fs.chmodSync(dir,0o777)
 assert.throws(()=>privateDirectory(dir,{restrictExisting:false}));assert.equal(mode(dir),0o777)
}))
test('real SQLite: DB, WAL, SHM and old/new backups use 0600, directories use 0700',()=>temporary(dir=>{
 const database=path.join(dir,'data','test.db')
 const code=`
  import fs from 'node:fs';import path from 'node:path';
  const {getDb}=await import('./src/db/database.js');
  const {createBackup}=await import('./src/db/backup.js');
  const db=getDb();db.exec("CREATE TABLE secret(value TEXT);INSERT INTO secret VALUES ('kept')");
  const dbPath=process.env.DB_PATH,folder=path.join(path.dirname(dbPath),'backups');
  fs.mkdirSync(folder,{mode:0o777});fs.chmodSync(folder,0o777);
  const old=path.join(folder,'workoutbuddy_2020-01-01.db');fs.writeFileSync(old,'old');fs.chmodSync(old,0o666);
  const legacy=path.join(folder,'pre-import-legacy.db');fs.writeFileSync(legacy,'old');fs.chmodSync(legacy,0o644);
  const backup=createBackup(db,dbPath,{force:true});
  const paths=[dbPath,dbPath+'-wal',dbPath+'-shm',old,backup,legacy];
  console.log(JSON.stringify({modes:paths.map(p=>fs.statSync(p).mode&0o777),dirs:[path.dirname(dbPath),folder].map(p=>fs.statSync(p).mode&0o777),data:db.prepare('SELECT value FROM secret').get().value}));
  db.close();
 `
 const result=spawnSync(process.execPath,['--input-type=module','-e',code],{cwd:root,env:{...process.env,DB_PATH:database},encoding:'utf8'})
 assert.equal(result.status,0,result.stderr)
 const actual=JSON.parse(result.stdout.trim())
 assert.deepEqual(actual.modes,[0o600,0o600,0o600,0o600,0o600,0o600]);assert.deepEqual(actual.dirs,[0o700,0o700]);assert.equal(actual.data,'kept')
 // A subsequent startup also corrects an existing database and backup before use.
 fs.chmodSync(database,0o666)
 const old=path.join(path.dirname(database),'backups','workoutbuddy_2020-01-01.db');fs.chmodSync(old,0o666)
 const again=spawnSync(process.execPath,['--input-type=module','-e',"const {getDb}=await import('./src/db/database.js');getDb().close()"],{cwd:root,env:{...process.env,DB_PATH:database},encoding:'utf8'})
 assert.equal(again.status,0,again.stderr);assert.equal(mode(database),0o600);assert.equal(mode(old),0o600)
}))
test('a backup pointing elsewhere is rejected without modifying its target',()=>temporary(dir=>{
 const folder=privateBackups(path.join(dir,'test.db'),{create:true})
 const outside=path.join(dir,'outside');fs.writeFileSync(outside,'keep');fs.chmodSync(outside,0o644)
 fs.symlinkSync(outside,path.join(folder,'workoutbuddy_bad.db'))
 assert.throws(()=>privateBackups(path.join(dir,'test.db')));assert.equal(mode(outside),0o644)
}))
