// Optional browser stage of test-auth-sessions.py. Uses only its disposable TLS
// hosts and installed Playwright; never accepts a production URL or credentials.
import {createRequire} from 'node:module'
import {readFileSync} from 'node:fs'
const [base,auth,cookieFile]=process.argv.slice(2)
for(const value of [base,auth]) {
  if(!new URL(value).hostname.endsWith('.workoutbuddy-test.test'))throw new Error('Disposable test host required')
}
const require=createRequire(process.env.WB_PLAYWRIGHT_PATH)
const {chromium}=require('playwright')
const browser=await chromium.launch({headless:true,args:['--ignore-certificate-errors','--host-resolver-rules=MAP *.workoutbuddy-test.test 127.0.0.1']})
try {
  const context=await browser.newContext({ignoreHTTPSErrors:true,locale:'fr-FR',viewport:{width:390,height:844},isMobile:true,hasTouch:true})
  const page=await context.newPage()
  if(cookieFile) {
    if(!cookieFile.includes('/workoutbuddy-auth-test-'))throw new Error('Disposable cookie file required')
    const cookies=JSON.parse(readFileSync(cookieFile,'utf8'))
    if(cookies.some(c=>c.domain.replace(/^\./,'')!==new URL(base).hostname))throw new Error('Disposable cookie domain required')
    await context.addCookies(cookies)
    const labels=JSON.parse(readFileSync(new URL('../../public/locales/fr.json',import.meta.url),'utf8'))
    await page.goto(base+'/#/exercises/dumbbell_bench_press')
    await page.waitForFunction(()=>{
      const images=[...document.querySelectorAll('.exercise-motion__frame')]
      return images.length===2 && images.every(image=>image.complete && image.naturalWidth>0)
    })
    console.log('Both exercise photos render behind real HTTPS, CSP and two-factor authentication: OK')
    await page.goto(base+'/#/settings')
    await page.getByText(labels['settings.section_profile'],{exact:true}).click()
    const name=page.getByLabel(labels['settings.profile_display_name'],{exact:true})
    await name.fill('Unsaved logout test')
    const logout=page.getByRole('button',{name:labels['settings.logout'],exact:true})
    await logout.click()
    const dialog=page.getByRole('dialog')
    await dialog.getByText(labels['settings.logout_unsaved'],{exact:true}).waitFor()
    await dialog.getByRole('button',{name:labels['common.cancel'],exact:true}).click()
    if(await name.inputValue()!=='Unsaved logout test')throw new Error('Cancelled logout lost the draft')
    await logout.click()
    const revoked=page.waitForResponse(r=>r.url().startsWith(auth+'/api/logout') && r.status()===200)
    await dialog.getByRole('button',{name:labels['settings.logout'],exact:true}).click()
    await revoked
    await page.goto(base+'/#/settings')
    await page.waitForURL(auth+'/**')
    console.log('Settings logout confirms drafts and revokes the real remembered Authelia session: OK')
  } else {
  await context.route(base+'/legacy-test.html',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><h1>Disposable legacy page</h1>'}))
  await page.goto(base+'/legacy-test.html')
  await page.evaluate(()=>{
    caches.open('workoutbuddy-vlegacy-check').then(cache=>cache.put('/',new Response('<h1>Disposable old cache</h1>'))).then(()=>navigator.serviceWorker.register('/sw.js'))
  })
  // Awaiting client.navigate() inside the worker's activate.waitUntil() can
  // deadlock HTTPS navigation. This exercises the full activation and redirect.
  await page.waitForURL(auth+'/**',{timeout:20000})
  await page.getByRole('checkbox').waitFor()
  console.log('HTTPS worker activation recovers a cached page and reaches real Authelia with remember-me: OK')
  }
} catch(error) {
  // Playwright HTTP diagnostics can include cookies; never emit the original
  // error or request log. The caller separately verifies server-side revocation.
  console.error('Disposable browser authentication check failed ('+error.name+').')
  process.exitCode=1
} finally {await browser.close()}
