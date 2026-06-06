const CACHE = 'athletik-v65';
const ASSETS = [
  '/',
  '/index.html',
  '/ciqual-data.js',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/assets/sounds/timer-beep.mp3'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS))
  );
  // self.skipWaiting() ici activerait le nouveau SW dès la fin de l'install,
  // mais alors le user reste sur l'ancienne page (CSS legacy) jusqu'au prochain
  // reload manuel. On préfère attendre le message 'skipWaiting' envoyé depuis
  // la page (voir le bloc registration dans index.html) : il déclenche un
  // 'controllerchange' que la page intercepte pour faire window.location.reload().
});

// Activation : nettoie les anciens caches puis claim tous les clients ouverts.
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

// Permet à la page d'activer immédiatement le nouveau SW (auto-update flow).
self.addEventListener('message', e => {
  if (e.data && e.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
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
