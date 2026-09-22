// Centre de notifications — la cloche de la Home, dans un vrai Chromium.
// Ce qu'on protège ici :
//   1. La Home ne porte PLUS de carte Mission Titan. Le message vit derrière
//      la cloche. Une carte, si petite soit-elle, reste une carte.
//   2. La cloche ne ment pas : la pastille ne s'allume que s'il existe
//      vraiment une notification non ouverte, et s'éteint à l'ouverture.
//   3. AUCUNE donnée inventée. Une notification sans date en base s'affiche
//      SANS heure — jamais avec une heure fabriquée.
//   node scripts/test-notif-center.js [autre.html]
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

  const KEEP = process.env.KEEP_SHOTS === '1';
  const OUT = path.join(REPO, '.tmp-mission');
  if (KEEP && !fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

  await page.goto(base + '/index.html', { waitUntil: 'domcontentloaded' });
  try { await page.waitForFunction(() => typeof window.renderTitanSmartCards === 'function', { timeout: 20000 }); }
  catch (e) {
    console.log('  FAIL  cette base n\'a pas le moteur de la Mission Titan');
    console.log('\n' + '='.repeat(58) + '\nRÉSULTAT : 1 ÉCHEC(S) sur 1');
    await browser.close(); server.close(); process.exit(1);
  }
  const cdp = await page.context().newCDPSession(page);
  const shot = async (f) => {
    if (!KEEP) return;
    const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(OUT, f), Buffer.from(data, 'base64'));
  };
  const clic = async (sel) => { try { await page.click(sel, { timeout: 2000 }); } catch (e) {} await page.waitForTimeout(300); };
  // Taper « à côté » = sur le voile, au-dessus de la feuille. Un page.click()
  // sur l'overlay viserait son centre, qui tombe DANS la feuille.
  const clicDehors = async () => {
    const w = page.viewportSize().width;
    try { await page.mouse.click(Math.round(w / 2), 24); } catch (e) {}
    await page.waitForTimeout(320);
  };

  // Pose l'état réel de l'app, puis laisse le VRAI moteur produire la reco.
  async function etat(profil, hist, mission, qLast, badges) {
    await page.evaluate(([profil, hist, mission, qLast, badges]) => {
      document.querySelectorAll('.scr').forEach(v => { v.style.display = 'none'; v.classList.remove('on'); });
      localStorage.setItem('ah_profile', JSON.stringify(profil));
      localStorage.setItem('ah_set_history', JSON.stringify(hist || []));
      localStorage.setItem('ah_badges_earned', JSON.stringify(badges || []));
      localStorage.removeItem('ah_titan_daily');
      localStorage.removeItem('ah_notif_read');
      if (mission) localStorage.setItem('ah_titan_mission', JSON.stringify(mission));
      else localStorage.removeItem('ah_titan_mission');
      if (qLast) localStorage.setItem('ah_titan_q_last', String(qLast));
      else localStorage.removeItem('ah_titan_q_last');
      const ov = document.getElementById('notifCenter');
      if (ov) { ov.classList.remove('on'); ov.style.display = 'none'; }
      window.switchTab('home');
      window.renderTitanSmartCards();
    }, [profil, hist, mission, qLast, badges]);
    await page.waitForTimeout(300);
  }

  const lire = () => page.evaluate(() => {
    const q = (s) => { const e = document.querySelector(s); return e ? e.textContent.replace(/\s+/g, ' ').trim() : null; };
    const bell = document.getElementById('notifBell');
    const dot = document.getElementById('notifDot');
    const ov = document.getElementById('notifCenter');
    const main = document.getElementById('mainScroll') || document.body;
    return {
      carteHome: (document.getElementById('titanSmartCards') || { innerHTML: '' }).innerHTML.trim(),
      cloche: !!bell,
      clocheVisible: bell ? bell.getBoundingClientRect().height > 20 : false,
      clocheTaille: bell ? Math.round(bell.getBoundingClientRect().height) : 0,
      pastille: dot ? !dot.hidden : null,
      // Visible, pas seulement « pas hidden » : une classe en display:flex bat
      // la règle navigateur [hidden]{display:none}.
      pastilleVue: dot ? dot.getBoundingClientRect().height > 0 : false,
      ouvert: !!(ov && ov.classList.contains('on') && ov.getBoundingClientRect().height > 0),
      feuilleVue: (() => { const sh = ov && ov.querySelector('.tsv-sheet'); return sh ? Math.round(sh.getBoundingClientRect().height) : 0; })(),
      compte: q('#ncCount'),
      vide: q('.nc-empty'),
      items: Array.from(document.querySelectorAll('#ncList .nc-item')).map(e => ({
        from: (e.querySelector('.nc-from') || {}).textContent || '',
        heure: e.querySelector('.nc-time') ? e.querySelector('.nc-time').textContent.trim() : null,
        txt: (e.querySelector('.nc-txt') || {}).textContent || '',
        avatar: !!e.querySelector('.nc-av'),
        nonLue: e.classList.contains('unread'),
        etapes: Array.from(e.querySelectorAll('.nc-step')).map(s => ({
          txt: (s.querySelector('.nc-stxt') || {}).textContent.trim(),
          sfx: s.querySelector('.nc-sfx') ? s.querySelector('.nc-sfx').textContent.trim() : null,
          faite: s.classList.contains('on'),
          h: Math.round(s.getBoundingClientRect().height)
        })),
        action: e.querySelector('.nc-act') ? e.querySelector('.nc-act').textContent.trim() : null,
        actionDone: !!e.querySelector('.nc-act.done')
      })),
      debordeX: main.scrollWidth - main.clientWidth
    };
  });

  const PROFIL = { prenom:'Alassane', age:25, sexe:'H', poids:75, taille:180, programKey:'vd', program:'Vertical Dunk', streak:3 };
  const today = new Date().toISOString().slice(0, 10);

  // ── La Home ────────────────────────────────────────────────────────────
  console.log('\n── La Home ne porte plus de carte ──');
  await etat(PROFIL, [], null, null, []);
  let v = await lire(); await shot('n01-home.png');
  ok('#titanSmartCards est VIDE — la carte a quitté la Home', v.carteHome === '', v.carteHome.slice(0, 70));
  ok('la cloche existe dans l\'en-tête', v.cloche === true);
  ok('elle est visible et assez grande pour le doigt (≥ 40 px)', v.clocheTaille >= 40, v.clocheTaille + 'px');
  ok('la pastille est allumée — il y a du non-lu', v.pastille === true);
  ok('la pastille est réellement peinte, pas seulement non-hidden', v.pastilleVue === true);
  ok('le centre est fermé au départ', v.ouvert === false);
  ok('rien ne déborde horizontalement', v.debordeX === 0, v.debordeX);
  ok('aucune erreur JS', errs.length === 0, errs.join(' | '));

  // ── Ouvrir la cloche ───────────────────────────────────────────────────
  console.log('\n── Le tap sur la cloche ouvre le centre ──');
  await clic('#notifBell');
  v = await lire(); await shot('n02-centre.png');
  ok('le centre s\'ouvre', v.ouvert === true);
  // Le piège : posée dans la vue Chat, la feuille héritait de son display:none
  // et ne s'affichait jamais depuis la Home. position:fixed n'y change rien.
  ok('la feuille est réellement peinte (hauteur > 0)', v.feuilleVue > 100, v.feuilleVue + 'px');
  ok('elle liste au moins deux notifications', v.items.length >= 2, v.items.length);
  ok('le compteur annonce le nombre', /\d+ message/.test(v.compte || ''), v.compte);
  ok('tout est marqué non-lu à la première ouverture', v.items.every(i => i.nonLue));
  ok('pas d\'état vide quand il y a des notifications', v.vide === null);

  // ── L'entrée Titan ─────────────────────────────────────────────────────
  console.log('\n── L\'entrée de Titan ──');
  const titan = v.items.filter(i => /titan/i.test(i.from))[0];
  ok('Titan a sa notification', !!titan, JSON.stringify(v.items.map(i => i.from)));
  ok('elle porte le VRAI avatar de Titan', !!titan && titan.avatar === true);
  // L'heure est celle du CALCUL de la reco : le cache journalier fait qu'une
  // reco lue à 18 h peut dater de 7 h du matin.
  ok('elle porte une heure au format HH:MM', !!titan && /^\d{2}:\d{2}$/.test(titan.heure || ''), titan && titan.heure);
  ok('le message vient du moteur, pas d\'un texte figé', !!titan && /Alassane/.test(titan.txt), titan && titan.txt.slice(0, 60));

  // ── L'entrée Mission ───────────────────────────────────────────────────
  console.log('\n── L\'entrée Mission du jour ──');
  const mis = v.items.filter(i => /mission/i.test(i.from))[0];
  ok('la mission a sa notification', !!mis);
  ok('elle annonce un compte RÉEL (n sur n)', !!mis && /\d+ sur \d+/.test(mis.txt), mis && mis.txt);
  ok('les étapes sont listées', !!mis && mis.etapes.length >= 2, mis && mis.etapes.length);
  ok('chaque étape tient sur une ligne (≤ 36 px)', !!mis && mis.etapes.every(e => e.h <= 36), mis && JSON.stringify(mis.etapes.map(e => e.h)));
  ok('l\'étape lecture porte le chapitre recommandé', !!mis && /Lire\s*:/.test(mis.etapes[0].txt), mis && mis.etapes[0].txt);
  ok('l\'étape lecture porte la page du livre', !!mis && /^p\.\d+$/.test(mis.etapes[0].sfx || ''), mis && mis.etapes[0].sfx);
  ok('un bouton d\'action annonce ce que le tap va faire', !!mis && /lire|séance|titan|sat|set|pdc/i.test(mis.action || ''), mis && mis.action);

  // ── Ouvrir, c'est lire ─────────────────────────────────────────────────
  console.log('\n── Ouvrir éteint la pastille ──');
  ok('la pastille est éteinte après ouverture', v.pastille === false);
  ok('l\'état de lecture est écrit dans ah_notif_read',
    await page.evaluate(() => { try { const m = JSON.parse(localStorage.getItem('ah_notif_read')); return !!m && Object.keys(m).length >= 2; } catch (e) { return false; } }));
  await clicDehors();
  v = await lire();
  ok('taper à côté referme le centre', v.ouvert === false);
  ok('la pastille reste éteinte — rien de neuf', v.pastille === false);
  await clic('#notifBell');
  v = await lire();
  ok('rouvert, plus rien n\'est marqué non-lu', v.items.every(i => !i.nonLue));
  await clicDehors();

  // ── Cocher une étape depuis le centre ──────────────────────────────────
  console.log('\n── Cocher une étape depuis le centre ──');
  await clic('#notifBell');
  await page.evaluate(() => window._missionMarkDone('lecture'));
  await page.waitForTimeout(300);
  v = await lire();
  const mis2 = v.items.filter(i => /mission/i.test(i.from))[0];
  ok('l\'étape est cochée', !!mis2 && mis2.etapes.some(e => e.faite));
  ok('le compte de la mission a bougé', !!mis2 && /1 sur \d+/.test(mis2.txt), mis2 && mis2.txt);
  ok('la liste se redessine sans refermer le centre', v.ouvert === true);
  await clicDehors();

  // ── Séance faite → l'étape se coche seule ──────────────────────────────
  console.log('\n── La séance du jour se coche toute seule ──');
  await etat(PROFIL, [{ date: today + 'T10:00:00.000Z', type: 'session', name: 'Séance 1' }], null, null, []);
  await clic('#notifBell');
  v = await lire();
  const mis3 = v.items.filter(i => /mission/i.test(i.from))[0];
  const seance = mis3 && mis3.etapes.filter(e => /séance/i.test(e.txt))[0];
  ok('l\'étape séance est cochée', !!seance && seance.faite === true, JSON.stringify(seance));
  ok('elle porte le suffixe « Faite »', !!seance && /faite/i.test(seance.sfx || ''), seance && seance.sfx);
  await clicDehors();

  // ── Parler à Titan coche l'étape Titan ─────────────────────────────────
  // C'est le défaut réparé : `ah_titan_q_last` n'était écrit NULLE PART, donc
  // `Date.now() - 0 > 48 h` était toujours vrai et l'étape ne pouvait jamais
  // se satisfaire d'autre chose qu'une case cochée à la main.
  console.log('\n── Parler à Titan coche l\'étape Titan ──');
  await etat(PROFIL, [], null, Date.now() - 3600000, []);
  await clic('#notifBell');
  v = await lire();
  const misT = v.items.filter(i => /mission/i.test(i.from))[0];
  const etT = misT && misT.etapes.filter(e => /Titan/i.test(e.txt))[0];
  ok('l\'étape Titan est cochée après un échange récent', !!etT && etT.faite === true, JSON.stringify(etT));
  ok('l\'écriture vit dans callAnthropicAPI, le passage obligé de tout échange',
    await page.evaluate(() => /ah_titan_q_last/.test(String(window.callAnthropicAPI || '')) && /setItem/.test(String(window.callAnthropicAPI || ''))));
  await clicDehors();

  // ── Les badges n'ont PAS de date en base : donc pas d'heure ────────────
  console.log('\n── Un badge s\'affiche sans heure inventée ──');
  const unBadge = await page.evaluate(() => (typeof BADGES_DEF !== 'undefined' && BADGES_DEF.length) ? BADGES_DEF[0].id : null);
  if (unBadge) {
    await etat(PROFIL, [], null, null, [unBadge]);
    await clic('#notifBell');
    v = await lire(); await shot('n03-badge.png');
    const bg = v.items.filter(i => /badge/i.test(i.from))[0];
    ok('le badge apparaît dans le centre', !!bg, JSON.stringify(v.items.map(i => i.from)));
    // `ah_badges_earned` est un tableau d'ids SANS horodatage : on peut dire
    // qu'un badge est débloqué, jamais quand.
    ok('il n\'affiche AUCUNE heure — la donnée n\'existe pas', !!bg && bg.heure === null, bg && bg.heure);
    ok('il nomme le badge', !!bg && bg.txt.length > 2, bg && bg.txt);
    await clicDehors();
    // Un badge lu ne réencombre pas la liste.
    await page.evaluate(() => window.renderTitanSmartCards());
    await clic('#notifBell');
    v = await lire();
    ok('une fois lu, le badge quitte la liste', v.items.filter(i => /badge/i.test(i.from)).length === 0);
    await clicDehors();
  } else {
    ok('BADGES_DEF est absent de cette base', false, 'impossible de tester les badges');
  }

  // ── Pas de programme → rien ────────────────────────────────────────────
  console.log('\n── Aucun programme attribué ──');
  await etat({ prenom: 'Alassane' }, [], null, null, []);
  v = await lire();
  ok('sans programme, la pastille reste éteinte', v.pastille === false);
  await clic('#notifBell');
  v = await lire(); await shot('n04-vide.png');
  ok('le centre dit franchement qu\'il n\'y a rien', !!v.vide && /rien de neuf/i.test(v.vide), v.vide);
  ok('aucune notification fabriquée pour meubler', v.items.length === 0, v.items.length);
  await clicDehors();

  // ── Le reste de la Home ────────────────────────────────────────────────
  console.log('\n── Le reste de la Home est intact ──');
  await etat(PROFIL, [], null, null, []);
  const home = await page.evaluate(() => ({
    livre: !!document.querySelector('#bookCardWrap'),
    plusDArticle: !document.getElementById('articleOverlay'),
    score: !!document.getElementById('homeScoreboard'),
    journey: !!document.getElementById('journeyCardWrap'),
    trial: !!document.getElementById('trialBanner'),
    resume: !!document.getElementById('resumeSessionBanner'),
    gear: !!document.querySelector('#vHome [aria-label="Paramètres"]')
  }));
  ok('la carte du livre est toujours là', home.livre === true);
  ok('l\'article « Résistance mentale » a bien disparu', home.plusDArticle === true);
  ok('le scoreboard est toujours là', home.score === true);
  ok('« Mon parcours » est toujours là', home.journey === true);
  ok('la bannière essai est toujours là', home.trial === true);
  ok('la bannière « reprendre séance » est toujours là', home.resume === true);
  ok('le bouton paramètres est toujours là, à côté de la cloche', home.gear === true);
  ok('toujours aucune erreur JS', errs.length === 0, errs.join(' | '));

  // ── 320 × 568 ──────────────────────────────────────────────────────────
  console.log('\n── 320 × 568 ──');
  await page.setViewportSize({ width: 320, height: 568 });
  await page.evaluate(() => window.renderTitanSmartCards());
  await clic('#notifBell');
  const p320 = await lire(); await shot('n05-320.png');
  ok('rien ne déborde en 320 px', p320.debordeX === 0, p320.debordeX);
  ok('la cloche reste assez grande', p320.clocheTaille >= 40, p320.clocheTaille);
  ok('le centre s\'ouvre en 320 px', p320.ouvert === true);
  ok('la feuille tient dans l\'écran', p320.feuilleVue > 0 && p320.feuilleVue <= 568, p320.feuilleVue + 'px');
  const misP = p320.items.filter(i => /mission/i.test(i.from))[0];
  ok('les étapes tiennent encore sur une ligne', !misP || misP.etapes.every(e => e.h <= 40), misP && JSON.stringify(misP.etapes.map(e => e.h)));
  await clicDehors();

  // ── Contraste ──────────────────────────────────────────────────────────
  console.log('\n── Contraste ──');
  await page.setViewportSize({ width: 375, height: 667 });
  await clic('#notifBell');
  const contraste = await page.evaluate(() => {
    const lum = (c) => {
      const m = c.match(/[\d.]+/g).map(Number);
      const f = m.slice(0, 3).map(v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); });
      return .2126 * f[0] + .7152 * f[1] + .0722 * f[2];
    };
    const compose = (fg, bgc) => {
      const f = fg.match(/[\d.]+/g).map(Number), b = bgc.match(/[\d.]+/g).map(Number);
      const a = f.length > 3 ? f[3] : 1;
      return 'rgb(' + [0, 1, 2].map(i => Math.round(f[i] * a + b[i] * (1 - a))).join(',') + ')';
    };
    // Le fond RÉEL derrière un texte : on remonte tant que c'est transparent.
    // Composer sur le fond de la carte au lieu de celui de l'élément donnait
    // 1,3 sur un bouton parfaitement lisible — et masquait un vrai 4,03.
    const solideDe = (e) => {
      for (let n = e; n; n = n.parentElement) {
        const bg = getComputedStyle(n).backgroundColor, m = bg.match(/[\d.]+/g);
        if (m && (m.length < 4 || Number(m[3]) > .9) && bg !== 'rgba(0, 0, 0, 0)') return bg;
      }
      return 'rgb(255,255,255)';
    };
    const ratio = (fg, bg) => {
      const l1 = lum(compose(fg, bg)), l2 = lum(bg);
      return (Math.max(l1, l2) + .05) / (Math.min(l1, l2) + .05);
    };
    // On mesure contre le fond solide ET contre CHAQUE arrêt d'un dégradé
    // porté par l'élément, puis on garde le PIRE. Traiter tout dégradé comme
    // la pilule dorée donnait « or sur or » = 1:1 sur un texte lisible, et
    // aurait laissé passer un vrai défaut ailleurs.
    const mesure = (sel) => {
      const e = document.querySelector(sel); if (!e) return null;
      const st = getComputedStyle(e), fg = st.color;
      const fonds = [solideDe(e)];
      if (st.backgroundImage && st.backgroundImage !== 'none') {
        (st.backgroundImage.match(/rgba?\([^)]+\)/g) || []).forEach((c) => {
          const m = c.match(/[\d.]+/g);
          // Un arrêt quasi transparent ne masque pas le fond solide en dessous.
          if (m && (m.length < 4 || Number(m[3]) > .9)) fonds.push(c);
        });
      }
      let pire = Infinity;
      fonds.forEach((bg) => { pire = Math.min(pire, ratio(fg, bg)); });
      return Math.round(pire * 100) / 100;
    };
    return { from: mesure('.nc-from'), txt: mesure('.nc-txt'), step: mesure('.nc-stxt'), act: mesure('.nc-act'), titre: mesure('.tsv-title') };
  });
  ok('l\'expéditeur ≥ 4.5:1', contraste.from >= 4.5, contraste.from);
  ok('le texte de la notification ≥ 4.5:1', contraste.txt >= 4.5, contraste.txt);
  ok('le libellé d\'étape ≥ 4.5:1', contraste.step >= 4.5, contraste.step);
  ok('le bouton d\'action ≥ 4.5:1', contraste.act >= 4.5, contraste.act);
  ok('le titre de la feuille ≥ 4.5:1', contraste.titre >= 4.5, contraste.titre);

  const echecs = R.filter(x => !x).length;
  console.log('\n' + '='.repeat(58));
  console.log(echecs ? ('RÉSULTAT : ' + echecs + ' ÉCHEC(S) sur ' + R.length)
                     : ('RÉSULTAT : ' + R.length + '/' + R.length + ' — tout est vert'));
  await browser.close(); server.close();
  process.exit(echecs ? 1 : 0);
})();
