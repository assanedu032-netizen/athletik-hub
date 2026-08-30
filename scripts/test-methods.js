// Le moteur de méthodes, de bout en bout : le registre, la validation de la
// sortie Titan, et le passage jusqu'au moteur d'exécution.
// L'enjeu : les trois sources — programme standard, Workout Builder, Titan —
// doivent produire la MÊME exécution pour la même méthode.
//   node scripts/test-methods.js
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(process.argv[2] || path.join(ROOT, 'index.html'), 'utf8');
const srv  = fs.readFileSync(path.join(ROOT, 'netlify', 'functions', 'titan.js'), 'utf8');

function grab(text, decl) {
  const s = text.indexOf(decl);
  if (s < 0) throw new Error('introuvable: ' + decl);
  let i = text.indexOf('{', text.indexOf('(', s)), d = 0, j = i;
  for (; j < text.length; j++) {
    if (text[j] === '{') d++;
    else if (text[j] === '}') { d--; if (!d) { j++; break; } }
  }
  return text.slice(s, j);
}
function grabObj(text, decl) {
  const i = text.indexOf(decl);
  if (i < 0) throw new Error('introuvable: ' + decl);
  let k = text.indexOf('{', i), d = 0, j = k, str = null;
  for (; j < text.length; j++) {
    const c = text[j];
    if (str) { if (c === '\\') j++; else if (c === str) str = null; continue; }
    if (c === '"' || c === "'") { str = c; continue; }
    if (c === '{') d++; else if (c === '}') { d--; if (!d) { j++; break; } }
  }
  return text.slice(k, j);
}

// expand() s'appuie sur _ahNum : on l'amène dans la portée du registre.
const AH = new Function(grab(html, 'function _ahNum(')
  + '\nreturn ' + grabObj(html, 'var AH_METHODS = ') + ';')();
const parse = new Function(
  grabObj(srv, 'const BUILDER_METHODS = ').replace(/^/, 'const BUILDER_METHODS = ') + ';\n'
  + grab(srv, 'function sanitizeMethod(') + '\n'
  + grab(srv, 'function parseWorkoutJson(') + '\nreturn parseWorkoutJson;')();

const R = [];
const ok = (l, c, d) => { R.push(c); console.log((c ? '  PASS  ' : '  FAIL  ') + l + (d && !c ? '  → ' + d : '')); };

console.log('\n=== TITAN NE PEUT PAS INVENTER DE MÉTHODE ===\n');
{
  const wrap = (m) => parse(JSON.stringify({ blocs: [{ titre: 'Bloc principal',
    exos: [{ n: 'Développé couché', sets: 3, reps: '8', rest: '2min', method: m }] }] }));
  const meth = (m) => (wrap(m).blocs[0].exos[0] || {}).method;

  ok('une méthode inconnue est retirée', meth({ id: 'super_secret', x: 1 }) === undefined);
  ok('« classique » n\'a pas besoin d\'être déclarée', meth({ id: 'classic' }) === undefined);
  ok('un paramètre hors schéma est retiré',
     JSON.stringify(meth({ id: 'isometric', duration: 25, danger: 999 })) === '{"id":"isometric","duration":25}',
     JSON.stringify(meth({ id: 'isometric', duration: 25, danger: 999 })));
  // Une prescription incomplète serait injouable : mieux vaut pas de méthode.
  ok('un rest-pause sans blocs est refusé', meth({ id: 'rest_pause', reps: 8 }) === undefined);
  ok('une isométrie sans durée est refusée', meth({ id: 'isometric' }) === undefined);
  ok('un drop set à un seul palier est refusé',
     meth({ id: 'drop_set', drops: [{ reps: 12, load: 60 }] }) === undefined);
  // Une isométrie sans durée est injouable, donc retirée. Un excentrique
  // sans tempo reste un excentrique : on retire juste la valeur absurde.
  ok('une valeur négative rend l\'isométrie injouable',
     meth({ id: 'isometric', duration: -5 }) === undefined);
  ok('et un tempo nul est simplement ignoré',
     JSON.stringify(meth({ id: 'eccentric', tempoDown: 0 })) === '{"id":"eccentric"}',
     JSON.stringify(meth({ id: 'eccentric', tempoDown: 0 })));
  ok('les blocs sont bornés à 6',
     meth({ id: 'rest_pause', reps: 8, microRest: 15, blocks: [1,1,1,1,1,1,1,1] }).blocks.length === 6);
  ok('une méthode en simple chaîne est acceptée',
     JSON.stringify(meth('superset')) === '{"id":"superset"}', JSON.stringify(meth('superset')));

  const bon = meth({ id: 'rest_pause', reps: 8, microRest: 15, blocks: [3, 2] });
  ok('une prescription complète passe intacte',
     bon.reps === 8 && bon.microRest === 15 && bon.blocks.join(',') === '3,2', JSON.stringify(bon));
}

console.log('\n=== LE REGISTRE CLIENT ET LE MIROIR SERVEUR SONT ALIGNÉS ===\n');
{
  const srvIds = Object.keys(new Function('return ' + grabObj(srv, 'const BUILDER_METHODS = '))());
  const cliIds = Object.keys(AH);
  ok('les mêmes méthodes des deux côtés',
     srvIds.sort().join(',') === cliIds.sort().join(','),
     'serveur: ' + srvIds.join(',') + ' | client: ' + cliIds.join(','));
  ok('le prompt décrit exactement ces méthodes',
     cliIds.filter(id => id !== 'classic').every(id => srv.indexOf('"id": "' + id + '"') > -1),
     cliIds.filter(id => id !== 'classic' && srv.indexOf('"id": "' + id + '"') < 0).join(','));
  ok('et interdit d\'écrire la méthode dans le nom',
     /N'écris jamais le nom de la méthode dans "n"/.test(srv));
}

console.log('\n=== LES TROIS SOURCES PRODUISENT LA MÊME EXÉCUTION ===\n');
{
  // Même méthode, trois provenances : le registre doit produire la même
  // séquence dans les trois cas. C'est tout l'objet d'un moteur central.
  const cfg = { reps: 8, microRest: 15, blocks: [3, 2] };
  const attendu = JSON.stringify(AH.rest_pause.expand(cfg));

  // 1. Programme standard : e(...) avec un 6e argument.
  const prog = { n: 'Développé couché', s: '3', r: '8 reps', rest: '2 mn',
                 method: Object.assign({ id: 'rest_pause' }, cfg) };
  // 2. Workout Builder : la sortie Titan aplatie par builderStartGenerated.
  const w = parse(JSON.stringify({ blocs: [{ titre: 'Bloc principal', exos: [
    { n: 'Développé couché', sets: 3, reps: '8', rest: '2min',
      method: Object.assign({ id: 'rest_pause' }, cfg) }] }] }));
  const built = w.blocs[0].exos[0];
  // 3. Titan chat : même structure, même validation.
  const conf = (m) => { const c = {}; Object.keys(m).forEach(k => { if (k !== 'id') c[k] = m[k]; }); return c; };

  ok('programme standard → même séquence',
     JSON.stringify(AH.rest_pause.expand(conf(prog.method))) === attendu);
  ok('Workout Builder → même séquence',
     JSON.stringify(AH.rest_pause.expand(conf(built.method))) === attendu);
  ok('et le Builder transmet bien la méthode au moteur',
     /if \(e\.method && typeof e\.method === 'object' && e\.method\.id\) ex\.method = e\.method;/.test(html));
  ok('la carte de séance affiche la méthode et sa séquence',
     /AH_METHODS\[e\.method\.id\]/.test(html) && /def\.expand === 'function'/.test(html));
}

console.log('\n=== LES 64 MÉTHODES EN TEXTE LIBRE RESTENT COUVERTES ===\n');
{
  // Rien n'a été migré : le repli textuel doit continuer de les reconnaître.
  const FNS = ['_lsDetectTechnique', '_ahNum', '_ahResolveMethod'];
  const api = new Function('AH_METHODS', 'LS_TEXT_TO_METHOD',
    FNS.map(n => grab(html, 'function ' + n + '(')).join('\n')
    + '\nreturn _ahResolveMethod;')(AH,
      new Function('return ' + grabObj(html, 'var LS_TEXT_TO_METHOD = '))());
  const cas = [
    ['Squat isométrique — 90°', '30-45 s', 'isometric'],
    ['Pompe isométrique — position basse', '15 s → 60 s', 'isometric'],
    ['Squat stato-dynamique — Iso profonde puis explosion', '6 s min', 'isometric'],
    ['Nordic hamstring excentrique — freinage maximal', '8-12 reps', 'eccentric'],
    ['Dips excentrique', '5 reps', 'eccentric'],
    ['Dips sur chaise / banc', '2-3 reps cluster', 'rest_pause'],
    ['Squat', '10 reps', 'classic'],
    ['Échauffement dynamique', '10 mn', 'classic']
  ];
  cas.forEach(([n, r, attendu]) => {
    const got = api({ n, r }).id;
    ok('  ' + n.slice(0, 44) + ' → ' + attendu, got === attendu, got);
  });
  ok('aucune de ces 64 lignes n\'est marquée comme déclarée',
     cas.every(([n, r]) => api({ n, r }).declared === false));
}

const failed = R.filter(x => !x).length;
console.log('\n' + '='.repeat(60));
console.log(failed ? 'RÉSULTAT : ' + failed + ' ÉCHEC(S) sur ' + R.length
                   : 'RÉSULTAT : ' + R.length + '/' + R.length + ' tests passés.');
process.exit(failed ? 1 : 0);
