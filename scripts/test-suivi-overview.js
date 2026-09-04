// Vue d'ensemble du Suivi — rendue dans un vrai Chromium, dans les trois
// états où un athlète la trouve réellement.
// La règle qu'on protège ici : AUCUNE DONNÉE INVENTÉE. Quand la mesure
// manque, l'écran dit ce qui manque, jamais un chiffre fabriqué.
//   node scripts/test-suivi-overview.js [autre.html]
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
  const cdp = await page.context().newCDPSession(page);
  const KEEP = process.env.KEEP_SHOTS === '1';
  const OUT = path.join(REPO, '.tmp-suivi');
  if (KEEP && !fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
  const shot = async (f) => {
    if (!KEEP) return;
    const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(OUT, f), Buffer.from(data, 'base64'));
  };
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto(base + '/index.html', { waitUntil: 'domcontentloaded' });
  try {
    await page.waitForFunction(() => typeof window.renderSuiviOverview === 'function', { timeout: 20000 });
  } catch (e) {
    console.log('  FAIL  la vue d\'ensemble est absente de cette base');
    console.log('\n' + '='.repeat(58) + '\nRÉSULTAT : 1 ÉCHEC(S) sur 1');
    await browser.close(); server.close(); process.exit(1);
  }

  const R = []; const ok = (l, c, d) => { R.push(c); console.log((c ? '  PASS  ' : '  FAIL  ') + l + (d && !c ? '  → ' + d : '')); };

  // `satValues` et `OB` sont les sources réelles des métriques : on les pose
  // comme l'app le fait, plutôt que de simuler la sortie du calcul.
  async function etat(profil, satV, hist) {
    await page.evaluate(([profil, satV, hist]) => {
      document.querySelectorAll('.scr').forEach(v => { v.style.display = 'none'; v.classList.remove('on'); });
      localStorage.setItem('ah_profile', JSON.stringify(profil));
      localStorage.setItem('ah_set_history', JSON.stringify(hist));
      localStorage.removeItem('ah_track_history');
      // switchTab('tracks') appelle initSATv7(), qui remet satValues à {}.
      // On pose donc les valeurs APRÈS le changement d'onglet.
      window.switchTab('tracks');
      window.satValues = satV;
      window.renderSuiviOverview();
    }, [profil, satV, hist]);
    await page.waitForTimeout(350);
  }
  const lire = () => page.evaluate(() => {
    const q = (s) => { const e = document.querySelector(s); return e ? e.textContent.replace(/\s+/g, ' ').trim() : null; };
    const b = document.getElementById('mainScroll') || document.body;
    return {
      score: q('.sv-score'), lock: q('.sv-lock-t'),
      dims: Array.from(document.querySelectorAll('.sv-dim')).map(e => e.textContent.replace(/\s+/g, ' ').trim()),
      note: q('.sv-hero-note'),
      prog: Array.from(document.querySelectorAll('.sv-prog-i')).map(e => e.textContent.replace(/\s+/g, ' ').trim()),
      vide: q('.sv-empty'),
      titan: Array.from(document.querySelectorAll('.sv-titan-i')).map(e => e.textContent.replace(/\s+/g, ' ').trim()),
      prio: q('.sv-prio-t'), prioS: q('.sv-prio-s'),
      act: q('.sv-act-t'), actS: q('.sv-act-s'),
      hist: Array.from(document.querySelectorAll('.sv-hist-i')).map(e => e.textContent.replace(/\s+/g, ' ').trim()),
      scrollX: b.scrollWidth - b.clientWidth,
      // Ordre des blocs : c'est la hiérarchie demandée.
      ordre: Array.from(document.querySelectorAll('#overviewBody > div, #overviewBody > button'))
        .map(e => e.className).filter(Boolean)
    };
  });

  console.log('\n=== ÉTAT 1 · AUCUNE MESURE ===\n');
  await etat({ prenom: 'Test', sexe: 'homme' }, {}, []);
  let v = await lire();
  ok('le score est verrouillé, sans chiffre inventé', v.score === null && /Ton score t'attend/.test(v.lock || ''), v.lock);
  ok('  et le blocage donne envie plutôt que d\'annoncer une panne',
     /découvrir ce qui limite/.test(await page.evaluate(() => document.querySelector('.sv-lock-s').textContent)));
  ok('aucune dimension n\'est affichée sans mesure', v.dims.length === 0, JSON.stringify(v.dims));
  ok('la progression dit ce qui manque', /Aucun test enregistré/.test(v.vide || ''), v.vide);
  ok('  et n\'invente aucun pourcentage', v.prog.length === 0);
  ok('Titan n\'observe rien sans données', v.titan.length === 0, JSON.stringify(v.titan));
  ok('la priorité ne dit plus « à déterminer »',
     v.prio === 'Analyse en cours' && !/déterminer/i.test(v.prio), v.prio);
  ok('  et explique comment l\'obtenir', /Passe tes tests/.test(v.prioS || ''), v.prioS);
  ok('l\'action est le test', /Passer mes tests/.test(v.act || ''), v.act);
  ok('l\'historique dit « Aucun » plutôt qu\'un tiret', /Aucun/.test(v.hist.join(' ')), JSON.stringify(v.hist));
  ok('aucun débordement horizontal', v.scrollX <= 0, String(v.scrollX));
  await shot('suivi-1-vide.png');

  console.log('\n=== ÉTAT 2 · UN SEUL TEST ===\n');
  const T1 = { date: new Date(Date.now() - 40 * 86400000).toISOString(),
               values: { set_jump: 300, set_reach: 245, set_sprint60: 8.4, squat_1rm: 100 } };
  await etat({ prenom: 'Test', sexe: 'homme', poids: 75 },
             { jump_diff: 55, p3SprintDist: 30, p3SprintTime: 4.4, p3FMS: 15, squat_1rm: 100 },
             [T1]);
  v = await lire();
  ok('le score s\'affiche', v.score !== null && /\d+/.test(v.score), v.score);
  ok('les 4 dimensions sont listées', v.dims.length === 4, JSON.stringify(v.dims));
  ok('  chacune avec son nom', /Explosivité/.test(v.dims.join(' ')) && /Mobilité/.test(v.dims.join(' ')));
  ok('un seul test → pas de progression inventée',
     v.prog.length === 0 && /pas encore d'écart à mesurer/.test(v.vide || ''), v.vide);
  ok('la priorité nomme une vraie dimension', !!v.prio && v.prio !== 'Analyse en cours', v.prio);
  ok('  et cite son chiffre', /\/100/.test(v.prioS || ''), v.prioS);
  ok('aucun débordement horizontal', v.scrollX <= 0, String(v.scrollX));
  await shot('suivi-2-un-test.png');

  console.log('\n=== ÉTAT 3 · DEUX TESTS + SÉANCES ===\n');
  const T2 = { date: new Date(Date.now() - 3 * 86400000).toISOString(),
               values: { set_jump: 309, set_reach: 245, set_sprint60: 8.15, squat_1rm: 110 } };
  const S = (d, n) => ({ type: 'session', date: new Date(Date.now() - d * 86400000).toISOString(), sessName: n });
  await etat({ prenom: 'Test', sexe: 'homme', poids: 75 },
             { jump_diff: 64, p3SprintDist: 30, p3SprintTime: 4.25, p3FMS: 15, squat_1rm: 110 },
             [T1, T2, S(2, 'Jour 3'), S(1, 'Jour 5'), S(0, 'Jour 6')]);
  v = await lire();
  ok('la progression apparaît MALGRÉ les séances intercalées',
     v.prog.length > 0, JSON.stringify(v.prog));
  // textContent colle le libellé et la valeur : aucune espace supposée.
  ok('  la détente est chiffrée en cm', /Détente verticale\s*\+9 cm/.test(v.prog.join(' | ')), v.prog.join(' | '));
  ok('  le sprint compte un gain quand le temps BAISSE',
     /Sprint 60 m\s*-0\.25 s/.test(v.prog.join(' | ')), v.prog.join(' | '));
  ok('  et le squat en kg', /Squat\s*\+10 kg/.test(v.prog.join(' | ')), v.prog.join(' | '));
  ok('Titan produit des observations', v.titan.length >= 1 && v.titan.length <= 3, JSON.stringify(v.titan));
  ok('  adossées à des chiffres réels', /\d/.test(v.titan.join(' ')), v.titan.join(' | '));
  ok('  et il propose d\'en parler',
     await page.evaluate(() => !!document.querySelector('.sv-titan-cta')));
  ok('l\'action tient compte de l\'activité récente',
     !/Relancer/.test(v.act || ''), v.act);
  ok('aucun débordement horizontal', v.scrollX <= 0, String(v.scrollX));
  await shot('suivi-3-progression.png');

  console.log('\n=== LA HIÉRARCHIE EST DANS L\'ORDRE DEMANDÉ ===\n');
  const pos = (cls) => v.ordre.findIndex(c => c.indexOf(cls) > -1);
  ok('① état → ② progression → ③ Titan → ④ priorité → ⑤ action → ⑥ historique',
     pos('sv-hero') === 0 && pos('sv-prog') > pos('sv-hero')
     && pos('sv-titan') > pos('sv-prog') && pos('sv-prio') > pos('sv-titan')
     && pos('sv-act') > pos('sv-prio') && pos('sv-hist') > pos('sv-act'),
     v.ordre.join(' → '));
  ok('une SEULE carte navy pleine en bas de page',
     await page.evaluate(() => document.querySelectorAll('.sv-act').length === 1));

  console.log('\n=== LA CHARTE N\'A PAS BOUGÉ ===\n');
  {
    const html = fs.readFileSync(HTML, 'utf8');
    const bloc = html.slice(html.indexOf("/* ═══ SUIVI — VUE D'ENSEMBLE ═══"), html.indexOf('/* ═══ CARTE NUTRITION'));
    const couleurs = (bloc.match(/#[0-9A-Fa-f]{3,6}/g) || []);
    const autorisees = ['#0F1B33', '#fff', '#FFF', '#2F7D52', '#B4692A'];
    const hors = couleurs.filter(c => autorisees.indexOf(c) < 0);
    ok('aucune couleur hors charte introduite', hors.length === 0, hors.join(', '));
    ok('  navy et or viennent des variables existantes',
       /var\(--navy\)/.test(bloc) && /var\(--gold\)/.test(bloc));
    ok('  les typographies restent celles du projet',
       /Bebas Neue/.test(bloc) && /JetBrains Mono/.test(bloc) && /Outfit/.test(bloc)
       && !/font-family:\s*'(?!Bebas|JetBrains|Outfit)/.test(bloc));
  }

  console.log('\n=== PETIT ÉCRAN (320×568) ===\n');
  await page.setViewportSize({ width: 320, height: 568 });
  await page.evaluate(() => window.renderSuiviOverview());
  await page.waitForTimeout(300);
  const p320 = await page.evaluate(() => {
    const b = document.getElementById('mainScroll') || document.body;
    const cta = document.querySelector('.sv-act');
    return { scrollX: b.scrollWidth - b.clientWidth,
             ctaH: cta ? cta.getBoundingClientRect().height : 0,
             dims: document.querySelectorAll('.sv-dim').length };
  });
  ok('aucun débordement horizontal en 320 px', p320.scrollX <= 0, String(p320.scrollX));
  {
    // Un onglet « Progre… » est pire qu'un onglet plus petit : les quatre
    // libellés doivent tenir EN ENTIER, aux deux largeurs.
    const coupe = async () => page.evaluate(() =>
      Array.from(document.querySelectorAll('#vTracks .sub-tab'))
        .filter(e => e.scrollWidth > e.clientWidth + 1)
        .map(e => e.textContent.trim()));
    ok('aucun onglet n\'est tronqué en 320 px', (await coupe()).length === 0, (await coupe()).join(', '));
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(200);
    ok('  ni en 375 px', (await coupe()).length === 0, (await coupe()).join(', '));
    ok('  et les quatre sont bien là',
       await page.evaluate(() => document.querySelectorAll('#vTracks .sub-tab').length === 4));
  }
  ok('la carte action reste tapable', p320.ctaH >= 44, Math.round(p320.ctaH) + 'px');
  ok('les 4 dimensions tiennent toujours', p320.dims === 4, String(p320.dims));

  ok('aucune exception JS', errs.filter(e => !/firebase|fetch|ServiceWorker/i.test(e)).length === 0,
     errs.slice(0, 2).join(' | '));

  const bad = R.filter(x => !x).length;
  console.log('\n' + '='.repeat(58));
  console.log(bad ? 'RÉSULTAT : ' + bad + ' ÉCHEC(S) sur ' + R.length : 'RÉSULTAT : ' + R.length + '/' + R.length + ' tests passés.');
  await browser.close(); server.close();
  process.exit(bad ? 1 : 0);
})();
