// Optional browser stage of test-auth-sessions.py. Uses only its disposable TLS
// hosts and installed Playwright; never accepts a production URL or credentials.
import {createRequire} from 'node:module'
const [base,auth]=process.argv.slice(2)
for(const value of [base,auth]) {
  if(!new URL(value).hostname.endsWith('.workoutbuddy-test.test'))throw new Error('Disposable test host required')
}
const require=createRequire(process.env.WB_PLAYWRIGHT_PATH)
const {chromium}=require('playwright')
const browser=await chromium.launch({headless:true,args:['--ignore-certificate-errors','--host-resolver-rules=MAP *.workoutbuddy-test.test 127.0.0.1']})
try {
  const context=await browser.newContext({ignoreHTTPSErrors:true,locale:'fr-FR',viewport:{width:390,height:844},isMobile:true,hasTouch:true})
  const page=await context.newPage()
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
} finally {await browser.close()}
