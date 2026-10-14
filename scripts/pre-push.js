import{readFileSync}from'node:fs'
import{execFileSync,spawnSync}from'node:child_process'
import{selectSuites,SUITES}from'./e2e-selection.js'
const updates=readFileSync(0,'utf8').trim().split('\n').filter(Boolean)
let needed=new Set(),hasUpdate=false
for(const line of updates){
 const[,local,,remote]=line.split(/\s+/)
 if(!local||/^0+$/.test(local))continue
 hasUpdate=true
 try{
  const files=/^0+$/.test(remote)?null:execFileSync('git',['diff','--name-only',remote,local],{encoding:'utf8'}).trim().split('\n').filter(Boolean)
  for(const suite of files?selectSuites(files):SUITES)needed.add(suite)
 }catch{needed=new Set(SUITES)}
}
if(hasUpdate){
 let result=spawnSync('npm',['test'],{stdio:'inherit'})
 if(result.status!==0)process.exit(result.status??1)
 if(needed.size){
  console.log('Avant push, parcours navigateur : '+[...needed].join(', '))
  result=spawnSync(process.execPath,['scripts/test-e2e.js',...SUITES.filter(s=>needed.has(s)).map(s=>s+'.spec.js')],{stdio:'inherit'})
  if(result.status!==0)process.exit(result.status??1)
 }
}
