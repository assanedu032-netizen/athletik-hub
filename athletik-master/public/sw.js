/* Athletik Master — Service Worker.
 * Coquille de l'app en cache (hors ligne), mise à jour en arrière-plan
 * (stale-while-revalidate). L'API (/.netlify/) et tout ce qui n'est pas du
 * même domaine ne passent JAMAIS par le cache. Incrémenter VERSION à chaque
 * livraison qui doit invalider la coquille. */
var VERSION = 'am-v7';
var SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css',
  'js/config.js', 'js/engine.js', 'js/access.js', 'js/content-tools.js', 'js/demo.js', 'js/store.js', 'js/app.js',
  'content/program.json', 'icons/icon-192.png', 'icons/icon-192.png', 'icons/favicon-32.png'
];
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== location.origin || url.pathname.indexOf('/.netlify/') === 0) return;
  e.respondWith(caches.open(VERSION).then(function (cache) {
    return cache.match(req, { ignoreSearch: true }).then(function (hit) {
      var net = fetch(req).then(function (res) {
        if (res && res.status === 200) cache.put(req, res.clone());
        return res;
      }).catch(function () { return hit; });
      return hit || net;
    });
  }));
});
