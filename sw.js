const CACHE = 'athletik-v26';
const ASSETS = [
  '/',
  '/index.html',
  '/ciqual-data.js',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const req = e.request;

  // Network first pour les ressources externes (Unsplash, Google Fonts…)
  if (!req.url.startsWith(self.location.origin)) {
    e.respondWith(fetch(req).catch(() => caches.match(req)));
    return;
  }

  // Network first pour le document HTML (navigations). En cache-first, le
  // Service Worker servait un index.html périmé après chaque déploiement —
  // l'app restait bloquée sur une vieille version. On retombe sur le cache
  // uniquement hors-ligne.
  const isHTML = req.mode === 'navigate' ||
    (req.headers.get('accept') || '').indexOf('text/html') > -1;
  if (isHTML) {
    e.respondWith(
      fetch(req).then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(req, clone));
        return res;
      }).catch(() =>
        caches.match(req).then(c => c || caches.match('/index.html'))
      )
    );
    return;
  }

  // Cache first pour les autres assets locaux (icônes, ciqual-data.js…)
  e.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(req, clone));
        return res;
      });
    })
  );
});
