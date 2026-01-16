
const CACHE_NAME = 'popar-kit-cache-v1';
const urlsToCache = [
    '/',
    'index.html',
    'style.css',
    'script.js',
    'camera_utils.js',
    'hands.js',
    'drawing_utils.js',
    'backgroundMusic.mp3',
    'buttonClickSound.mp3',
    'popBubbleSound.mp3',
    'correctAnswerSound.mp3',
    'wrongAnswerSound.mp3'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Opened cache');
                return cache.addAll(urlsToCache);
            })
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
