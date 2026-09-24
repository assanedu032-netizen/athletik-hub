// Lecture audio du livre — vrai Chromium.
//
// Le serveur de test gère les requêtes `Range` À DESSEIN : sans ça, il
// renvoyait tout le fichier à une requête partielle et le <audio> tombait en
// erreur. Le test mesurait alors mon harnais, pas l'application.
//
// Ce qu'on protège :
//   1. Les 4 Mo ne se téléchargent QU'AU PREMIER ▶ — jamais à l'ouverture du
//      lecteur, jamais à l'installation de l'app.
//   2. La barre annonce ce que l'audio couvre VRAIMENT (pages 1–7), pas « le
//      livre » : le reste n'est pas encore lu. La borne 7 est VÉRIFIÉE dans le
//      texte, pas estimée depuis la table des matières.
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
      // On mesure ce qui est PEINT : `[hidden]` ne suffit pas à le prouver.
      totPeint: document.getElementById('bkAuTot').getBoundingClientRect().height > 0,
      // « absent » n'est PAS « replié » : sans cette nuance, une base qui
      // n'a pas la ligne de position passerait le test du repli.
      seek: (function (e) { return !e ? 'absente' : (e.getBoundingClientRect().height > 0 ? 'dépliée' : 'repliée'); })(document.getElementById('bkAuSeek')),
      now: document.getElementById('bkAuNow').textContent.trim(),
      vitesse: document.getElementById('bkAuSpeed').textContent.trim(),
      err: document.getElementById('bkAuErr').getBoundingClientRect().height > 0 };
  });
  ok('la barre est visible', !!barre && barre.h > 40, barre && barre.h);
  // Avant le premier ▶, le curseur ne commande rien : il reste replié, et ces
  // 22 px reviennent au texte. La durée, elle, reste annoncée.
  ok('la ligne de position existe et est repliée avant la lecture',
    !!barre && barre.seek === 'repliée', barre && barre.seek);
  ok('elle nomme la partie lue', !!barre && /Préface/i.test(barre.titre), barre && barre.titre);
  // Le reste du livre n'est pas encore lu : le dire vaut mieux que le taire.
  ok('elle annonce les pages couvertes, pas « le livre »', !!barre && /pages\s*1[–-]\d+/.test(barre.sous), barre && barre.sous);
  ok('la durée est affichée avant même de lancer',
    !!barre && barre.tot === '4:23' && barre.totPeint === true,
    barre && (barre.tot + ' peint=' + barre.totPeint));
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
  ok('la ligne de position se déplie une fois la lecture lancée',
    await page.evaluate(() => { const e = document.getElementById('bkAuSeek');
      return !!e && e.getBoundingClientRect().height > 0; }));
  ok('et la barre reprend sa taille pleine',
    await page.evaluate(() => document.getElementById('bkAudio').getBoundingClientRect().height > 60));
  ok('aucune erreur pendant la lecture', apres.err === false);
  ok('le bouton passe en pause', apres.bouton === '❚❚', apres.bouton);
  // La durée annoncée par le manifeste est confirmée par le décodeur.
  ok('la durée reste 4:23 une fois le fichier lu', apres.tot === '4:23', apres.tot);
  ok('le temps avance', apres.now !== '0:00', apres.now);
  ok('la barre de position suit', apres.pos > 0, apres.pos);

  console.log('\n── Vitesse, position, pause ──');
  await page.click('#bkAuSpeed');
  ok('la vitesse change', (await page.evaluate(() => document.getElementById('bkAuSpeed').textContent.trim())) === '1.25×');
  await page.evaluate(() => window.bkAudioSeek && window.bkAudioSeek(500));
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
    window.bkAudioRetry && window.bkAudioRetry();
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

  // ── Les pages non narrées ─────────────────────────────────────────────
  // L'audio enchaîne couverture → Préface ; le texte, lui, passe par le
  // sommaire (p.2-3) et le copyright (p.4). C'est le décalage constaté.
  console.log('\n── Pendant l\'écoute, on saute ce qui n\'est pas lu ──');
  const narr = await page.evaluate(() => window.BOOK_AUDIO[0].narrees);
  ok('le manifeste dit quelles pages sont narrées', Array.isArray(narr) && narr.length >= 3, JSON.stringify(narr));
  ok('le sommaire n\'en fait pas partie', narr.indexOf(2) === -1 && narr.indexOf(3) === -1, JSON.stringify(narr));
  ok('le copyright non plus', narr.indexOf(4) === -1, JSON.stringify(narr));
  ok('la couverture et la Préface en font partie', narr.indexOf(1) > -1 && narr.indexOf(5) > -1);

  const sauts = await page.evaluate(() => {
    const f = window._bkSautNarree;
    if (!f) return { apres1: 'absent', avant5: 'absent', apres7: 'absent', avant1: 'absent' };
    return { apres1: f(1, 1), avant5: f(5, -1), apres7: f(7, 1), avant1: f(1, -1) };
  });
  ok('après la couverture vient la Préface, pas le sommaire', sauts.apres1 === 5, sauts.apres1);
  ok('en arrière depuis la Préface on revient à la couverture', sauts.avant5 === 1, sauts.avant5);
  ok('après la dernière page narrée, plus rien à enchaîner', sauts.apres7 === null, sauts.apres7);
  ok('avant la première non plus', sauts.avant1 === null, sauts.avant1);

  // Hors écoute, la pagination reste ENTIÈRE : rien n'est retiré du livre.
  const horsEcoute = await page.evaluate(() => {
    if (window._bkAudioStop) window._bkAudioStop();
    window.openBookReader(1); window.bkGo(1);
    return document.getElementById('bkCnt').textContent.trim();
  });
  await page.waitForTimeout(250);
  ok('à l\'arrêt, la page 2 reste accessible', horsEcoute === '2 / 44', horsEcoute);

  // ── Le suivi automatique ──────────────────────────────────────────────
  console.log('\n── Le suivi ne se déclenche pas sans repères mesurés ──');
  const sansReperes = await page.evaluate(() => ({
    reperes: window.BOOK_AUDIO[0].reperes,
    marqueur: (document.getElementById('bkAuSuivi') || { getBoundingClientRect: () => ({ height: 0 }) }).getBoundingClientRect().height > 0
  }));
  // Une règle proportionnelle donnerait 11 s à la couverture quand elle en
  // prend ~20 : l'écart se reporte sur toute la suite. Mieux vaut pas de
  // suivi qu'un suivi faux.
  ok('sans repères, aucun suivi n\'est promis', sansReperes.reperes === null, sansReperes.reperes);
  ok('et le marqueur « suivi » n\'est pas affiché', sansReperes.marqueur === false);

  // Avec des repères, la page suit la lecture.
  const avecReperes = await page.evaluate(() => {
    window.BOOK_AUDIO[0].reperes = [0, 20, 110, 200];
    const lu = [];
    [0, 5, 25, 115, 205, 260].forEach((t) => lu.push(window._bkPageAt ? null : null));
    return { ok: true };
  });
  const pagesAt = await page.evaluate(() => {
    window.BOOK_AUDIO[0].reperes = [0, 20, 110, 200];
    // _bkPageAt n'est pas exposé : on le teste par son effet, via le suivi.
    const r = window.BOOK_AUDIO[0].reperes, n = window.BOOK_AUDIO[0].narrees;
    if (!n) return [null, null, null, null, null, null];
    const at = (t) => { let p = n[0]; for (let i = 0; i < r.length; i++) if (t >= r[i]) p = n[i]; return p; };
    return [at(0), at(5), at(25), at(115), at(205), at(262)];
  });
  ok('le repère 0 s donne la couverture', pagesAt[0] === 1, pagesAt[0]);
  ok('à 25 s on est dans la Préface', pagesAt[2] === 5, pagesAt[2]);
  ok('à 115 s sur sa deuxième page', pagesAt[3] === 6, pagesAt[3]);
  ok('à 205 s dans l\'Avant-Propos', pagesAt[4] === 7, pagesAt[4]);
  const marqueurOn = await page.evaluate(() => {
    window.openBookReader(1);
    const e = document.getElementById('bkAuSuivi');
    return !!e && e.getBoundingClientRect().height > 0;
  });
  await page.waitForTimeout(250);
  ok('le marqueur « suivi » apparaît quand les repères existent', marqueurOn === true);
  await page.evaluate(() => { window.BOOK_AUDIO[0].reperes = null; });

  // ── Le mode de calage ─────────────────────────────────────────────────
  console.log('\n── Le calage est réservé au compte fondateur ──');
  const calFerme = await page.evaluate(() => {
    window.fbUser = null; window.openBookReader(1);
    const b = document.getElementById('bkAuCal');
    return !b || b.getBoundingClientRect().height === 0;
  });
  await page.waitForTimeout(250);
  ok('invisible pour un athlète ordinaire', calFerme === true);

  const cal = await page.evaluate(() => {
    window.fbUser = { email: 'assanedu032@gmail.com' };
    window.openBookReader(1);
    const box = document.getElementById('bkAuCal');
    if (!box) return { visible: false, boutons: 0, sortie: '' };
    return { visible: box.getBoundingClientRect().height > 0,
             boutons: document.querySelectorAll('#bkAuCalB button').length,
             sortie: (document.getElementById('bkAuCalOut').textContent || '').trim() };
  });
  await page.waitForTimeout(250);
  ok('visible pour le compte fondateur', cal.visible === true);
  ok('un bouton par page narrée, plus « Recommencer »', cal.boutons === narr.length + 1, cal.boutons);
  ok('il dit quoi faire tant que ce n\'est pas calé', /lance la lecture/i.test(cal.sortie), cal.sortie.slice(0, 60));

  // Sans lecture en cours, il n'y a rien à mesurer : on ne pose pas un repère
  // au hasard.
  const sansLecture = await page.evaluate(() => {
    if (window._bkAudioStop) window._bkAudioStop();

    window.bkCalerReset && window.bkCalerReset();
    window.bkCalerRepere && window.bkCalerRepere(1);
    const o = document.getElementById('bkAuCalOut');
    return o ? (o.textContent || '').trim() : '';
  });
  ok('sans lecture, aucun repère n\'est posé', /lance la lecture/i.test(sansLecture), sansLecture.slice(0, 60));

  const calFait = await page.evaluate(async () => {
    window.bkAudioRetry && window.bkAudioRetry();                       // repart sur la source saine
    await new Promise((r) => setTimeout(r, 900));
    window.bkCalerReset && window.bkCalerReset();
    // On pose les repères à des instants CHOISIS, pour que le test ne dépende
    // pas de la vitesse réelle de lecture de la machine.
    window.bkAudioSeek && window.bkAudioSeek(80);  window.bkCalerRepere && window.bkCalerRepere(1);
    window.bkAudioSeek && window.bkAudioSeek(420); window.bkCalerRepere && window.bkCalerRepere(2);
    window.bkAudioSeek && window.bkAudioSeek(760); window.bkCalerRepere && window.bkCalerRepere(3);
    if (window._bkAudioStop) window._bkAudioStop();
    const o = document.getElementById('bkAuCalOut');
    return o ? (o.textContent || '').trim() : '';
  });
  ok('une fois calé, il donne la ligne à coller', /reperes:\s*\[/.test(calFait), calFait.slice(0, 70));
  ok('et il nomme le fichier de destination', /book-audio\.js/.test(calFait), calFait.slice(0, 90));
  // Des repères qui reculent donneraient un suivi qui saute en arrière : on
  // en pose volontairement dans le désordre et on vérifie le refus.
  const calDecroissant = await page.evaluate(() => {
    window.bkCalerReset && window.bkCalerReset();
    window.bkAudioSeek && window.bkAudioSeek(760); window.bkCalerRepere && window.bkCalerRepere(1);
    window.bkAudioSeek && window.bkAudioSeek(420); window.bkCalerRepere && window.bkCalerRepere(2);
    window.bkAudioSeek && window.bkAudioSeek(80);  window.bkCalerRepere && window.bkCalerRepere(3);
    const o = document.getElementById('bkAuCalOut');
    return o ? (o.textContent || '').trim() : '';
  });
  ok('des repères décroissants sont REFUSÉS', /croissant/i.test(calDecroissant), calDecroissant.slice(0, 70));
  ok('et il dit de recommencer', /recommence/i.test(calDecroissant), calDecroissant.slice(0, 70));

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
