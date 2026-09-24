// Passages enregistrés du livre — vrai Chromium, 375×667 et 320×568.
//
// Ce qu'on protège :
//   1. LIRE → ENREGISTRER → RETROUVER → REVENIR. Le tap sur un passage doit
//      rouvrir la BONNE page et amener l'athlète SUR le paragraphe : sans ça,
//      la fonctionnalité ne sert à rien.
//   2. Le même passage ne peut pas produire deux entrées — l'identifiant EST
//      le contenu.
//   3. Le lecteur reste un lecteur : aucune icône permanente devant les
//      paragraphes, et la colonne de texte ne bouge pas d'un pixel quand un
//      paragraphe est marqué.
//   4. Rien de l'existant ne bouge : pagination, A−/A+, CTA Amazon, et le
//      découpage audio (partie 1 = pages 1–7, et elle s'y arrête).
//   node scripts/test-book-marks.js [autre.html]
const fs = require('fs'), http = require('http'), path = require('path');
const REPO = path.join(__dirname, '..');
const HTML = process.argv[2] || path.join(REPO, 'index.html');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('Playwright absent — npm i -D playwright --no-save'); process.exit(0); }
const MIME = { '.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.png':'image/png','.mp3':'audio/mpeg' };

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
  const R = []; const ok = (l, c, d) => { R.push(c); console.log((c ? '  PASS  ' : '  FAIL  ') + l + (d !== undefined && !c ? '  → ' + String(d) : '')); };

  await page.goto(base + '/index.html', { waitUntil: 'domcontentloaded' });
  try { await page.waitForFunction(() => typeof window.openBookReader === 'function', { timeout: 20000 }); }
  catch (e) {
    console.log('  FAIL  cette base n\'a pas le lecteur du livre');
    console.log('\n' + '='.repeat(58) + '\nRÉSULTAT : 1 ÉCHEC(S) sur 1');
    await browser.close(); server.close(); process.exit(1);
  }

  // L'invite d'installation PWA et les toasts flottent au-dessus de tout et
  // interceptent les taps du harnais. Ils ne font pas partie de ce qu'on teste.
  const degager = () => page.evaluate(() => {
    const ip = document.getElementById('installPrompt'); if (ip) ip.style.display = 'none';
    const tc = document.getElementById('toastContainer'); if (tc) tc.innerHTML = '';
  });
  const clic = async (sel) => {
    await degager();
    try { await page.click(sel, { timeout: 2500 }); } catch (e) {}
    await page.waitForTimeout(280);
  };
  const ouvrir = async (p) => {
    await page.evaluate((p) => {
      document.querySelectorAll('.scr').forEach(e => { e.style.display = 'none'; e.classList.remove('on'); });
      localStorage.setItem('ah_profile', JSON.stringify({ prenom: 'Alassane', programKey: 'vd', satDone: true }));
      localStorage.removeItem('ah_book_excerpt');
      window.switchTab('home'); window.openBookReader(p);
    }, p);
    await page.waitForTimeout(320);
    await degager();
  };
  // Sélectionne les `n` premiers caractères du bloc `i` — c'est ce que fait
  // un doigt sur un téléphone, et `selectionchange` part tout seul.
  const selectionner = (i, n) => page.evaluate(([i, n]) => {
    const el = document.querySelectorAll('#bkInner > *')[i];
    if (!el) return null;
    const noeud = (function creuse(x) {
      if (x.nodeType === 3) return x;
      for (const c of x.childNodes) { const r = creuse(c); if (r && r.textContent.trim().length > 20) return r; }
      return null;
    })(el);
    if (!noeud) return null;
    const r = document.createRange();
    r.setStart(noeud, 0); r.setEnd(noeud, Math.min(n, noeud.textContent.length));
    const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
    return s.toString().replace(/\s+/g, ' ').trim();
  }, [i, n]);
  const barre = () => page.evaluate(() => {
    const b = document.getElementById('bkSelBar');
    if (!b) return { etat: 'absente' };
    const r = b.getBoundingClientRect();
    const btn = document.getElementById('bkSelSave');
    const br = btn ? btn.getBoundingClientRect() : null;
    return { etat: r.height > 0 ? 'visible' : 'repliée', label: btn ? btn.textContent.trim() : null,
      bas: Math.round(innerHeight - r.bottom), h: br ? Math.round(br.height) : 0, w: br ? Math.round(br.width) : 0 };
  });
  const marks = () => page.evaluate(() => {
    try { return JSON.parse(localStorage.getItem('ah_book_marks') || '[]'); } catch (e) { return 'illisible'; }
  });

  // ══ 1. La barre n'existe que pendant une sélection ═════════════════════
  console.log('\n── Le lecteur reste un lecteur ──');
  await ouvrir(12);
  let b = await barre();
  ok('la barre existe et reste repliée sans sélection', b.etat === 'repliée', b.etat);
  ok('aucune icône permanente devant les paragraphes',
    await page.evaluate(() => [...document.querySelectorAll('#bkInner > p')]
      .every(p => !p.querySelector('button,svg,img'))));

  // ══ 2. Sélectionner → la barre apparaît ════════════════════════════════
  console.log('\n── Sélectionner un passage ──');
  const txt1 = await selectionner(1, 60);
  await page.waitForTimeout(260);
  b = await barre();
  ok('le texte est bien sélectionné', !!txt1 && txt1.length > 20, txt1);
  ok('la barre apparaît', b.etat === 'visible', b.etat);
  ok('elle propose d\'enregistrer', /Enregistrer/.test(b.label || ''), b.label);
  // Mobile first : la cible doit se toucher sans viser.
  ok('le bouton fait au moins 44 px de haut', b.h >= 44, b.h);
  // Elle ne doit pas couvrir la pagination ni le CTA.
  ok('elle se pose AU-DESSUS du pied de page', b.bas >= 60, b.bas);

  // ══ 3. Enregistrer ═════════════════════════════════════════════════════
  console.log('\n── Enregistrer ──');
  await clic('#bkSelSave');
  let L = await marks();
  ok('le passage est sauvegardé', Array.isArray(L) && L.length === 1, Array.isArray(L) ? L.length : L);
  ok('avec le texte exact', !!L[0] && txt1.indexOf(L[0].texte.slice(0, 40)) === 0, L[0] && L[0].texte.slice(0, 40));
  ok('avec la bonne page', !!L[0] && L[0].page === 12, L[0] && L[0].page);
  ok('avec l\'emplacement dans la page', !!L[0] && L[0].bloc === 1, L[0] && L[0].bloc);
  ok('avec la date', !!L[0] && L[0].at > 0, L[0] && L[0].at);
  ok('et un champ note prêt pour la suite', !!L[0] && L[0].note === '', L[0] && JSON.stringify(L[0].note));
  // Confirmation légère : un toast PEINT, pas un popup.
  const toast = await page.evaluate(() => {
    const t = document.querySelector('#toastContainer .toast');
    return t ? { txt: t.textContent.trim(), h: Math.round(t.getBoundingClientRect().height) } : null;
  });
  ok('une confirmation légère s\'affiche', !!toast && /enregistr/i.test(toast.txt) && toast.h > 0, toast && toast.txt);
  ok('et aucune boîte de dialogue ne bloque la lecture',
    await page.evaluate(() => !document.querySelector('#bookReader [role="dialog"]')));

  // ══ 4. Pas de doublon ══════════════════════════════════════════════════
  console.log('\n── Le même passage, deux fois ──');
  await selectionner(1, 60); await page.waitForTimeout(260);
  b = await barre();
  ok('la barre dit qu\'il est déjà enregistré', /Déjà/i.test(b.label || ''), b.label);
  await clic('#bkSelSave');
  L = await marks();
  ok('aucune copie n\'est créée', Array.isArray(L) && L.length === 1, Array.isArray(L) ? L.length : L);

  // ══ 5. L'état visuel, discret ══════════════════════════════════════════
  console.log('\n── « Enregistré » se voit, sans encombrer ──');
  const filet = await page.evaluate(() => {
    const kept = document.querySelector('#bkInner .bk-kept');
    if (!kept) return null;
    const autre = [...document.querySelectorAll('#bkInner > p')].find(p => !p.classList.contains('bk-kept'));
    const cs = getComputedStyle(kept);
    return { bord: cs.borderLeftWidth, xKept: Math.round(kept.getBoundingClientRect().left + parseFloat(cs.paddingLeft)),
      xAutre: autre ? Math.round(autre.getBoundingClientRect().left) : null,
      boutons: kept.querySelectorAll('button').length };
  });
  ok('le paragraphe gardé porte un filet', !!filet && parseFloat(filet.bord) >= 2, filet && filet.bord);
  // Si la colonne se décalait, la page « sauterait » à chaque enregistrement.
  ok('la colonne de texte ne bouge pas', !!filet && filet.xKept === filet.xAutre, filet && (filet.xKept + ' vs ' + filet.xAutre));
  ok('et rien n\'est ajouté devant le texte', !!filet && filet.boutons === 0, filet && filet.boutons);

  // ══ 6. Mes passages ════════════════════════════════════════════════════
  console.log('\n── Mes passages ──');
  await page.evaluate(() => { window.bkAller(27); });
  await page.waitForTimeout(250);
  const txt2 = await selectionner(1, 70); await page.waitForTimeout(250);
  await clic('#bkSelSave');
  ok('un deuxième passage, sur une autre page',
    (await marks()).length === 2, (await marks()).length);
  const badge = await page.evaluate(() => {
    const n = document.getElementById('bkMarksN');
    return n ? { txt: n.textContent.trim(), h: Math.round(n.getBoundingClientRect().height) } : null;
  });
  ok('l\'en-tête annonce le compte', !!badge && badge.txt === '2' && badge.h > 0, badge && JSON.stringify(badge));
  await clic('#bkMarksBtn'); await page.waitForTimeout(120);
  const feuille = await page.evaluate(() => {
    const o = document.getElementById('bkMarksOv');
    const s = o && o.querySelector('.bkm-sheet');
    if (!o || !s) return { etat: 'absente', compte: '', n: 0, metas: [], premier: '', lire: 0, suppr: 0, deborde: 0 };
    const items = [...o.querySelectorAll('.bkm-item')];
    return { etat: (s && s.getBoundingClientRect().height > 0) ? 'ouverte' : 'fermée',
      compte: (document.getElementById('bkmCount') || {}).textContent,
      n: items.length,
      metas: items.map(i => (i.querySelector('.bkm-meta') || {}).textContent),
      premier: (items[0] && items[0].querySelector('.bkm-quote') || {}).textContent,
      lire: items[0] ? Math.round(items[0].querySelector('.bkm-read').getBoundingClientRect().height) : 0,
      suppr: items[0] ? Math.round(items[0].querySelector('.bkm-del').getBoundingClientRect().width) : 0,
      deborde: Math.max(0, Math.round(s.scrollWidth - innerWidth)) };
  });
  ok('la feuille s\'ouvre', feuille.etat === 'ouverte', feuille.etat);
  ok('elle annonce 2 passages', /2 passages/.test(feuille.compte || ''), feuille.compte);
  ok('les deux passages sont là', feuille.n === 2, feuille.n);
  // Le plus récent en premier : c'est celui de la page 27.
  ok('le plus récent d\'abord', /page 27/.test(feuille.metas[0] || ''), feuille.metas[0]);
  // La section vient du SOMMAIRE du livre, pas d'une liste écrite à la main.
  ok('chaque carte nomme sa section et sa page',
    feuille.metas.every(m => /page \d+/.test(m) && m.split('·').length >= 2), JSON.stringify(feuille.metas));
  ok('la citation est affichée', /«/.test(feuille.premier || ''), (feuille.premier || '').slice(0, 40));
  ok('« Lire » est une vraie cible tactile', feuille.lire >= 42, feuille.lire);
  ok('« Supprimer » aussi', feuille.suppr >= 44, feuille.suppr);
  ok('rien ne déborde en largeur', feuille.deborde === 0, feuille.deborde);

  // ══ 7. Revenir au passage ══════════════════════════════════════════════
  console.log('\n── Revenir au passage ──');
  await page.evaluate(() => { window.bkAller(3); });     // on s'éloigne
  await page.waitForTimeout(240);
  await page.evaluate(() => { if (window.openBookMarks) window.openBookMarks(); });
  await page.waitForTimeout(240);
  // On rouvre le PREMIER passage enregistré (page 12), pas celui du dessus.
  await page.evaluate(() => {
    const items = [...document.querySelectorAll('.bkm-item')];
    const cible = items.find(i => /page 12/.test((i.querySelector('.bkm-meta') || {}).textContent || ''));
    if (cible) cible.querySelector('.bkm-read').click();
  });
  await page.waitForTimeout(700);
  const retour = await page.evaluate(() => {
    const z = document.getElementById('bkPage');
    const hit = document.querySelector('#bkInner .bk-hit');
    const r = hit ? hit.getBoundingClientRect() : null;
    const zr = z.getBoundingClientRect();
    const ov = document.getElementById('bkMarksOv');
    return { page: (document.getElementById('bkCnt') || {}).textContent,
      ouvert: document.getElementById('bookReader').classList.contains('on'),
      feuille: !!ov && ov.classList.contains('on'),
      marque: !!hit, visible: !!r && r.top < zr.bottom && r.bottom > zr.top };
  });
  ok('le lecteur s\'ouvre', retour.ouvert === true);
  ok('la feuille se referme', retour.feuille === false);
  ok('sur la BONNE page', (retour.page || '').trim() === '12 / 44', retour.page);
  ok('le passage est signalé', retour.marque === true);
  ok('et il est À L\'ÉCRAN, sans rien chercher', retour.visible === true);

  // ══ 8. Persistance ═════════════════════════════════════════════════════
  console.log('\n── Fermer, rouvrir l\'application ──');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.openBookReader === 'function', { timeout: 20000 });
  await page.evaluate(() => {
    document.querySelectorAll('.scr').forEach(e => { e.style.display = 'none'; e.classList.remove('on'); });
    window.switchTab('home'); window.openBookReader(12);
  });
  await page.waitForTimeout(340);
  L = await marks();
  ok('les passages ont survécu', Array.isArray(L) && L.length === 2, Array.isArray(L) ? L.length : L);
  ok('le filet est repeint après rechargement',
    await page.evaluate(() => !!document.querySelector('#bkInner .bk-kept')));
  // Ils suivent l'athlète, pas l'appareil.
  ok('ah_book_marks voyage avec le compte (FB_SYNC_KEYS)',
    await page.evaluate(() => {
      try { return FB_SYNC_KEYS.some(e => e[0] === 'ah_book_marks'); } catch (x) { return false; }
    }));

  // ══ 9. Supprimer ═══════════════════════════════════════════════════════
  console.log('\n── Supprimer ──');
  await page.evaluate(() => { if (window.openBookMarks) window.openBookMarks(); }); await page.waitForTimeout(280);
  await page.evaluate(() => { const b = document.querySelector('.bkm-item .bkm-del'); if (b) b.click(); });
  await page.waitForTimeout(220);
  const arme = await page.evaluate(() => (document.querySelector('.bkm-item .bkm-del') || {}).textContent);
  ok('le premier tap demande confirmation', /Supprimer/.test(arme || ''), arme);
  ok('rien n\'est encore supprimé', (await marks()).length === 2, (await marks()).length);
  await page.evaluate(() => { const b = document.querySelector('.bkm-item .bkm-del'); if (b) b.click(); });
  await page.waitForTimeout(280);
  L = await marks();
  ok('le second tap supprime', Array.isArray(L) && L.length === 1, Array.isArray(L) ? L.length : L);
  ok('la liste se met à jour',
    await page.evaluate(() => document.querySelectorAll('.bkm-item').length === 1));
  // Tout supprimer → un état vide honnête, pas une page blanche.
  await page.evaluate(() => { for (let i = 0; i < 2; i++) { const b = document.querySelector('.bkm-del'); if (b) b.click(); } });
  await page.waitForTimeout(300);
  const vide = await page.evaluate(() => ({
    n: document.querySelectorAll('.bkm-item').length,
    txt: (document.querySelector('.bkm-vide') || {}).textContent || '',
    badge: (document.getElementById('bkMarksN') || {}).hidden
  }));
  ok('la liste est vide', vide.n === 0, vide.n);
  ok('et le dit franchement', /sélectionne un passage/i.test(vide.txt), vide.txt.slice(0, 50));
  ok('la pastille du compteur disparaît', vide.badge === true);
  await page.evaluate(() => { if (window.closeBookMarks) window.closeBookMarks(); }); await page.waitForTimeout(220);

  // ══ 10. Rien d'autre n'a bougé ═════════════════════════════════════════
  console.log('\n── L\'existant est intact ──');
  await ouvrir(12);
  await clic('#bkNext');
  ok('la pagination avance', (await page.evaluate(() => bkCnt.textContent.trim())) === '13 / 44');
  await clic('#bkPrev');
  ok('et recule', (await page.evaluate(() => bkCnt.textContent.trim())) === '12 / 44');
  const fs0 = await page.evaluate(() => getComputedStyle(bkInner).fontSize);
  await clic('#bkAaBtn');
  await clic('#bkFplus');
  ok('A+ fonctionne toujours',
    (await page.evaluate(() => getComputedStyle(bkInner).fontSize)) !== fs0);
  await clic('#bkAaVeil').catch(() => {});
  const cta = await page.evaluate(() => {
    const b = document.getElementById('bkBuyRow');
    return { h: Math.round(b.getBoundingClientRect().height), fn: typeof window.openAmazonBook };
  });
  ok('le CTA Amazon est toujours là', cta.h > 0 && cta.fn === 'function', JSON.stringify(cta));
  // LE DÉCOUPAGE AUDIO NE BOUGE PAS. La partie 1 couvre les pages 1–7.
  const au = await page.evaluate(() => {
    const p = (window.BOOK_AUDIO || [])[0];
    return p ? { pages: p.pages, narrees: p.narrees, sec: p.sec,
      barre: Math.round(document.getElementById('bkAudio').getBoundingClientRect().height) } : null;
  });
  ok('l\'audio couvre toujours les pages 1–7', !!au && au.pages[0] === 1 && au.pages[1] === 7, au && JSON.stringify(au.pages));
  ok('et s\'arrête bien là — aucune page au-delà de 7 n\'est narrée',
    !!au && au.narrees.every(n => n <= 7), au && JSON.stringify(au.narrees));
  ok('la barre audio est toujours peinte', !!au && au.barre > 0, au && au.barre);
  ok('le bouton ▶ répond toujours', await page.evaluate(() => typeof window.bkAudioToggle === 'function'));

  // ══ 11. Aucun autre écran n'est touché ═════════════════════════════════
  console.log('\n── Le reste de l\'application ──');
  const avant = await page.evaluate(() => Math.round(document.getElementById('vHome').getBoundingClientRect().height));
  await page.evaluate(() => window.closeBookReader()); await page.waitForTimeout(600);
  const apres = await page.evaluate(() => {
    const h = (id) => { const e = document.getElementById(id); return e ? Math.round(e.getBoundingClientRect().height) : 0; };
    return { home: h('vHome'), feuille: h('bkMarksOv'), barre: h('bkSelBar') };
  });
  ok('la Home retrouve toute sa hauteur', apres.home >= avant - 2, avant + ' → ' + apres.home);
  ok('la feuille ne traîne pas derrière', apres.feuille === 0, apres.feuille);
  ok('la barre de sélection non plus', apres.barre === 0, apres.barre);

  // ══ 12. 320 × 568 ══════════════════════════════════════════════════════
  console.log('\n── 320 × 568 ──');
  await page.setViewportSize({ width: 320, height: 568 });
  await ouvrir(12);
  await selectionner(1, 60); await page.waitForTimeout(280);
  const p320 = await page.evaluate(() => {
    const e = document.getElementById('bkSelBar');
    if (!e) return { deborde: -1, h: -1 };
    const b = e.getBoundingClientRect();
    return { deborde: Math.max(0, Math.round(b.right - innerWidth)), h: Math.round(b.height) };
  });
  ok('la barre tient dans 320 px', p320.deborde === 0 && p320.h > 0, JSON.stringify(p320));
  ok('et reste touchable', p320.h >= 44, p320.h);
  await clic('#bkSelSave');
  await clic('#bkMarksBtn'); await page.waitForTimeout(120);
  const f320 = await page.evaluate(() => {
    const s = document.querySelector('.bkm-sheet');
    if (!s) return { deborde: -1, h: -1 };
    return { deborde: Math.max(0, Math.round(s.scrollWidth - innerWidth)), h: Math.round(s.getBoundingClientRect().height) };
  });
  ok('la feuille tient dans 320 px', f320.deborde === 0 && f320.h > 0, JSON.stringify(f320));
  ok('et reste lisible', f320.h > 100, f320.h);
  await page.evaluate(() => { if (window.closeBookMarks) window.closeBookMarks(); });

  ok('aucune erreur JS sur tout le parcours', errs.length === 0, errs.join(' | '));

  const bad = R.filter(x => !x).length;
  console.log('\n' + '='.repeat(58));
  console.log(bad ? ('RÉSULTAT : ' + bad + ' ÉCHEC(S) sur ' + R.length) : ('RÉSULTAT : ' + R.length + '/' + R.length + ' — tout est vert'));
  await browser.close(); server.close();
  process.exit(bad ? 1 : 0);
})();
