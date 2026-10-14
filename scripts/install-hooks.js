import{execFileSync}from'node:child_process'
import{existsSync}from'node:fs'
let current=''
try{current=execFileSync('git',['config','--get','core.hooksPath'],{encoding:'utf8'}).trim()}catch{}
if(current && current!=='.githooks')throw new Error('Un hooksPath existe déjà : '+current)
const hooks=execFileSync('git',['rev-parse','--git-path','hooks/pre-push'],{encoding:'utf8'}).trim()
if(!current && existsSync(hooks))throw new Error('Un hook pre-push existe déjà ; intégration manuelle nécessaire.')
execFileSync('git',['config','--local','core.hooksPath','.githooks'])
console.log('Hook local activé : npm test puis parcours Playwright concernés avant chaque push.')
