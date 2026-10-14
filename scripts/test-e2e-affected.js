import{execFileSync,spawnSync}from'node:child_process'
import{selectSuites}from'./e2e-selection.js'
const args=process.argv.slice(2),index=args.indexOf('--base')
const base=index>=0?args.splice(index,2)[1]:null
if(index>=0&&!base)throw new Error('--base requires a Git reference')
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim().split('\n').filter(Boolean)
const files=[...git('diff','--name-only',...(base?[base,'HEAD']:['HEAD'])),...git('ls-files','--others','--exclude-standard')]
const suites=selectSuites(files)
if(!suites.length)console.log('Aucun parcours navigateur concerné par ces fichiers.')
else{
 console.log('Parcours concernés : '+suites.join(', '))
 const result=spawnSync(process.execPath,['scripts/test-e2e.js',...suites.map(s=>s+'.spec.js'),...args],{stdio:'inherit'})
 process.exitCode=result.status??1
}
