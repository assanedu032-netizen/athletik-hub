// L'app native (Capacitor) — ce qui change quand l'interface tourne DANS le
// téléphone, et ce qui ne doit surtout pas changer sur le web.
//
// Dans l'app, la page est lue depuis le téléphone (https://localhost,
// capacitor://localhost). Un appel relatif « /.netlify/functions/titan »
// viserait le téléphone lui-même : il doit partir vers le serveur. Sur le web,
// rien ne doit bouger d'un caractère.
//
// La simulation pose window.Capacitor AVANT les scripts de la page — c'est
// exactement ce que fait Capacitor, qui injecte son pont au démarrage du
// document. Les appels au serveur sont interceptés : aucun ne sort réellement.
//
//   node scripts/test-native-shell.js [autre.html]
'use strict';
const fs = require('fs'), http = require('http'), path = require('path');
const REPO = path.join(__dirname, '..');
const HTML = process.argv[2] || path.join(REPO, 'index.html');
const PROD = 'https://athletikfondation.netlify.app';
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('Playwright absent — npm i -D playwright --no-save'); process.exit(0); }
const R = []; const ok = (l, c, d) => { R.push(!!c); console.log((c ? '  PASS  ' : '  FAIL  ') + l + (d !== undefined && !c ? '  → ' + String(d) : '')); };
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.mp3': 'audio/mpeg' };

(async () => {
  const src = fs.readFileSync(HTML, 'utf8');

  // ── 1. Lecture du code ──────────────────────────────────────────────────
  console.log('\n── Dans le code ──');
  const relatifs = (src.match(/fetch\(\s*['"]\/\.netlify\/functions\//g) || []).length;
  ok('aucun appel relatif aux fonctions ne subsiste', relatifs === 0, relatifs + ' appel(s)');
  ok('les appels passent par ahApi()', (src.match(/fetch\(ahApi\('\/\.netlify\/functions\//g) || []).length >= 10);
  const iDetect = src.indexOf('window.AH_API_BASE');
  const iPremierScript = src.search(/<script[\s>]/);
  ok('la détection native est le PREMIER script de la page', iDetect > 0 && src.lastIndexOf('<script', iDetect) === iPremierScript);

  // ── Le projet natif ─────────────────────────────────────────────────────
  console.log('\n── Le projet Capacitor ──');
  let cfg = null;
  try { cfg = JSON.parse(fs.readFileSync(path.join(REPO, 'capacitor.config.json'), 'utf8')); } catch (e) {}
  // L'app embarque le dossier PUBLIÉ, jamais la racine du dépôt : celle-ci
  // contient le livre complet et les réponses d'activation.
  ok('l\'app embarque www/ — jamais la racine du dépôt', !!cfg && cfg.webDir === 'www', cfg && cfg.webDir);
  ok('un identifiant d\'application est fixé', !!cfg && /^[a-z]+(\.[a-z0-9]+){2,}$/.test(cfg.appId || ''), cfg && cfg.appId);
  ok('le projet Android existe, avec ses icônes',
    fs.existsSync(path.join(REPO, 'android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png')));
  ok('le projet iOS existe, avec son icône 1024 px',
    fs.existsSync(path.join(REPO, 'ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png')));

  // ── Serveur local : la page, telle qu'un navigateur la reçoit ───────────
  const server = http.createServer((q, r) => {
    const u = decodeURIComponent(q.url.split('?')[0]);
    const f = (u === '/' || u === '/index.html') ? HTML : path.join(REPO, u);
    if ((f !== HTML && !f.startsWith(REPO)) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
    r.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(r);
  });
  await new Promise((res) => server.listen(0, '127.0.0.1', res));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

  async function scenario(natif) {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 667 } });
    if (natif) {
      await ctx.addInitScript(() => {
        window.Capacitor = { isNativePlatform: () => true, getPlatform: () => 'android' };
      });
    }
    const page = await ctx.newPage();
    const erreurs = [], appels = [];
    page.on('pageerror', (e) => erreurs.push(e.message));
    // Toute requête vers une fonction est interceptée et notée : on teste
    // l'ADRESSE visée, pas le serveur.
    // Le reste d'Internet (polices, SDK Firebase) est coupé : injoignable
    // depuis le bac à sable, il bloquerait l'événement « load » dont dépend
    // l'enregistrement du service worker.
    await ctx.route((url) => !url.href.startsWith(base) && !/\/\.netlify\/functions\//.test(url.href),
      (route) => route.abort());
    await ctx.route(/\/\.netlify\/functions\//, (route) => {
      appels.push(route.request().url());
      route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":false,"message":"test"}' });
    });
    await page.goto(base + '/index.html', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof window.submitAccessCode === 'function', { timeout: 20000 });
    // Dans ce bac à sable, « load » ne se déclenche jamais (toutes les suites
    // attendent donc domcontentloaded). Or l'app enregistre son service
    // worker SUR « load » : on émet l'événement nous-mêmes — c'est bien le
    // code de l'app qui réagit, pas un raccourci du test.
    await page.evaluate(() => window.dispatchEvent(new Event('load')));
    await page.waitForTimeout(1800);

    const etat = await page.evaluate(() => ({
      natif: window.AH_NATIVE, base: window.AH_API_BASE,
      exemple: typeof window.ahApi === 'function' ? window.ahApi('/.netlify/functions/titan') : null
    }));

    // Un VRAI chemin de l'app : l'activation d'un code d'accès. On fournit
    // l'utilisateur connecté et on court-circuite la question du livre — le
    // reste est le code de l'app, jusqu'au fetch.
    await page.evaluate(() => {
      window.fbUser = { uid: 'test', getIdToken: () => Promise.resolve('jeton-de-test') };
      window._checkBookAnswer = () => true;
      const m = document.getElementById('accessCodeModal'); if (m) m.style.display = 'flex';
      const v = (id, x) => { const e = document.getElementById(id); if (e) e.value = x; };
      v('accessCodeInput', 'B-ABCDEF-1234'); v('accessQuestionInput', 'x'); v('accessOrderInput', '');
    });
    await page.evaluate(() => window.submitAccessCode());
    await page.waitForTimeout(500);

    const sw = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return -1;
      return (await navigator.serviceWorker.getRegistrations()).length;
    });
    const fcm = await page.evaluate(async () => {
      const t = await window._registerFCMToken();
      return { token: t, raison: window._fcmLastError || '' };
    });
    await page.waitForTimeout(2600);   // la bannière d'install apparaît à 3 s
    const banniere = await page.evaluate(() => {
      const b = document.getElementById('installPrompt');
      return !!b && getComputedStyle(b).display !== 'none' && b.getBoundingClientRect().height > 0;
    });
    await ctx.close();
    const vraies = erreurs.filter((m) => !/firebase|gstatic|googleapis|Failed to fetch|NetworkError|network/i.test(m));
    return { etat, appels, sw, fcm, banniere, erreurs: vraies };
  }

  // ── 2. Sur le web : rien ne change ──────────────────────────────────────
  console.log('\n── Sur le web (navigateur, PWA) ──');
  const w = await scenario(false);
  ok('l\'app ne se croit pas native', w.etat.natif === false, w.etat.natif);
  ok('l\'adresse de base reste vide', w.etat.base === '', JSON.stringify(w.etat.base));
  ok('ahApi() rend le chemin tel quel', w.etat.exemple === '/.netlify/functions/titan', w.etat.exemple);
  ok('l\'activation appelle le serveur DU SITE', w.appels.length === 1 && w.appels[0] === base + '/.netlify/functions/check-code',
    JSON.stringify(w.appels));
  ok('le service worker s\'enregistre toujours', w.sw >= 1, w.sw);
  // Sans ce témoin, « pas de bannière dans l'app » pourrait passer parce que
  // la bannière ne s'afficherait nulle part.
  ok('la bannière « Installe l\'app » s\'affiche toujours sur le web', w.banniere === true);
  ok('aucune erreur JS', w.erreurs.length === 0, w.erreurs.join(' | '));

  // ── 3. Dans l'app native ─────────────────────────────────────────────────
  console.log('\n── Dans l\'app native (Capacitor simulé) ──');
  const n = await scenario(true);
  ok('l\'app se sait native', n.etat.natif === true, n.etat.natif);
  ok('l\'adresse de base est celle de la production', n.etat.base === PROD, n.etat.base);
  ok('l\'activation appelle le serveur DE PRODUCTION', n.appels.length === 1 && n.appels[0] === PROD + '/.netlify/functions/check-code',
    JSON.stringify(n.appels));
  ok('aucun appel ne vise le téléphone lui-même', !n.appels.some((u) => u.startsWith(base)), JSON.stringify(n.appels));
  ok('aucun service worker n\'est enregistré', n.sw === 0, n.sw);
  ok('les notifications web refusent proprement', n.fcm.token === null && /application mobile/.test(n.fcm.raison), JSON.stringify(n.fcm));
  ok('pas de bannière « Installe l\'app » dans l\'app', n.banniere === false);
  ok('aucune erreur JS', n.erreurs.length === 0, n.erreurs.join(' | '));

  await browser.close(); server.close();
  const bad = R.filter((x) => !x).length;
  console.log('\n' + '='.repeat(58));
  console.log(bad ? ('RÉSULTAT : ' + bad + ' ÉCHEC(S) sur ' + R.length) : ('RÉSULTAT : ' + R.length + '/' + R.length + ' — tout est vert'));
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.log('  FAIL  exception : ' + e.message); console.log('\nRÉSULTAT : 1 ÉCHEC(S)'); process.exit(1); });
