const scope = new URL(self.registration.scope);
const prefix = 'forma-assets-' + scope.pathname + '-';
const cacheName = prefix + 'v8';
const assets = [
  './',
  './index.html',
  './app.js',
  './ui.js',
  './views.js',
  './forms.js',
  './model.js',
  './style.css',
  './manifest.webmanifest',
  './assets/icon-180.png',
  './assets/icon-192.png',
  './assets/icon-512.png',
];
const urls = new Set(assets.map((p) => new URL(p, scope).href));
self.addEventListener('install', (e) =>
  e.waitUntil(
    (async () => {
      const cache = await caches.open(cacheName);
      await cache.addAll(
        assets.map((p) => new Request(new URL(p, scope), { cache: 'reload' })),
      );
      await self.skipWaiting();
    })(),
  ),
);
self.addEventListener('activate', (e) =>
  e.waitUntil(
    (async () => {
      for (const key of await caches.keys())
        if (key.startsWith(prefix) && key !== cacheName)
          await caches.delete(key);
      await self.clients.claim();
    })(),
  ),
);
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  url.hash = '';
  if (
    e.request.mode === 'navigate' &&
    url.origin === scope.origin &&
    (url.pathname === scope.pathname ||
      url.pathname === new URL('index.html', scope).pathname)
  ) {
    url.search = '';
  }
  if (!urls.has(url.href)) return;
  e.respondWith(
    (async () => {
      const cache = await caches.open(cacheName);
      const hit = await cache.match(url.href);
      return hit || fetch(e.request);
    })(),
  );
});
