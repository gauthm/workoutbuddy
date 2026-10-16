const CACHE_NAME = 'workoutbuddy-v77'

// Assets à mettre en cache immédiatement lors de l'installation.
// ⚠️ Toute modification de public/ exige de bump CACHE_NAME (vN → vN+1).
// Règle complète : AGENT.md §14.
const PRECACHE_URLS = [
  '/css/main.css',
  '/css/components.css',
  '/js/app.js',
  '/js/appUpdates.js',
  '/js/router.js',
  '/js/store.js',
  '/js/i18n.js',
  '/js/api.js',
  '/js/timer-worker.js',
  '/js/timer-worker-singleton.js',
  '/js/utils/rm.js',
  '/js/utils/muscles.js',
  '/js/utils/programMuscles.js',
  '/js/utils/pain.js',
  '/js/utils/weight.js',
  '/js/utils/warmup.js',
  '/js/utils/date.js',
  '/js/utils/dialog.js',
  '/js/components/layout/AppShell.js',
  '/js/components/layout/BottomNav.js',
  '/js/components/layout/PageHeader.js',
  '/js/components/common/LoadingSpinner.js',
  '/js/components/common/ErrorBanner.js',
  '/js/components/common/EmptyState.js',
  '/js/components/common/ConfirmModal.js',
  '/js/components/common/ModalDialog.js',
  '/js/components/common/Toast.js',
  '/js/components/common/AppUpdateBanner.js',
  '/js/components/exercises/ExerciseListView.js',
  '/js/components/exercises/ExerciseCard.js',
  '/js/components/exercises/ExerciseDetailView.js',
  '/js/components/exercises/ExerciseMotion.js',
  '/js/components/exercises/ExerciseFilter.js',
  '/js/components/equipment/EquipmentView.js',
  '/js/components/equipment/EquipmentEditor.js',
  '/js/components/equipment/inventoryCatalog.js',
  '/js/components/equipment/DumbbellInventory.js',
  '/js/components/equipment/DumbbellRows.js',
  '/js/components/equipment/EquipmentItemRow.js',
  '/js/components/equipment/EquipmentForm.js',
  '/js/components/calendar/CalendarView.js',
  '/js/components/coach/AdviceCard.js',
  '/js/components/coach/ChatMessage.js',
  '/js/components/coach/CoachView.js',
  '/js/components/coach/UserProfileCard.js',
  '/js/components/programs/ExerciseSelector.js',
  '/js/components/programs/ProgramCard.js',
  '/js/components/programs/ProgramDetailView.js',
  '/js/components/programs/ProgramGenerator.js',
  '/js/components/programs/ProgramListView.js',
  '/js/components/session/AITooltip.js',
  '/js/components/session/ExerciseBlock.js',
  '/js/components/session/ExerciseHelp.js',
  '/js/components/session/RestTimer.js',
  '/js/components/session/SessionActiveView.js',
  '/js/components/session/SessionAdjustmentBanner.js',
  '/js/components/session/SessionDetailView.js',
  '/js/components/session/SessionHistoryView.js',
  '/js/components/session/SessionTimer.js',
  '/js/components/session/SetRow.js',
  '/js/components/settings/AIProviderForm.js',
  '/js/components/settings/EquipmentSettings.js',
  '/js/components/settings/equipmentCatalog.js',
  '/js/components/settings/ExportImport.js',
  '/js/components/settings/ProfileSettings.js',
  '/js/components/settings/SettingsSection.js',
  '/js/components/settings/SettingsView.js',
  '/js/components/stats/BodyWeightView.js',
  '/js/components/stats/ExerciseProgressView.js',
  '/js/components/stats/PRList.js',
  '/js/components/stats/StatsDashboardView.js',
  '/js/components/stats/StreakCard.js',
  '/js/components/stats/VolumeChart.js',
  '/js/views/DashboardView.js',
  '/vendor/vue.esm-browser.prod.js',
  '/vendor/chart.umd.min.js',
  '/locales/fr.json',
  '/locales/en.json',
  '/manifest.json',
  '/favicon.ico?v=1',
  '/icons/workoutbuddy.svg?v=1',
  '/apple-touch-icon.png?v=1',
  '/icons/icon-192.png?v=1',
  '/icons/icon-512.png?v=1',
]

// A release only activates after every shell asset is cached successfully.
// Authentication redirects must never replace JavaScript or HTML in the cache.
async function cacheResponse(cache, request, response) {
  if (!response.ok || response.redirected || response.type === 'opaqueredirect' ||
      new URL(response.url).origin !== self.location.origin) return false
  const path = new URL(request.url).pathname
  const type = response.headers.get('content-type') || ''
  if ((path.endsWith('.js') && !/javascript/.test(type)) ||
      (path.endsWith('.css') && !type.includes('text/css')) ||
      (path.endsWith('.json') && !type.includes('json'))) return false
  await cache.put(request, response.clone())
  return true
}

let loginRequired = false
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME)
    // The worker is public so even a logged-out client can recover from an old
    // cached shell. It contains no user data. Never cache protected HTML.
    const gate = await fetch('/', { redirect: 'manual', credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'text/html' } })
    if (gate.type === 'opaqueredirect' || gate.status === 401) {
      loginRequired = true
      await self.skipWaiting()
      return
    }
    if (!gate.ok) throw new Error('Application unavailable; keeping the previous release')
    const results = await Promise.allSettled(PRECACHE_URLS.map(async path => {
      const request = new Request(new URL(path, self.location.origin), { cache: 'reload', credentials: 'same-origin', redirect: 'manual' })
      if (!await cacheResponse(cache, request, await fetch(request))) throw new Error('Asset unavailable: ' + path)
    }))
    if (results.some(result => result.status === 'rejected')) {
      await caches.delete(CACHE_NAME)
      throw new Error('Incomplete app update; keeping the previous release')
    }
    await self.skipWaiting()
  })())
})

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys()
    await Promise.all(keys.filter(key => key.startsWith('workoutbuddy-v') && key !== CACHE_NAME).map(key => caches.delete(key)))
    await self.clients.claim()
    // A worker may be stopped and recreated between installation and activation.
    if (!loginRequired) {
      try {
        const gate = await fetch('/', { redirect: 'manual', credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'text/html' } })
        loginRequired = gate.type === 'opaqueredirect' || gate.status === 401
      } catch { /* No network: leave an existing page intact. */ }
    }
    if (loginRequired) {
      for (const client of await self.clients.matchAll({ type: 'window' })) {
        // Never await this navigation inside activate: HTTPS navigation can wait
        // for activation itself, deadlocking both the worker and the page.
        if (client.visibilityState === 'visible') client.navigate('/auth/login').catch(() => {})
      }
    }
  })())
})

self.addEventListener('fetch', event => {
  const request = event.request, url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  // Let the browser perform cross-origin login redirects as real navigations.
  // A fetch() followed to the identity provider can fail CORS and masquerade as
  // a network outage. Cached HTML must never shadow an expired login.
  if (request.mode === 'navigate') return
  if (url.pathname.startsWith('/api/')) {
    event.respondWith((async () => {
      try {
        const headers = new Headers(request.headers)
        headers.set('Accept', 'application/json')
        const response = await fetch(new Request(request, { headers, redirect: 'manual', cache: 'no-store' }))
        if (response.status === 401 || response.type === 'opaqueredirect') {
          // Also repairs already-open pages running the old client code.
          event.waitUntil(self.clients.get(event.clientId).then(client => client?.navigate('/auth/login')).catch(() => {}))
          return new Response(JSON.stringify({ error: 'AUTH_REQUIRED' }), { status: 401, headers: { 'Content-Type': 'application/json' } })
        }
        return response
      } catch {
        return new Response(JSON.stringify({ error: 'OFFLINE' }), { status: 503, headers: { 'Content-Type': 'application/json' } })
      }
    })())
    return
  }
  if (request.method !== 'GET') return
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME), cached = await cache.match(request)
    if (cached) return cached
    try {
      const response = await fetch(request)
      event.waitUntil(cacheResponse(cache, request, response).catch(() => {}))
      return response
    } catch { return new Response('', { status: 503 }) }
  })())
})
