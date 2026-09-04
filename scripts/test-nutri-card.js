// La carte d'action nutritionnelle de Titan, rendue dans un vrai Chromium.
// Ce qui n'est vérifiable qu'ici : le détail replié (une classe `display:flex`
// bat la règle `[hidden]{display:none}` — `el.hidden` peut valoir true pendant
// que le bloc reste VISIBLE), la lisibilité des totaux à l'arrivée de la carte,
// et le fait que le journal Nutrition reflète réellement l'écriture.
//   node scripts/test-nutri-card.js [autre.html]
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
  const OUT = path.join(REPO, '.tmp-nutri-card');
  if (KEEP && !fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
  const shot = async f => {
    if (!KEEP) return;
    const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(OUT, path.basename(f)), Buffer.from(data, 'base64'));
  };
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto(base + '/index.html', { waitUntil: 'domcontentloaded' });
  try {
    await page.waitForFunction(() => typeof window._titanRenderNutriCard === 'function', { timeout: 20000 });
  } catch (e) {
    console.log('  FAIL  la carte nutritionnelle est absente de cette base');
    console.log('\n' + '='.repeat(58));
    console.log('RÉSULTAT : 1 ÉCHEC(S) sur 1');
    await browser.close(); server.close();
    process.exit(1);
  }

  const R = []; const ok = (l,c,d) => { R.push(c); console.log((c?'  PASS  ':'  FAIL  ')+l+(d&&!c?'  → '+d:'')); };

  const NUT = {
    items: [
      { name:'Attiéké', quantity:'300 g', calories:330, protein:2, carbs:72, fat:1, estimated:false },
      { name:'Poulet grillé', quantity:'2 morceaux', calories:280, protein:35, carbs:0, fat:14, estimated:true },
      { name:'Tomates + salade', quantity:'une portion', calories:30, protein:1, carbs:6, fat:0, estimated:true },
      { name:'Créatine', quantity:'5 g', calories:0, protein:0, carbs:0, fat:0, estimated:false }
    ],
    totals: { calories:640, protein:38, carbs:78, fat:15 },
    estimatedItems: ['quantité de poulet', 'taille de la salade'],
    confidence: 'moyenne', wantsSave: true,
    question: 'Tu peux me donner le poids du poulet ? Ça change le total de 100 kcal.'
  };

  await page.evaluate(() => {
    localStorage.removeItem('ah_nutri_journal');
    localStorage.setItem('ah_titan_chat', JSON.stringify([
      { role:'user', content:"Ojd j'ai manger de l'attiéké avec du poulet, salade tomates et 5g de creatine. Calcule mon total.", t: Date.now()-60000 },
      { role:'assistant', content:"Environ 640 kcal, 38 g de protéines. La quantité de poulet n'était pas précisée — c'est une estimation.", t: Date.now()-30000 }
    ]));
    document.querySelectorAll('.scr').forEach(v => { v.style.display='none'; v.classList.remove('on'); });
    window.switchTab('chat');
  });
  await page.waitForTimeout(400);
  await page.evaluate((n) => window._titanRenderNutriCard(n), NUT);
  await page.waitForTimeout(700);

  console.log('\n=== LA CARTE ===\n');
  let st = await page.evaluate(() => {
    const c = document.querySelector('.tn-card');
    const b = document.getElementById('chatBody');
    return { exists: !!c, id: c && c.id,
      totals: Array.from(document.querySelectorAll('.tn-t-v')).map(e => e.textContent.trim()),
      warn: (document.querySelector('.tn-warn')||{}).textContent,
      q: (document.querySelector('.tn-q')||{}).textContent,
      // On MESURE : `el.hidden` peut valoir true alors que la règle
      // display:flex de la classe l'emporte et laisse le bloc visible.
      detailHidden: document.querySelector('.tn-items').getBoundingClientRect().height === 0,
      btn: (document.querySelector('.tn-btn-go')||{}).textContent,
      btnH: document.querySelector('.tn-btn-go').getBoundingClientRect().height,
      width: c.getBoundingClientRect().width,
      scrollX: b.scrollWidth - b.clientWidth,
      journal: JSON.parse(localStorage.getItem('ah_nutri_journal') || '[]').length };
  });
  ok('la carte est rendue', st.exists === true);
  ok('les 4 totaux sont affichés', st.totals.join(' ') === '640 38g 78g 15g', st.totals.join(' '));
  ok('les incertitudes sont nommées', /quantité de poulet/.test(st.warn||''), st.warn);
  ok('  et présentées comme une estimation', /estimation/.test(st.warn||''));
  ok('la question de précision est posée', /poids du poulet/.test(st.q||''), st.q);
  ok('le détail est replié par défaut — mesuré, pas déduit', st.detailHidden === true);
  ok('  et la carte entière tient dans l\'écran',
     await page.evaluate(() => document.querySelector('.tn-card').getBoundingClientRect().height < 560),
     await page.evaluate(() => Math.round(document.querySelector('.tn-card').getBoundingClientRect().height) + 'px'));
  ok('le bouton dit ce qu\'il fait', /Enregistrer dans mon journal/.test(st.btn||''), st.btn);
  ok('  et fait au moins 44 px', st.btnH >= 44, Math.round(st.btnH)+'px');
  ok('la carte occupe la largeur du fil', st.width > 300, Math.round(st.width)+'px');
  ok('aucun débordement horizontal', st.scrollX <= 0, String(st.scrollX));
  {
    // Les totaux sont ce que l'athlète vient lire : ils doivent être VISIBLES
    // à l'arrivée de la carte, pas au-dessus de la zone affichée.
    const v = await page.evaluate(() => {
      const t = document.querySelector('.tn-totals').getBoundingClientRect();
      const b = document.getElementById('chatBody').getBoundingClientRect();
      return { ok: t.top >= b.top - 1 && t.bottom <= b.bottom + 1, top: Math.round(t.top), bTop: Math.round(b.top) };
    });
    ok('les totaux sont visibles sans scroller', v.ok === true, 'totaux à ' + v.top + ', zone à ' + v.bTop);
  }
  ok('RIEN n\'est encore écrit dans le journal', st.journal === 0, String(st.journal));
  await shot(__dirname + '/nutri-1-carte.png');

  await page.evaluate(() => document.querySelector('.tn-toggle').click());
  await page.waitForTimeout(150);
  st = await page.evaluate(() => ({
    hidden: document.querySelector('.tn-items').getBoundingClientRect().height === 0,
    items: document.querySelectorAll('.tn-item').length,
    est: document.querySelectorAll('.tn-est').length,
    label: document.querySelector('.tn-toggle').textContent
  }));
  ok('le détail s\'ouvre', st.hidden === false);
  ok('  les 4 aliments y sont', st.items === 4, String(st.items));
  ok('  seuls les estimés portent le marqueur', st.est === 2, String(st.est));
  ok('  le libellé du bouton suit', /masquer le détail/.test(st.label), st.label);
  await shot(__dirname + '/nutri-2-detail.png');

  console.log('\n=== L\'ÉCRITURE PART DU TAP, ET D\'ELLE SEULE ===\n');
  await page.evaluate(() => document.querySelector('.tn-btn-go').click());
  await page.waitForTimeout(300);
  st = await page.evaluate(() => {
    const j = JSON.parse(localStorage.getItem('ah_nutri_journal') || '[]');
    return { n: j.length, e: j[0], done: (document.querySelector('.tn-done')||{}).textContent,
             btnGone: !document.querySelector('.tn-btn-go') };
  });
  ok('une entrée est écrite', st.n === 1, String(st.n));
  ok('  avec les bons totaux', st.e.totals.cal === 640 && st.e.totals.p === 38, JSON.stringify(st.e.totals));
  ok('  la source est « titan »', st.e.source === 'titan');
  ok('  le détail des aliments est gardé', st.e.foods.length === 4);
  ok('la carte confirme', /Enregistré/.test(st.done||'') && /640 kcal/.test(st.done||''), st.done);
  ok('  et le bouton disparaît (pas de double écriture possible)', st.btnGone === true);
  await shot(__dirname + '/nutri-3-enregistre.png');

  // Le journal du jour doit refléter l'ajout.
  await page.evaluate(() => window.switchTab('nutri'));
  await page.waitForTimeout(400);
  const jr = await page.evaluate(() => ({
    kcal: (document.getElementById('jRdiTotal')||{}).textContent,
    prot: (document.getElementById('jProtTotal')||{}).textContent,
    repas: (document.getElementById('jRepasCount')||{}).textContent,
    names: Array.from(document.querySelectorAll('.jml-name')).map(e => e.textContent.trim())
  }));
  ok('le journal Nutrition affiche le repas', jr.names.some(n => /Attiéké/.test(n)), JSON.stringify(jr.names));
  ok('  et le compte de repas', jr.repas === '1', jr.repas);
  ok('  et les protéines du jour', jr.prot === '38g', jr.prot);
  await shot(__dirname + '/nutri-4-journal.png');

  // Rechargement : la donnée doit rester.
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window._titanRenderNutriCard === 'function', { timeout: 20000 });
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem('ah_nutri_journal') || '[]'));
  ok('TEST 4 — la donnée survit au rechargement', after.length === 1 && after[0].totals.cal === 640);

  ok('aucune exception JS', errs.filter(e => !/firebase|fetch|ServiceWorker/i.test(e)).length === 0,
     errs.slice(0,2).join(' | '));

  const bad = R.filter(x => !x).length;
  console.log('\n' + '='.repeat(58));
  console.log(bad ? 'RÉSULTAT : ' + bad + ' ÉCHEC(S) sur ' + R.length : 'RÉSULTAT : ' + R.length + '/' + R.length + ' tests passés.');
  await browser.close(); server.close();
  process.exit(bad ? 1 : 0);
})();
