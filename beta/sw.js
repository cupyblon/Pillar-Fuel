// Caches the app shell so it opens instantly and works offline.
// Data calls to script.google.com always go to the network.
const CACHE = 'fuel-beta-1';   // BETA copy
const SHELL = ['./', 'index.html', 'manifest.webmanifest', '../icon-180.png', '../icon-512.png'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('fuel-beta-') && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin || e.request.method !== 'GET') return;
  // Network first, and skip the browser's 10-minute HTTP cache ("no-cache" = always ask GitHub
  // if the file changed), so a new version shows up on the next open. Cache = offline fallback.
  e.respondWith(fetch(url.href, { cache: 'no-cache', credentials: 'same-origin' }).then(r => {
    if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
    return r;
  }).catch(() => caches.match(e.request).then(r => r || caches.match('index.html'))));
});
