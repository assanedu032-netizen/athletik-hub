// Lecteur du livre — les 44 pages de l'extrait, dans un vrai Chromium.
// Ce qu'on protège :
//   1. L'extrait s'arrête à 44 pages, et c'est la DONNÉE qui le garantit —
//      il n'existe aucune page 45 à aller chercher.
//   2. L'appel à l'achat n'arrive qu'à la fin, et jamais à qui a déjà le livre.
//   3. La lecture reprend où elle s'est arrêtée.
//   node scripts/test-book-reader.js [autre.html]
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
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await browser.newPage({ viewport: { width: 375, height: 667 }, deviceScaleFactor: 2 });
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  const R = []; const ok = (l, c, d) => { R.push(c); console.log((c ? '  PASS  ' : '  FAIL  ') + l + (d && !c ? '  → ' + String(d) : '')); };

  await page.goto(base + '/index.html', { waitUntil: 'domcontentloaded' });
  try { await page.waitForFunction(() => typeof window.openBookReader === 'function', { timeout: 20000 }); }
  catch (e) {
    console.log('  FAIL  cette base n\'a pas le lecteur du livre');
    console.log('\n' + '='.repeat(58) + '\nRÉSULTAT : 1 ÉCHEC(S) sur 1');
    await browser.close(); server.close(); process.exit(1);
  }
  const clic = async (s) => { try { await page.click(s, { timeout: 2000 }); } catch (e) {} await page.waitForTimeout(280); };

  async function etat(profil, bk) {
    await page.evaluate(([profil, bk]) => {
      document.querySelectorAll('.scr').forEach(v => { v.style.display = 'none'; v.classList.remove('on'); });
      localStorage.setItem('ah_profile', JSON.stringify(profil));
      if (bk) localStorage.setItem('ah_book_excerpt', JSON.stringify(bk));
      else localStorage.removeItem('ah_book_excerpt');
      window.switchTab('home');
      if (window.renderBookCard) window.renderBookCard();
    }, [profil, bk]);
    await page.waitForTimeout(260);
  }
  const lire = () => page.evaluate(() => {
    const z = document.getElementById('bookReader');
    const q = s => { const e = document.querySelector(s); return e ? e.textContent.replace(/\s+/g,' ').trim() : null; };
    const inner = document.getElementById('bkInner');
    return {
      pages: window.BOOK_EXCERPT ? window.BOOK_EXCERPT.length : 0,
      ouvert: !!(z && z.classList.contains('on') && z.getBoundingClientRect().height > 200),
      cnt: q('#bkCnt'), bar: (document.getElementById('bkBar')||{style:{}}).style.width,
      prevOff: (document.getElementById('bkPrev')||{}).disabled,
      nextOff: (document.getElementById('bkNext')||{}).disabled,
      buy: !!document.querySelector('.bk-buy'),
      end: q('.bk-end'),
      texte: inner ? inner.textContent.replace(/\s+/g,' ').trim() : '',
      fs: inner ? getComputedStyle(inner).fontSize : null,
      carte: q('#bookCardWrap .art-teaser-card'),
      done: window.bookExcerptDone ? window.bookExcerptDone() : null,
      debordeX: (document.getElementById('mainScroll')||document.body).scrollWidth - (document.getElementById('mainScroll')||document.body).clientWidth
    };
  });
  const PROFIL = { prenom:'Alassane', programKey:'vd', program:'Vertical Dunk', satDone:true };

  // ── Les données ────────────────────────────────────────────────────────
  console.log('\n── Les 44 pages sont DANS l\'app ──');
  await etat(PROFIL, null);
  let v = await lire();
  ok('l\'extrait est chargé comme donnée, pas comme PDF', v.pages === 44, v.pages + ' pages');
  // La limite est portée par la donnée : il n'existe aucune page 45.
  ok('aucune page au-delà de 44 n\'existe',
    await page.evaluate(() => !window.BOOK_EXCERPT[44]));
  ok('le texte est lisible, pas du charabia d\'encodage',
    await page.evaluate(() => {
      const t = window.BOOK_EXCERPT.map(p => p.b.map(b => b.t).join(' ')).join(' ');
      return /Détente/.test(t) && !/DÈtente|D…TENTE|estelle/.test(t);
    }));
  ok('les 8 Lois sont bien dedans — c\'est ce qui fait la valeur de l\'extrait',
    await page.evaluate(() => /Les 8 Lois de la Détente Verticale/.test(
      window.BOOK_EXCERPT.map(p => p.b.map(b => b.t).join(' ')).join(' '))));
  ok('aucun Cours n\'a fuité dans l\'extrait',
    await page.evaluate(() => !/Cours 1\s*—\s*La Périodisation/.test(
      window.BOOK_EXCERPT.slice(-3).map(p => p.b.map(b => b.t).join(' ')).join(' '))));

  // ── La mise en page : le défaut qu'on a vu sur un vrai téléphone ──────
  // Recoller toutes les lignes de même taille donnait un pavé justifié où
  // « Copyright 4 Préface - Loïc 5 Avant-Propos 7 » se lisait d'un trait.
  console.log('\n── Le texte est découpé, pas recollé en un pavé ──');
  const mep = await page.evaluate(() => {
    const B = window.BOOK_EXCERPT;
    const p2 = B[1].b, p4 = B[3].b, p5 = B[4].b;
    return {
      tocBlocs: p2.filter(b => b.k === 'toc').length,
      tocAvecNum: p2.filter(b => b.k === 'toc' && b.n).length,
      // Le pavé d'avant : une seule ligne qui contenait plusieurs entrées.
      tocRecolle: p2.some(b => b.k !== 'toc' && /Copyright.*Préface.*Avant-Propos/.test(b.t)),
      copyBlocs: p4.length,
      copyRecolle: p4.some(b => /droits réservés.*Toute reproduction.*Dépôt légal/.test(b.t)),
      prefaceParas: p5.filter(b => b.k === 'p').length,
      prefaceRecolle: p5.some(b => b.t.length > 1400)
    };
  });
  ok('la table des matières est découpée en entrées', mep.tocBlocs >= 20, mep.tocBlocs);
  ok('chaque entrée porte son numéro de page', mep.tocAvecNum === mep.tocBlocs, mep.tocAvecNum + '/' + mep.tocBlocs);
  ok('elle n\'est PLUS recollée en un seul pavé', mep.tocRecolle === false);
  ok('la page de copyright est en plusieurs paragraphes', mep.copyBlocs >= 5, mep.copyBlocs);
  ok('elle n\'est PLUS un bloc unique', mep.copyRecolle === false);
  ok('la préface garde ses paragraphes', mep.prefaceParas >= 4, mep.prefaceParas);
  ok('aucun paragraphe monstre n\'est recollé', mep.prefaceRecolle === false);

  // ── Le sommaire est un raccourci, et il montre ce qui manque ──────────
  console.log('\n── Le sommaire ──');
  await page.evaluate(() => window.openBookReader(2)); await page.waitForTimeout(320);
  const toc = await page.evaluate(() => ({
    lignes: document.querySelectorAll('#bkInner .bk-toc').length,
    cliquables: document.querySelectorAll('#bkInner button.bk-toc').length,
    estompees: document.querySelectorAll('#bkInner .bk-toc-off').length,
    premierNum: (document.querySelector('#bkInner button.bk-toc .bk-toc-n') || {}).textContent
  }));
  ok('les entrées sont rendues en lignes de sommaire', toc.lignes >= 20, toc.lignes);
  // Une entrée DANS l'extrait s'ouvre ; au-delà, elle se voit sans mentir.
  ok('celles qui sont dans l\'extrait sont cliquables', toc.cliquables >= 5, toc.cliquables);
  ok('celles qui sont hors extrait sont estompées', toc.estompees >= 10, toc.estompees);
  ok('aucune entrée hors extrait n\'est cliquable',
    await page.evaluate(() => [...document.querySelectorAll('#bkInner button.bk-toc')]
      .every(b => parseInt(b.querySelector('.bk-toc-n').textContent, 10) <= window.BOOK_EXCERPT.length)));
  await page.click('#bkInner button.bk-toc:nth-of-type(1)').catch(() => {});
  await page.waitForTimeout(300);
  ok('taper une entrée saute à sa page',
    (await lire()).cnt === (toc.premierNum || '').trim() + ' / 44', (await lire()).cnt + ' attendu ' + toc.premierNum);

  // ── La carte de la Home ────────────────────────────────────────────────
  await etat(PROFIL, null);
  v = await lire();
  console.log('\n── La carte sur la Home ──');
  ok('la carte est présente', !!v.carte, v.carte);
  ok('elle annonce un extrait gratuit', /gratuit/i.test(v.carte || ''), v.carte);
  ok('elle invite à commencer', /commencer/i.test(v.carte || ''), v.carte);
  ok('la barre du bas n\'a pas d\'onglet Livre',
    await page.evaluate(() => !/livre|extrait/i.test(
      (document.querySelector('.ah-bottomnav') || document.querySelector('nav') || {textContent:''}).textContent)));

  // ── Ouvrir et tourner les pages ────────────────────────────────────────
  console.log('\n── Ouvrir, tourner, buter ──');
  await clic('#bookCardWrap .art-teaser-card');
  v = await lire();
  ok('le lecteur s\'ouvre et est réellement peint', v.ouvert === true);
  ok('il démarre page 1', v.cnt === '1 / 44', v.cnt);
  ok('le bouton précédent est désactivé en page 1', v.prevOff === true);
  ok('la page 1 est bien la couverture', /DÉTENTE VERTICALE/.test(v.texte), v.texte.slice(0, 60));
  await page.evaluate(() => window.openBookReader(13)); await page.waitForTimeout(300);
  ok('une page de contenu porte un vrai volume de texte',
    (await lire()).texte.length > 1000, (await lire()).texte.length + ' car.');
  await page.evaluate(() => window.openBookReader(1)); await page.waitForTimeout(300);
  await clic('#bkNext'); v = await lire();
  ok('la page suivante avance', v.cnt === '2 / 44', v.cnt);
  ok('la barre de progression suit', v.bar !== '0%', v.bar);
  await clic('#bkPrev'); await clic('#bkPrev'); v = await lire();
  ok('butée basse : on ne descend pas sous 1', v.cnt === '1 / 44', v.cnt);
  await page.evaluate(() => window.openBookReader(44)); await page.waitForTimeout(300);
  await clic('#bkNext'); v = await lire();
  ok('butée haute : on ne dépasse pas 44', v.cnt === '44 / 44', v.cnt);
  ok('le bouton suivant est désactivé en page 44', v.nextOff === true);

  // ── L'appel à l'achat ──────────────────────────────────────────────────
  console.log('\n── L\'appel à l\'achat ──');
  ok('il est là en page 44', v.buy === true);
  ok('il annonce ce qui reste dans le livre', /Cours|MENER|programmes/i.test(v.end || ''), v.end);
  ok('l\'extrait est marqué terminé', v.done === true);
  await page.evaluate(() => window.openBookReader(20)); await page.waitForTimeout(300);
  v = await lire();
  ok('aucun appel à l\'achat au milieu de l\'extrait', v.buy === false, v.cnt);

  // ── Qui a déjà le livre ────────────────────────────────────────────────
  console.log('\n── L\'athlète qui a déjà le livre ──');
  await etat({ ...PROFIL, hasBookAccess: true }, { page: 44, done: true, fs: 1 });
  await page.evaluate(() => window.openBookReader(44)); await page.waitForTimeout(300);
  v = await lire();
  // Lui vendre le livre qu'il possède serait une faute, pas une occasion.
  ok('aucun bouton Amazon ne lui est montré', !/amazon/i.test(v.end || ''), v.end);
  ok('on le renvoie vers son programme', /programme/i.test(v.end || ''), v.end);

  // ── Reprise de lecture ─────────────────────────────────────────────────
  console.log('\n── La lecture reprend où elle s\'est arrêtée ──');
  await etat(PROFIL, { page: 17, done: false, fs: 1 });
  v = await lire();
  ok('la carte dit où on en est', /page 17/i.test(v.carte || ''), v.carte);
  await page.evaluate(() => window.openBookReader()); await page.waitForTimeout(300);
  v = await lire();
  ok('le lecteur rouvre à la page 17', v.cnt === '17 / 44', v.cnt);
  ok('l\'état est persisté dans ah_book_excerpt',
    await page.evaluate(() => { try { return JSON.parse(localStorage.getItem('ah_book_excerpt')).page === 17; } catch (e) { return false; } }));

  // ── Taille du texte ────────────────────────────────────────────────────
  console.log('\n── Régler la taille du texte ──');
  const t0 = (await lire()).fs;
  await clic('#bkFplus'); await clic('#bkFplus');
  const t1 = (await lire()).fs;
  ok('A+ agrandit le texte', parseFloat(t1) > parseFloat(t0), t0 + ' → ' + t1);
  await clic('#bkFmoins'); await clic('#bkFmoins'); await clic('#bkFmoins');
  const t2 = (await lire()).fs;
  ok('A− le réduit', parseFloat(t2) < parseFloat(t1), t1 + ' → ' + t2);
  ok('la taille survit à une réouverture',
    await page.evaluate(async () => {
      const a = getComputedStyle(document.getElementById('bkInner')).fontSize;
      window.closeBookReader(); window.openBookReader();
      return getComputedStyle(document.getElementById('bkInner')).fontSize === a;
    }));

  // ── Le bouton dans le chat ─────────────────────────────────────────────
  console.log('\n── Le bouton dans le chat ──');
  const chat = await page.evaluate(() => {
    const b = [...document.querySelectorAll('#vChat button')].find(x => /extrait du livre/i.test(x.getAttribute('aria-label') || ''));
    if (!b) return null;
    const r = b.getBoundingClientRect();
    return { existe: true, onclick: b.getAttribute('onclick') || '', w: Math.round(r.width) };
  });
  ok('un bouton livre existe dans l\'en-tête du chat', !!chat);
  ok('il ouvre le lecteur', !!chat && /openBookReader/.test(chat.onclick), chat && chat.onclick);

  // ── Robustesse ─────────────────────────────────────────────────────────
  console.log('\n── Sans données, on le dit ──');
  const vide = await page.evaluate(() => {
    const sauve = window.BOOK_EXCERPT; window.BOOK_EXCERPT = null;
    window._bkRender();
    const t = document.getElementById('bkInner').textContent;
    window.BOOK_EXCERPT = sauve; window._bkRender();
    return t;
  });
  ok('un message explicite, jamais un écran blanc', /pas pu être chargé/i.test(vide), vide.slice(0, 60));

  // ── 320 px ─────────────────────────────────────────────────────────────
  console.log('\n── 320 × 568 ──');
  await page.setViewportSize({ width: 320, height: 568 });
  await page.evaluate(() => window.openBookReader(13)); await page.waitForTimeout(300);
  const p320 = await lire();
  ok('rien ne déborde en 320 px', p320.debordeX === 0, p320.debordeX);
  ok('le lecteur reste utilisable', p320.ouvert === true && p320.cnt === '13 / 44', p320.cnt);

  // ── Contraste ──────────────────────────────────────────────────────────
  console.log('\n── Contraste de lecture ──');
  const c = await page.evaluate(() => {
    const lum = (col) => {
      const m = col.match(/[\d.]+/g).map(Number);
      const f = m.slice(0, 3).map(v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); });
      return .2126 * f[0] + .7152 * f[1] + .0722 * f[2];
    };
    const solide = (e) => { for (let n = e; n; n = n.parentElement) {
      const bg = getComputedStyle(n).backgroundColor, m = bg.match(/[\d.]+/g);
      if (m && (m.length < 4 || Number(m[3]) > .9) && bg !== 'rgba(0, 0, 0, 0)') return bg; } return 'rgb(255,255,255)'; };
    const r = (sel) => { const e = document.querySelector(sel); if (!e) return null;
      const bg = solide(e), l1 = lum(getComputedStyle(e).color), l2 = lum(bg);
      return Math.round(((Math.max(l1,l2)+.05)/(Math.min(l1,l2)+.05))*100)/100; };
    return { corps: r('.bk-inner p'), cnt: r('.bk-cnt') };
  });
  ok('le corps du texte ≥ 7:1 — c\'est de la lecture longue', c.corps >= 7, c.corps);
  ok('le compteur de pages ≥ 4.5:1', c.cnt >= 4.5, c.cnt);

  ok('aucune erreur JS sur tout le parcours', errs.length === 0, errs.join(' | '));

  const echecs = R.filter(x => !x).length;
  console.log('\n' + '='.repeat(58));
  console.log(echecs ? ('RÉSULTAT : ' + echecs + ' ÉCHEC(S) sur ' + R.length)
                     : ('RÉSULTAT : ' + R.length + '/' + R.length + ' — tout est vert'));
  await browser.close(); server.close();
  process.exit(echecs ? 1 : 0);
})();
