// Les cartes livre dans le chat de Titan — vrai Chromium.
// Ce qu'on protège, dans l'ordre d'importance :
//   1. LA CARTE NE PROMET QUE CE QUE L'EXTRAIT CONTIENT. L'extrait s'arrête
//      page 44 : les 8 Lois y sont, aucun Cours n'y est. Dire « la réponse est
//      dans l'extrait » sur une question de pliométrie serait faux, et un coach
//      qui ment une fois n'est plus cru ensuite.
//   2. Elle vit HORS de la bulle — le texte de Titan n'est jamais commercial.
//   3. Elle est RARE : une par 24 h, jamais deux réponses de suite, jamais à
//      quelqu'un qui possède déjà le livre.
//   node scripts/test-titan-book-card.js [autre.html]
const fs = require('fs'), http = require('http'), path = require('path');
const REPO = path.join(__dirname, '..');
const HTML = process.argv[2] || path.join(REPO, 'index.html');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('Playwright absent — npm i -D playwright --no-save'); process.exit(0); }
const MIME = { '.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.png':'image/png' };

(async () => {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]);
    const f = (rel === '/index.html') ? HTML : path.join(REPO, rel);
    if ((f !== HTML && !f.startsWith(REPO)) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  });
  await new Promise(r => server.listen(0, r));
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await browser.newPage({ viewport: { width: 375, height: 667 }, deviceScaleFactor: 2 });
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  const R = []; const ok = (l, c, d) => { R.push(c); console.log((c ? '  PASS  ' : '  FAIL  ') + l + (d && !c ? '  → ' + String(d) : '')); };

  await page.goto('http://127.0.0.1:' + server.address().port + '/index.html', { waitUntil: 'domcontentloaded' });
  try { await page.waitForFunction(() => typeof window._tbChoisir === 'function', { timeout: 20000 }); }
  catch (e) {
    console.log('  FAIL  cette base n\'a pas les cartes livre de Titan');
    console.log('\n' + '='.repeat(58) + '\nRÉSULTAT : 1 ÉCHEC(S) sur 1');
    await browser.close(); server.close(); process.exit(1);
  }

  // Pose l'état, puis demande au VRAI sélecteur ce qu'il proposerait.
  const choisir = (q, prof, bk, promo, tour) => page.evaluate(([q, prof, bk, promo, tour]) => {
    localStorage.setItem('ah_profile', JSON.stringify(prof || {}));
    if (bk) localStorage.setItem('ah_book_excerpt', JSON.stringify(bk)); else localStorage.removeItem('ah_book_excerpt');
    if (promo) localStorage.setItem('ah_book_promo', JSON.stringify(promo)); else localStorage.removeItem('ah_book_promo');
    window._tbTour = tour || 1;
    return window._tbChoisir(q);
  }, [q, prof, bk, promo, tour]);

  // ── La règle qui compte : ne promettre que ce qui est dans l'extrait ───
  console.log('\n── La carte ne promet que ce que l\'extrait contient ──');
  const lois = await choisir('c\'est quoi les 8 lois de la détente verticale ?');
  ok('un sujet des 8 Lois déclenche une carte', !!lois, lois);
  // Les 8 Lois sont p.35-44 : elles SONT dans l'extrait. On peut le dire.
  ok('elle annonce que c\'est dans l\'extrait gratuit', !!lois && /extrait gratuit/i.test(lois.eyebrow), lois && lois.eyebrow);
  ok('elle porte la page réelle du livre', !!lois && /p\. 35/.test(lois.ref || ''), lois && lois.ref);
  ok('elle ouvre directement le bon passage', !!lois && lois.page === 35, lois && lois.page);

  const plio = await choisir('comment je progresse en pliométrie ?');
  ok('un sujet de Cours déclenche aussi une carte', !!plio, plio);
  // Le Cours 7 est p.101 : HORS extrait. Prétendre le contraire serait faux.
  ok('elle NE dit PAS que c\'est dans l\'extrait', !!plio && !/extrait gratuit/i.test(plio.eyebrow), plio && plio.eyebrow);
  ok('elle situe la réponse dans le livre', !!plio && /dans le livre/i.test(plio.eyebrow), plio && plio.eyebrow);
  ok('elle le dit aussi en toutes lettres', !!plio && /ne va pas jusque-là/i.test(plio.txt), plio && plio.txt);
  ok('elle marque la référence « hors extrait »', !!plio && /hors extrait/i.test(plio.ref || ''), plio && plio.ref);
  ok('elle porte la page réelle du Cours', !!plio && /p\. 101/.test(plio.ref || ''), plio && plio.ref);

  const nutri = await choisir('parle moi de nutrition et récupération');
  ok('le Cours 12 est reconnu et situé hors extrait',
    !!nutri && /dans le livre/i.test(nutri.eyebrow) && /p\. 162/.test(nutri.ref || ''), nutri && nutri.ref);

  // Vérifié exhaustivement : AUCUNE section au-delà de la page 44 ne peut
  // produire une carte « dans l'extrait ».
  const jamaisFaux = await page.evaluate(() => {
    const n = window.BOOK_EXCERPT.length;
    return Object.keys(BOOK_CHAPTERS).filter((k) => {
      const ch = BOOK_CHAPTERS[k];
      if (ch.page <= n) return false;
      localStorage.removeItem('ah_book_promo'); localStorage.setItem('ah_profile', '{}');
      localStorage.removeItem('ah_book_excerpt'); window._tbTour = 1;
      const c = window._tbChoisir(ch.titre);
      return c && /extrait gratuit/i.test(c.eyebrow);
    });
  });
  ok('AUCUN des 24 chapitres hors extrait ne prétend y être', jamaisFaux.length === 0, jamaisFaux.join(', '));

  // ── Hors sujet ─────────────────────────────────────────────────────────
  console.log('\n── Hors sujet : silence ──');
  ok('un bug de l\'app ne déclenche rien', (await choisir('l\'app plante quand je clique')) === null);
  ok('une question de matériel ne déclenche rien', (await choisir('quelles chaussures acheter ?')) === null);

  // ── Jamais à qui possède le livre ─────────────────────────────────────
  console.log('\n── Celui qui a le livre ne se voit rien vendre ──');
  ok('aucune carte si hasBookAccess', (await choisir('c\'est quoi les 8 lois ?', { hasBookAccess: true })) === null);
  ok('même une fois l\'extrait terminé',
    (await choisir('pliométrie', { hasBookAccess: true }, { page: 44, done: true, fs: 1 })) === null);

  // ── L'achat n'arrive qu'après l'extrait ───────────────────────────────
  console.log('\n── L\'achat ne se propose qu\'après l\'extrait ──');
  const avant = await choisir('pliométrie', {}, { page: 20, done: false, fs: 1 });
  ok('extrait commencé mais non fini → on propose de LIRE', !!avant && avant.kind === 'read', avant && avant.kind);
  const apres = await choisir('pliométrie', {}, { page: 44, done: true, fs: 1 });
  ok('extrait terminé → on propose d\'ACHETER', !!apres && apres.kind === 'buy', apres && apres.kind);
  ok('la carte d\'achat dit ce qui reste dans le livre',
    !!apres && /Cours|MENER|programmes/i.test(apres.txt), apres && apres.txt);

  // ── Les plafonds ───────────────────────────────────────────────────────
  console.log('\n── Une carte par 24 h, jamais deux de suite ──');
  ok('une carte il y a 3 h bloque la suivante',
    (await choisir('les 8 lois', {}, null, { lastAt: Date.now() - 3 * 3600e3 }, 5)) === null);
  ok('au-delà de 24 h, une carte redevient possible',
    !!(await choisir('les 8 lois', {}, null, { lastAt: Date.now() - 25 * 3600e3 }, 5)));
  ok('une carte écartée fait taire pendant 24 h',
    (await choisir('les 8 lois', {}, null, { dismissedAt: Date.now() - 3600e3 }, 5)) === null);
  ok('deux réponses de suite ne portent pas deux cartes',
    (await choisir('les 8 lois', {}, null, { lastTurn: 7 }, 7)) === null);

  // ── Le rendu : hors de la bulle ────────────────────────────────────────
  console.log('\n── La carte vit hors de la bulle ──');
  const rendu = await page.evaluate(() => {
    localStorage.setItem('ah_profile', '{}');
    localStorage.removeItem('ah_book_promo'); localStorage.removeItem('ah_book_excerpt');
    window._tbTour = 1;
    window.switchTab('chat');
    const body = document.getElementById('chatBody');
    const avant = body.querySelectorAll('.msg').length;
    window._titanRenderBookCard('c\'est quoi les 8 lois ?');
    const carte = body.querySelector('.tb-card:not(.tb-hello)');
    const bulles = [...body.querySelectorAll('.msg-bubble')].map((b) => b.textContent).join(' ');
    return {
      rendue: !!carte,
      ajoutee: body.querySelectorAll('.msg').length - avant,
      dansBulle: !!body.querySelector('.msg-bubble .tb-card'),
      promoDansTexte: /amazon|acheter|obtenir le livre/i.test(bulles),
      h: carte ? Math.round(carte.getBoundingClientRect().height) : 0,
      largeur: carte ? Math.round(carte.getBoundingClientRect().width / body.clientWidth * 100) : 0,
      cta: (body.querySelector('.tb-go') || {}).textContent,
      fermable: !!body.querySelector('.tb-x')
    };
  });
  ok('la carte est rendue', rendu.rendue === true);
  ok('elle est réellement peinte', rendu.h > 60, rendu.h + 'px');
  ok('elle est AJOUTÉE sous la réponse, pas dedans', rendu.ajoutee === 1 && rendu.dansBulle === false);
  // Le texte de Titan ne doit jamais devenir commercial : c'est le client qui
  // propose, le modèle ne sait même pas que la carte existe.
  ok('aucune bulle de Titan ne contient de promotion', rendu.promoDansTexte === false);
  ok('elle ne prend pas toute la largeur', rendu.largeur <= 90, rendu.largeur + '%');
  ok('elle porte une action explicite', /lire|obtenir/i.test(rendu.cta || ''), rendu.cta);
  ok('elle est fermable', rendu.fermable === true);

  const ferme = await page.evaluate(() => {
    document.querySelector('.tb-x').click();
    const st = JSON.parse(localStorage.getItem('ah_book_promo') || '{}');
    return { partie: !document.querySelector('.tb-card:not(.tb-hello)'), note: !!st.dismissedAt };
  });
  ok('la fermer la retire', ferme.partie === true);
  ok('la fermeture est mémorisée', ferme.note === true);

  // ── Deux moments de plus, tous les deux réels ─────────────────────────
  // Le bouton 📖 de l'en-tête fait 24 px parmi quatre icônes et les cartes
  // contextuelles sont plafonnées à une par 24 h : sans ces deux moments,
  // l'extrait est en pratique invisible depuis le chat.
  console.log('\n── Le chat s\'ouvre sur un fil vierge ──');
  const hello = await page.evaluate(() => {
    localStorage.setItem('ah_profile', '{}');
    localStorage.removeItem('ah_titan_chat'); localStorage.removeItem('ah_book_excerpt');
    document.querySelectorAll('.tb-wrap').forEach((e) => e.remove());
    window.switchTab('home'); window.switchTab('chat');
    const c = document.querySelector('.tb-hello');
    return c ? { txt: c.textContent.replace(/\s+/g, ' ').trim(), croix: !!c.querySelector('.tb-x'),
                 h: Math.round(c.getBoundingClientRect().height) } : null;
  });
  await page.waitForTimeout(250);
  ok('une carte d\'accueil propose l\'extrait', !!hello, hello);
  ok('elle est réellement peinte', !!hello && hello.h > 60, hello && hello.h);
  ok('elle annonce que c\'est gratuit', !!hello && /gratuit/i.test(hello.txt), hello && hello.txt.slice(0, 60));
  // Pas de croix : elle n'encombre rien, elle remonte avec le fil au premier
  // message. Une croix demanderait un état à mémoriser pour rien.
  ok('elle n\'a pas de croix — elle remonte avec le fil', !!hello && hello.croix === false);

  const reprise = await page.evaluate(() => {
    localStorage.setItem('ah_book_excerpt', JSON.stringify({ page: 17, done: false, fs: 1 }));
    document.querySelectorAll('.tb-wrap').forEach((e) => e.remove());
    window.switchTab('home'); window.switchTab('chat');
    const c = document.querySelector('.tb-hello');
    return c ? { txt: c.textContent.replace(/\s+/g, ' ').trim(), barre: !!c.querySelector('.tb-bar > i') } : null;
  });
  ok('lecture entamée : elle dit où on en est', !!reprise && /page 17 sur 44/.test(reprise.txt), reprise && reprise.txt);
  ok('et montre la progression', !!reprise && reprise.barre === true);

  // Le fil est entamé → la carte d'accueil n'a plus lieu d'être.
  const filEntame = await page.evaluate(() => {
    localStorage.setItem('ah_titan_chat', JSON.stringify([
      { role: 'user', content: 'salut', t: Date.now() - 60000 },
      { role: 'assistant', content: 'Yo.', t: Date.now() }]));
    document.querySelectorAll('.tb-wrap').forEach((e) => e.remove());
    window.switchTab('home'); window.switchTab('chat');
    return !document.querySelector('.tb-hello');
  });
  await page.waitForTimeout(250);
  ok('sur un fil déjà entamé, aucune carte d\'accueil', filEntame === true);
  await page.evaluate(() => localStorage.removeItem('ah_titan_chat'));

  console.log('\n── Le quota est atteint ──');
  // Le meilleur moment de toute l'app : l'athlète en veut plus, Titan n'a plus
  // rien. Avant, on répondait « Reviens demain » et on ne proposait RIEN.
  const quota = await page.evaluate(() => {
    localStorage.setItem('ah_profile', '{}');
    localStorage.removeItem('ah_book_excerpt');
    localStorage.setItem('ah_book_promo', JSON.stringify({ lastAt: Date.now() }));  // plafond armé
    document.querySelectorAll('.tb-wrap').forEach((e) => e.remove());
    if (window._titanRenderQuotaCard) window._titanRenderQuotaCard(); else return null;
    const c = document.querySelector('.tb-card');
    return c ? { txt: c.textContent.replace(/\s+/g, ' ').trim(), cta: (c.querySelector('.tb-go') || {}).textContent } : null;
  });
  ok('une carte est proposée quand le quota tombe', !!quota, quota);
  // Elle ignore VOLONTAIREMENT le plafond de 24 h : ce n'est pas une réclame,
  // c'est une réponse à « je veux plus » quand Titan ne peut plus donner.
  ok('elle passe outre le plafond de 24 h', !!quota);
  ok('elle nomme la limite de Titan', !!quota && /limite/i.test(quota.txt), quota && quota.txt.slice(0, 70));
  ok('elle oppose le livre, qui n\'en a pas', !!quota && /n'en a pas|pas de limite/i.test(quota.txt), quota && quota.txt);
  ok('elle propose de lire', !!quota && /lire/i.test(quota.cta || ''), quota && quota.cta);

  const quotaLivre = await page.evaluate(() => {
    localStorage.setItem('ah_profile', JSON.stringify({ hasBookAccess: true }));
    document.querySelectorAll('.tb-wrap').forEach((e) => e.remove());
    if (window._titanRenderQuotaCard) window._titanRenderQuotaCard(); else return null;
    return !document.querySelector('.tb-card');
  });
  ok('rien pour qui possède déjà le livre, même à quota épuisé', quotaLivre === true);

  const quotaFini = await page.evaluate(() => {
    localStorage.setItem('ah_profile', '{}');
    localStorage.setItem('ah_book_excerpt', JSON.stringify({ page: 44, done: true, fs: 1 }));
    document.querySelectorAll('.tb-wrap').forEach((e) => e.remove());
    if (window._titanRenderQuotaCard) window._titanRenderQuotaCard(); else return null;
    const c = document.querySelector('.tb-card');
    return c ? (c.querySelector('.tb-go') || {}).textContent : null;
  });
  ok('extrait déjà lu : on propose le livre, pas de le relire', /obtenir/i.test(quotaFini || ''), quotaFini);

  // ── Contraste ──────────────────────────────────────────────────────────
  console.log('\n── Contraste ──');
  await page.evaluate(() => {
    localStorage.setItem('ah_profile', '{}'); localStorage.removeItem('ah_book_excerpt');
    localStorage.removeItem('ah_book_promo'); window._tbTour = 99;
    document.querySelectorAll('.tb-wrap').forEach((e) => e.remove());
    window._titanRenderBookCard('les 8 lois');
    if (window._titanRenderHelloCard) window._titanRenderHelloCard();
  });
  const c = await page.evaluate(() => {
    const lum = (col) => { const m = col.match(/[\d.]+/g).map(Number);
      const f = m.slice(0, 3).map(v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); });
      return .2126 * f[0] + .7152 * f[1] + .0722 * f[2]; };
    const solide = (e) => { for (let n = e; n; n = n.parentElement) {
      const bg = getComputedStyle(n).backgroundColor, m = bg.match(/[\d.]+/g);
      if (m && (m.length < 4 || Number(m[3]) > .9) && bg !== 'rgba(0, 0, 0, 0)') return bg; } return 'rgb(255,255,255)'; };
    const r = (sel) => { const e = document.querySelector(sel); if (!e) return null;
      const st = getComputedStyle(e); let fonds = [solide(e)];
      if (st.backgroundImage && st.backgroundImage !== 'none')
        (st.backgroundImage.match(/rgba?\([^)]+\)/g) || []).forEach((x) => fonds.push(x));
      let pire = Infinity;
      fonds.forEach((bg) => { const l1 = lum(st.color), l2 = lum(bg);
        pire = Math.min(pire, (Math.max(l1, l2) + .05) / (Math.min(l1, l2) + .05)); });
      return Math.round(pire * 100) / 100; };
    const hello = document.querySelector('.tb-hello');
    const rh = (sel) => { const e = hello && hello.querySelector(sel); if (!e) return null;
      const st = getComputedStyle(e); let fonds = [solide(e)];
      if (st.backgroundImage && st.backgroundImage !== 'none')
        (st.backgroundImage.match(/rgba?\([^)]+\)/g) || []).forEach((x) => fonds.push(x));
      let pire = Infinity;
      fonds.forEach((bg) => { const l1 = lum(st.color), l2 = lum(bg);
        pire = Math.min(pire, (Math.max(l1, l2) + .05) / (Math.min(l1, l2) + .05)); });
      return Math.round(pire * 100) / 100; };
    return { eyebrow: r('.tb-eyebrow'), txt: r('.tb-txt'), cta: r('.tb-go'),
             helloTxt: rh('.tb-txt'), helloEye: rh('.tb-eyebrow') };
  });
  ok('l\'en-tête ≥ 4.5:1', c.eyebrow >= 4.5, c.eyebrow);
  ok('le texte ≥ 4.5:1', c.txt >= 4.5, c.txt);
  ok('le bouton ≥ 4.5:1', c.cta >= 4.5, c.cta);
  // La variante d'accueil a son propre fond : `background: <dégradé>` écrasait
  // la surface opaque et laissait du texte sombre sur le navy du chat.
  ok('le texte de la carte d\'accueil ≥ 4.5:1', c.helloTxt === null || c.helloTxt >= 4.5, c.helloTxt);
  ok('son en-tête ≥ 4.5:1', c.helloEye === null || c.helloEye >= 4.5, c.helloEye);

  ok('aucune erreur JS sur tout le parcours', errs.length === 0, errs.join(' | '));

  const echecs = R.filter(x => !x).length;
  console.log('\n' + '='.repeat(58));
  console.log(echecs ? ('RÉSULTAT : ' + echecs + ' ÉCHEC(S) sur ' + R.length)
                     : ('RÉSULTAT : ' + R.length + '/' + R.length + ' — tout est vert'));
  await browser.close(); server.close();
  process.exit(echecs ? 1 : 0);
})();
