// Reuse the installed Playwright toolchain; no project dependency is added.
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { join,dirname } from 'node:path'
import { existsSync } from 'node:fs'
const local=createRequire(import.meta.url)
function resolveRuntime() {
  const candidates=[process.env.WB_PLAYWRIGHT_PATH]
  try { candidates.push(local.resolve('playwright/package.json')) } catch {}
  try {
    const root=execFileSync('npm',['root','-g'],{encoding:'utf8'}).trim()
    candidates.push(join(root,'playwright/package.json'),join(root,'@playwright/mcp/package.json'))
  } catch {}
  for (const file of candidates.filter(Boolean)) {
    if (!existsSync(file)) continue
    try {
      const require=createRequire(file)
      const test=require('playwright/test')
      return {...test,cli:join(dirname(require.resolve('playwright/package.json')),'cli.js'),version:require('playwright/package.json').version}
    } catch {}
  }
  throw new Error('Playwright introuvable. Voir tests/e2e/README.md ; WB_PLAYWRIGHT_PATH peut désigner son package.json ou celui de @playwright/mcp.')
}
const runtime=resolveRuntime()
export const {test,expect,defineConfig,devices,cli,version}=runtime
