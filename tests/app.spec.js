// ════════════════════════════════════════════════════════════════════════════
// tests/app.spec.js — Smoke tests Athletik Hub
// ────────────────────────────────────────────────────────────────────────────
// Objectif : repérer en < 30 s les régressions visibles après un push.
// On ne teste PAS la logique métier — uniquement que l'app se monte, ne
// crash pas, navigue. Les erreurs "attendues hors prod" (Firebase Auth
// sans clé, Netlify Functions absentes, manifest PWA, etc.) sont
// whitelistées dans IGNORED_ERRORS.
//
// Pour ajouter un test : ne pas viser un workflow complexe. Préférer un
// petit smoke supplémentaire que de gros parcours fragiles.
// ════════════════════════════════════════════════════════════════════════════
const { test, expect } = require('@playwright/test');

// Erreurs et warnings ATTENDUS hors prod — ils ne doivent pas faire échouer
// le smoke test. Si un nouveau pattern bruyant apparaît, l'ajouter ici.
const IGNORED_ERRORS = [
  /\.netlify\/functions/i,           // backend non démarré en CI
  /firebaseapp\.com/i,                // Firebase Auth nécessite la prod
  /googleapis\.com/i,                 // Firestore / FCM
  /firestore/i,
  /sw\.js/i,                          // service worker peut ne pas s'installer
  /Failed to load resource/i,         // resources externes (Unsplash, fonts)
  /quota/i,                           // localStorage quota en mode test
  /manifest\.json/i,
  /favicon/i,
  /image[s]?\//i,                     // images programmes/recipes manquantes
  /ciqual-data\.js/i,                 // gros fichier, parfois 404 en CI
  /NotAllowedError/i,                 // permission denied (notification, etc.)
  /^The resource .* was preloaded/i,  // hint preload warning
];

function isIgnored(text) {
  return IGNORED_ERRORS.some(re => re.test(text));
}

function attachErrorListeners(page) {
  const errors = [];
  page.on('pageerror', (err) => errors.push(String(err && err.message || err)));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  return errors;
}

function filterFatal(errors) {
  return errors.filter(e => !isIgnored(e));
}

test.describe('Athletik Hub — smoke tests', () => {
  test('1. Page d\'accueil charge — pas d\'écran blanc', async ({ page }) => {
    const errors = attachErrorListeners(page);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    // Laisser le temps aux scripts inline de s'exécuter et au splash de partir
    await page.waitForTimeout(2000);
    const bodyText = await page.locator('body').innerText().catch(() => '');
    expect(bodyText.length, 'le <body> ne doit pas être vide').toBeGreaterThan(50);
    const fatal = filterFatal(errors);
    expect.soft(fatal, 'erreurs JS non triviales :\n' + fatal.join('\n')).toEqual([]);
  });

  test('2. Au moins un écran principal est rendu (.scr.on ou .view.on)', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    const count = await page.locator('.scr.on, .view.on, #splash').count();
    expect(count, 'aucun écran .scr.on / .view.on / #splash visible').toBeGreaterThan(0);
  });

  test('3. La structure principale est présente (header / navigation)', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    // L'app a soit la bottom nav, soit un écran d'onboarding — on accepte les deux
    const nav = await page.locator('#mainNav, .ah-bottomnav, .bottom-nav').count();
    const onboard = await page.locator('#welcome, #titanIntro, #obQ1, #auth, .scr.on').count();
    expect(nav + onboard, 'ni navigation ni écran onboarding visibles').toBeGreaterThan(0);
  });

  test('4. Les premiers boutons visibles ne font pas crasher l\'app', async ({ page }) => {
    const errors = attachErrorListeners(page);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    // On clique au max 5 boutons visibles — c'est un smoke, pas un audit
    const buttons = await page.locator('button:visible, [role="button"]:visible, a[onclick]:visible').all();
    let clicked = 0;
    for (const btn of buttons.slice(0, 5)) {
      try {
        await btn.click({ timeout: 1500, force: true });
        await page.waitForTimeout(200);
        clicked++;
      } catch (_) {
        // Bouton qui ouvre file picker, lien externe, etc. — on ignore
      }
    }
    const fatal = filterFatal(errors);
    expect.soft(fatal, 'erreurs pageerror après clics :\n' + fatal.join('\n')).toEqual([]);
    expect(clicked, 'au moins un bouton aurait dû être cliquable').toBeGreaterThan(0);
  });

  test('5. Le refresh ne casse pas l\'app', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    const errors = attachErrorListeners(page);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    const bodyText = await page.locator('body').innerText().catch(() => '');
    expect(bodyText.length, '<body> vide après reload').toBeGreaterThan(50);
    const fatal = filterFatal(errors);
    expect.soft(fatal, 'erreurs JS au reload :\n' + fatal.join('\n')).toEqual([]);
  });

  test('6. Bundles critiques répondent en 200 (index.html, sw.js)', async ({ page }) => {
    const r1 = await page.request.get('/');
    expect(r1.status(), 'GET / doit répondre 200').toBe(200);
    const r2 = await page.request.get('/sw.js');
    expect([200, 304], 'GET /sw.js attendu 200/304').toContain(r2.status());
  });
});
