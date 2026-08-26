// RÈGLE 1 — ZÉRO SCROLL, vérifiée dans un vrai navigateur en 375 × 667.
// Chaque mode d'affichage et chaque programme est ouvert pour de vrai, puis
// on mesure : la zone de contenu déborde-t-elle ? le bouton d'action est-il
// entièrement visible ? Les captures sont écrites dans le dossier passé en
// argument (--out), pour pouvoir les regarder.
//   node scripts/test-live-layout.js [--out DIR] [--keep]
const fs = require('fs');
const path = require('path');
const http = require('http');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) {
  console.log('\nCe test ouvre un vrai navigateur pour vérifier la Règle 1 (zéro scroll).');
  console.log('Playwright n\'est pas installé — il n\'est volontairement pas dans package.json');
  console.log('(Netlify installerait les dépendances à chaque build). Pour lancer le test :');
  console.log('\n  npm i -D playwright --no-save && node scripts/test-live-layout.js\n');
  process.exit(0);
}

const ROOT = path.join(__dirname, '..');
const outIdx = process.argv.indexOf('--out');
const OUT = outIdx > -1 ? process.argv[outIdx + 1] : path.join(ROOT, '.live-shots');
const KEEP = process.argv.indexOf('--keep') > -1 || outIdx > -1;

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
               '.json': 'application/json', '.png': 'image/png', '.mp3': 'audio/mpeg',
               '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.webp': 'image/webp' };

// Cas de test : un par mode, tirés des vraies séances des 6 programmes.
const CASES = [
  { id: 'A-chrono',      prog: 'se',  label: 'Mode A — chrono',
    exos: [{ n: 'Squat isométrique (90°) — progresser le temps', s: '4', r: '30-60 s', rest: '1 mn' }] },
  { id: 'A-cote',        prog: 'se',  label: 'Mode A — durée par côté',
    exos: [{ n: 'Fente isométrique', s: '3', r: '30-45 s / jambe', rest: '1 mn' }] },
  { id: 'A-echec',       prog: 'tri', label: 'Mode A — à l\'échec',
    exos: [{ n: 'Wall sit — tenir la position', s: '3', r: 'À L\'ÉCHEC', rest: '2 mn' }] },
  { id: 'B-charge',      prog: 'vd',  label: 'Mode B — charge',
    exos: [{ n: 'Back squat — 85% 1RM', s: '5', r: '5 reps', rest: '2 mn 30' }] },
  { id: 'C-reps',        prog: 'se',  label: 'Mode C — reps poids du corps',
    exos: [{ n: 'Squat jump', s: '4', r: '8-12 reps', rest: '1 mn' }] },
  { id: 'C-reps-cote',   prog: 'se',  label: 'Mode C — reps par côté',
    exos: [{ n: 'Fentes sautées', s: '3', r: '20 reps (10/jambe)', rest: '1 mn' }] },
  { id: 'D-sprint',      prog: 'se',  label: 'Mode D — distance',
    exos: [{ n: 'Sprint 30 m — vitesse maximale', s: '6', r: '30 m', rest: '1 mn 30' }] },
  { id: 'E-bloc',        prog: 'se',  label: 'Mode E — bloc libre',
    exos: [{ n: 'Échauffement dynamique — Mobilité complète', s: '-', r: '5-10 mn', rest: '-' }] },
  { id: 'F-complexe',    prog: 'tri', label: 'Mode F — complexe',
    exos: [{ n: 'Squat isométrique 30 s → Squat excentrique 5 reps → Squat jump 5 reps', s: '3', r: 'Enchaîner sans pause', rest: '2 mn' }] },
  { id: 'G-intervalle',  prog: 'ea',  label: 'Mode G — intervalle',
    exos: [{ n: 'Fractionné : 15 s sprint (100%) + 15 s repos — ALL OUT', s: '8 cycles', r: 'Cycle complet', rest: '-' }] },
  { id: 'H-validation',  prog: 'mt',  label: 'Mode H — validation',
    exos: [{ n: 'Peser : même heure, à jeun, même conditions', s: '-', r: '1 mesure', rest: '-' }] },
  { id: 'X-video',       prog: 'se',  label: 'Avec vidéo',
    exos: [{ n: 'Fente isométrique', s: '3', r: '30-45 s / jambe', rest: '1 mn', video: 'dQw4w9WgXcQ' }] },
  { id: 'X-nom-long',    prog: 'ep',  label: 'Nom et séance très longs',
    exos: [{ n: 'Squat stato-dynamique — Iso profonde puis explosion maximale à la sortie', s: 'Var.*', r: '6 s min → explosion', rest: '2 mn 30' }],
    sess: 'Jour 6 — LOWER : Isométrique avancé + Pied + Proprioception avancée' },
];

// Séances réelles complètes, une par programme (Règle 1 sur les 6 programmes).
const REAL = [
  ['vd', 0, 'j2'], ['ea', 0, 'j1'], ['se', 0, 'j6'],
  ['tri', 0, 'j1'], ['mt', 0, 'm12'], ['ep', 0, 'j2'],
];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const server = http.createServer((req, res) => {
    let f = decodeURIComponent(req.url.split('?')[0]);
    if (f === '/' ) f = '/index.html';
    const p = path.join(ROOT, f);
    if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' });
    fs.createReadStream(p).pipe(res);
  });
  await new Promise(r => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;

  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await browser.newPage({ viewport: { width: 375, height: 667 }, deviceScaleFactor: 2 });
  // La capture native attend document.fonts.ready. Les polices Google sont
  // injectées par la page et ne peuvent pas aboutir avec le réseau coupé :
  // l'attente n'expire jamais. On capture donc via CDP, qui ne l'attend pas —
  // le test mesure une mise en page, pas un rendu typographique.
  const cdp = await page.context().newCDPSession(page);
  const shot = async (file) => {
    const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    fs.writeFileSync(file, Buffer.from(data, 'base64'));
  };

  const errs = [];
  page.on('pageerror', e => errs.push(String(e.message)));
  await page.goto(base + '/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.launchSession === 'function', { timeout: 20000 });

  const R = [];
  const ok = (l, c, d) => { R.push(c); console.log((c ? '  PASS  ' : '  FAIL  ') + l + (d && !c ? '  → ' + d : '')); };
  // La séance de la capture d'écran de référence.
  const PV_J6 = await page.evaluate(() => {
    const S = PROGRAMS_V2.se.phases[0].sessions.j6;
    return { name: S.name, exos: S.exos };
  });

  async function open(exos, sess, prog, progKey) {
    await page.evaluate(([exos, sess, prog, progKey]) => {
      try { localStorage.setItem('ah_profile', JSON.stringify({ programProgress: { [progKey]: { phaseIdx: 0, week: 1 } } })); } catch (e) {}
      window.launchSession(exos, sess, prog, progKey, 'test');
    }, [exos, sess, prog, progKey]);
    // L'écran monte avec une transition de 350 ms : mesurer avant la fin
    // ferait apparaître un faux débordement de quelques pixels.
    await page.waitForFunction(() => {
      const el = document.getElementById('liveSession');
      return el && el.getBoundingClientRect().top <= 0.5;
    }, { timeout: 5000 });
    await page.waitForTimeout(120);
  }
  // Mesure : rien ne doit déborder, et le bouton doit être entièrement visible.
  async function measure() {
    return page.evaluate(() => {
      const q = id => document.getElementById(id);
      const st = q('lsStage'), btn = q('lsBtnDone'), sess = q('lsSessName'), nm = q('lsExName');
      const vh = window.innerHeight;
      const b = btn.getBoundingClientRect();
      const clipped = el => el.scrollWidth > el.clientWidth + 1
                         || el.scrollHeight > el.clientHeight + 1;
      return {
        stageOverflow: st.scrollHeight - st.clientHeight,
        bodyOverflow: document.getElementById('lsBody').scrollHeight - document.getElementById('lsBody').clientHeight,
        pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        btnTop: Math.round(b.top), btnBottom: Math.round(b.bottom), btnH: Math.round(b.height), vh,
        btnLabel: btn.textContent.trim(),
        ellipsis: clipped(sess) || clipped(nm),
        dashes: document.querySelectorAll('#lsDashes .ls-dash').length,
        text: (q('lsStage').innerText || '').trim(),
      };
    });
  }

  console.log('\n=== RÈGLE 1 — ZÉRO SCROLL, 375 × 667, PAR MODE ===\n');
  for (const c of CASES) {
    await open(c.exos, c.sess || 'Jour 6 — LOWER : Isométrique avancé + Pied', 'PROGRAMME TEST', c.prog);
    const m = await measure();
    await shot(path.join(OUT, c.id + '.png'));
    ok(c.label + ' — rien ne déborde', m.stageOverflow <= 1 && m.bodyOverflow <= 1,
       'stage +' + m.stageOverflow + 'px, body +' + m.bodyOverflow + 'px');
    ok(c.label + ' — bouton entièrement visible', m.btnBottom <= m.vh && m.btnTop >= 0 && m.btnH >= 55,
       'bas=' + m.btnBottom + ' / ' + m.vh + ', h=' + m.btnH);
    ok(c.label + ' — aucun texte tronqué', !m.ellipsis);
    ok(c.label + ' — pas de scroll horizontal', m.pageOverflow <= 0, String(m.pageOverflow));
    ok(c.label + ' — aucun "—" affiché', m.text.split('\n').every(l => l.trim() !== '—'),
       m.text.replace(/\n/g, ' | '));
    ok(c.label + ' — aucun "Var.*" affiché', !/Var\.?\*/.test(m.text));
    ok(c.label + ' — pas de tag "Classique"', !/classique/i.test(m.text), m.text.slice(0, 60));
  }

  console.log('\n=== RÈGLE 1 SUR LES 6 PROGRAMMES, SÉANCES RÉELLES ===\n');
  for (const [key, ph, sk] of REAL) {
    const sess = await page.evaluate(([k, p, s]) => {
      const S = PROGRAMS_V2[k].phases[p].sessions[s];
      return { name: S.name, exos: S.exos, prog: PROGRAMS_V2[k].name };
    }, [key, ph, sk]);
    let worst = { stageOverflow: -99 }, worstIdx = 0;
    await open(sess.exos, sess.name, sess.prog, key);
    for (let i = 0; i < sess.exos.length; i++) {
      await page.evaluate(i => { window._LS.idx = i; window._LS.setNum = 1; window._lsRenderEx(); }, i);
      await page.waitForTimeout(45);
      const m = await measure();
      if (m.stageOverflow > worst.stageOverflow) { worst = m; worstIdx = i; }
    }
    await page.evaluate(i => { window._LS.idx = i; window._lsRenderEx(); }, worstIdx);
    await page.waitForTimeout(80);
    await shot(path.join(OUT, 'prog-' + key + '.png'));
    ok(sess.prog + ' (' + sess.exos.length + ' exos) — aucun débordement',
       worst.stageOverflow <= 1 && worst.bodyOverflow <= 1,
       'pire = exo ' + (worstIdx + 1) + ' : +' + worst.stageOverflow + 'px');
    ok(sess.prog + ' — bouton visible sur le pire exercice', worst.btnBottom <= worst.vh,
       worst.btnBottom + ' / ' + worst.vh);
    ok(sess.prog + ' — une carte de séance à ' + sess.exos.length + ' tirets',
       worst.dashes === sess.exos.length, String(worst.dashes));
  }

  console.log('\n=== ÉCRAN DE REPOS ===\n');
  {
    await open([
      { n: 'Squat isométrique (90°)', s: '3', r: '30-60 s', rest: '1 mn' },
      { n: 'Squat excentrique — 5 s de descente', s: '3', r: '8 reps', rest: '2 mn' }
    ], 'Jour test', 'PROGRAMME TEST', 'se');
    await page.evaluate(() => { window._LS._pendingAction = 'nextEx'; window._lsStartRest(90); });
    await page.waitForTimeout(300);
    await shot(path.join(OUT, 'repos.png'));
    const r = await page.evaluate(() => {
      const ov = document.getElementById('lsRestOverlay');
      const cd = document.getElementById('lsRestCountdown');
      const col = getComputedStyle(cd).color;
      const b = ov.getBoundingClientRect();
      return { active: ov.classList.contains('ls-rest-active'), col,
               next: (document.getElementById('lsRestNext').innerText || '').trim(),
               covers: b.height > 300, overflow: ov.scrollHeight - ov.clientHeight };
    });
    ok('le repos est un état plein écran', r.active && r.covers);
    // §11 — la carte de séance et les flèches restent visibles pendant le
    // repos : c'est le moment où l'athlète a le temps de les regarder.
    const chrome = await page.evaluate(() => {
      const f = document.getElementById('lsFooter').getBoundingClientRect();
      const ov = document.getElementById('lsRestOverlay').getBoundingClientRect();
      const btn = document.getElementById('lsBtnDone');
      return { footerVisible: f.height > 0 && f.bottom <= window.innerHeight + 1,
               overlayStopsAbove: Math.round(ov.bottom) <= Math.round(f.top) + 1,
               dashes: document.querySelectorAll('#lsDashes .ls-dash').length,
               arrows: document.querySelectorAll('.ls-nav-btn').length,
               cta: btn.textContent.trim(),
               ctaGold: getComputedStyle(btn).backgroundColor };
    });
    ok('la barre du bas reste visible pendant le repos',
       chrome.footerVisible && chrome.overlayStopsAbove && chrome.dashes > 0 && chrome.arrows === 2,
       JSON.stringify(chrome));
    ok('le bouton central devient "Passer le repos"',
       /passer le repos/i.test(chrome.cta), chrome.cta);
    ok('l\'or est interdit pendant le repos',
       chrome.ctaGold !== 'rgb(212, 168, 67)', chrome.ctaGold);
    ok('le compte à rebours est bleu, jamais or', r.col === 'rgb(74, 158, 219)', r.col);
    ok('le prochain exercice est nommé en entier',
       r.next.indexOf('Squat excentrique') > -1 && r.next.indexOf('…') < 0, r.next.replace(/\n/g, ' | '));
    ok('l\'écran de repos ne scrolle pas', r.overflow <= 1, String(r.overflow));
  }

  console.log('\n=== CONTRASTE — AUCUN TEXTE ILLISIBLE (AA, 4.5:1) ===\n');
  {
    // Le thème par défaut de l'app est LIGHT : tout token global lu depuis
    // l'écran live y devient sombre sur fond navy. C'est exactement ce qui
    // rendait "Semaine 1/8 terminée" invisible sur l'écran de fin.
    await page.evaluate(() => { try { localStorage.setItem('ah_theme', 'light'); } catch (e) {}
      document.documentElement.removeAttribute('data-theme'); });
    await open([{ n: 'Squat jump', s: '1', r: '10 reps', rest: '-' }], 'Jour test', 'PROGRAMME TEST', 'se');
    await page.evaluate(() => {
      window._lsFinalizeSession({ sessionQualityScore: 80, titanStatus: 'Bonne séance',
                                  difficulties: [], intensity: 75, focus: 80,
                                  exosDone: 9, exosTotal: 12 });
      // Les deux blocs de la capture : ce sont eux qui étaient invisibles.
      const c = document.getElementById('lsCelebrate');
      c.className = 'ls-celebrate on';
      c.innerHTML = '<div class="ls-celebrate-kicker">Étape franchie</div>'
                  + '<div class="ls-celebrate-msg">Semaine 1/8 terminée.</div>';
      const n = document.getElementById('lsNextStep');
      n.className = 'ls-nextstep on';
      n.innerHTML = '<div class="ls-nextstep-kicker">Prochaine étape</div>'
                  + '<div class="ls-nextstep-txt">10 semaines depuis ton dernier test. Il est temps de le refaire.</div>';
    });
    await page.waitForTimeout(300);
    await shot(path.join(OUT, 'fin-contraste.png'));

    const contrasts = await page.evaluate(() => {
      const lum = (c) => {
        const m = c.match(/[\d.]+/g).map(Number);
        const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
        return 0.2126 * f(m[0]) + 0.7152 * f(m[1]) + 0.0722 * f(m[2]);
      };
      const bgOf = (el) => {
        let n = el;
        while (n) {
          const b = getComputedStyle(n).backgroundColor;
          const m = b.match(/[\d.]+/g);
          if (m && (m.length < 4 || Number(m[3]) > 0.85)) return b;
          n = n.parentElement;
        }
        return 'rgb(11,17,32)';
      };
      const out = [];
      document.querySelectorAll('#liveSession *').forEach(el => {
        const txt = (el.childNodes.length && Array.from(el.childNodes)
          .filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join('')) || '';
        if (!txt) return;
        const st = getComputedStyle(el);
        if (st.display === 'none' || st.visibility === 'hidden' || Number(st.opacity) < 0.9) return;
        if (!el.getClientRects().length) return;
        const L1 = lum(st.color), L2 = lum(bgOf(el));
        const r = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
        out.push({ t: txt.slice(0, 44), r: Math.round(r * 10) / 10, cls: el.className || el.id, c: st.color });
      });
      return out;
    });
    const bad = contrasts.filter(x => x.r < 4.5);
    ok('écran de fin : tout le texte est au-dessus de 4.5:1',
       bad.length === 0, bad.map(b => b.t + ' [' + b.cls + '] ' + b.r + ':1 ' + b.c).join(' | '));
    const celeb = contrasts.find(x => /Semaine 1\/8/.test(x.t));
    const next = contrasts.find(x => /10 semaines depuis/.test(x.t));
    ok('"Semaine 1/8 terminée" est lisible', celeb && celeb.r >= 4.5,
       celeb ? celeb.r + ':1 (' + celeb.c + ')' : 'introuvable');
    ok('le rappel de re-test est lisible', next && next.r >= 4.5,
       next ? next.r + ':1 (' + next.c + ')' : 'introuvable');

    await page.evaluate(() => { window._lsClose(); });
    await page.waitForTimeout(150);
  }

  console.log('\n=== IDENTITÉ — LE FOND EST NAVY, PAS NOIR ===\n');
  {
    await open([{ n: 'Squat jump', s: '1', r: '10 reps', rest: '-' }], 'Jour test', 'PROGRAMME TEST', 'se');
    const col = await page.evaluate(() => {
      const rgb = (s) => s.match(/[\d.]+/g).map(Number);
      return { live: rgb(getComputedStyle(document.getElementById('liveSession')).backgroundColor),
               footer: rgb(getComputedStyle(document.getElementById('lsFooter')).backgroundColor) };
    });
    // Navy = le bleu domine nettement le rouge, et le fond n'est pas noir.
    // Critère mécanique du brief V3 : canal Bleu − canal Rouge ≥ 35.
    ok('le fond est visiblement bleu (B − R ≥ 35)',
       col.live[2] - col.live[0] >= 35, 'rgb(' + col.live.join(',') + ') → écart ' + (col.live[2] - col.live[0]));
    ok('le footer partage le même navy',
       col.footer[2] - col.footer[0] >= 35, 'rgb(' + col.footer.join(',') + ')');
    // Les surfaces doivent se détacher SANS bordure.
    const surf = await page.evaluate(() => {
      const rgb = s => s.match(/[\d.]+/g).map(Number);
      const lum = c => { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); };
        return .2126 * f(c[0]) + .7152 * f(c[1]) + .0722 * f(c[2]); };
      const bg = rgb(getComputedStyle(document.getElementById('liveSession')).backgroundColor);
      const vw = document.getElementById('lsVideoWrap');
      const s1 = rgb(getComputedStyle(vw).backgroundColor);
      const nav = rgb(getComputedStyle(document.getElementById('lsPrevBtn')).backgroundColor);
      const r = (a, b) => { const L1 = lum(a), L2 = lum(b);
        return Math.round(((Math.max(L1, L2) + .05) / (Math.min(L1, L2) + .05)) * 100) / 100; };
      return { video: r(s1, bg), nav: r(nav, bg), s1: s1, bg: bg, navRgb: nav };
    });
    // Sur un fond sombre, un ratio WCAG (fait pour du texte) écrase l'écart :
    // ce qui rend une surface visible, c'est le saut de clarté par canal.
    const step = (a, b) => Math.round(((a[0]-b[0]) + (a[1]-b[1]) + (a[2]-b[2])) / 3);
    ok('le bloc vidéo se détache du fond sans bordure', step(surf.s1, surf.bg) >= 8,
       '+' + step(surf.s1, surf.bg) + ' niveaux (rgb(' + surf.s1.join(',') + ') sur rgb(' + surf.bg.join(',') + '))');
    ok('les boutons secondaires se détachent du fond', surf.video >= 1.1, surf.video + ':1');
  }

  console.log('\n=== 320 × 568 (iPhone SE 1re génération) ===\n');
  {
    await page.setViewportSize({ width: 320, height: 568 });
    let bad = [];
    for (const c of CASES) {
      await open(c.exos, c.sess || 'Jour 6 — LOWER : Isométrique avancé + Pied', 'PROGRAMME TEST', c.prog);
      const m = await measure();
      if (m.stageOverflow > 1 || m.btnBottom > m.vh) bad.push(c.id + ' (+' + m.stageOverflow + 'px)');
    }
    await shot(path.join(OUT, 'se-320.png'));
    ok('les 12 gabarits tiennent aussi en 320 × 568', bad.length === 0, bad.join(', '));
    await page.setViewportSize({ width: 375, height: 667 });
  }

  console.log('\n=== PARCOURS RÉEL DANS L\'ÉCRAN ===\n');
  {
    // Un exo à 3 séries avec repos, puis un exo enchaîné (repos "-").
    await open([
      { n: 'Squat jump', s: '3', r: '8-12 reps', rest: '30 s' },
      { n: 'Pompes explosives', s: '2', r: '12 reps', rest: '-' },
      { n: 'Étirements légers', s: '-', r: '5 mn', rest: '-' }
    ], 'Jour test', 'PROGRAMME TEST', 'se');

    await page.click('#lsBtnDone');
    await page.waitForTimeout(180);
    let st = await page.evaluate(() => ({
      rest: document.getElementById('lsRestOverlay').classList.contains('ls-rest-active'),
      set: window._LS.setNum, pending: window._LS._pendingAction
    }));
    ok('valider une série ouvre le repos prescrit', st.rest && st.pending === 'nextSet', JSON.stringify(st));

    await page.click('#lsBtnDone');
    await page.waitForTimeout(180);
    st = await page.evaluate(() => ({
      rest: document.getElementById('lsRestOverlay').classList.contains('ls-rest-active'),
      set: window._LS.setNum,
      kicker: (document.querySelector('#lsMode .ls-mode-kicker') || {}).textContent || ''
    }));
    ok('passer le repos enchaîne sur la série suivante',
       !st.rest && st.set === 2 && /2/.test(st.kicker), JSON.stringify(st));

    await page.evaluate(() => { window._LS.setNum = 3; window._lsRenderEx(); });
    await page.click('#lsBtnDone');
    await page.waitForTimeout(180);
    await page.click('#lsBtnDone');
    await page.waitForTimeout(200);
    st = await page.evaluate(() => ({ idx: window._LS.idx, set: window._LS.setNum }));
    ok('dernière série → exercice suivant, compteur remis à 1',
       st.idx === 1 && st.set === 1, JSON.stringify(st));

    // Repos "-" : le programme dit d'enchaîner, l'app n'invente plus 60 s.
    await page.evaluate(() => { window._LS.setNum = 2; window._lsRenderEx(); });
    await page.click('#lsBtnDone');
    await page.waitForTimeout(250);
    st = await page.evaluate(() => ({
      rest: document.getElementById('lsRestOverlay').classList.contains('ls-rest-active'),
      idx: window._LS.idx
    }));
    ok('repos "-" → enchaînement direct, aucun écran de repos',
       !st.rest && st.idx === 2, JSON.stringify(st));
  }

  console.log('\n=== CHRONO ===\n');
  {
    await open([{ n: 'Squat isométrique', s: '2', r: '30-60 s', rest: '30 s' }], 'Jour test', 'PROGRAMME TEST', 'se');
    let v = await page.textContent('#lsBigVal');
    ok('la durée prescrite est affichée avant le départ', v.trim() === '00:30', v);
    await page.click('#lsBtnDone');
    await page.waitForTimeout(1300);
    const after = await page.evaluate(() => ({
      val: document.getElementById('lsBigVal').textContent.trim(),
      run: window._LS.tmr.running,
      label: document.getElementById('lsBtnDone').textContent.trim(),
      width: document.getElementById('lsTimerFill').style.width
    }));
    ok('le chrono décompte', after.val === '00:29' && after.run, JSON.stringify(after));
    ok('le bouton bascule sur Pause', /pause/i.test(after.label), after.label);
    ok('la barre se vide en même temps', parseFloat(after.width) < 100 && parseFloat(after.width) > 90, after.width);
    await page.click('#lsBtnDone');
    await page.waitForTimeout(1200);
    const paused = await page.evaluate(() => ({
      val: document.getElementById('lsBigVal').textContent.trim(), run: window._LS.tmr.running,
      label: document.getElementById('lsBtnDone').textContent.trim()
    }));
    ok('la pause fige vraiment le chrono', paused.val === '00:29' && !paused.run, JSON.stringify(paused));
    ok('le bouton propose de reprendre', /reprendre/i.test(paused.label), paused.label);
  }

  console.log('\n=== DURÉE PAR CÔTÉ : DEUX PASSAGES ===\n');
  {
    await open([{ n: 'Fente isométrique', s: '2', r: '3-5 s / jambe', rest: '30 s' }], 'Jour test', 'PROGRAMME TEST', 'se');
    let side = await page.textContent('#lsMode');
    ok('démarre sur le côté gauche', /gauche/i.test(side), side.slice(0, 60));
    await page.click('#lsBtnDone');
    await page.waitForTimeout(3600);
    const s2 = await page.evaluate(() => ({
      side: window._LS.side, rest: document.getElementById('lsRestOverlay').classList.contains('ls-rest-active'),
      txt: document.getElementById('lsMode').innerText
    }));
    ok('fin du premier côté → bascule sur le droit, sans repos',
       s2.side === 'D' && !s2.rest && /droit/i.test(s2.txt), JSON.stringify({ s: s2.side, r: s2.rest }));
  }

  console.log('\n=== MODE CHARGE : SAISIE ET ENREGISTREMENT ===\n');
  {
    await page.evaluate(() => { try { localStorage.removeItem('ah_track_history'); } catch (e) {} });
    await open([{ n: 'Back squat — 85% 1RM', s: '2', r: '5 reps', rest: '30 s' }], 'Jour test', 'PROGRAMME TEST', 'vd');
    await page.click('.ls-stepper:nth-child(2) .ls-stepper-btn:last-child');
    await page.click('.ls-stepper:nth-child(2) .ls-stepper-btn:last-child');
    await page.click('.ls-rpe-dot:nth-child(4)');   // échelle 2·4·6·8·10 → 8
    const before = await page.evaluate(() => ({
      kg: document.getElementById('lsStep_load').textContent,
      reps: document.getElementById('lsStep_reps').textContent,
      rpe: window._LS.mb.rpe,
      inputs: document.querySelectorAll('#lsMode input').length,
      say: (document.getElementById('lsRpeSay') || {}).textContent,
      dots: document.querySelectorAll('.ls-rpe-dot').length,
      minTarget: Math.min.apply(null, Array.from(document.querySelectorAll(
        '.ls-rpe-dot, .ls-stepper-btn, .ls-nav-btn, #lsBtnDone'))
        .map(e => Math.round(Math.min(e.getBoundingClientRect().width, e.getBoundingClientRect().height))))
    }));
    ok('les steppers ajustent sans ouvrir le clavier',
       before.kg === '5' && before.reps === '5' && before.rpe === 8 && before.inputs === 0,
       JSON.stringify(before));
    // §11 — 5 pastilles au lieu de 10, toutes les cibles ≥ 44 px.
    ok('l\'échelle RPE tient en 5 pastilles', before.dots === 5, String(before.dots));
    ok('toutes les cibles tactiles font au moins 44 px',
       before.minTarget >= 44, before.minTarget + ' px');
    ok('le RPE dit ce qu\'il veut dire', /8 — Difficile mais maîtrisé/.test(before.say || ''),
       before.say);
    await page.click('#lsBtnDone');
    await page.waitForTimeout(200);
    const hist = await page.evaluate(() => JSON.parse(localStorage.getItem('ah_track_history') || '[]'));
    ok('la série part dans ah_track_history au format du tracker',
       hist.length === 1 && hist[0].exerciseName === 'Back squat'
       && hist[0].method === 'charge' && hist[0].essais[0].load === 5
       && hist[0].essais[0].reps === 5 && hist[0].rpe === 8 && hist[0].source === 'live_session',
       JSON.stringify(hist[0] || null));
  }

  console.log('\n=== SAISIE DE PERF SUR UN EXERCICE SANS CHARGE ===\n');
  {
    await page.evaluate(() => { try { localStorage.removeItem('ah_track_history'); } catch (e) {} });
    await open([{ n: 'Toe taps — Coordination tibial', s: '3', r: '20 reps', rest: '30 s' }],
               'Jour test', 'PROGRAMME TEST', 'se');
    const m = await page.evaluate(() => ({
      txt: document.getElementById('lsStage').innerText,
      steppers: document.querySelectorAll('#lsMode .ls-stepper').length,
      labels: Array.from(document.querySelectorAll('#lsMode .ls-stepper-l')).map(e => e.textContent),
      rpe: document.querySelectorAll('#lsMode .ls-rpe-dot').length,
      reps: (document.getElementById('lsStep_reps') || {}).textContent
    }));
    ok('aucune colonne KG sur un exercice sans charge',
       m.steppers === 1 && m.labels.indexOf('Kg') < 0, JSON.stringify(m.labels));
    ok('plus de lien "Noter ma charge"', !/noter ma charge/i.test(m.txt));
    ok('les reps sont pré-remplies sur l\'objectif', m.reps === '20', m.reps);
    ok('le RPE reste saisissable', m.rpe === 5, String(m.rpe));
    await page.click('#lsBtnDone');
    await page.waitForTimeout(200);
    const hist = await page.evaluate(() => JSON.parse(localStorage.getItem('ah_track_history') || '[]'));
    ok('la perf au poids du corps part quand même dans l\'historique',
       hist.length === 1 && hist[0].exerciseName === 'Toe taps'
       && hist[0].essais[0].reps === 20 && hist[0].essais[0].load === undefined,
       JSON.stringify(hist[0] || null));
  }

  console.log('\n=== §5.1 — PLUS DE TROU VERTICAL SOUS LE TITRE ===\n');
  {
    for (const c of CASES) {
      await open(c.exos, c.sess || 'Jour 6 — LOWER : Isométrique avancé + Pied', 'PROGRAMME TEST', c.prog);
      const gap = await page.evaluate(() => {
        const st = document.getElementById('lsStage');
        const mode = document.getElementById('lsMode');
        const first = mode.firstElementChild;
        if (!first) return 0;
        // Dernier élément visible au-dessus de la zone mode.
        let above = null;
        Array.from(st.children).forEach(el => {
          if (el === mode) return;
          if (getComputedStyle(el).display === 'none' || !el.getClientRects().length) return;
          above = el;
        });
        if (!above) return 0;
        return Math.round(first.getBoundingClientRect().top - above.getBoundingClientRect().bottom);
      });
      // 82 px de tolérance : le plafond CSS est à 80 px, plus la marge de
      // 2 px du premier élément de la zone mode.
      ok(c.label + ' — écart titre → donnée ≤ 82 px', gap <= 82, gap + ' px');
    }
  }

  console.log('\n=== FIN DE SÉANCE ===\n');
  {
    await open([{ n: 'Squat jump', s: '1', r: '10 reps', rest: '-' }], 'Jour test', 'PROGRAMME TEST', 'se');
    await page.click('#lsBtnDone');
    await page.waitForTimeout(400);
    const end = await page.evaluate(() => {
      const fb = document.getElementById('seFeedback');
      return {
        feedbackVisible: !!(fb && getComputedStyle(fb).display !== 'none'),
        stillOpen: document.getElementById('liveSession').classList.contains('ls-open')
      };
    });
    ok('la dernière série ouvre le bilan de séance',
       end.feedbackVisible && end.stillOpen, JSON.stringify(end));

    // Le changement structurel le plus risqué : _lsFinalizeSession masque
    // TOUS les enfants de #lsBody sauf #lsComplete, et _lsClose les restaure.
    // La refonte a ajouté #lsStage / #lsFooter à cette liste.
    await page.evaluate(() => { window._lsFinalizeSession({}); });
    await page.waitForTimeout(200);
    const fin = await page.evaluate(() => {
      const d = id => getComputedStyle(document.getElementById(id)).display;
      return { stage: d('lsStage'), footer: d('lsFooter'), rest: d('lsRestOverlay'), complete: d('lsComplete'),
               over: document.getElementById('lsBody').scrollHeight - document.getElementById('lsBody').clientHeight };
    });
    await shot(path.join(OUT, 'fin-seance.png'));
    ok('l\'écran de fin masque bien l\'exercice, le footer et le repos',
       fin.stage === 'none' && fin.footer === 'none' && fin.rest === 'none' && fin.complete === 'flex',
       JSON.stringify(fin));
    ok('l\'écran de fin ne déborde pas', fin.over <= 1, String(fin.over));

    await page.evaluate(() => { window._lsClose(); });
    await page.waitForTimeout(200);
    await page.evaluate(() => window.launchSession(
      [{ n: 'Squat jump', s: '2', r: '10 reps', rest: '30 s' }], 'Jour test', 'PROG', 'se', 'test'));
    await page.waitForTimeout(500);
    const back = await page.evaluate(() => {
      const d = id => getComputedStyle(document.getElementById(id)).display;
      return { stage: d('lsStage'), footer: d('lsFooter'), complete: d('lsComplete'),
               btn: document.getElementById('lsBtnDone').textContent.trim() };
    });
    ok('fermer puis relancer restaure l\'écran complet',
       back.stage !== 'none' && back.footer !== 'none' && back.complete === 'none' && /fait|valider/i.test(back.btn),
       JSON.stringify(back));
  }

  console.log('\n=== §3 — LE BLOC VIDÉO NE DISPARAÎT JAMAIS ===\n');
  {
    await page.evaluate(() => {
      const f = document.getElementById('seFeedback'); if (f) f.style.display = 'none';
    });
    await open([
      { n: 'Fente isométrique', s: '3', r: '30-45 s / jambe', rest: '1 mn', video: 'dQw4w9WgXcQ' },
      { n: 'Toe taps — Coordination tibial', s: '3', r: '20 reps', rest: '30 s' }
    ], 'Jour test', 'PROGRAMME TEST', 'se');
    const withV = await page.evaluate(() => {
      const vw = document.getElementById('lsVideoWrap');
      const r = vw.getBoundingClientRect();
      return { h: Math.round(r.height), top: Math.round(r.top),
               display: getComputedStyle(vw).display,
               play: getComputedStyle(document.getElementById('lsPlayCircle')).display,
               soon: getComputedStyle(document.getElementById('lsVideoSoon')).display,
               link: getComputedStyle(document.getElementById('lsVideoLink')).display,
               clickable: vw.getAttribute('role') };
    });
    await page.evaluate(() => { window._LS.idx = 1; window._lsRenderEx(); });
    await page.waitForTimeout(150);
    await shot(path.join(OUT, 'v3-placeholder.png'));
    const noV = await page.evaluate(() => {
      const vw = document.getElementById('lsVideoWrap');
      const r = vw.getBoundingClientRect();
      return { h: Math.round(r.height), top: Math.round(r.top),
               display: getComputedStyle(vw).display,
               play: getComputedStyle(document.getElementById('lsPlayCircle')).display,
               soon: getComputedStyle(document.getElementById('lsVideoSoon')).display,
               txt: document.getElementById('lsVideoSoon').textContent.trim(),
               link: getComputedStyle(document.getElementById('lsVideoLink')).display,
               clickable: vw.getAttribute('role') };
    });
    ok('le bloc existe dans les deux états',
       withV.display !== 'none' && noV.display !== 'none');
    ok('aucun saut de layout entre les deux exercices',
       withV.h === noV.h && withV.top === noV.top,
       'avec: h=' + withV.h + ' top=' + withV.top + ' | sans: h=' + noV.h + ' top=' + noV.top);
    ok('avec vidéo : bouton play, lien visible',
       withV.play !== 'none' && withV.soon === 'none' && withV.link !== 'none'
       && withV.clickable === 'button');
    ok('sans vidéo : "Démo à venir", pas de play, pas de lien',
       noV.play === 'none' && noV.soon !== 'none' && noV.link === 'none'
       && /Démo à venir/.test(noV.txt), JSON.stringify(noV));
    ok('le placeholder n\'est pas cliquable', noV.clickable === null, String(noV.clickable));
    ok('aucun message d\'erreur dans le placeholder',
       !/indisponible|erreur|manquant/i.test(noV.txt), noV.txt);
    // Aucun saut de layout sur une vraie séance complète.
    await open(PV_J6.exos, PV_J6.name, 'SHRED EXPLOSE', 'se');
    const tops = [];
    for (let i = 0; i < PV_J6.exos.length; i++) {
      await page.evaluate(i => { window._LS.idx = i; window._LS.setNum = 1; window._lsRenderEx(); }, i);
      await page.waitForTimeout(35);
      tops.push(await page.evaluate(() => {
        const r = document.getElementById('lsVideoWrap').getBoundingClientRect();
        return Math.round(r.top) + '/' + Math.round(r.height);
      }));
    }
    ok('les 12 exercices de la séance gardent le bloc vidéo à la même place',
       new Set(tops).size === 1, tops.join(', '));
  }

  console.log('\n=== LES 10 ACQUIS DE LA V1 — VÉRIFIÉS UN PAR UN ===\n');
  {
    // Le brief V2 liste 10 comportements à ne casser sous aucun prétexte.
    // Cette section les rejoue explicitement, dans l'ordre du brief.
    // Le bilan de fin ouvert par la section précédente capte encore les taps.
    await page.evaluate(() => {
      const f = document.getElementById('seFeedback'); if (f) f.style.display = 'none';
    });
    await open(PV_J6.exos, PV_J6.name, 'SHRED EXPLOSE', 'se');
    const a = await page.evaluate(() => {
      const q = id => document.getElementById(id);
      const cs = el => getComputedStyle(el);
      const st = q('lsStage'), body = q('lsBody');
      const acts = document.querySelectorAll('.ls-actions button');
      const nl = q('lsNextLine');
      const nm = q('lsExName');
      return {
        scroll: (st.scrollHeight - st.clientHeight) + (body.scrollHeight - body.clientHeight),
        footerFixed: cs(q('lsFooter')).flexShrink === '0',
        actions: Array.from(acts).map(b => b.textContent.trim()),
        actionH: Math.round(acts[1].getBoundingClientRect().height),
        titleTransform: cs(nm).textTransform,
        titleColor: cs(nm).color,
        titleFont: cs(nm).fontFamily,
        nextTxt: nl.innerText.trim(),
        nextClipped: nl.scrollHeight > nl.clientHeight + 1,
        header: q('lsSessName').innerText.trim(),
        headerClipped: q('lsSessName').scrollHeight > q('lsSessName').clientHeight + 1,
        dashes: document.querySelectorAll('#lsDashes .ls-dash').length,
        stage: st.innerText
      };
    });
    ok('1. zéro scroll', a.scroll <= 1, String(a.scroll));
    ok('2. barre d\'action fixe ‹ · CTA · ›',
       a.footerFixed && a.actions.length === 3 && a.actions[0] === '‹' && a.actions[2] === '›'
       && a.actionH >= 56, JSON.stringify(a.actions) + ' h=' + a.actionH);
    ok('4. titre en casse normale, blanc, police de texte',
       a.titleTransform === 'none' && a.titleColor === 'rgb(255, 255, 255)'
       && /Outfit/.test(a.titleFont), a.titleTransform + ' ' + a.titleColor);
    ok('5. "ENSUITE [nom complet]" jamais tronqué',
       /^ENSUITE/i.test(a.nextTxt) && !a.nextClipped && a.nextTxt.indexOf('…') < 0, a.nextTxt);
    ok('6. header complet, non tronqué',
       a.header === 'Jour 6 — LOWER : Isométrique avancé + Pied' && !a.headerClipped, a.header);
    ok('8. carte de séance en tirets (12 exos)', a.dashes === 12, String(a.dashes));
    ok('10. CLASSIQUE / — SÉRIES / durée sous REPS restent supprimés',
       !/classique/i.test(a.stage) && a.stage.split('\n').every(l => l.trim() !== '—')
       && !/\bmn\b[\s\S]{0,12}REPS/i.test(a.stage), a.stage.replace(/\n/g, ' | '));

    // 3 — CTA contextuel : DÉMARRER → PAUSE → (exo en reps) FAIT
    await page.evaluate(() => { window._LS.idx = 1; window._LS.setNum = 1; window._lsRenderEx(); });
    await page.waitForTimeout(120);
    const l1 = (await page.textContent('#lsBtnDone')).trim();
    await page.click('#lsBtnDone'); await page.waitForTimeout(400);
    const l2 = (await page.textContent('#lsBtnDone')).trim();
    await page.evaluate(() => { window._LS.idx = 7; window._LS.setNum = 1; window._lsRenderEx(); });
    await page.waitForTimeout(120);
    const l3 = (await page.textContent('#lsBtnDone')).trim();
    ok('3. CTA contextuel Démarrer → Pause → Fait',
       /démarrer/i.test(l1) && /pause/i.test(l2) && /fait/i.test(l3),
       [l1, l2, l3].join(' → '));

    // 7 — CÔTÉ GAUCHE en bleu
    await page.evaluate(() => { window._LS.idx = 2; window._LS.setNum = 1; window._lsRenderEx(); });
    await page.waitForTimeout(120);
    const side = await page.evaluate(() => {
      const el = Array.from(document.querySelectorAll('#lsMode .ls-mode-kicker'))
        .find(e => /côté/i.test(e.textContent));
      return el ? { txt: el.innerText.trim(), col: getComputedStyle(el).color } : null;
    });
    ok('7. côté gauche/droit annoncé en bleu',
       side && /gauche/i.test(side.txt) && side.col === 'rgb(74, 158, 219)',
       side ? side.txt + ' ' + side.col : 'absent');

    // 9 — chrono et reps restent deux gabarits distincts
    const modes = await page.evaluate(() => {
      const grab = i => { window._LS.idx = i; window._LS.setNum = 1; window._lsRenderEx();
                          return document.getElementById('lsMode').innerHTML; };
      return { chrono: grab(1), reps: grab(7) };
    });
    // Acquis V5 n°4 et n°6, non couverts jusqu'ici.
    const g = await page.evaluate(() => {
      window._LS.idx = 0; window._lsRenderEx();
      const first = document.getElementById('lsPrevBtn').disabled;
      window._LS.idx = 3; window._lsRenderEx();
      const mid = document.getElementById('lsPrevBtn').disabled;
      window._LS.idx = window._LS.exos.length - 1; window._lsRenderEx();
      return { first: first, mid: mid, last: document.getElementById('lsNextBtn').disabled };
    });
    ok('‹ est grisé sur le premier exercice, actif ensuite',
       g.first === true && g.mid === false && g.last === true, JSON.stringify(g));
    await page.evaluate(() => {
      localStorage.setItem('ah_track_history', JSON.stringify([{
        exerciseName: 'Squat jump', exo: 'Squat jump', method: 'charge',
        essais: [{ reps: 3 }], date: '2026-08-20', source: 'live_session', rpe: 0 }]));
    });
    await open([{ n: 'Squat jump', s: '4', r: '8-12 reps', rest: '1 mn' }],
               'Jour test', 'PROGRAMME TEST', 'se');
    const hist = await page.evaluate(() => document.getElementById('lsMode').innerText);
    ok('le rappel "Dernière fois" est présent et chiffré',
       /Dernière fois/i.test(hist) && /3 reps/.test(hist), hist.replace(/\n/g, ' | '));
    await open(PV_J6.exos, PV_J6.name, 'SHRED EXPLOSE', 'se');

    ok('9. chrono et reps sont deux gabarits distincts',
       /lsBigVal/.test(modes.chrono) && !/ls-stepper/.test(modes.chrono)
       && /ls-stepper/.test(modes.reps) && !/lsBigVal/.test(modes.reps));
    await page.evaluate(() => { window._lsClose(); });
    await page.waitForTimeout(150);
  }

  console.log('\n=== AUCUNE ERREUR JS ===\n');
  {
    const real = errs.filter(e => !/firebase|network|Failed to fetch|importScripts|ServiceWorker/i.test(e));
    ok('aucune exception pendant la navigation de séance', real.length === 0, real.slice(0, 2).join(' | '));
  }

  await browser.close();
  server.close();
  if (!KEEP) fs.rmSync(OUT, { recursive: true, force: true });
  else console.log('\nCaptures : ' + OUT);

  const failed = R.filter(x => !x).length;
  console.log('\n' + '='.repeat(62));
  console.log(failed ? 'RÉSULTAT : ' + failed + ' ÉCHEC(S) sur ' + R.length
                     : 'RÉSULTAT : ' + R.length + '/' + R.length + ' tests passés.');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
