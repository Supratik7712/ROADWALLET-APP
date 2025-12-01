const CACHE_NAME = 'roadwallet-v1';
const OFFLINE_URL = '/?source=pwa';

const ASSETS_TO_CACHE = [
  '/', // index
  '/index.html',
  '/style.css',
  '/app.js',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
  // add any other static assets you want cached (fonts, images, etc.)
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS_TO_CACHE))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    // cleanup old caches
    caches.keys().then(keys => Promise.all(
      keys.map(k => (k !== CACHE_NAME) ? caches.delete(k) : null)
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // network-first for navigation requests, cache fallback
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).then(resp => {
        // update cache with fresh index
        const copy = resp.clone();
        caches.open(CACHE_NAME).then(c => c.put('/', copy));
        return resp;
      }).catch(() => caches.match('/'))
    );
    return;
  }

  // for other requests: cache-first then network
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request).then(res => {
      // keep a copy
      return caches.open(CACHE_NAME).then(cache => {
        try { cache.put(event.request, res.clone()); } catch(e) {}
        return res;
      });
    }).catch(() => {
      // fallback for images or other static requests
      return caches.match('/icons/icon-192.png');
    }))
  );
});
