// Hiérarchie de la Home — vrai Chromium, 375×667 et 320×568.
//
// Ce qu'on protège :
//   1. LA SÉANCE EST L'ACTION PRINCIPALE. Elle doit venir avant la lecture du
//      livre et être atteignable sans scroller. Le livre au-dessus repoussait
//      la carte à 390 px sur un écran de 667.
//   2. DES STATS VIDES NE MÉRITENT PAS UN BLOC PLEIN. Trois tirets sur 69 px
//      de navy pesaient autant que la carte séance, pour zéro information.
//   3. MAIS DES STATS REMPLIES NE CHANGENT PAS. Navy, 28 px, or — à l'octet
//      près ce qu'elles étaient.
//   node scripts/test-home-layout.js [autre.html]
const fs = require('fs'), http = require('http'), path = require('path');
const REPO = path.join(__dirname, '..');
const HTML = process.argv[2] || path.join(REPO, 'index.html');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('Playwright absent — npm i -D playwright --no-save'); process.exit(0); }
const MIME = { '.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.png':'image/png','.mp3':'audio/mpeg','.jpg':'image/jpeg' };

const PROFIL = { prenom:'Alassox', age:28, sexe:'H', programKey:'ea', program:'ELITE ATHLETE',
  objectif:'Explosivité globale', objNutri:'optimisation', nutriObj:'optimisation',
  poids:78, taille:182, satDone:true };

(async () => {
  const server = http.createServer((q, r) => {
    const rel = decodeURIComponent(q.url.split('?')[0]);
    const f = (rel === '/index.html') ? HTML : path.join(REPO, rel);
    if ((f !== HTML && !f.startsWith(REPO)) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
    r.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(r);
  });
  await new Promise(r => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await browser.newPage({ viewport: { width: 375, height: 667 }, deviceScaleFactor: 2 });
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  const R = []; const ok = (l, c, d) => { R.push(c); console.log((c ? '  PASS  ' : '  FAIL  ') + l + (d !== undefined && !c ? '  → ' + String(d) : '')); };

  await page.goto(base + '/index.html', { waitUntil: 'domcontentloaded' });
  try { await page.waitForFunction(() => typeof window.renderUserData === 'function', { timeout: 20000 }); }
  catch (e) {
    console.log('  FAIL  cette base n\'a pas la Home attendue');
    console.log('\n' + '='.repeat(58) + '\nRÉSULTAT : 1 ÉCHEC(S) sur 1');
    await browser.close(); server.close(); process.exit(1);
  }

  // `renderUserData()` EST la fonction qui peint la Home ; le harnais n'a pas
  // d'auth Firebase, donc on l'appelle comme l'app le fait au démarrage.
  const peindre = (prof, theme) => page.evaluate(([prof, theme]) => {
    document.documentElement.setAttribute('data-theme', theme || 'light');
    document.querySelectorAll('.scr').forEach(e => { e.style.display = 'none'; e.classList.remove('on'); });
    const ip = document.getElementById('installPrompt'); if (ip) ip.style.display = 'none';
    localStorage.setItem('ah_profile', JSON.stringify(prof));
    localStorage.setItem('ah_onboarding_done', '1');
    window.switchTab('home');
    try { window.renderUserData(); } catch (e) {}
    try { if (window.renderBookCard) window.renderBookCard(); } catch (e) {}
  }, [prof, theme]);

  const lire = () => page.evaluate(() => {
    const V = document.getElementById('vHome');
    const y = (id) => { const e = document.getElementById(id); return e ? Math.round(e.getBoundingClientRect().top) : -1; };
    const sc = document.getElementById('homeScoreboard');
    const cta = document.getElementById('todayCardCtaBtn');
    const cs = sc ? getComputedStyle(sc) : null;
    const val = sc && sc.querySelector('.val'), lbl = sc && sc.querySelector('.lbl');
    const fondDe = (el) => { let n = el; while (n) { const c = getComputedStyle(n).backgroundColor;
      if (c && c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent') { const m = c.match(/[\d.]+/g).map(Number); if (m.length < 4 || m[3] >= .95) return c; }
      n = n.parentElement; } return 'rgb(255,255,255)'; };
    const lum = (c) => { const m = c.match(/[\d.]+/g).map(Number); const f = m.slice(0,3).map(v => { v/=255; return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4); }); return .2126*f[0]+.7152*f[1]+.0722*f[2]; };
    const ratio = (a,b) => { const L1=Math.max(lum(a),lum(b)), L2=Math.min(lum(a),lum(b)); return +((L1+.05)/(L2+.05)).toFixed(2); };
    const fond = sc ? fondDe(sc) : 'rgb(255,255,255)';
    return {
      ySeance: y('todayCardFrame'), yLivre: y('bookCardWrap'), ySb: y('homeScoreboard'),
      ctaBas: cta ? Math.round(cta.getBoundingClientRect().bottom) : -1,
      sbClasse: sc ? sc.className : 'absent',
      sbH: sc ? Math.round(sc.getBoundingClientRect().height) : 0,
      sbFond: cs ? cs.backgroundColor : '', sbDegrade: cs ? (cs.backgroundImage === 'none' ? 'non' : 'oui') : '',
      valFS: val ? getComputedStyle(val).fontSize : '', valCol: val ? getComputedStyle(val).color : '',
      cVal: val ? ratio(getComputedStyle(val).color, fond) : 0,
      cLbl: lbl ? ratio(getComputedStyle(lbl).color, fond) : 0,
      debordeX: V ? Math.max(0, Math.round(V.scrollWidth - window.innerWidth)) : 0
    };
  });

  // ══ La séance est l'action principale ═══════════════════════════════════
  console.log('\n── Ce qu\'on voit en ouvrant ──');
  await peindre(PROFIL, 'light'); await page.waitForTimeout(340);
  let v = await lire();
  ok('la carte séance est là', v.ySeance > 0, v.ySeance);
  ok('la carte livre est là', v.yLivre > 0, v.yLivre);
  // L'ordre, c'est toute la hiérarchie : agir d'abord, lire ensuite.
  ok('la SÉANCE vient AVANT le livre', v.ySeance < v.yLivre, v.ySeance + ' vs ' + v.yLivre);
  ok('elle commence dans le premier tiers de l\'écran', v.ySeance < 222, v.ySeance + ' px / 667');
  // Si le bouton tombe sous la ligne de flottaison, l'action n'est pas offerte.
  ok('« Lancer la séance » est atteignable sans scroller', v.ctaBas > 0 && v.ctaBas <= 667, v.ctaBas);
  ok('rien ne déborde en largeur', v.debordeX === 0, v.debordeX);

  // ══ Des stats vides s'effacent ══════════════════════════════════════════
  console.log('\n── Rien de mesuré ──');
  ok('le bandeau porte la classe discrète', /sb-vide/.test(v.sbClasse), v.sbClasse);
  ok('il n\'a plus de fond plein', v.sbFond === 'rgba(0, 0, 0, 0)' && v.sbDegrade === 'non',
    v.sbFond + ' / dégradé ' + v.sbDegrade);
  ok('il tient en moins de 56 px', v.sbH > 0 && v.sbH <= 56, v.sbH);
  // Discret ne veut pas dire illisible : l'ancien tiret tombait à 1,04:1.
  ok('la valeur reste lisible (AA)', v.cVal >= 4.5, v.cVal + ':1');
  ok('le libellé aussi', v.cLbl >= 4.5, v.cLbl + ':1');

  console.log('\n── Rien de mesuré, en thème sombre ──');
  await peindre(PROFIL, 'dark'); await page.waitForTimeout(320);
  let d = await lire();
  ok('le dégradé sombre est neutralisé', d.sbDegrade === 'non', d.sbDegrade);
  ok('et le texte reste lisible', d.cVal >= 4.5 && d.cLbl >= 4.5, d.cVal + ':1 / ' + d.cLbl + ':1');

  // ══ Mais des stats remplies ne changent pas ═════════════════════════════
  console.log('\n── Dès qu\'il y a un chiffre ──');
  await peindre(PROFIL, 'light'); await page.waitForTimeout(300);
  await page.evaluate(() => {
    [['sbSet','72'],['sbCmj','64'],['sbJours','5']].forEach(([id, t]) => {
      const e = document.getElementById(id); if (e) { e.textContent = t; e.classList.remove('empty'); }
    });
    const sc = document.getElementById('homeScoreboard'); if (sc) sc.classList.remove('sb-vide');
  });
  await page.waitForTimeout(180);
  const r = await lire();
  ok('le bandeau reprend son navy', r.sbFond === 'rgb(36, 59, 107)', r.sbFond);
  ok('sa hauteur d\'origine', r.sbH === 69, r.sbH);
  ok('ses chiffres en 28 px', r.valFS === '28px', r.valFS);
  ok('et son or', r.valCol === 'rgb(197, 164, 78)', r.valCol);

  // ══ 320 × 568 ═══════════════════════════════════════════════════════════
  console.log('\n── 320 × 568 ──');
  await page.setViewportSize({ width: 320, height: 568 });
  await peindre(PROFIL, 'light'); await page.waitForTimeout(340);
  const p = await lire();
  ok('rien ne déborde', p.debordeX === 0, p.debordeX);
  ok('la séance vient toujours avant le livre', p.ySeance > 0 && p.ySeance < p.yLivre, p.ySeance + ' vs ' + p.yLivre);
  ok('et le bouton reste sous les yeux', p.ctaBas > 0 && p.ctaBas <= 568, p.ctaBas);

  ok('aucune erreur JS sur tout le parcours', errs.length === 0, errs.join(' | '));

  const bad = R.filter(x => !x).length;
  console.log('\n' + '='.repeat(58));
  console.log(bad ? ('RÉSULTAT : ' + bad + ' ÉCHEC(S) sur ' + R.length) : ('RÉSULTAT : ' + R.length + '/' + R.length + ' — tout est vert'));
  await browser.close(); server.close();
  process.exit(bad ? 1 : 0);
})();
