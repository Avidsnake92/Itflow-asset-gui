// Borgo Antico — service worker: cache per giocare offline
const CACHE = 'borgo-antico-v5';
const FILES = [
  './',
  'index.html',
  'css/style.css',
  'js/config.js',
  'js/world.js',
  'js/sprites.js',
  'js/game.js',
  'js/render.js',
  'js/input.js',
  'js/ui.js',
  'js/main.js',
  'manifest.webmanifest',
  'icon-180.png',
  'icon-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
      if (e.request.method === 'GET' && res.ok && new URL(e.request.url).origin === location.origin) {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
      }
      return res;
    }))
  );
});
