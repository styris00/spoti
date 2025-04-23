const CACHE_NAME = 'v1';
const urlsToCache = ['/spoti/', '/spoti/index.html', '/spoti/style.css', '/spoti/script.js'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => response || fetch(event.request))
  );
});
