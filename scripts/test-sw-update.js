// Mises à jour de l'app — vrai Chromium, vrais Service Workers.
//
// Ce qu'on protège :
//   1. UN SEUL SERVICE WORKER PAR PORTÉE. Un navigateur n'en tient qu'un pour
//      '/'. firebase-messaging-sw.js y était enregistré aussi : il REMPLAÇAIT
//      sw.js à chaque démarrage avec les notifications actives, puis sw.js le
//      remplaçait au démarrage suivant. Il doit vivre sur sa propre portée.
//   2. UNE MISE À JOUR PREND LA MAIN SEULE. Avant, la nouvelle version
//      attendait un message de l'ANCIENNE page ; sans lui, elle restait en
//      attente tant que l'app n'était pas tuée — des jours, pour une PWA
//      qu'on met en arrière-plan. Un article supprimé le 23/09 s'affichait
//      encore le 27.
//
// Le test tourne sur une page VIERGE, pas sur index.html : la page de l'app
// envoie elle-même 'skipWaiting', ce qui masquerait exactement le défaut
// qu'on veut voir. Et firebase-messaging-sw.js est remplacé par un bouchon :
// il importe le SDK depuis gstatic.com, injoignable depuis le bac à sable —
// son installation échouerait pour une raison qui n'a rien à voir. On teste
// la PORTÉE de son enregistrement, lue dans le vrai index.html.
//
//   node scripts/test-sw-update.js [dossier contenant index.html + sw.js]
const fs = require('fs'), http = require('http'), path = require('path');
const REPO = path.join(__dirname, '..');
const SRC = process.argv[2] || REPO;
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('Playwright absent — npm i -D playwright --no-save'); process.exit(0); }

const R = []; const ok = (l, c, d) => { R.push(c); console.log((c ? '  PASS  ' : '  FAIL  ') + l + (d !== undefined && !c ? '  → ' + String(d) : '')); };
const fin = async (browser, server) => {
  const bad = R.filter(x => !x).length;
  console.log('\n' + '='.repeat(58));
  console.log(bad ? ('RÉSULTAT : ' + bad + ' ÉCHEC(S) sur ' + R.length) : ('RÉSULTAT : ' + R.length + '/' + R.length + ' — tout est vert'));
  if (browser) await browser.close(); if (server) server.close();
  process.exit(bad ? 1 : 0);
};

(async () => {
  const html = fs.readFileSync(path.join(SRC, 'index.html'), 'utf8');
  const swSrc = fs.readFileSync(path.join(SRC, 'sw.js'), 'utf8');

  // ── L'appel RÉEL de l'app, tel qu'écrit dans index.html ──────────────────
  console.log('\n── Ce que l\'app demande au navigateur ──');
  const m = /navigator\.serviceWorker\.register\(\s*'\/firebase-messaging-sw\.js'\s*(,\s*(\{[\s\S]*?\}))?\s*\)/.exec(html);
  ok('index.html enregistre bien firebase-messaging-sw.js', !!m);
  let fcmOpts = null;
  try { fcmOpts = (m && m[2]) ? Function('return (' + m[2] + ')')() : null; } catch (e) {}
  ok('avec une portée explicite', !!(fcmOpts && fcmOpts.scope), m && (m[2] || '(aucune option)'));
  ok('qui n\'est PAS la racine', !!(fcmOpts && fcmOpts.scope && fcmOpts.scope !== '/' && fcmOpts.scope !== './'),
    fcmOpts && fcmOpts.scope);

  // ── Serveur : sw.js réel (avec une révision qu'on peut changer), bouchon
  //    pour le SW Firebase, page vierge pour ne rien envoyer à la place du SW.
  let rev = 1;
  const server = http.createServer((q, r) => {
    const u = decodeURIComponent(q.url.split('?')[0]);
    if (u === '/__vierge.html') { r.writeHead(200, { 'Content-Type': 'text/html' }); return r.end('<!doctype html><title>vierge</title>'); }
    if (u === '/sw.js') {
      r.writeHead(200, { 'Content-Type': 'text/javascript', 'Cache-Control': 'no-cache' });
      return r.end(swSrc + '\n// révision de test ' + rev + '\n');
    }
    if (u === '/firebase-messaging-sw.js') {
      r.writeHead(200, { 'Content-Type': 'text/javascript', 'Cache-Control': 'no-cache' });
      return r.end("self.addEventListener('push', function(){});\n");
    }
    // sw.js pré-charge '/' et '/index.html' : un 404 ici ferait échouer son
    // installation (cache.addAll est tout-ou-rien) — on testerait le harnais.
    if (u === '/' || u === '/index.html') { r.writeHead(200, { 'Content-Type': 'text/html' }); return r.end(html); }
    const f = path.join(REPO, u);
    if (!f.startsWith(REPO) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
    r.writeHead(200); fs.createReadStream(f).pipe(r);
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + server.address().port;   // 127.0.0.1 = contexte sûr
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(base + '/__vierge.html');

  // ── 1. Une portée chacun ─────────────────────────────────────────────────
  console.log('\n── Deux service workers, deux portées ──');
  const portees = await page.evaluate(async (fcmOpts) => {
    const attendre = (reg) => new Promise((res) => {
      const w = reg.installing || reg.waiting || reg.active;
      if (!w || w.state === 'activated') return res();
      w.addEventListener('statechange', () => { if (w.state === 'activated' || w.state === 'redundant') res(); });
      setTimeout(res, 8000);
    });
    // Ordre du démarrage : sw.js au chargement, Firebase ~1,5 s plus tard.
    const r1 = await navigator.serviceWorker.register('/sw.js'); await attendre(r1);
    const r2 = fcmOpts ? await navigator.serviceWorker.register('/firebase-messaging-sw.js', fcmOpts)
                       : await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    await attendre(r2);
    await new Promise(r => setTimeout(r, 400));
    const regs = await navigator.serviceWorker.getRegistrations();
    const script = (reg) => { const w = reg.active || reg.waiting || reg.installing; return w ? new URL(w.scriptURL).pathname : null; };
    return regs.map(reg => ({ portee: new URL(reg.scope).pathname, script: script(reg) }));
  }, fcmOpts);
  const racine = portees.find(p => p.portee === '/');
  ok('le navigateur tient DEUX enregistrements', portees.length === 2, JSON.stringify(portees));
  // Le cœur du défaut : si la racine exécute le SW Firebase, sw.js a été
  // chassé — plus de cache, plus de hors-ligne, plus d'alarme du timer.
  ok('la racine exécute toujours sw.js', !!racine && racine.script === '/sw.js', racine && racine.script);
  ok('Firebase a sa propre portée', portees.some(p => p.portee !== '/' && p.script === '/firebase-messaging-sw.js'),
    JSON.stringify(portees));

  // ── 2. Une nouvelle version prend la main SEULE ─────────────────────────
  console.log('\n── Une nouvelle version, sans que la page ne dise rien ──');
  const avant = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.getRegistration('/');
    return reg && reg.active ? reg.active.scriptURL : null;
  });
  rev = 2;   // le serveur publie une nouvelle version de sw.js
  const apres = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.getRegistration('/');
    if (!reg) return { erreur: 'aucun enregistrement' };
    const actifAvant = reg.active;
    try { await reg.update(); } catch (e) { return { erreur: e.message }; }
    // On laisse au nouveau SW le temps de s'installer — et, s'il le fait
    // tout seul, de s'activer. Personne ne lui envoie 'skipWaiting'.
    await new Promise(r => setTimeout(r, 3000));
    return {
      enAttente: !!reg.waiting,
      aChange: !!reg.active && reg.active !== actifAvant,
      etat: reg.active ? reg.active.state : null
    };
  });
  ok('une version était active au départ', !!avant, avant);
  ok('la nouvelle version ne reste PAS en attente', apres.enAttente === false, JSON.stringify(apres));
  ok('elle a pris la main d\'elle-même', apres.aChange === true && apres.etat === 'activated', JSON.stringify(apres));

  // ── 3. L'ancien cache ne survit pas ─────────────────────────────────────
  console.log('\n── Rien de l\'ancienne version ne reste ──');
  const caches_ = await page.evaluate(async () => await caches.keys());
  const nom = (/const CACHE = '([^']+)'/.exec(swSrc) || [])[1];
  ok('un seul cache sur l\'appareil', caches_.length === 1, JSON.stringify(caches_));
  ok('et c\'est celui de la version courante', caches_[0] === nom, caches_[0] + ' vs ' + nom);
  // Le document HTML ne doit JAMAIS être servi depuis le cache quand le
  // réseau répond : c'est ce qui garantit qu'une suppression se voit.
  ok('le HTML reste servi réseau d\'abord', /Network first pour le document HTML/.test(swSrc));

  await fin(browser, server);
})().catch(async (e) => { console.log('  FAIL  exception : ' + e.message); R.push(false); await fin(); });
