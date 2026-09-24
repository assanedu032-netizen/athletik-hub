const CACHE = 'athletik-v301';
const ASSETS = [
  '/',
  '/index.html',
  '/ciqual-data.js',
  '/data/elite-athlete-program.js',
  '/data/vertical-dunk-program.js',
  '/data/shred-explose-program.js',
  '/data/explose-plus-program.js',
  '/data/triphasique-program.js',
  '/data/microtraining-program.js',
  '/data/book-excerpt.js',
  '/data/book-audio.js',
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
// ──
// TIMER_SCHEDULE / TIMER_CANCEL : la page demande au SW de programmer une
// notification système à un instant T absolu. Plus fiable que setTimeout dans
// la page (qui meurt quand l'OS endort la PWA). Le SW vit plus longtemps mais
// peut aussi être tué par l'OS — défense en profondeur avec TimestampTrigger
// côté page si disponible.
const _swTimers = new Map();
self.addEventListener('message', e => {
  const d = e.data || {};
  if (d.action === 'skipWaiting') { self.skipWaiting(); return; }
  if (d.type === 'TIMER_SCHEDULE') {
    const endsAt = d.endsAt;
    const delay = Math.max(0, endsAt - Date.now());
    // Annule un éventuel timer précédent (peut être un seul ID ou une liste)
    const prev = _swTimers.get('tim-minut');
    if (prev) (Array.isArray(prev) ? prev : [prev]).forEach(t => clearTimeout(t));
    // 3 notifications rapprochées pour être SÛR que l'user entende (la première
    // peut être ratée si l'écran est éteint). Tags différents → chacune ré-alerte.
    // Vibration agressive [1s vibre, 0.3s pause, ×3 + 1.5s final].
    const ALERTS = [0, 1800, 3600];
    const handles = [];
    ALERTS.forEach((offset, i) => {
      const t = setTimeout(() => {
        try {
          self.registration.showNotification(
            i === 0 ? '⏰ Timer terminé' : '⏰ Rappel timer',
            {
              body: d.body || 'Le minuteur a sonné',
              icon: '/images/titan-mascot.png',
              image: '/images/titan-mascot.png',
              badge: '/icons/icon-192.png',
              tag: 'tim-minut-' + i,
              requireInteraction: true,
              vibrate: [1000, 300, 1000, 300, 1000, 300, 1500],
              renotify: true,
              silent: false
            }
          );
        } catch (err) { /* SW killed — TimestampTrigger côté page prend le relais */ }
      }, delay + offset);
      handles.push(t);
    });
    _swTimers.set('tim-minut', handles);
    return;
  }
  if (d.type === 'TIMER_CANCEL') {
    const prev = _swTimers.get('tim-minut');
    if (prev) {
      (Array.isArray(prev) ? prev : [prev]).forEach(t => clearTimeout(t));
      _swTimers.delete('tim-minut');
    }
    // Ferme les 3 alertes (tags 0/1/2) + ancien tag legacy "tim-minut"
    [0, 1, 2].forEach(i => {
      self.registration.getNotifications({ tag: 'tim-minut-' + i, includeTriggered: true })
        .then(arr => arr.forEach(n => { try { n.close(); } catch(_){} }))
        .catch(() => {});
    });
    self.registration.getNotifications({ tag: 'tim-minut', includeTriggered: true })
      .then(arr => arr.forEach(n => { try { n.close(); } catch(_){} }))
      .catch(() => {});
    return;
  }
});

// Click sur la notif → focus la PWA si déjà ouverte, sinon l'ouvre.
self.addEventListener('notificationclick', e => {
  if (e.notification && e.notification.tag === 'tim-minut') {
    e.notification.close();
    e.waitUntil((async () => {
      const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const w of wins) {
        if (w.url.indexOf(self.location.origin) === 0) {
          await w.focus();
          return;
        }
      }
      await self.clients.openWindow('/');
    })());
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

  // L'AUDIO DU LIVRE NE PASSE PAS PAR LE SERVICE WORKER.
  //
  // Un <audio> ne télécharge pas son fichier d'un bloc : il envoie des
  // requêtes portant un en-tête `Range`, auxquelles le serveur répond 206
  // (Partial Content). Trois choses cassent si on les intercepte :
  //   1. `cache.put()` REFUSE une réponse 206 — la promesse est rejetée, et
  //      comme elle n'est pas attendue ici, le rejet part en silence ;
  //   2. à la toute première requête (sans Range), on mettrait les 4 Mo du
  //      MP3 dans le cache, sur le téléphone de l'athlète, sans qu'il ait
  //      rien demandé ;
  //   3. `caches.match()` renverrait ensuite une réponse COMPLÈTE à une
  //      requête PARTIELLE — Chrome s'en accommode, Safari non : la lecture
  //      s'arrête.
  //
  // La règle est volontairement PAR CHEMIN, pas par extension : le son du
  // timer (`/assets/sounds/timer-beep.mp3`) est pré-caché EXPRÈS pour sonner
  // hors ligne, en salle. Une règle sur `.mp3` l'aurait sorti du cache et
  // cassé ce cas d'usage.
  if (new URL(req.url).pathname.startsWith('/assets/audio/')) return;

  // Cache first pour les autres assets locaux (icônes, ciqual-data.js…)
  e.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(res => {
        // `cache.put()` lève sur une réponse partielle (206) ou une erreur :
        // on ne met en cache QUE des 200 pleins. Sans ce garde-fou, une
        // requête Range sur n'importe quel asset produirait un rejet muet.
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(req, clone)).catch(() => {});
        }
        return res;
      });
    })
  );
});
