const CACHE_NAME = 'workoutbuddy-v71'

// Assets à mettre en cache immédiatement lors de l'installation.
// ⚠️ Toute modification de public/ exige de bump CACHE_NAME (vN → vN+1).
// Règle complète : AGENT.md §14.
const PRECACHE_URLS = [
  '/',
  '/offline.html',
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

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME)
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
  })())
})

self.addEventListener('fetch', event => {
  const request = event.request, url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(request).catch(() => new Response(JSON.stringify({ error: 'OFFLINE' }), {
      status: 503, headers: { 'Content-Type': 'application/json' },
    })))
    return
  }
  if (request.method !== 'GET') return
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request)
        const cache = await caches.open(CACHE_NAME)
        await cacheResponse(cache, request, response)
        return response
      } catch {
        const cache = await caches.open(CACHE_NAME)
        return await cache.match(request) || await cache.match('/') || await cache.match('/offline.html')
      }
    })())
    return
  }
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
