// Dossier publié — ce qui part en ligne, et seulement ça.
//
// Ce qu'on protège :
//   1. Le livre complet (data/livre.md) et les réponses d'activation
//      (data/book-challenges.js) ne sont JAMAIS publiés. Netlify publiait la
//      racine du dépôt : les deux étaient téléchargeables par n'importe qui.
//   2. Le garde-fou de construction marche VRAIMENT : une page qui référence
//      un fichier non publié fait échouer la construction (Netlify ne publie
//      alors pas). Un garde-fou qu'on n'a jamais vu échouer ne prouve rien.
//   3. Le dossier publié suffit : l'app s'y charge sans aucun 404.
//   4. Plus aucun code d'accès n'est écrit dans le code des fonctions.
//
//   node scripts/test-www-build.js
'use strict';
const fs = require('fs'), os = require('os'), path = require('path'), http = require('http');
const { spawnSync } = require('child_process');
const REPO = path.join(__dirname, '..');
const R = []; const ok = (l, c, d) => { R.push(!!c); console.log((c ? '  PASS  ' : '  FAIL  ') + l + (d !== undefined && !c ? '  → ' + String(d) : '')); };
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'www-test-'));

(async () => {
  // ── 1. La construction ───────────────────────────────────────────────────
  console.log('\n── Construire le dossier publié ──');
  const script = path.join(REPO, 'scripts', 'build-www.js');
  ok('le script de construction existe', fs.existsSync(script));
  const OUT = path.join(tmp, 'www');
  const b = fs.existsSync(script) ? spawnSync(process.execPath, [script, OUT], { encoding: 'utf8' }) : { status: 1, stderr: 'absent' };
  ok('il réussit sur le dépôt actuel', b.status === 0, (b.stderr || '').slice(0, 200));

  const present = (p) => fs.existsSync(path.join(OUT, p));
  console.log('\n── Ce qui est publié ──');
  ['index.html', 'manifest.json', 'sw.js', 'firebase-messaging-sw.js', 'ciqual-data.js',
   'data/book-excerpt.js', 'data/book-audio.js', 'data/elite-athlete-program.js',
   'icons/icon-192.png', 'assets/sounds/timer-beep.mp3', 'assets/audio/livre-01-preface.mp3']
    .forEach((p) => ok('publié : ' + p, present(p)));

  console.log('\n── Ce qui ne doit JAMAIS l\'être ──');
  [['data/livre.md', 'le livre complet'], ['data/book-challenges.js', 'les réponses d\'activation'],
   ['netlify', 'le code des fonctions'], ['scripts', 'les scripts'], ['CLAUDE.md', 'les notes internes'],
   ['.env.example', 'la liste des secrets'], ['node_modules', 'les dépendances'], ['docs', 'la documentation interne'],
   ['bookChallengesSeed.example.json', 'le gabarit des réponses']]
    .forEach(([p, quoi]) => ok('absent : ' + quoi + ' (' + p + ')', !present(p)));

  // ── 2. Le garde-fou échoue quand il doit ─────────────────────────────────
  // Un faux dépôt : tout est un lien vers le vrai, sauf index.html, qui
  // référence un fichier existant dans le dépôt mais NON publié.
  console.log('\n── Le garde-fou bloque une page cassée ──');
  const faux = path.join(tmp, 'faux');
  fs.mkdirSync(path.join(faux, 'scripts'), { recursive: true });
  for (const nom of fs.readdirSync(REPO)) {
    if (['index.html', 'scripts', 'data', '.git', 'node_modules', 'www'].includes(nom)) continue;
    fs.symlinkSync(path.join(REPO, nom), path.join(faux, nom));
  }
  fs.mkdirSync(path.join(faux, 'data'));
  for (const nom of fs.readdirSync(path.join(REPO, 'data'))) fs.symlinkSync(path.join(REPO, 'data', nom), path.join(faux, 'data', nom));
  fs.writeFileSync(path.join(faux, 'data', 'nouveau-fichier.js'), '/* jamais listé */');
  const html = fs.readFileSync(path.join(REPO, 'index.html'), 'utf8')
    .replace('</head>', '<script src="data/nouveau-fichier.js"></script></head>');
  fs.writeFileSync(path.join(faux, 'index.html'), html);
  if (fs.existsSync(script)) fs.copyFileSync(script, path.join(faux, 'scripts', 'build-www.js'));
  const g = spawnSync(process.execPath, [path.join(faux, 'scripts', 'build-www.js'), path.join(tmp, 'www-faux')], { encoding: 'utf8' });
  ok('la construction ÉCHOUE', g.status !== 0, 'statut ' + g.status);
  ok('et dit quel fichier manque', /nouveau-fichier\.js/.test(g.stderr || ''), (g.stderr || '').slice(0, 160));

  // ── 3. Netlify publie ce dossier, et seulement lui ───────────────────────
  console.log('\n── Netlify ──');
  const toml = fs.readFileSync(path.join(REPO, 'netlify.toml'), 'utf8');
  const bloc = (/\[build\]([\s\S]*?)(?:\n\[|$)/.exec(toml) || [])[1] || '';
  ok('publie www/, plus la racine du dépôt', /publish\s*=\s*"www"/.test(bloc), (/publish\s*=\s*"[^"]*"/.exec(bloc) || [''])[0]);
  ok('construit avec le script', /command\s*=\s*"node scripts\/build-www\.js"/.test(bloc));
  ok('www/ n\'est pas commité', /^www\/$/m.test(fs.readFileSync(path.join(REPO, '.gitignore'), 'utf8')));
  // Les fonctions lisent ces fichiers dans LEUR paquet : il doit les embarquer.
  ok('la fonction Titan-livre embarque toujours le livre', /included_files\s*=\s*\["data\/livre\.md"\]/.test(toml));
  ok('la fonction d\'activation embarque toujours les réponses', /included_files\s*=\s*\["data\/book-challenges\.js"\]/.test(toml));

  // ── 4. Aucun code d'accès en clair ───────────────────────────────────────
  console.log('\n── Codes d\'accès ──');
  const cc = fs.readFileSync(path.join(REPO, 'netlify', 'functions', 'check-code.js'), 'utf8');
  ok('aucun code fixe écrit dans check-code.js', !/LEGACY_CODES\s*=\s*\{\s*['"][^'"]+['"]\s*:/.test(cc));
  ok('les codes hérités viennent d\'une variable d\'env', /process\.env\.ACCESS_LEGACY_CODES/.test(cc));
  const src = (/function parseLegacyCodes\(raw\) \{[\s\S]*?\n\}/.exec(cc) || [])[0];
  let parse = null; try { parse = src ? Function(src + '\nreturn parseLegacyCodes;')() : null; } catch (e) {}
  ok('variable vide → aucun code accepté', !!parse && Object.keys(parse('')).length === 0 && Object.keys(parse(undefined)).length === 0);
  ok('« ab-1:vip, CD-2:BETA » → deux codes', !!parse && JSON.stringify(parse('ab-1:vip, CD-2:BETA')) === '{"AB-1":"VIP","CD-2":"BETA"}',
    parse && JSON.stringify(parse('ab-1:vip, CD-2:BETA')));
  ok('un niveau inconnu est ignoré', !!parse && Object.keys(parse('X-1:ADMIN')).length === 0);

  // ── 5. Le dossier publié suffit à faire tourner l'app ────────────────────
  console.log('\n── L\'app se charge depuis le seul dossier publié ──');
  let chromium = null;
  try { chromium = require('playwright').chromium; } catch (e) {}
  if (!chromium || b.status !== 0) {
    ok('Playwright disponible (npm i -D playwright --no-save)', !!chromium);
  } else {
    const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg', '.svg': 'image/svg+xml' };
    const servi = [];
    const server = http.createServer((q, r) => {
      const u = decodeURIComponent(q.url.split('?')[0]);
      const f = path.join(OUT, u === '/' ? 'index.html' : u);
      servi.push(u);
      if (!f.startsWith(OUT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
      r.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
      fs.createReadStream(f).pipe(r);
    });
    await new Promise((res) => server.listen(0, '127.0.0.1', res));
    const base = 'http://127.0.0.1:' + server.address().port;
    const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
    for (const pageNom of ['index.html', 'landing.html', 'download.html']) {
      const page = await browser.newPage({ viewport: { width: 375, height: 667 } });
      const err = [], introuvables = [];
      page.on('pageerror', (e) => err.push(e.message));
      page.on('response', (res) => { if (res.url().startsWith(base) && res.status() === 404) introuvables.push(res.url().slice(base.length)); });
      await page.goto(base + '/' + pageNom, { waitUntil: 'load', timeout: 30000 }).catch(() => {});
      await page.waitForTimeout(pageNom === 'index.html' ? 2500 : 600);
      if (pageNom === 'index.html') {
        ok('index.html : l\'app démarre', await page.evaluate(() => typeof window.switchTab === 'function' && typeof window.openBookReader === 'function'));
        ok('index.html : les programmes sont chargés', await page.evaluate(() => !!(window.PROGRAMS_V2 || window.BOOK_EXCERPT)));
      }
      ok(pageNom + ' : aucun fichier local introuvable', introuvables.length === 0, introuvables.join(', '));
      // Les erreurs réseau vers Firebase/gstatic (bloqués dans le bac à sable)
      // ne sont pas des défauts du dossier publié.
      const vraies = err.filter((m) => !/firebase|gstatic|googleapis|Failed to fetch|NetworkError|network/i.test(m));
      ok(pageNom + ' : aucune erreur JS', vraies.length === 0, vraies.join(' | '));
      await page.close();
    }
    ok('le livre complet n\'a jamais été demandé', !servi.some((u) => /livre\.md|book-challenges/.test(u)));
    await browser.close(); server.close();
  }

  fs.rmSync(tmp, { recursive: true, force: true });
  const bad = R.filter((x) => !x).length;
  console.log('\n' + '='.repeat(58));
  console.log(bad ? ('RÉSULTAT : ' + bad + ' ÉCHEC(S) sur ' + R.length) : ('RÉSULTAT : ' + R.length + '/' + R.length + ' — tout est vert'));
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.log('  FAIL  exception : ' + e.message); console.log('\nRÉSULTAT : 1 ÉCHEC(S)'); process.exit(1); });
