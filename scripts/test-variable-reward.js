// Récompense variable (brique 5) — §7 du brief.
// Le test le plus important est l'INTERDICTION : la variabilité doit venir des
// événements réels, jamais d'un tirage. On vérifie donc aussi le déterminisme.
//   node scripts/test-variable-reward.js [autre.html]
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(process.argv[2] || path.join(__dirname, '..', 'index.html'), 'utf8');

function grab(decl) {
  const start = html.indexOf(decl);
  if (start < 0) throw new Error('introuvable: ' + decl);
  let i = html.indexOf('{', html.indexOf('(', start)), d = 0, j = i;
  for (; j < html.length; j++) {
    if (html[j] === '{') d++;
    else if (html[j] === '}') { d--; if (!d) { j++; break; } }
  }
  return html.slice(start, j);
}

const src = 'var AH_STRONG_SIGNAL = 85; var AH_COMPARABLE_GAP = 20;\n'
  + grab('function _ahSafeParse(') + '\n'
  + grab('function _ahPickFeedback(');

function build(store) {
  const localStorage = {
    getItem: k => (k in (store || {}) ? store[k] : null),
    setItem: () => {}, removeItem: () => {},
  };
  const fn = new Function('localStorage', 'console', src + '\nreturn _ahPickFeedback;');
  return fn(localStorage, console);
}

const pick = build({});
const c = (type, weight) => ({ type, weight, message: type + '-' + weight });
const R = [];
const ok = (l, cond, d) => { R.push(cond); console.log((cond ? '  PASS  ' : '  FAIL  ') + l + (d && !cond ? '  → ' + d : '')); };

console.log('\n=== INTERDICTION : AUCUN HASARD ARTIFICIEL ===\n');
{
  const code = html.split('\n').filter(l => !l.trim().startsWith('//')).join('\n');
  const i = code.indexOf('function _ahPickFeedback(');
  let a = code.indexOf('{', i), d = 0, j = a;
  for (; j < code.length; j++) { if (code[j] === '{') d++; else if (code[j] === '}') { d--; if (!d) { j++; break; } } }
  const body = code.slice(i, j);
  ok('aucun Math.random dans la sélection', !/Math\.random/.test(body));
  ok('aucun Date.now utilisé comme graine', !/Date\.now/.test(body));
}
{
  // Déterminisme : mêmes entrées → même sortie, 50 fois de suite
  const cands = [c('D', 65), c('C', 55), c('G', 10)];
  const results = [];
  for (let i = 0; i < 50; i++) results.push(pick(cands.slice(), 'D').type);
  ok('50 appels identiques → 1 seul résultat', new Set(results).size === 1, JSON.stringify([...new Set(results)]));
}

console.log('\n=== UN SIGNAL FORT N\'EST JAMAIS MASQUÉ ===\n');
{
  const cands = [c('A', 90), c('B', 85), c('D', 65)];
  ok('record annoncé même s\'il l\'était déjà la veille', pick(cands, 'A').type === 'A', pick(cands, 'A').type);
}
{
  const cands = [c('F', 100), c('A', 90)];
  ok('programme terminé prime toujours', pick(cands, 'F').type === 'F');
}
{
  const cands = [c('B', 85), c('D', 65)];
  ok('jalon au seuil (85) reste prioritaire', pick(cands, 'B').type === 'B');
}

console.log('\n=== VARIATION ENTRE SIGNAUX COMPARABLES ===\n');
{
  const cands = [c('D', 65), c('C', 55), c('G', 10)];
  ok('même type que la veille → on prend l\'alternative comparable',
     pick(cands, 'D').type === 'C', pick(cands, 'D').type);
  ok('type différent de la veille → on garde le meilleur',
     pick(cands, 'C').type === 'D', pick(cands, 'C').type);
  ok('aucune veille → on garde le meilleur', pick(cands, null).type === 'D');
}
{
  // Écart trop grand : on ne descend PAS vers un signal nettement plus faible
  const cands = [c('D', 65), c('C', 30), c('G', 10)];
  ok('écart > 20 → pas de variation forcée', pick(cands, 'D').type === 'D', pick(cands, 'D').type);
}
{
  // Le fallback G ne doit pas être choisi tant qu'un vrai signal existe
  const cands = [c('C', 25), c('G', 10)];
  ok('G écarté tant qu\'un signal réel existe', pick(cands, 'C').type === 'C', pick(cands, 'C').type);
}
{
  // Un seul candidat réel → pas d'alternative possible, on assume la répétition
  const cands = [c('D', 65), c('G', 10)];
  ok('un seul signal réel → répétition assumée plutôt qu\'invention',
     pick(cands, 'D').type === 'D', pick(cands, 'D').type);
}
{
  const cands = [c('G', 10)];
  ok('fallback seul → fallback', pick(cands, 'G').type === 'G');
}

console.log('\n=== LA VARIÉTÉ VIENT DES ÉVÉNEMENTS, PAS DU TIRAGE ===\n');
{
  // Deux séances identiques en données → même message. La variété n'apparaît
  // QUE si les événements diffèrent.
  const jour1 = [c('D', 65), c('G', 10)];
  const jour2 = [c('D', 65), c('G', 10)];
  ok('mêmes événements → même feedback (pas de fausse variété)',
     pick(jour1, null).type === pick(jour2, null).type);
  const jour3 = [c('D', 65), c('C', 55), c('G', 10)];
  ok('un événement en plus → la sélection peut changer',
     pick(jour3, 'D').type !== pick(jour1, 'D').type);
}

console.log('\n=== LECTURE DU PROFIL EN PRODUCTION ===\n');
{
  const p = build({ ah_profile: JSON.stringify({ lastFeedbackType: 'D' }) });
  const cands = [c('D', 65), c('C', 55), c('G', 10)];
  ok('lastFeedbackType lu depuis le profil', p(cands).type === 'C', p(cands).type);
}
{
  const p = build({ ah_profile: 'CASSÉ{{' });
  const cands = [c('D', 65), c('C', 55)];
  let threw = false, r = null;
  try { r = p(cands); } catch (e) { threw = true; }
  ok('profil corrompu → aucune exception', !threw);
  ok('profil corrompu → meilleur candidat', r && r.type === 'D');
}
{
  let threw = false;
  try { pick(null); pick([]); pick(undefined); } catch (e) { threw = true; }
  ok('entrées vides → aucune exception', !threw);
  ok('entrées vides → null', pick([]) === null);
}

const failed = R.filter(x => !x).length;
console.log('\n' + '='.repeat(60));
console.log(failed ? 'RÉSULTAT : ' + failed + ' ÉCHEC(S) sur ' + R.length
                   : 'RÉSULTAT : ' + R.length + '/' + R.length + ' tests passés.');
process.exit(failed ? 1 : 0);
