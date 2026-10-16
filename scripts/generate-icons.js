// Reuse the browser already available for E2E; no image dependency or server.
import {readFile,writeFile} from 'node:fs/promises'
import {createRequire} from 'node:module'
import {cli} from '../tests/e2e/runtime.js'
const {chromium}=createRequire(cli)('playwright')
const directory=new URL('../public/',import.meta.url)
const svg=await readFile(new URL('icons/workoutbuddy.svg',directory),'utf8')
const browser=await chromium.launch({headless:true})
try {
  const page=await browser.newPage()
  async function png(size,opaque) {
    const data=await page.evaluate(async({svg,size,opaque})=>{
      const image=new Image()
      image.src='data:image/svg+xml;base64,'+btoa(svg)
      await image.decode()
      const canvas=document.createElement('canvas')
      canvas.width=canvas.height=size
      const context=canvas.getContext('2d')
      if(opaque){context.fillStyle='#1a1a1a';context.fillRect(0,0,size,size)}
      context.drawImage(image,0,0,size,size)
      return canvas.toDataURL('image/png').split(',')[1]
    },{svg,size,opaque})
    return Buffer.from(data,'base64')
  }
  for(const size of [180,192,512]) {
    const path=size===180?'apple-touch-icon.png':`icons/icon-${size}.png`
    await writeFile(new URL(path,directory),await png(size,true))
  }
  // ICO contains both native tab sizes; SVG remains sharp at larger sizes.
  const sizes=[16,32],images=await Promise.all(sizes.map(size=>png(size,false)))
  const header=Buffer.alloc(6+16*sizes.length)
  header.writeUInt16LE(1,2);header.writeUInt16LE(sizes.length,4)
  let offset=header.length
  images.forEach((data,index)=>{
    const at=6+16*index
    header[at]=header[at+1]=sizes[index]
    header.writeUInt16LE(1,at+4);header.writeUInt16LE(32,at+6)
    header.writeUInt32LE(data.length,at+8);header.writeUInt32LE(offset,at+12)
    offset+=data.length
  })
  await writeFile(new URL('favicon.ico',directory),Buffer.concat([header,...images]))
} finally {await browser.close()}
