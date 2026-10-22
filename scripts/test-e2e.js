import {spawnSync} from 'node:child_process'
import {cli,version} from '../tests/e2e/runtime.js'
const args=process.argv.slice(2)
console.log(`Playwright ${version} — local servers and temporary databases per test`)
const command=['show-report','show-trace'].includes(args[0]) ? args : ['test','--config=tests/e2e/playwright.config.js',...args]
const result=spawnSync(process.execPath,[cli,...command],{stdio:'inherit'})
process.exitCode=result.status??1
