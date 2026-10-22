import{execFileSync}from'node:child_process'
import{existsSync}from'node:fs'
let current=''
try{current=execFileSync('git',['config','--get','core.hooksPath'],{encoding:'utf8'}).trim()}catch{}
if(current && current!=='.githooks')throw new Error('A hooksPath already exists: '+current)
const hooks=execFileSync('git',['rev-parse','--git-path','hooks/pre-push'],{encoding:'utf8'}).trim()
if(!current && existsSync(hooks))throw new Error('A pre-push hook already exists; manual integration required.')
execFileSync('git',['config','--local','core.hooksPath','.githooks'])
console.log('Local hook enabled: affected Node tests followed by Playwright journeys before each push.')
