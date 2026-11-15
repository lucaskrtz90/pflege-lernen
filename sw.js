// Offline support: always try the network first so corrections and new diseases arrive,
// and fall back to the saved copy when there is no connection.
// The service worker never touches localStorage, so learning progress is safe across updates.
const CACHE = 'pflege-v1';
const FILES = [
  './', './index.html', './manifest.webmanifest', './css/styles.css',
  './js/main.js', './js/srs.js', './js/session.js', './js/rewards.js', './js/store.js',
  './js/content.js', './js/speech.js', './js/icons.js', './js/ui.js',
  './js/views/home.js', './js/views/disease.js', './js/views/quiz.js',
  './js/views/result.js', './js/views/awards.js', './js/views/settings.js',
  './icons/icon-192.png', './icons/icon-512.png', './data/index.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((c) => Promise.all(FILES.map((f) => c.add(new Request(f, { cache: 'reload' }))))
        // Also save every disease that is already published, so the app works offline from the start.
        .then(() => fetch('./data/index.json', { cache: 'reload' }).then((r) => r.json()))
        .then((idx) => Promise.all(idx.filter((e) => e.available)
          .map((e) => c.add(new Request(`./data/${e.id}.json`, { cache: 'reload' })).catch(() => {}))))
        .catch(() => {}))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  event.respondWith(
    fetch(req, { cache: 'no-cache' })
      .then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }).then((hit) => hit || Response.error())),
  );
});
