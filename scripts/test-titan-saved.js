// Messages de Titan enregistrés en favoris — parcours complet dans un vrai
// Chromium (375×667 puis 320×568). Playwright n'est volontairement pas dans
// package.json : `npm i -D playwright --no-save`.
//   node scripts/test-titan-saved.js [autre.html]
//
// Ce que ce harnais protège, et qui n'est vérifiable qu'au navigateur :
//   - l'action n'existe que sur les messages de Titan ;
//   - la zone tactile atteint 44 px sans alourdir la conversation ;
//   - six taps rapides ne créent jamais deux entrées (identifiant = hash) ;
//   - un favori survit au rechargement ET à l'effacement du chat, parce
//     qu'il porte son propre texte (ah_titan_chat ne garde que 40 messages) ;
//   - le retour au message d'origine défile et met en évidence, ou le dit.
const fs = require('fs'), http = require('http'), path = require('path');
const REPO = path.join(__dirname, '..');
const HTML = process.argv[2] || path.join(REPO, 'index.html');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('Playwright absent — npm i -D playwright --no-save'); process.exit(0); }
chromium = chromium || null;
const MIME = { '.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.png':'image/png' };
(async () => {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]);
    const f = (rel === '/index.html') ? HTML : path.join(REPO, rel);
    // Le fichier HTML explicitement passé en argument peut vivre hors du dépôt
    // (contre-épreuve sur une variante) ; tout le reste doit y rester.
    if ((f !== HTML && !f.startsWith(REPO)) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
      res.writeHead(404); return res.end();
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  });
  await new Promise(r => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await browser.newPage({ viewport: { width: 375, height: 667 }, deviceScaleFactor: 2 });
  const cdp = await page.context().newCDPSession(page);
  const KEEP = process.env.KEEP_SHOTS === '1';
  const OUT = path.join(REPO, '.tmp-titan-saved');
  if (KEEP && !fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
  const shot = async f => {
    if (!KEEP) return;
    const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(OUT, path.basename(f)), Buffer.from(data, 'base64'));
  };
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto(base + '/index.html', { waitUntil: 'domcontentloaded' });
  // Sur une base qui ne porte pas encore la fonctionnalité, on veut un
  // échec LISIBLE, pas une exception de timeout.
  try {
    await page.waitForFunction(() => typeof window.titanToggleSave === 'function', { timeout: 20000 });
  } catch (e) {
    console.log('  FAIL  la fonctionnalité « messages enregistrés » est absente de cette base');
    console.log('\n' + '='.repeat(58));
    console.log('RÉSULTAT : 1 ÉCHEC(S) sur 1');
    await browser.close(); server.close();
    process.exit(1);
  }

  const R = []; const ok = (l,c,d) => { R.push(c); console.log((c?'  PASS  ':'  FAIL  ')+l+(d&&!c?'  → '+d:'')); };

  // Une conversation réaliste dans le stockage, puis ouverture du chat.
  await page.evaluate(() => {
    localStorage.setItem('ah_titan_chat', JSON.stringify([
      { role:'user', content:'Comment progresser en détente ?' },
      { role:'assistant', content:'La détente se gagne avec la **pliométrie** ET la force. Les deux.' },
      { role:'user', content:'Et la récup ?' },
      { role:'assistant', content:'48 h entre deux séances plio. Ton système nerveux a besoin de ce temps.' }
    ]));
    localStorage.removeItem('ah_titan_saved');
    document.querySelectorAll('.scr').forEach(v => { v.style.display='none'; v.classList.remove('on'); });
    document.querySelectorAll('.view').forEach(v => { v.style.display=''; v.classList.remove('on'); });
    window.switchTab('chat');
  });
  await page.waitForTimeout(400);

  console.log('\n=== 1 · L\'ACTION EXISTE, ET SEULEMENT SUR TITAN ===\n');
  let st = await page.evaluate(() => ({
    titan: document.querySelectorAll('#chatBody .msg.titan').length,
    user: document.querySelectorAll('#chatBody .msg.user').length,
    btnsTitan: document.querySelectorAll('#chatBody .msg.titan .msg-save').length,
    btnsUser: document.querySelectorAll('#chatBody .msg.user .msg-save').length,
    label: (document.querySelector('#chatBody .msg.titan .msg-save')||{}).textContent,
    badge: document.getElementById('chSavedCount').style.display
  }));
  ok('chaque message Titan a son action', st.btnsTitan === st.titan && st.titan === 2, JSON.stringify(st));
  ok('aucun message utilisateur n\'en a', st.btnsUser === 0 && st.user === 2, JSON.stringify(st));
  ok('libellé initial « ☆ Enregistrer »', /☆/.test(st.label) && /Enregistrer$/.test(st.label), st.label);
  ok('compteur masqué quand rien n\'est enregistré', st.badge === 'none', st.badge);

  // Zone tactile réelle du bouton (pseudo-élément inclus).
  const hit = await page.evaluate(() => {
    const b = document.querySelector('#chatBody .msg.titan .msg-save');
    const r = b.getBoundingClientRect();
    const cs = getComputedStyle(b, '::after');
    const grow = (p) => Math.abs(parseFloat(cs[p]) || 0);
    return { h: r.height + grow('top') + grow('bottom'), w: r.width + grow('left') + grow('right') };
  });
  ok('zone tactile ≥ 44 px de haut', hit.h >= 44, Math.round(hit.h) + 'px');
  await shot(__dirname + '/fav-1-chat.png');

  console.log('\n=== 2 · ENREGISTRER, PUIS RETIRER ===\n');
  await page.evaluate(() => document.querySelectorAll('#chatBody .msg.titan .msg-save')[0].click());
  await page.waitForTimeout(200);
  st = await page.evaluate(() => {
    const b = document.querySelectorAll('#chatBody .msg.titan .msg-save')[0];
    return { label: b.textContent, on: b.classList.contains('on'), aria: b.getAttribute('aria-pressed'),
             badge: document.getElementById('chSavedCount').textContent,
             badgeShown: document.getElementById('chSavedCount').style.display !== 'none',
             store: JSON.parse(localStorage.getItem('ah_titan_saved') || '[]') };
  });
  ok('le bouton passe à « ★ Enregistré »', /★/.test(st.label) && /Enregistré$/.test(st.label), st.label);
  ok('  et prend l\'état visuel actif', st.on === true && st.aria === 'true');
  ok('le compteur d\'en-tête s\'affiche à 1', st.badgeShown && st.badge === '1', st.badge);
  ok('une seule entrée stockée', st.store.length === 1, JSON.stringify(st.store));
  ok('  elle porte son propre texte', /pliométrie/.test(st.store[0].text), st.store[0].text);
  ok('  un id et une date', !!st.store[0].id && /^\d{4}-/.test(st.store[0].savedAt), JSON.stringify(st.store[0]));

  // §6 — multi-clic rapide ne doit jamais dupliquer.
  await page.evaluate(() => {
    const b = document.querySelectorAll('#chatBody .msg.titan .msg-save')[1];
    for (let i = 0; i < 6; i++) b.click();   // pair → doit finir NON enregistré
  });
  await page.waitForTimeout(200);
  st = await page.evaluate(() => ({
    store: JSON.parse(localStorage.getItem('ah_titan_saved') || '[]'),
    label: document.querySelectorAll('#chatBody .msg.titan .msg-save')[1].textContent
  }));
  ok('6 taps successifs ne créent aucun doublon', st.store.length === 1, JSON.stringify(st.store.map(e=>e.id)));
  ok('  et l\'état final est cohérent (pair → non enregistré)', /☆/.test(st.label), st.label);

  await page.evaluate(() => document.querySelectorAll('#chatBody .msg.titan .msg-save')[1].click());
  await page.waitForTimeout(150);
  const ids = await page.evaluate(() => JSON.parse(localStorage.getItem('ah_titan_saved')||'[]').map(e => e.id));
  ok('deux messages différents → deux entrées distinctes',
     ids.length === 2 && ids[0] !== ids[1], JSON.stringify(ids));

  console.log('\n=== 3 · LA LISTE ===\n');
  await page.evaluate(() => window.titanOpenSaved());
  await page.waitForTimeout(350);
  const sheet = await page.evaluate(() => {
    const ov = document.getElementById('titanSavedOv');
    const items = document.querySelectorAll('#tsvList .tsv-item');
    const b = document.getElementById('tsvList').getBoundingClientRect();
    return { open: ov.classList.contains('on'), n: items.length,
             count: document.getElementById('tsvCount').textContent,
             first: items[0] ? items[0].textContent.replace(/\s+/g,' ').trim() : null,
             all: document.getElementById('tsvList').textContent,
             html: document.getElementById('tsvList').innerHTML,
             toasts: document.querySelectorAll('#toastContainer .toast').length,
             withinViewport: b.bottom <= 667 + 1 };
  });
  ok('la feuille s\'ouvre', sheet.open === true);
  ok('elle liste les 2 messages', sheet.n === 2, String(sheet.n));
  ok('le compteur est écrit', /2 messages/.test(sheet.count), sheet.count);
  ok('chaque entrée porte « Titan », une date et le texte',
     /Titan/.test(sheet.first) && /Aujourd'hui/.test(sheet.first) && /pliométrie|48 h/.test(sheet.first), sheet.first);
  ok('le markdown est rendu, pas affiché brut',
     !/\*\*/.test(sheet.all) && /<strong>/.test(sheet.html), sheet.all);
  ok('  aucun toast ne recouvre la conversation', sheet.toasts === 0, String(sheet.toasts));
  ok('elle propose de revenir à la conversation', /Voir dans la conversation/.test(sheet.first), sheet.first);
  ok('la feuille tient dans l\'écran', sheet.withinViewport === true);
  await shot(__dirname + '/fav-2-liste.png');

  console.log('\n=== 4 · RETOUR AU MESSAGE D\'ORIGINE ===\n');
  await page.evaluate(() => document.querySelectorAll('#tsvList .tsv-item')[1].click());
  await page.waitForTimeout(500);
  const back = await page.evaluate(() => {
    const hl = document.querySelector('#chatBody .msg.msg-hl');
    return { sheetClosed: !document.getElementById('titanSavedOv').classList.contains('on'),
             highlighted: !!hl, txt: hl ? hl.querySelector('.msg-bubble').textContent.slice(0, 40) : null };
  });
  ok('la feuille se referme', back.sheetClosed === true);
  ok('le message d\'origine est mis en évidence', back.highlighted === true);
  ok('  et c\'est le bon', /pliométrie/.test(back.txt || ''), back.txt);
  await shot(__dirname + '/fav-3-retour.png');
  await page.waitForTimeout(2300);
  ok('la mise en évidence est temporaire',
     await page.evaluate(() => !document.querySelector('#chatBody .msg.msg-hl')));

  console.log('\n=== 5 · PERSISTANCE ===\n');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.titanToggleSave === 'function', { timeout: 20000 });
  await page.evaluate(() => {
    document.querySelectorAll('.scr').forEach(v => { v.style.display='none'; v.classList.remove('on'); });
    document.querySelectorAll('.view').forEach(v => { v.style.display=''; v.classList.remove('on'); });
    window.switchTab('chat');
  });
  await page.waitForTimeout(400);
  const afterReload = await page.evaluate(() => ({
    store: JSON.parse(localStorage.getItem('ah_titan_saved') || '[]').length,
    badge: document.getElementById('chSavedCount').textContent,
    onBtns: document.querySelectorAll('#chatBody .msg-save.on').length,
    payload: (function(){ try { return Object.keys(window._fbCollectPayload ? window._fbCollectPayload() : {}); } catch(e){ return []; } })()
  }));
  ok('les favoris survivent au rechargement', afterReload.store === 2, String(afterReload.store));
  ok('le compteur est correct', afterReload.badge === '2', afterReload.badge);
  ok('les boutons retrouvent leur état ★', afterReload.onBtns === 2, String(afterReload.onBtns));
  ok('la clé part bien vers Firestore', afterReload.payload.indexOf('titanSaved') > -1, afterReload.payload.join(','));

  console.log('\n=== 6 · CAS LIMITES ===\n');
  // Message enregistré puis sorti de la conversation.
  await page.evaluate(() => { window.resetTitanChat(); });
  await page.waitForTimeout(200);
  const afterReset = await page.evaluate(() => ({
    store: JSON.parse(localStorage.getItem('ah_titan_saved') || '[]').length,
    badge: document.getElementById('chSavedCount').textContent,
    welcomeHasBtn: !!document.querySelector('#chatBody .msg.titan .msg-save')
  }));
  ok('effacer le chat ne supprime pas les favoris', afterReset.store === 2, String(afterReset.store));
  ok('le message d\'accueil a lui aussi son action', afterReset.welcomeHasBtn === true);
  await page.evaluate(() => window.titanOpenSaved());
  await page.waitForTimeout(250);
  const orphan = await page.evaluate(() => {
    const t = document.querySelectorAll('#tsvList .tsv-item')[0].textContent;
    return { txt: t.replace(/\s+/g,' ').trim() };
  });
  ok('un favori sans message à l\'écran le dit franchement',
     /Plus dans la conversation/.test(orphan.txt), orphan.txt.slice(0, 90));
  await page.evaluate(() => { document.querySelectorAll('#tsvList .tsv-item')[0].click(); });
  await page.waitForTimeout(300);
  ok('  et cliquer dessus ne fait pas défiler dans le vide',
     await page.evaluate(() => document.getElementById('titanSavedOv').classList.contains('on')));
  // Retrait depuis la liste
  await page.evaluate(() => document.querySelectorAll('#tsvList .tsv-rm')[0].click());
  await page.waitForTimeout(250);
  const removed = await page.evaluate(() => ({
    store: JSON.parse(localStorage.getItem('ah_titan_saved') || '[]').length,
    n: document.querySelectorAll('#tsvList .tsv-item').length,
    badge: document.getElementById('chSavedCount').textContent
  }));
  ok('« Retirer » depuis la liste supprime l\'entrée', removed.store === 1 && removed.n === 1, JSON.stringify(removed));
  ok('  et le compteur suit', removed.badge === '1', removed.badge);
  await page.evaluate(() => document.querySelectorAll('#tsvList .tsv-rm')[0].click());
  await page.waitForTimeout(250);
  ok('liste vide → message d\'explication, pas un écran blanc',
     await page.evaluate(() => !!document.querySelector('#tsvList .tsv-empty')));
  ok('  et le compteur disparaît',
     await page.evaluate(() => document.getElementById('chSavedCount').style.display === 'none'));
  await shot(__dirname + '/fav-4-vide.png');

  console.log('\n=== 7 · RIEN N\'EST CASSÉ ===\n');
  ok('aucune exception JS', errs.filter(e => !/firebase|fetch|ServiceWorker/i.test(e)).length === 0,
     errs.slice(0,2).join(' | '));

  console.log('\n=== 8 · PETIT ÉCRAN (320×568) ===\n');
  {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.evaluate(() => {
      localStorage.setItem('ah_titan_chat', JSON.stringify([
        { role:'assistant', content:'Trois séries de squats lourds, puis du saut. Repos complet entre les deux.' }
      ]));
      document.querySelectorAll('.scr').forEach(v => { v.style.display='none'; v.classList.remove('on'); });
      window.switchTab('chat');
    });
    await page.waitForTimeout(350);
    await page.evaluate(() => document.querySelector('#chatBody .msg.titan .msg-save').click());
    await page.evaluate(() => window.titanOpenSaved());
    await page.waitForTimeout(350);
    const m = await page.evaluate(() => {
      const b = document.querySelector('#chatBody .msg.titan .msg-save').getBoundingClientRect();
      const sheet = document.querySelector('.tsv-sheet').getBoundingClientRect();
      const title = document.querySelector('.tsv-title').getBoundingClientRect();
      return { btnRight: b.right, sheetOk: sheet.bottom <= 568 + 1 && sheet.left >= -1,
               titleLines: Math.round(title.height / 24),
               bodyScrollX: document.documentElement.scrollWidth - document.documentElement.clientWidth };
    });
    ok('l\'action reste dans l\'écran', m.btnRight <= 320, String(Math.round(m.btnRight)));
    ok('la feuille tient dans l\'écran', m.sheetOk === true);
    ok('le titre tient sur une ligne', m.titleLines <= 1, String(m.titleLines));
    ok('aucun débordement horizontal de la page', m.bodyScrollX <= 0, String(m.bodyScrollX));
    await shot('fav-5-320.png');
  }

  const bad = R.filter(x => !x).length;
  console.log('\n' + '='.repeat(58));
  console.log(bad ? 'RÉSULTAT : ' + bad + ' ÉCHEC(S) sur ' + R.length : 'RÉSULTAT : ' + R.length + '/' + R.length + ' tests passés.');
  await browser.close(); server.close();
  process.exit(bad ? 1 : 0);
})();
