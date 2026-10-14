import { mkdtemp,rm,writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join,resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { once } from 'node:events'
const root=fileURLToPath(new URL('../../',import.meta.url))
async function freePort() {
  const server=createServer()
  await new Promise((yes,no)=>{server.once('error',no);server.listen(0,'127.0.0.1',yes)})
  const port=server.address().port
  await new Promise((yes,no)=>server.close(err=>err?no(err):yes()))
  return port
}
export async function isolatedApp() {
  const directory=await mkdtemp(join(tmpdir(),'workoutbuddy-e2e-'))
  const dbPath=join(directory,'test.db'),port=await freePort()
  if (resolve(dbPath)===resolve(root,'data/workoutbuddy.db') || port===3000) {
    await rm(directory,{recursive:true,force:true});throw new Error('Unsafe E2E environment')
  }
  let child,logs=''
  async function stop() {
    if (!child || child.exitCode!==null) return
    const exited=once(child,'exit')
    child.kill('SIGTERM')
    const timer=setTimeout(()=>child.kill('SIGKILL'),3000)
    try { await exited } finally {clearTimeout(timer)}
  }
  async function start() {
    child=spawn(process.execPath,['server.js'],{cwd:root,env:{...process.env,
      DB_PATH:dbPath,HOST:'127.0.0.1',PORT:String(port)},stdio:['ignore','pipe','pipe']})
    try {
      await new Promise((yes,no)=>{
        const timer=setTimeout(()=>done(new Error('Test server startup timed out\n'+logs)),15000)
        const exit=code=>done(new Error(`Test server exited (${code})\n${logs}`))
        function done(error){clearTimeout(timer);child.off('exit',exit);child.off('error',done);error?no(error):yes()}
        child.once('exit',exit);child.once('error',done)
        child.stdout.on('data',chunk=>{logs+=chunk;if(String(chunk).includes('WorkoutBuddy démarré'))done()})
        child.stderr.on('data',chunk=>{logs+=chunk})
      })
      const health=await fetch(`http://127.0.0.1:${port}/api/v1/settings`)
      if (!health.ok) throw new Error('Test server health check failed')
    } catch(error) {await stop();throw error}
  }
  try {await start()} catch(error){await rm(directory,{recursive:true,force:true});throw error}
  return {url:`http://127.0.0.1:${port}`,dbPath,directory,
    async restart(){await stop();await start()},
    async dispose(logPath){try{await stop();if(logPath)await writeFile(logPath,logs)}finally{await rm(directory,{recursive:true,force:true})}},
  }
}
