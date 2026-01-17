
const CACHE_NAME = 'popar-kit-cache-v7';
const urlsToCache = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './words.json',
  './manifest.json',
  './camera_utils.js',
  './drawing_utils.js',
  './hands.js',
  './icon/hello-icon-144.png',
  './icon/hello-icon-192.png',
  './icon/hello-icon-512.png',
  './backgroundMusic.mp3',
  './buttonClickSound.mp3',
  './popBubbleSound.mp3',
  './correctAnswerSound.mp3',
  './wrongAnswerSound.mp3'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('activate', event => {
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheWhitelist.indexOf(cacheName) === -1) {
              return caches.delete(cacheName);
            }
          })
        );
      }).then(() => self.clients.claim())
    );
  });

self.addEventListener('fetch', event => {
  // Ignore non-GET requests and API calls to OpenSheet
  if (event.request.method !== 'GET' || event.request.url.includes('opensheet.elk.sh')) {
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(cache => {
      return cache.match(event.request).then(response => {
        // Return cached response if it exists
        if (response) {
          return response;
        }

        // Otherwise, fetch from the network and handle failures
        return fetch(event.request).then(networkResponse => {
          // If the fetch is successful, clone it, cache it, and return it.
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            cache.put(event.request, responseToCache);
          }
          return networkResponse;
        }).catch(() => {
          // If the network fetch fails (e.g., offline) and there is no cache match,
          // return a synthetic error response. This prevents the service worker from crashing.
          return new Response(
            JSON.stringify({ error: 'offline' }),
            { headers: { 'Content-Type': 'application/json' }, status: 503 }
          );
        });
      });
    })
  );
});
