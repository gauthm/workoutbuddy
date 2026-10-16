import { execFileSync, spawnSync } from 'node:child_process'
import { selectNodeTests } from './test-selection.js'
const args = process.argv.slice(2)
const baseIndex = args.indexOf('--base')
const base = baseIndex >= 0 ? args.splice(baseIndex, 2)[1] : null
if (baseIndex >= 0 && !base) throw new Error('--base requires a Git reference')
const explicit = args.filter(arg => arg.endsWith('.test.js'))
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim().split('\n').filter(Boolean)
const files = [...git('diff', '--name-only', ...(base ? [base] : ['HEAD'])), ...git('ls-files', '--others', '--exclude-standard')]
const tests = explicit.length ? explicit : selectNodeTests(files)
const options = args.filter(arg => !arg.endsWith('.test.js'))
if (!tests.length) console.log('Aucun test Node concerné par ces fichiers.')
else {
  console.log('Tests Node concernés : '+tests.join(', '))
  if (!options.includes('--list')) {
    const result = spawnSync(process.execPath, ['--import', './tests/helpers/register-in-process.js', '--test', ...options, ...tests], { stdio: 'inherit' })
    process.exitCode = result.status ?? 1
  }
}
