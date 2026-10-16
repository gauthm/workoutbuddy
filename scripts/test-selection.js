import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { dirname, resolve, relative } from 'node:path'
import { selectSuites, SUITES } from './e2e-selection.js'

export const NODE_TESTS = ['unit', 'integration', 'journeys'].flatMap(dir =>
  readdirSync(`tests/${dir}`).filter(name => name.endsWith('.test.js')).map(name => `tests/${dir}/${name}`))

// Integration cases cross routes: keep these dependencies explicit and review them
// when adding a test. Unclassified cases are always included for backend changes.
const integrationDomains = {
  ai: ['coach', 'settings'], api: ['security'], apiExports: ['coach'],
  auditCorrections: ['programs', 'sessions', 'history', 'data', 'stats'],
  calendar: ['dashboard', 'history', 'programs'],
  catalogueAndEngineReview: ['exercises', 'equipment', 'programs', 'sessions'],
  coachChatPersistence: ['coach'], coachHistoryApi: ['coach'], coachView: ['coach', 'settings'],
  codeAudit: ['programs', 'sessions', 'data', 'settings'],
  equipmentDraftSave: ['equipment', 'settings'], equipmentEnhancements: ['equipment', 'exercises'],
  equipmentProgramSelection: ['equipment', 'programs'], exerciseExclusion: ['exercises', 'programs'],
  exercises: ['exercises', 'equipment'], exportImport: ['data'], historyDeleteReset: ['history', 'sessions'],
  httpSecurity: ['security'], programAndHistoryReliability: ['programs', 'history'],
  programCreationWeight: ['programs', 'equipment'], programPlanner: ['programs'],
  programWeeklyProgress: ['programs', 'sessions', 'history'], programs: ['programs'],
  reliabilityStress: ['programs', 'sessions', 'history', 'data'], session: ['sessions'],
  sessionActualDate: ['sessions', 'history'], sessionAdjustment: ['sessions'], sessionReset: ['sessions', 'history'],
  settings_complete: ['settings'], stats: ['stats'], statsScreens: ['stats'], target: ['sessions'],
  userProfile: ['settings', 'programs'], userProfileSettings: ['settings'],
}

// Follow literal local imports (including dynamic imports) and new URL references.
// This also finds source files read as text by a test. Runtime-computed dependencies
// such as migrations and seed data receive the conservative fallback below.
function dependencies(file, cache, visited = new Set()) {
  if (visited.has(file)) return visited
  visited.add(file)
  if (!cache.has(file)) {
    const direct = []
    if (existsSync(file) && file.endsWith('.js')) {
      const source = readFileSync(file, 'utf8')
      for (const match of source.matchAll(/['"]((?:\.\.?\/)[^'"\n]+)['"]/g)) {
        const dependency = relative(process.cwd(), resolve(dirname(file), match[1])).replaceAll('\\', '/')
        if (existsSync(dependency)) direct.push(dependency)
      }
    }
    cache.set(file, direct)
  }
  for (const dependency of cache.get(file)) dependencies(dependency, cache, visited)
  return visited
}

export function selectNodeTests(paths) {
  const selected = new Set(), cache = new Map()
  const changed = paths.filter(path => !/\.md$|^docs\/|^\.gitignore$/.test(path))
  for (const path of changed) {
    if (NODE_TESTS.includes(path)) { selected.add(path); continue }
    if (/^tests\/(?:e2e|ui)\//.test(path) || path === 'public/sw.js') continue
    if (/^scripts\/(?:test-selection|e2e-selection|test-affected|test-e2e-affected|pre-push)\.js$/.test(path)) {
      selected.add('tests/unit/e2eSelection.test.js')
      continue
    }
    if (/^(?:src\/db\/|src\/seed\/|server\.js$|package(?:-lock)?\.json$|tests\/helpers\/)/.test(path)) return [...NODE_TESTS]
    if (path.startsWith('src/')) {
      const suites = selectSuites([path])
      if (suites.length === SUITES.length) return [...NODE_TESTS]
      for (const file of NODE_TESTS.filter(file => file.startsWith('tests/integration/'))) {
        const name = file.split('/').pop().replace('.test.js', '')
        const domains = integrationDomains[name]
        if (!domains || domains.some(domain => suites.includes(domain))) selected.add(file)
      }
      // The API journey file exercises the whole business lifecycle.
      if (suites.some(domain => ['programs', 'sessions', 'history', 'data'].includes(domain))) selected.add('tests/journeys/app.test.js')
    } else if (!/^(?:public\/|tests\/unit\/|tests\/integration\/|tests\/journeys\/)/.test(path)) return [...NODE_TESTS]
    for (const test of NODE_TESTS) {
      if (path.startsWith('src/') && !test.startsWith('tests/unit/')) continue
      if (dependencies(test, cache).has(path)) selected.add(test)
    }
    if (/^public\/locales\//.test(path)) selected.add('tests/unit/exerciseEquipmentCatalog.test.js')
  }
  return NODE_TESTS.filter(file => selected.has(file))
}
