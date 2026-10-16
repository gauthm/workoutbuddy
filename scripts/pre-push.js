import{readFileSync}from'node:fs'
import{execFileSync,spawnSync}from'node:child_process'
import{selectNodeTests,NODE_TESTS}from'./test-selection.js'
import{selectSuites,SUITES,filterReleaseBump}from'./e2e-selection.js'
const updates=readFileSync(0,'utf8').trim().split('\n').filter(Boolean)
let needed=new Set(),nodeTests=new Set(),hasUpdate=false
for(const line of updates){
 const[,local,,remote]=line.split(/\s+/)
 if(!local||/^0+$/.test(local))continue
 hasUpdate=true
 try{
  const files=/^0+$/.test(remote)?null:execFileSync('git',['diff','--name-only',remote,local],{encoding:'utf8'}).trim().split('\n').filter(Boolean)
  for(const suite of files?selectSuites(filterReleaseBump(files,path=>execFileSync('git',['show',`${remote}:${path}`],{encoding:'utf8'}),path=>execFileSync('git',['show',`${local}:${path}`],{encoding:'utf8'}))):SUITES)needed.add(suite)
  for(const file of files?selectNodeTests(files):NODE_TESTS)nodeTests.add(file)
 }catch{needed=new Set(SUITES);nodeTests=new Set(NODE_TESTS)}
}
if(hasUpdate){
 let result
 if(nodeTests.size){
  result=spawnSync(process.execPath,['--import','./tests/helpers/register-in-process.js','--test',...nodeTests],{stdio:'inherit'})
  if(result.status!==0)process.exit(result.status??1)
 }
 if(needed.size){
  console.log('Avant push, parcours navigateur : '+[...needed].join(', '))
  result=spawnSync(process.execPath,['scripts/test-e2e.js',...SUITES.filter(s=>needed.has(s)).map(s=>s+'.spec.js')],{stdio:'inherit'})
  if(result.status!==0)process.exit(result.status??1)
 }
}
