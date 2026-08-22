// Harness : extrait les VRAIES fonctions de index.html et simule le cycle
// "je complète profil1 → je quitte l'app → je rouvre".
const fs = require('fs');
const path = require('path');
// Permet de tester une autre version : node scripts/test-onboarding.js <fichier>
const target = process.argv[2] || path.join(__dirname, '..', 'index.html');
const html = fs.readFileSync(target, 'utf8');

// --- extraction du source réel par équilibrage d'accolades ---
function extractFn(name) {
  const start = html.indexOf('function ' + name + '(');
  if (start < 0) throw new Error('introuvable: ' + name);
  let i = html.indexOf('{', start), depth = 0, j = i;
  for (; j < html.length; j++) {
    if (html[j] === '{') depth++;
    else if (html[j] === '}') { depth--; if (depth === 0) { j++; break; } }
  }
  return html.slice(start, j);
}
function extractVarArray(name) {
  const start = html.indexOf('var ' + name + ' = [');
  const end = html.indexOf('];', start) + 2;
  return html.slice(start, end);
}

const src = [
  extractVarArray('FB_SYNC_KEYS'),
  extractFn('_isOnboardingComplete'),
  extractFn('_nextOnboardingScreen'),
  extractFn('_syncOnboardingDoneFlag'),
  extractFn('_fbApplyPayload'),
].join('\n\n');

// --- mock localStorage ---
function makeLS() {
  const store = {};
  return {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; },
    _dump: () => store,
  };
}

function run(scenario) {
  const localStorage = makeLS();
  const window = { fbUser: { uid: 'u1' } };
  const sandbox = { localStorage, window, console, trainingDays: undefined, trainingTimes: {} };
  const fn = new Function('localStorage', 'window', 'console', 'trainingDays', 'trainingTimes',
    src + '\nreturn {_isOnboardingComplete,_nextOnboardingScreen,_syncOnboardingDoneFlag,_fbApplyPayload};');
  const api = fn(localStorage, window, console, undefined, {});
  return scenario(api, localStorage);
}

const R = [];
function check(label, actual, expected) {
  const ok = actual === expected;
  R.push({ label, actual, expected, ok });
  console.log((ok ? '  PASS  ' : '  FAIL  ') + label + '  → got "' + actual + '", attendu "' + expected + '"');
}

console.log('\n=== SCÉNARIO 1 : profil1 terminé, app fermée avant la nutrition ===');
console.log('(Firestore contient un profil INCOMPLET : pas de programKey)\n');
run((api, ls) => {
  // Boot 1 : l'utilisateur termine profil1 → obCalcProg écrit en local
  ls.setItem('ah_profile', JSON.stringify({
    prenom: 'Kadia', age: 22, sexe: 'femme', objectif: 'dunk',
    programKey: 'vd', program: 'Vertical Dunk', sit: ['a'], cont: ['b'], mat: ['c']
  }));
  check('après profil1, écran suivant', api._nextOnboardingScreen(), 'profil4');

  // L'utilisateur ferme l'app. Il rouvre : Firestore renvoie l'ANCIEN doc,
  // écrit avant que programKey existe (le cas d'avant le fix).
  api._fbApplyPayload({ profile: { prenom: 'Kadia', age: 22, sexe: 'femme', objectif: 'dunk' } });
  check('après réouverture (Firestore incomplet)', api._nextOnboardingScreen(), 'profil4');
  check('programKey survit à la synchro', JSON.parse(ls.getItem('ah_profile')).programKey, 'vd');
});

console.log('\n=== SCÉNARIO 2 : onboarding 100% terminé, réouverture ===\n');
run((api, ls) => {
  const complet = {
    prenom: 'Kadia', age: 22, sexe: 'femme', objectif: 'dunk',
    programKey: 'vd', objNutri: 'perf', poids: 60, taille: 170, satDone: true
  };
  ls.setItem('ah_profile', JSON.stringify(complet));
  check('onboarding détecté comme complet', api._isOnboardingComplete(), true);
  check('routage', api._nextOnboardingScreen(), 'home');
  api._fbApplyPayload({ profile: complet });
  check('drapeau ah_onboarding_done posé', ls.getItem('ah_onboarding_done'), '1');
  check('routage après synchro', api._nextOnboardingScreen(), 'home');
});

console.log('\n=== SCÉNARIO 3 : ancien profil Firestore avec alias legacy ===');
console.log('(nutriObj au lieu de objNutri, satForce au lieu de satDone)\n');
run((api, ls) => {
  api._fbApplyPayload({ profile: {
    prenom: 'Kadia', age: 22, sexe: 'femme', objectif: 'dunk', programKey: 'vd',
    nutriObj: 'perf', poids: 60, taille: 170, satForce: 80
  }});
  check('alias normalisés → complet', api._isOnboardingComplete(), true);
  check('routage', api._nextOnboardingScreen(), 'home');
  check('drapeau posé', ls.getItem('ah_onboarding_done'), '1');
});

console.log('\n=== SCÉNARIO 4 : nutrition faite en local, absente de Firestore ===\n');
run((api, ls) => {
  ls.setItem('ah_profile', JSON.stringify({
    prenom: 'Kadia', age: 22, sexe: 'femme', objectif: 'dunk', programKey: 'vd',
    objNutri: 'perf', poids: 60, taille: 170, satDone: true
  }));
  api._fbApplyPayload({ profile: { prenom: 'Kadia', age: 22, sexe: 'femme', objectif: 'dunk' } });
  check('poids conservé', JSON.parse(ls.getItem('ah_profile')).poids, 60);
  check('satDone conservé', JSON.parse(ls.getItem('ah_profile')).satDone, true);
  check('routage reste home', api._nextOnboardingScreen(), 'home');
});

const failed = R.filter(r => !r.ok);
console.log('\n' + '='.repeat(60));
console.log(failed.length === 0
  ? 'RÉSULTAT : ' + R.length + '/' + R.length + ' tests passés.'
  : 'RÉSULTAT : ' + failed.length + ' ÉCHEC(S) sur ' + R.length);
process.exit(failed.length ? 1 : 0);
