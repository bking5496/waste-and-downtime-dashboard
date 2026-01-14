/**
 * Service Worker for Production Control Dashboard
 * Provides offline support and caching
 */

const CACHE_NAME = 'production-control-v1';
const STATIC_CACHE = 'static-v1';
const DYNAMIC_CACHE = 'dynamic-v1';

// Static assets to cache on install
// Use relative paths for GitHub Pages compatibility (served from subdirectory)
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './favicon.ico',
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[ServiceWorker] Installing...');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(async (cache) => {
        console.log('[ServiceWorker] Caching static assets');
        // Cache each asset individually with error handling
        // This prevents one failed request from breaking the entire install
        const cachePromises = STATIC_ASSETS.map(async (asset) => {
          try {
            await cache.add(asset);
          } catch (err) {
            console.warn(`[ServiceWorker] Failed to cache: ${asset}`, err.message);
          }
        });
        return Promise.all(cachePromises);
      })
      .then(() => {
        console.log('[ServiceWorker] Installed');
        return self.skipWaiting();
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[ServiceWorker] Activating...');
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== STATIC_CACHE && name !== DYNAMIC_CACHE)
            .map((name) => {
              console.log('[ServiceWorker] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => {
        console.log('[ServiceWorker] Activated');
        return self.clients.claim();
      })
  );
});

// Fetch event - serve from cache or network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip cross-origin requests (except for Supabase API which we don't cache)
  if (url.origin !== location.origin) {
    return;
  }

  // For navigation requests (HTML), try network first
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache successful responses
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(DYNAMIC_CACHE)
              .then((cache) => cache.put(request, responseClone));
          }
          return response;
        })
        .catch(() => {
          // Fall back to cache
          return caches.match(request)
            .then((cached) => cached || caches.match('/index.html'));
        })
    );
    return;
  }

  // For static assets, use cache-first strategy
  if (
    request.destination === 'style' ||
    request.destination === 'script' ||
    request.destination === 'image' ||
    request.destination === 'font'
  ) {
    event.respondWith(
      caches.match(request)
        .then((cached) => {
          if (cached) {
            // Return cached and update in background
            fetch(request)
              .then((response) => {
                if (response.status === 200) {
                  caches.open(STATIC_CACHE)
                    .then((cache) => cache.put(request, response));
                }
              })
              .catch(() => { });
            return cached;
          }
          // Not in cache, fetch from network
          return fetch(request)
            .then((response) => {
              if (response.status === 200) {
                const responseClone = response.clone();
                caches.open(STATIC_CACHE)
                  .then((cache) => cache.put(request, responseClone));
              }
              return response;
            });
        })
    );
    return;
  }

  // Default: network-first strategy for other requests
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.status === 200) {
          const responseClone = response.clone();
          caches.open(DYNAMIC_CACHE)
            .then((cache) => cache.put(request, responseClone));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});

// Handle messages from the main app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Background sync for failed submissions
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-submissions') {
    event.waitUntil(syncFailedSubmissions());
  }
});

async function syncFailedSubmissions() {
  // This would sync any pending submissions stored in IndexedDB
  console.log('[ServiceWorker] Syncing failed submissions...');
  // Implementation would go here
}
