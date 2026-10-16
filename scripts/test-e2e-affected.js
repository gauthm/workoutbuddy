import{execFileSync,spawnSync}from'node:child_process'
import{readFileSync}from'node:fs'
import{selectSuites,SUITES,filterReleaseBump}from'./e2e-selection.js'
const args=process.argv.slice(2),index=args.indexOf('--base')
const base=index>=0?args.splice(index,2)[1]:null
if(index>=0&&!base)throw new Error('--base requires a Git reference')
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim().split('\n').filter(Boolean)
const files=[...git('diff','--name-only',...(base?[base]:['HEAD'])),...git('ls-files','--others','--exclude-standard')]
const domainIndex=args.indexOf('--domains')
const domains=domainIndex>=0?args.splice(domainIndex,2)[1]:null
if(domainIndex>=0&&(!domains||domains.split(',').some(s=>!SUITES.includes(s))))throw new Error('--domains requires known comma-separated domains')
const relevant=filterReleaseBump(files,path=>execFileSync('git',['show',`${base||'HEAD'}:${path}`],{encoding:'utf8'}),path=>readFileSync(path,'utf8'))
const suites=domains?domains.split(','):selectSuites(relevant)
if(!suites.length)console.log('Aucun parcours navigateur concerné par ces fichiers.')
else{
 console.log('Parcours concernés : '+suites.join(', '))
 const result=spawnSync(process.execPath,['scripts/test-e2e.js',...suites.map(s=>s+'.spec.js'),...args],{stdio:'inherit'})
 process.exitCode=result.status??1
}
