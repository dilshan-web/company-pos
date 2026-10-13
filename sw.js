const CACHE_NAME = 'spice-pos-v5.0.0';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  'index.html',
  './manifest.json',
  'manifest.json',
  './icon-192.png',
  'icon-192.png',
  './icon-512.png',
  'icon-512.png',
  './icon.png',
  'icon.png',
  './icon.svg',
  'icon.svg',
  './apple-touch-icon.png',
  'apple-touch-icon.png',
  './favicon.png',
  'favicon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[ServiceWorker] Caching complete offline app shell v5.0.0');
      return Promise.all(
        ASSETS_TO_CACHE.map((url) =>
          cache.add(url).catch((err) => {
            console.warn('[ServiceWorker] Asset cache notice:', url, err?.message || err);
          })
        )
      );
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(
        keyList.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[ServiceWorker] Purging old cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Exclude external third-party streaming APIs / websockets / firestore live endpoints
  if (url.origin.includes('firestore.googleapis.com') || url.origin.includes('identitytoolkit')) {
    return;
  }

  // Navigation requests: HTML document navigation
  if (event.request.mode === 'navigate' || event.request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) {
          // Stale-while-revalidate for faster offline startup
          fetch(event.request).then((res) => {
            if (res && res.status === 200) {
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, res));
            }
          }).catch(() => {});
          return cached;
        }
        return fetch(event.request).then((res) => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return res;
        }).catch(async () => {
          return (await caches.match('./index.html')) ||
                 (await caches.match('index.html')) ||
                 (await caches.match('./'));
        });
      })
    );
    return;
  }

  // Static Assets: Cache-First with Network fallback & cache update
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((response) => {
        if (response && (response.status === 200 || response.type === 'opaque')) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone).catch(() => {});
          });
        }
        return response;
      }).catch(async () => {
        // If image failed while offline, fallback to icon
        if (event.request.destination === 'image') {
          return (await caches.match('./icon-192.png')) ||
                 (await caches.match('icon-192.png'));
        }
      });
    })
  );
});
