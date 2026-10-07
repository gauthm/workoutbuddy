const CACHE_NAME = 'workoutbuddy-v1'

// Assets à mettre en cache immédiatement lors de l'installation
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
  '/js/utils/rm.js',
  '/js/utils/weight.js',
  '/js/utils/date.js',
  '/js/components/layout/AppShell.js',
  '/js/components/layout/BottomNav.js',
  '/js/components/layout/PageHeader.js',
  '/js/components/common/LoadingSpinner.js',
  '/js/components/common/ErrorBanner.js',
  '/js/components/common/EmptyState.js',
  '/js/components/common/ConfirmModal.js',
  '/js/components/common/Toast.js',
  '/js/components/exercises/ExerciseListView.js',
  '/js/components/exercises/ExerciseCard.js',
  '/js/components/exercises/ExerciseDetailView.js',
  '/js/components/exercises/ExerciseFilter.js',
  '/js/components/exercises/ExerciseForm.js',
  '/js/components/equipment/EquipmentView.js',
  '/js/components/equipment/EquipmentItemRow.js',
  '/js/components/equipment/EquipmentForm.js',
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
            caches.open(CACHE_NAME).then(cache => cache.put(request, response.clone()))
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
          caches.open(CACHE_NAME).then(cache => cache.put(request, response.clone()))
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
