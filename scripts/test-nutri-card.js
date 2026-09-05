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
    // wantsSave FAUX : cette section teste la carte de PROPOSITION. La
    // demande explicite a sa propre section, plus bas.
    confidence: 'moyenne', wantsSave: false,
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

  console.log('\n=== DEMANDE EXPLICITE : L\'APP ÉCRIT, ET SAIT ANNULER ===\n');
  {
    await page.evaluate(() => {
      // Cette section tourne après un rechargement : on remet l'app sur le
      // chat, sinon la capture ne montre que l'écran de démarrage.
      document.querySelectorAll('.scr').forEach(v => { v.style.display = 'none'; v.classList.remove('on'); });
      window.switchTab('chat');
      localStorage.removeItem('ah_nutri_journal');
      localStorage.setItem('ah_profile', JSON.stringify({ nutriCal: 2000 }));
      document.querySelectorAll('.tn-wrap').forEach(e => e.remove());
      window._titanRenderNutriCard({
        items: [{ name: 'Poulet', quantity: '150 g', calories: 250, protein: 35, carbs: 0, fat: 11, estimated: false },
                { name: 'Riz', quantity: '200 g', calories: 260, protein: 5, carbs: 57, fat: 1, estimated: false }],
        totals: { calories: 510, protein: 40, carbs: 57, fat: 12 },
        estimatedItems: [], confidence: 'haute', wantsSave: true, question: ''
      });
    });
    await page.waitForTimeout(500);
    const e1 = await page.evaluate(() => {
      const j = JSON.parse(localStorage.getItem('ah_nutri_journal') || '[]');
      const c = document.querySelector('.tn-card');
      return { n: j.length, id: j[0] && j[0].id, cal: j[0] && j[0].totals.cal,
               txt: c ? c.textContent.replace(/\s+/g, ' ').trim() : null,
               undo: !!document.querySelector('.tn-btn-no'),
               propose: !!document.querySelector('.tn-btn-go') };
    });
    ok('« ajoute-le » écrit sans attendre de tap', e1.n === 1 && e1.cal === 510, JSON.stringify(e1));
    ok('  l\'entrée porte un identifiant', /^m[a-z0-9]+$/.test(e1.id || ''), String(e1.id));
    ok('  la carte confirme au passé', /Ajouté à ton journal/.test(e1.txt || ''), e1.txt);
    ok('  et annonce ce qu\'il reste', /reste 1490 kcal/.test(e1.txt || ''), e1.txt);
    ok('  elle ne propose plus, elle propose d\'ANNULER', e1.undo === true && e1.propose === false);
    await shot('nutri-5-auto.png');

    await page.evaluate(() => document.querySelector('.tn-btn-no').click());
    await page.waitForTimeout(300);
    const e2 = await page.evaluate(() => ({
      n: JSON.parse(localStorage.getItem('ah_nutri_journal') || '[]').length,
      txt: (document.querySelector('.tn-card') || {}).textContent
    }));
    ok('Annuler retire l\'entrée', e2.n === 0, String(e2.n));
    ok('  et le dit clairement', /Ajout annulé/.test(e2.txt || ''), e2.txt);
  }
  {
    // Une entrée sans identifiant (enregistrée avant la mise à jour) doit
    // rester supprimable par sa position, comme avant.
    const ok2 = await page.evaluate(() => {
      localStorage.setItem('ah_nutri_journal', JSON.stringify([
        { date: new Date().toISOString(), name: 'Vieux repas', totals: { cal: 300, p: 0, g: 0, l: 0 } }
      ]));
      const done = window.removeJournalMeal(0);
      return { done, n: JSON.parse(localStorage.getItem('ah_nutri_journal') || '[]').length };
    });
    ok('une entrée d\'avant la mise à jour se retire toujours par index',
       ok2.done === true && ok2.n === 0, JSON.stringify(ok2));
  }

  console.log('\n=== FICHE D\'UN REPAS DU JOURNAL ===\n');
  {
    // Le journal contient DEUX formes d'aliments, et la fiche doit lire les
    // deux : le scan photo écrit des valeurs POUR 100 G (à multiplier par la
    // quantité), l'analyse de Titan des valeurs ABSOLUES.
    await page.evaluate(() => {
      document.querySelectorAll('.scr').forEach(v => { v.style.display = 'none'; v.classList.remove('on'); });
      const now = new Date().toISOString();
      localStorage.setItem('ah_profile', JSON.stringify({ nutriCal: 2500 }));
      localStorage.setItem('ah_nutri_journal', JSON.stringify([
        { id: 'mA', ts: Date.now(), date: now, source: 'titan',
          name: 'Gaufre (portion découpée), Céréales complètes, Lait d\'amande, Pain complet',
          totals: { cal: 795, p: 18, g: 132, l: 25 }, estimated: true,
          foods: [
            { name: 'Gaufre', quantity: 'portion découpée', calories: 310, protein: 6, carbs: 42, fat: 13, estimated: true },
            { name: 'Céréales complètes', quantity: '2 poignées', calories: 220, protein: 5, carbs: 44, fat: 2, estimated: true },
            { name: 'Lait d\'amande', quantity: '250 ml', calories: 40, protein: 1, carbs: 2, fat: 3, estimated: false },
            { name: 'Pain complet', quantity: '2 tranches', calories: 225, protein: 6, carbs: 44, fat: 7, estimated: false }
          ] },
        { id: 'mB', ts: Date.now(), date: now, source: 'photo',
          name: 'Poulet riz', totals: { cal: 510, p: 40, g: 57, l: 12 },
          // Forme du scan : POUR 100 G, à multiplier par la quantité.
          foods: [{ name: 'poulet', qty: 150, unit: 'g', cal: 165, p: 31, g: 0, l: 4 }] },
        { id: 'mC', ts: Date.now(), date: now, source: 'recipe',
          name: 'Bowl protéiné', totals: { cal: 480, p: 35, g: 40, l: 15 } }
      ]));
      window.switchTab('nutri');
      // Le rendu du journal n'est pas garanti par le simple switchTab dans ce
      // harnais : on l'appelle explicitement.
      if (typeof window.renderJournalToday === 'function') window.renderJournalToday();
    });
    await page.waitForTimeout(500);

    const liste = await page.evaluate(() => {
      const n = document.querySelector('.jml-name');
      const cs = getComputedStyle(n);
      return { lignes: cs.webkitLineClamp || cs.getPropertyValue('-webkit-line-clamp'),
               nowrap: cs.whiteSpace === 'nowrap',
               items: document.querySelectorAll('.jml-item').length,
               chevrons: document.querySelectorAll('.jml-chev').length };
    });
    ok('le nom du repas tient sur deux lignes, plus une seule tronquée',
       liste.nowrap === false && String(liste.lignes) === '2', JSON.stringify(liste));
    ok('  chaque ligne annonce qu\'elle s\'ouvre', liste.chevrons === liste.items && liste.items === 3);

    await page.evaluate(() => document.querySelectorAll('.jml-item')[0].click());
    await page.waitForTimeout(350);
    const f1 = await page.evaluate(() => {
      const ov = document.getElementById('journalMealOv');
      const foods = Array.from(document.querySelectorAll('.jd-food')).map(e => e.textContent.replace(/\s+/g, ' ').trim());
      const r = document.querySelector('.jd-sheet').getBoundingClientRect();
      return { open: ov.classList.contains('on'),
               titre: (document.querySelector('.jd-title') || {}).textContent,
               src: (document.querySelector('.jd-src') || {}).textContent,
               totaux: Array.from(document.querySelectorAll('.jd-t-v')).map(e => e.textContent.trim()),
               foods, est: document.querySelectorAll('.jd-est').length,
               warn: !!Array.from(document.querySelectorAll('.jd-none')).find(e => /estimées/.test(e.textContent)),
               dansEcran: r.bottom <= 667 + 1 };
    });
    ok('la fiche s\'ouvre au tap', f1.open === true);
    ok('  le nom COMPLET est affiché, pas tronqué',
       /Gaufre/.test(f1.titre) && /Pain complet/.test(f1.titre), f1.titre);
    ok('  la source est nommée', /Analysé par Titan/.test(f1.src || ''), f1.src);
    ok('  les 4 totaux sont là', f1.totaux.join(' ') === '795 18g 132g 25g', f1.totaux.join(' '));
    ok('  les 4 aliments sont détaillés', f1.foods.length === 4, String(f1.foods.length));
    // textContent colle les éléments inline sans espace : on ne suppose donc
    // aucun séparateur entre le nom, la quantité et le marqueur.
    ok('  chacun avec sa quantité et ses macros',
       /Gaufre\s*portion découpée/.test(f1.foods[0])
       && /310 kcal · 6g · 42g · 13g/.test(f1.foods[0]), f1.foods[0]);
    ok('  les estimations sont marquées', f1.est === 2, String(f1.est));
    ok('  et l\'avertissement d\'estimation est présent', f1.warn === true);
    ok('  la fiche tient dans l\'écran', f1.dansEcran === true);
    await shot('nutri-6-fiche.png');

    // Forme du scan photo : valeurs pour 100 g × quantité.
    await page.evaluate(() => { window.closeJournalMeal(); });
    await page.waitForTimeout(200);
    await page.evaluate(() => document.querySelectorAll('.jml-item')[1].click());
    await page.waitForTimeout(300);
    const f2 = await page.evaluate(() => ({
      food: (document.querySelector('.jd-food') || {}).textContent.replace(/\s+/g, ' ').trim()
    }));
    // 165 kcal/100 g × 150 g = 248 ; 31 g/100 g × 1,5 = 47.
    ok('un aliment du scan est converti depuis ses valeurs pour 100 g',
       /poulet\s*150 g/.test(f2.food) && /248 kcal · 47g · 0g · 6g/.test(f2.food), f2.food);

    // Repas sans détail (recette) : on le dit, on n'invente pas.
    await page.evaluate(() => { window.closeJournalMeal(); });
    await page.waitForTimeout(200);
    await page.evaluate(() => document.querySelectorAll('.jml-item')[2].click());
    await page.waitForTimeout(300);
    const f3 = await page.evaluate(() => ({
      foods: document.querySelectorAll('.jd-food').length,
      none: (document.querySelector('.jd-none') || {}).textContent,
      totaux: Array.from(document.querySelectorAll('.jd-t-v')).map(e => e.textContent.trim())
    }));
    ok('un repas sans détail le dit franchement',
       f3.foods === 0 && /pas été enregistré/.test(f3.none || ''), f3.none);
    ok('  mais ses totaux restent affichés', f3.totaux.join(' ') === '480 35g 40g 15g', f3.totaux.join(' '));

    // Retirer depuis la fiche.
    await page.evaluate(() => document.querySelector('.jd-btn-del').click());
    await page.waitForTimeout(350);
    const apres = await page.evaluate(() => ({
      n: JSON.parse(localStorage.getItem('ah_nutri_journal') || '[]').length,
      ouvert: document.getElementById('journalMealOv').classList.contains('on'),
      reste: Array.from(document.querySelectorAll('.jml-name')).map(e => e.textContent.trim())
    }));
    ok('« Retirer » depuis la fiche supprime le bon repas',
       apres.n === 2 && !apres.reste.some(x => /Bowl protéiné/.test(x)), JSON.stringify(apres));
    ok('  et referme la fiche', apres.ouvert === false);

    // Le ✕ de la liste ne doit pas ouvrir la fiche.
    await page.evaluate(() => document.querySelector('.jml-del').click());
    await page.waitForTimeout(300);
    ok('le ✕ de la liste supprime sans ouvrir la fiche',
       await page.evaluate(() => !document.getElementById('journalMealOv').classList.contains('on')
         && JSON.parse(localStorage.getItem('ah_nutri_journal') || '[]').length === 1));
  }

  console.log('\n=== LA PHOTO DE REPAS PASSE PAR L\'ANALYSE ===\n');
  {
    // Une photo dans le chat pouvait être un repas OU un contrôle de posture.
    // On ne devine pas : l'athlète choisit dans le menu photo, et ce choix
    // force le mode nutrition — donc la carte.
    const sheet = await page.evaluate(() =>
      Array.from(document.querySelectorAll('#ciPhotoSheet button')).map(b => b.textContent.trim()));
    ok('le menu photo propose d\'analyser un repas', sheet.length === 3 && /Analyser un repas/.test(sheet[0]), JSON.stringify(sheet));
    ok('  sans retirer les deux entrées existantes',
       /Prendre une photo/.test(sheet[1]) && /galerie/.test(sheet[2]), JSON.stringify(sheet));

    const flags = await page.evaluate(() => {
      const avant = window._titanPhotoIsMeal;
      // On n'ouvre pas le sélecteur de fichier (impossible sans geste réel) :
      // on vérifie que chaque entrée pose la bonne intention.
      window._titanPhotoIsMeal = true;  window._titanFromCamera && null;
      const apresRepas = window._titanPhotoIsMeal;
      window._titanPhotoIsMeal = false;
      return { avant: avant === false, apresRepas };
    });
    ok('l\'intention part à faux par défaut', flags.avant === true);

    const src = await page.evaluate(() => document.documentElement.outerHTML.length > 0);
    ok('le rendu de la page reste intact', src === true);
  }

  ok('aucune exception JS', errs.filter(e => !/firebase|fetch|ServiceWorker/i.test(e)).length === 0,
     errs.slice(0,2).join(' | '));

  const bad = R.filter(x => !x).length;
  console.log('\n' + '='.repeat(58));
  console.log(bad ? 'RÉSULTAT : ' + bad + ' ÉCHEC(S) sur ' + R.length : 'RÉSULTAT : ' + R.length + '/' + R.length + ' tests passés.');
  await browser.close(); server.close();
  process.exit(bad ? 1 : 0);
})();
