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
    ok('le compte à rebours est bleu, jamais or', r.col === 'rgb(74, 158, 219)', r.col);
    ok('le prochain exercice est nommé en entier',
       r.next.indexOf('Squat excentrique') > -1 && r.next.indexOf('…') < 0, r.next.replace(/\n/g, ' | '));
    ok('l\'écran de repos ne scrolle pas', r.overflow <= 1, String(r.overflow));
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

    await page.click('.ls-rest-skip');
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
    await page.click('.ls-rest-skip');
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
    await page.click('.ls-rpe-dot:nth-child(8)');
    const before = await page.evaluate(() => ({
      kg: document.getElementById('lsStep_load').textContent,
      reps: document.getElementById('lsStep_reps').textContent,
      rpe: window._LS.mb.rpe
    }));
    ok('les steppers ajustent sans ouvrir le clavier',
       before.kg === '5' && before.reps === '5' && before.rpe === 8, JSON.stringify(before));
    await page.click('#lsBtnDone');
    await page.waitForTimeout(200);
    const hist = await page.evaluate(() => JSON.parse(localStorage.getItem('ah_track_history') || '[]'));
    ok('la série part dans ah_track_history au format du tracker',
       hist.length === 1 && hist[0].exerciseName === 'Back squat'
       && hist[0].method === 'charge' && hist[0].essais[0].load === 5
       && hist[0].essais[0].reps === 5 && hist[0].rpe === 8 && hist[0].source === 'live_session',
       JSON.stringify(hist[0] || null));
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
