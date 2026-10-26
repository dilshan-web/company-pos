const CACHE_NAME = 'spice-pos-v6.1.1';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  'index.html',
  './manifest.json',
  'manifest.json',
  './guide.html',
  'guide.html',
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

// Install: pre-cache app shell (errors are non-fatal — file may not exist in all deployments)
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[ServiceWorker] Caching offline app shell v6.1.0');
      return Promise.all(
        ASSETS_TO_CACHE.map((url) =>
          cache.add(url).catch((err) => {
            console.warn('[ServiceWorker] Asset cache skipped:', url, err?.message || err);
          })
        )
      );
    }).then(() => self.skipWaiting())
  );
});

// Activate: purge old caches and claim all clients immediately
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

  // Let Firestore, Firebase Auth & other external APIs pass through untouched
  if (
    url.origin.includes('firestore.googleapis.com') ||
    url.origin.includes('firebaseio.com') ||
    url.origin.includes('identitytoolkit') ||
    url.origin.includes('googleapis.com') ||
    url.origin.includes('gstatic.com') ||
    url.origin.includes('firebaseapp.com') ||
    url.origin.includes('firebase.google.com')
  ) {
    return;
  }

  // ----------------------------------------------------------------
  // NAVIGATION (HTML page loads): Network-First → Cache fallback
  // This ensures the app loads offline even with ?t=... query params
  // ----------------------------------------------------------------
  if (event.request.mode === 'navigate' ||
      (event.request.headers.get('accept') || '').includes('text/html')) {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          // Cache a fresh copy whenever we successfully fetch the page
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => {
              // Store under BOTH the exact request URL and the bare scope URL
              cache.put(event.request, clone).catch(() => {});
              cache.put(self.registration.scope, res.clone()).catch(() => {});
            });
          }
          return res;
        })
        .catch(async () => {
          // --- OFFLINE FALLBACK: try every known URL for index.html ---
          const cache = await caches.open(CACHE_NAME);

          // 1. Exact request URL (may have ?t=... cache-buster)
          const exactMatch = await cache.match(event.request, { ignoreSearch: true });
          if (exactMatch) return exactMatch;

          // 2. SW scope root (e.g. https://dilshan-web.github.io/company-pos/)
          const scopeMatch = await cache.match(self.registration.scope, { ignoreSearch: true });
          if (scopeMatch) return scopeMatch;

          // 3. Relative index.html / root
          const relativeMatches = [
            './index.html',
            'index.html',
            './',
          ];
          for (const key of relativeMatches) {
            const m = await cache.match(key, { ignoreSearch: true });
            if (m) return m;
          }

          // 4. Scan the whole cache for any index.html / root response
          const allKeys = await cache.keys();
          for (const req of allKeys) {
            const u = new URL(req.url);
            if (u.pathname.endsWith('/') || u.pathname.endsWith('/index.html')) {
              const m = await cache.match(req, { ignoreSearch: true });
              if (m) return m;
            }
          }

          // 5. Last resort: global caches.match across all caches
          const globalMatch = await caches.match('./index.html', { ignoreSearch: true }) ||
                              await caches.match('index.html', { ignoreSearch: true }) ||
                              await caches.match('./', { ignoreSearch: true });
          if (globalMatch) return globalMatch;

          // Nothing in cache — return a friendly offline page instead of the dinosaur
          return new Response(
            `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>MOB POS — Offline</title>
  <style>
    body{font-family:system-ui,sans-serif;background:#0f172a;color:#f1f5f9;
         display:flex;flex-direction:column;align-items:center;justify-content:center;
         min-height:100vh;margin:0;text-align:center;padding:1rem;}
    .icon{font-size:4rem;margin-bottom:1rem;}
    h1{font-size:1.5rem;font-weight:900;margin:0 0 .5rem;}
    p{color:#94a3b8;margin:0 0 1.5rem;font-size:.9rem;}
    button{background:#16a34a;color:#fff;border:none;border-radius:1rem;
           padding:.75rem 2rem;font-size:1rem;font-weight:700;cursor:pointer;}
    button:active{opacity:.8;}
  </style>
</head>
<body>
  <div class="icon">📵</div>
  <h1>You're Offline</h1>
  <p>MOB POS needs to load at least once online<br>so it can be cached for offline use.</p>
  <button onclick="location.reload()">🔄 Try Again</button>
</body>
</html>`,
            { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
          );
        })
    );
    return;
  }

  // ----------------------------------------------------------------
  // STATIC ASSETS: Cache-First → Network fallback + cache update
  // ----------------------------------------------------------------
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then((cachedResponse) => {
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
        // Offline image fallback → app icon
        if (event.request.destination === 'image') {
          return (await caches.match('./icon-192.png', { ignoreSearch: true })) ||
                 (await caches.match('icon-192.png', { ignoreSearch: true }));
        }
      });
    })
  );
});
