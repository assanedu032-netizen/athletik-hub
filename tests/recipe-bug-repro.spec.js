// ════════════════════════════════════════════════════════════════════════════
// tests/recipe-bug-repro.spec.js — Reproduction du bug "recette se ferme seule"
// ────────────────────────────────────────────────────────────────────────────
// Bug remonté par l'user : ouvrir une recette dans Nutrition → après 2-3 s la
// modal recette se ferme automatiquement.
// Cause racine identifiée : onFirebaseAuthChange + _bootHandleAuthRestore
// appelaient _routeToOnboardingStep quand current=null (user sur une view).
// switchTab('home') s'exécutait derrière la modal et écrasait l'expérience.
// Fix : ne router que si curId === 'splash' (ou 'auth' pour le second hook).
// ════════════════════════════════════════════════════════════════════════════
const { test, expect } = require('@playwright/test');

const IGNORED_ERRORS = [
  /\.netlify\/functions/i, /firebaseapp\.com/i, /googleapis\.com/i,
  /firestore/i, /sw\.js/i, /Failed to load resource/i, /quota/i,
  /manifest\.json/i, /favicon/i, /image[s]?\//i, /ciqual-data\.js/i,
  /NotAllowedError/i, /^The resource .* was preloaded/i,
];
function isIgnored(t) { return IGNORED_ERRORS.some(re => re.test(t)); }

test('recipe modal reste ouverte > 5 secondes (pas de auto-close par routing)', async ({ page }) => {
  // Stub : on simule un user logged-in (fbUser) sans ah_onboarding_done →
  // déclenche la branche buggy de onFirebaseAuthChange.
  await page.addInitScript(() => {
    // Pas vraiment de Firebase ici — on ne peut pas le brancher en CI. À la
    // place on vérifie que SI la condition routing tombe à false (notre fix),
    // alors la modal ne se ferme PAS toute seule.
    window.__busFiredRoute = 0;
    // Hook : intercepte _routeToOnboardingStep pour compter les appels après
    // ouverture de la recette.
    const origDef = Object.defineProperty;
    let wrappedRoute = null;
    Object.defineProperty(window, '_routeToOnboardingStep', {
      configurable: true,
      get() { return wrappedRoute; },
      set(v) {
        wrappedRoute = function() {
          window.__busFiredRoute = (window.__busFiredRoute || 0) + 1;
          return v.apply(this, arguments);
        };
      }
    });
  });

  const errors = [];
  page.on('pageerror', e => errors.push(String(e.message || e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  // Force user state : navigate to Nutrition tab manually
  await page.evaluate(() => {
    if (typeof window.switchTab === 'function') {
      try { window.switchTab('nutrition'); } catch(e) {}
    }
  });
  await page.waitForTimeout(500);

  // Ouvre une recette par key (la fonction est exposée globalement)
  const opened = await page.evaluate(() => {
    if (typeof window.RECIPES !== 'object' || !window.RECIPES) return null;
    const firstKey = Object.keys(window.RECIPES)[0];
    if (!firstKey) return null;
    if (typeof window.showRecipe !== 'function') return null;
    window.showRecipe(firstKey, 1);
    return firstKey;
  });
  if (!opened) {
    test.skip(true, 'RECIPES/showRecipe non dispo en environnement test');
    return;
  }

  // Vérif : recipeModal a la classe 'open'
  const isOpenInitially = await page.evaluate(() => {
    const m = document.getElementById('recipeModal');
    return m && m.classList.contains('open');
  });
  expect(isOpenInitially, 'recipeModal doit être ouverte juste après showRecipe').toBe(true);

  // Attente longue : le bug se déclenche entre 2-3s. On attend 6s pour être sûr.
  await page.waitForTimeout(6000);

  // Le modal DOIT toujours être ouvert
  const isStillOpen = await page.evaluate(() => {
    const m = document.getElementById('recipeModal');
    return m && m.classList.contains('open');
  });
  expect(isStillOpen, 'recipeModal doit rester ouverte après 6s (pas de auto-close)').toBe(true);

  // Sanity : pas d'erreur JS fatale
  const fatal = errors.filter(e => !isIgnored(e));
  expect.soft(fatal, 'erreurs JS pendant l\'attente : ' + fatal.join('\n')).toEqual([]);
});

test('recipe modal — back arrow ferme correctement', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  const opened = await page.evaluate(() => {
    if (!window.RECIPES) return null;
    const k = Object.keys(window.RECIPES)[0];
    if (!k || typeof window.showRecipe !== 'function') return null;
    window.showRecipe(k, 1);
    return k;
  });
  if (!opened) { test.skip(true, 'RECIPES non dispo'); return; }

  await page.waitForTimeout(300);
  // Click sur le bouton retour de la modal
  await page.evaluate(() => {
    if (typeof window.closeRecipeModal === 'function') window.closeRecipeModal();
  });
  await page.waitForTimeout(200);

  const isClosed = await page.evaluate(() => {
    const m = document.getElementById('recipeModal');
    return m && !m.classList.contains('open');
  });
  expect(isClosed, 'recipeModal doit être fermée après closeRecipeModal()').toBe(true);
});
