import {defineConfig} from './runtime.js'
export default defineConfig({
  testDir:'.',testMatch:'*.spec.js',fullyParallel:true,workers:2,timeout:45000,
  expect:{timeout:6000},forbidOnly:true,retries:0,
  outputDir:'../../test-results/e2e',
  reporter:[['list'],['html',{outputFolder:'../../test-results/report',open:'never'}]],
  use:{channel:process.env.WB_E2E_BROWSER_CHANNEL || 'chrome',headless:!process.env.WB_E2E_HEADED,
    locale:'fr-FR',timezoneId:'Europe/Paris',serviceWorkers:'block',
    actionTimeout:7000,navigationTimeout:12000,trace:'retain-on-failure',screenshot:'only-on-failure'},
  projects:[{name:'desktop',use:{viewport:{width:1280,height:900}}},
    {name:'mobile',use:{viewport:{width:390,height:844},isMobile:true,hasTouch:true}}],
})
