
const CACHE_NAME = 'popar-kit-cache-v4';
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
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
  );
});
