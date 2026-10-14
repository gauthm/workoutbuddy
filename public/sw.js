const CACHE_NAME = 'workoutbuddy-v59'

// Assets à mettre en cache immédiatement lors de l'installation.
// ⚠️ Toute modification de public/ exige de bump CACHE_NAME (vN → vN+1).
// Règle complète : AGENT.md §14.
const PRECACHE_URLS = [
  '/',
  '/offline.html',
  '/css/main.css',
  '/css/components.css',
  '/js/app.js',
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
  '/js/components/exercises/ExerciseListView.js',
  '/js/components/exercises/ExerciseCard.js',
  '/js/components/exercises/ExerciseDetailView.js',
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

// ── Installation : pré-cache des assets statiques ─────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // addAll échoue si une seule URL est introuvable.
      // Utiliser des ajouts individuels pour être tolérant aux erreurs.
      return Promise.allSettled(
        PRECACHE_URLS.map(url =>
          cache.add(url).catch(err =>
            console.warn(`[SW] Pré-cache échoué pour ${url}:`, err.message)
          )
        )
      )
    })
  )
  self.skipWaiting()
})

// ── Activation : supprimer les anciens caches ─────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    )
  )
  self.clients.claim()
})

// ── Fetch : stratégie selon le type de requête ────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // ── API calls → Network First (jamais de cache)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).catch(() =>
        new Response(
          JSON.stringify({ error: 'OFFLINE', message: 'Hors ligne' }),
          { status: 503, headers: { 'Content-Type': 'application/json' } }
        )
      )
    )
    return
  }

  // ── Images d'exercices → Cache First avec fallback réseau
  if (url.pathname.startsWith('/exercises/images/')) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached
        return fetch(request).then(response => {
          if (response.ok) {
            const copy = response.clone()
            caches.open(CACHE_NAME).then(cache => cache.put(request, copy))
          }
          return response
        }).catch(() => new Response('', { status: 404 }))
      })
    )
    return
  }

  // ── Assets statiques → Cache First
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached
      return fetch(request).then(response => {
        if (response.ok && request.method === 'GET') {
          const copy = response.clone()
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy))
        }
        return response
      }).catch(() => {
        // Fallback : retourner offline.html pour les navigations HTML
        if (request.headers.get('accept')?.includes('text/html')) {
          return caches.match('/offline.html')
        }
        return new Response('', { status: 503 })
      })
    })
  )
})
