// Lecture audio du livre — vrai Chromium.
//
// Le serveur de test gère les requêtes `Range` À DESSEIN : sans ça, il
// renvoyait tout le fichier à une requête partielle et le <audio> tombait en
// erreur. Le test mesurait alors mon harnais, pas l'application.
//
// Ce qu'on protège :
//   1. Les 4 Mo ne se téléchargent QU'AU PREMIER ▶ — jamais à l'ouverture du
//      lecteur, jamais à l'installation de l'app.
//   2. La barre annonce ce que l'audio couvre VRAIMENT (pages 1–9), pas « le
//      livre » : le reste n'est pas encore lu.
//   3. Le Service Worker NE DOIT PAS intercepter /assets/audio/ — `cache.put`
//      refuse un 206, et servir une réponse complète à une requête partielle
//      casse la lecture sur iOS.
//   node scripts/test-book-audio.js [autre.html]
const fs = require('fs'), http = require('http'), path = require('path');
const REPO = path.join(__dirname, '..');
const HTML = process.argv[2] || path.join(REPO, 'index.html');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('Playwright absent — npm i -D playwright --no-save'); process.exit(0); }
const MIME = { '.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.png':'image/png','.mp3':'audio/mpeg' };

(async () => {
  const demandes = [];
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]);
    demandes.push({ url: rel, range: req.headers.range || null });
    const f = (rel === '/index.html') ? HTML : path.join(REPO, rel);
    if ((f !== HTML && !f.startsWith(REPO)) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
    const st = fs.statSync(f);
    const type = MIME[path.extname(f)] || 'application/octet-stream';
    // Requête partielle : on répond 206, comme le ferait Netlify.
    if (req.headers.range) {
      const m = /bytes=(\d+)-(\d*)/.exec(req.headers.range);
      if (m) {
        const a = +m[1], b = m[2] ? +m[2] : st.size - 1;
        res.writeHead(206, { 'Content-Type': type, 'Accept-Ranges': 'bytes',
          'Content-Range': `bytes ${a}-${b}/${st.size}`, 'Content-Length': b - a + 1 });
        return fs.createReadStream(f, { start: a, end: b }).pipe(res);
      }
    }
    res.writeHead(200, { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Content-Length': st.size });
    fs.createReadStream(f).pipe(res);
  });
  await new Promise(r => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await browser.newPage({ viewport: { width: 375, height: 667 }, deviceScaleFactor: 2 });
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  const R = []; const ok = (l, c, d) => { R.push(c); console.log((c ? '  PASS  ' : '  FAIL  ') + l + (d && !c ? '  → ' + String(d) : '')); };

  await page.goto(base + '/index.html', { waitUntil: 'domcontentloaded' });
  try { await page.waitForFunction(() => typeof window.bkAudioToggle === 'function', { timeout: 20000 }); }
  catch (e) {
    console.log('  FAIL  cette base n\'a pas la lecture audio');
    console.log('\n' + '='.repeat(58) + '\nRÉSULTAT : 1 ÉCHEC(S) sur 1');
    await browser.close(); server.close(); process.exit(1);
  }

  // ── Le manifeste ───────────────────────────────────────────────────────
  console.log('\n── Le manifeste audio ──');
  const man = await page.evaluate(() => {
    const L = window.BOOK_AUDIO;
    if (!L || !L.length) return null;
    const p = L[0];
    return { n: L.length, titre: p.titre, src: p.src, sec: p.sec, pages: p.pages };
  });
  ok('il existe', !!man, man);
  ok('il déclare une partie', !!man && man.n >= 1, man && man.n);
  ok('avec la durée réelle du fichier (263 s)', !!man && man.sec === 263, man && man.sec);
  // L'audio couvre le DÉBUT du livre, pas les 44 pages de l'extrait.
  ok('et les pages qu\'il couvre vraiment', !!man && man.pages[0] === 1 && man.pages[1] <= 44, man && JSON.stringify(man.pages));
  ok('le fichier vit sous /assets/audio/', !!man && /^assets\/audio\//.test(man.src), man && man.src);

  // ── Rien ne se télécharge avant le premier ▶ ──────────────────────────
  console.log('\n── Les 4 Mo attendent qu\'on les demande ──');
  demandes.length = 0;
  await page.evaluate(() => {
    document.querySelectorAll('.scr').forEach((e) => { e.style.display = 'none'; e.classList.remove('on'); });
    localStorage.setItem('ah_profile', JSON.stringify({ prenom: 'Alassane', programKey: 'vd', satDone: true }));
    localStorage.removeItem('ah_book_excerpt');
    window.switchTab('home'); window.openBookReader(1);
  });
  await page.waitForTimeout(800);
  const avantPlay = demandes.filter((d) => d.url.endsWith('.mp3') && d.url.indexOf('/assets/audio/') > -1);
  ok('le MP3 n\'est PAS demandé à l\'ouverture du lecteur', avantPlay.length === 0, avantPlay.length + ' requête(s)');
  ok('il n\'est pas non plus dans le pré-cache du Service Worker',
    await page.evaluate(async () => {
      const r = await fetch('/sw.js'); const t = await r.text();
      const bloc = t.slice(t.indexOf('ASSETS'), t.indexOf(']', t.indexOf('ASSETS')));
      return bloc.indexOf('/assets/audio/') === -1;
    }));

  // ── La barre dit ce qu'elle contient ──────────────────────────────────
  console.log('\n── Ce que la barre annonce ──');
  const barre = await page.evaluate(() => {
    const b = document.getElementById('bkAudio');
    if (!b || b.hidden) return null;
    return { h: Math.round(b.getBoundingClientRect().height),
      titre: document.getElementById('bkAuTitre').textContent.trim(),
      sous: document.getElementById('bkAuSous').textContent.trim(),
      tot: document.getElementById('bkAuTot').textContent.trim(),
      now: document.getElementById('bkAuNow').textContent.trim(),
      vitesse: document.getElementById('bkAuSpeed').textContent.trim(),
      err: document.getElementById('bkAuErr').getBoundingClientRect().height > 0 };
  });
  ok('la barre est visible', !!barre && barre.h > 60, barre && barre.h);
  ok('elle nomme la partie lue', !!barre && /Préface/i.test(barre.titre), barre && barre.titre);
  // Le reste du livre n'est pas encore lu : le dire vaut mieux que le taire.
  ok('elle annonce les pages couvertes, pas « le livre »', !!barre && /pages\s*1[–-]\d+/.test(barre.sous), barre && barre.sous);
  ok('la durée est affichée avant même de lancer', !!barre && barre.tot === '4:23', barre && barre.tot);
  // On mesure la hauteur PEINTE, pas `el.hidden` : `display:flex` d'une classe
  // bat `[hidden]{display:none}`, et la propriété ne le dit pas.
  ok('aucun bandeau d\'erreur peint au repos', !!barre && barre.err === false);

  // ── La lecture ────────────────────────────────────────────────────────
  console.log('\n── Lancer la lecture ──');
  await page.click('#bkAuPlay');
  await page.waitForTimeout(2200);
  const apres = await page.evaluate(() => ({
    bouton: document.getElementById('bkAuPlay').textContent.trim(),
    now: document.getElementById('bkAuNow').textContent.trim(),
    tot: document.getElementById('bkAuTot').textContent.trim(),
    err: document.getElementById('bkAuErr').getBoundingClientRect().height > 0,
    pos: Number(document.getElementById('bkAuRange').value)
  }));
  const mp3 = demandes.filter((d) => d.url.indexOf('/assets/audio/') > -1);
  ok('le MP3 est demandé APRÈS le tap', mp3.length > 0, mp3.length);
  ok('aucune erreur pendant la lecture', apres.err === false);
  ok('le bouton passe en pause', apres.bouton === '❚❚', apres.bouton);
  // La durée annoncée par le manifeste est confirmée par le décodeur.
  ok('la durée reste 4:23 une fois le fichier lu', apres.tot === '4:23', apres.tot);
  ok('le temps avance', apres.now !== '0:00', apres.now);
  ok('la barre de position suit', apres.pos > 0, apres.pos);

  console.log('\n── Vitesse, position, pause ──');
  await page.click('#bkAuSpeed');
  ok('la vitesse change', (await page.evaluate(() => document.getElementById('bkAuSpeed').textContent.trim())) === '1.25×');
  await page.evaluate(() => window.bkAudioSeek(500));
  await page.waitForTimeout(400);
  const apresSeek = await page.evaluate(() => document.getElementById('bkAuNow').textContent.trim());
  ok('on peut se déplacer dans la lecture', apresSeek !== '0:00' && apresSeek !== apres.now, apresSeek);

  // Fermer le lecteur doit couper la voix : une lecture qui continue derrière
  // un écran fermé est une mauvaise surprise.
  await page.evaluate(() => window.closeBookReader());
  await page.waitForTimeout(600);
  const memo = await page.evaluate(() => {
    try { return JSON.parse(localStorage.getItem('ah_book_excerpt')).audio; } catch (e) { return null; }
  });
  ok('la position est mémorisée à la fermeture', !!memo && memo.t > 0, JSON.stringify(memo));
  ok('la vitesse choisie est mémorisée', !!memo && memo.v === 1, JSON.stringify(memo));

  await page.evaluate(() => window.openBookReader(1));
  await page.waitForTimeout(900);
  ok('à la réouverture, la vitesse est retrouvée',
    (await page.evaluate(() => document.getElementById('bkAuSpeed').textContent.trim())) === '1.25×');

  // ── L'état d'échec ────────────────────────────────────────────────────
  console.log('\n── Quand l\'audio ne charge pas, on le dit ──');
  const echec = await page.evaluate(async () => {
    const sauve = window.BOOK_AUDIO[0].src;
    window.BOOK_AUDIO[0].src = 'assets/audio/nexiste-pas.mp3';
    if (window._bkAudioStop) window._bkAudioStop();
    // On force la recréation de l'élément sur une source morte.
    window.bkAudioRetry();
    await new Promise((r) => setTimeout(r, 1500));
    const e = document.getElementById('bkAuErr');
    const out = { visible: e.getBoundingClientRect().height > 0, txt: (e.textContent || '').trim(),
                  bouton: document.getElementById('bkAuPlay').disabled };
    window.BOOK_AUDIO[0].src = sauve;
    return out;
  });
  ok('un message explicite est réellement peint', echec.visible === true);
  ok('il propose de réessayer', /réessayer/i.test(echec.txt), echec.txt.slice(0, 60));
  ok('le bouton lecture est désactivé, pas muet', echec.bouton === true);

  // ── La ligne d'achat ──────────────────────────────────────────────────
  console.log('\n── Le bouton d\'achat ──');
  const buy = await page.evaluate(() => {
    const b = document.getElementById('bkBuyRow');
    return b ? { cache: b.getBoundingClientRect().height === 0, txt: b.textContent.trim(), onclick: b.getAttribute('onclick') || '' } : null;
  });
  ok('la ligne d\'achat existe', !!buy);
  ok('elle est visible sans le livre', !!buy && buy.cache === false);
  ok('elle mène à Amazon par la fonction centralisée', !!buy && /openAmazonBook/.test(buy.onclick), buy && buy.onclick);
  ok('elle dit où elle mène', !!buy && /amazon/i.test(buy.txt), buy && buy.txt);
  const buyLivre = await page.evaluate(() => {
    localStorage.setItem('ah_profile', JSON.stringify({ hasBookAccess: true }));
    window.openBookReader(1);
    return document.getElementById('bkBuyRow').getBoundingClientRect().height === 0;
  });
  await page.waitForTimeout(300);
  ok('elle disparaît pour qui possède déjà le livre', buyLivre === true);

  // ── Le Service Worker ─────────────────────────────────────────────────
  console.log('\n── Le Service Worker laisse passer l\'audio ──');
  const swTxt = await page.evaluate(async () => (await fetch('/sw.js')).text());
  // cache.put() lève sur un 206 ; servir une réponse complète à une requête
  // partielle casse la lecture sur iOS.
  ok('il contourne /assets/audio/', /assets\/audio\//.test(swTxt) && /return;/.test(swTxt), 'règle absente');
  ok('il ne met en cache que des réponses 200', /status === 200/.test(swTxt));
  // La règle est par CHEMIN : une règle sur `.mp3` aurait sorti le son du
  // timer du cache et cassé son fonctionnement hors ligne.
  ok('le son du timer reste pré-caché', /assets\/sounds\/timer-beep\.mp3/.test(swTxt));

  ok('aucune erreur JS sur tout le parcours', errs.length === 0, errs.join(' | '));

  const echecs = R.filter(x => !x).length;
  console.log('\n' + '='.repeat(58));
  console.log(echecs ? ('RÉSULTAT : ' + echecs + ' ÉCHEC(S) sur ' + R.length)
                     : ('RÉSULTAT : ' + R.length + '/' + R.length + ' — tout est vert'));
  await browser.close(); server.close();
  process.exit(echecs ? 1 : 0);
})();
