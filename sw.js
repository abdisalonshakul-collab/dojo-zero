const CACHE = 'dojo-zero-v4-8-0'; // bump this on every release
const CORE = ['./', './index.html', './manifest.webmanifest', './config.js', './economy.js', './css/style.css', './js/core.js', './js/game.js', './js/accounts-online.js', './js/online-duel.js', './js/register-sw.js', './icon-192.png', './icon-512.png', './portraits/fighter-1.svg', './portraits/fighter-2.svg', './portraits/fighter-3.svg', './portraits/fighter-4.svg', './portraits/fighter-5.svg', './portraits/fighter-6.svg', './portraits/fighter-7.svg', './portraits/fighter-8.svg', './portraits/fighter-9.svg', './portraits/fighter-10.svg', './portraits/fighter-11.svg', './portraits/fighter-12.svg', './portraits/fighter-13.svg', './portraits/fighter-14.svg', './portraits/fighter-15.svg', './portraits/fighter-16.svg', './portraits/fighter-17.svg', './portraits/fighter-18.svg', './portraits/fighter-19.svg', './portraits/fighter-20.svg', './portraits/fighter-21.svg', './portraits/fighter-22.svg', './portraits/fighter-23.svg', './portraits/fighter-24.svg', './portraits/fighter-25.svg', './portraits/fighter-26.svg', './portraits/fighter-27.svg', './portraits/fighter-28.svg', './portraits/fighter-29.svg', './portraits/fighter-30.svg', './portraits/fighter-31.svg', './portraits/fighter-32.svg', './portraits/fighter-33.svg', './portraits/fighter-34.svg', './portraits/fighter-35.svg'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  if (req.mode === 'navigate' || /\.(html|js|css)$/.test(new URL(req.url).pathname)) {
    event.respondWith(fetch(req).then(response => {
      if (response && response.ok) caches.open(CACHE).then(cache => cache.put(req, response.clone()));
      return response;
    }).catch(() => caches.match(req).then(c => c || caches.match('./index.html'))));
    return;
  }
  event.respondWith(caches.match(req).then(cached => {
    if (cached) return cached;
    return fetch(req).then(response => {
      if (response && response.ok) caches.open(CACHE).then(cache => cache.put(req, response.clone()));
      return response;
    }).catch(() => caches.match('./index.html'));
  }));
});
