// Images only: never import exercises again or open the application database.
import {readFile,writeFile,mkdir,rename,unlink} from 'node:fs/promises'
const revision='f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5'
const upstream=`https://raw.githubusercontent.com/yuhonas/free-exercise-db/${revision}/`
const directory=new URL('../public/exercises/images/',import.meta.url)
const exercises=JSON.parse(await readFile(new URL('../src/seed/exercises.json',import.meta.url),'utf8'))
const paths=[...new Set(exercises.flatMap(exercise=>exercise.image_paths))]
const jpeg=data=>data.length>4 && data[0]===255 && data[1]===216 && data[2]===255 && data.at(-2)===255 && data.at(-1)===217
if(paths.some(path=>!/^([a-z0-9_]+)\/[0-9]+\.jpg$/.test(path)))throw new Error('Unexpected catalogue image path')
const check=process.argv.includes('--check')
if(process.argv.slice(2).some(arg=>arg!=='--check'))throw new Error('Usage: node scripts/download-exercise-images.js [--check]')
async function request(path){
 const response=await fetch(upstream+path,{signal:AbortSignal.timeout(30000)})
 if(!response.ok)throw new Error(`HTTP ${response.status}: ${path}`)
 return response
}
async function main(){
 let mapping
 if(!check){
  const raw=await(await request('dist/exercises.json')).json()
  const snake=value=>value.replace(/([A-Z])/g,'_$1').replace(/^_/,'').toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/_+/g,'_').replace(/^_|_$/g,'')
  mapping=new Map(raw.flatMap(exercise=>exercise.images.map(path=>{
   const [folder,file]=path.split('/')
   if(!/^[A-Za-z0-9_-]+$/.test(folder) || !/^[0-9]+\.jpg$/.test(file))throw new Error('Unexpected upstream image path')
   return [`${snake(folder)}/${file}`,path]
  })))
  const missing=paths.filter(path=>!mapping.has(path))
  if(missing.length)throw new Error(`Upstream is missing ${missing.length} catalogue images; no files changed`)
 }
 let cursor=0,downloaded=0,existing=0,processed=0
 const failures=[]
 async function worker(){
  while(cursor<paths.length){
   const path=paths[cursor++],file=new URL(path,directory)
   try {
    if(jpeg(await readFile(file))){existing++;processed++;continue}
   }catch(error){if(error.code!=='ENOENT')throw error}
   if(check){failures.push(path);continue}
   const temporary=new URL(file.href+`.download-${process.pid}`)
   let complete=false
   for(let attempt=0;attempt<3;attempt++){
    try {
     const response=await request('exercises/'+mapping.get(path))
     const data=Buffer.from(await response.arrayBuffer())
     if(data.length>8*1024*1024 || !jpeg(data))throw new Error('Invalid JPEG: '+path)
     await mkdir(new URL('./',file),{recursive:true,mode:0o755})
     await writeFile(temporary,data,{mode:0o644})
     await rename(temporary,file)
     downloaded++;complete=true;break
    }catch(error){
     await unlink(temporary).catch(()=>{})
     if(attempt===2)failures.push(path+': '+error.message)
     else await new Promise(resolve=>setTimeout(resolve,500*(attempt+1)))
    }
   }
   if(complete)processed++
   if(processed && processed%100===0)console.log(`${processed}/${paths.length} images disponibles`)
  }
 }
 await Promise.all(Array.from({length:4},worker))
 if(failures.length)throw new Error(`${failures.length} images manquantes ou invalides:\n${failures.join('\n')}`)
 console.log(`${paths.length} images vérifiées ; ${downloaded} téléchargées, ${existing} déjà présentes. Aucun catalogue ni base modifié.`)
}
main().catch(error=>{console.error(error.message);process.exitCode=1})
