const CACHE = 'duual-v3';
const ASSETS = ['/manifest.json', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Never cache API calls — always fresh
  if (url.pathname.startsWith('/api/')) {
    return; // Let the browser handle it normally
  }

  // Never cache assetlinks.json — must be served fresh
  if (url.pathname.startsWith('/.well-known/')) {
    return;
  }

  // Network-first for HTML (so updates are picked up)
  if (e.request.mode === 'navigate' || e.request.destination === 'document' || url.pathname === '/' || url.pathname.endsWith('.html')) {
    e.respondWith(
      fetch(e.request)
        .then(response => {
          // Cache the fresh copy in the background
          const responseClone = response.clone();
          caches.open(CACHE).then(cache => cache.put(e.request, responseClone));
          return response;
        })
        .catch(() => caches.match(e.request).then(cached => cached || caches.match('/index.html')))
    );
    return;
  }

  // Cache-first for static assets (images, fonts, etc.)
  e.respondWith(
    caches.match(e.request).then(cached =>
      cached || fetch(e.request).then(response => {
        // Only cache successful GET responses from same origin
        if (response.ok && e.request.method === 'GET' && url.origin === location.origin) {
          const responseClone = response.clone();
          caches.open(CACHE).then(cache => cache.put(e.request, responseClone));
        }
        return response;
      }).catch(() => cached)
    )
  );
});

// Allow the page to trigger immediate activation of a new SW
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
