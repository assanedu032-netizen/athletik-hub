// Saisie de performance en séance → ah_track_history → contexte Titan.
// L'enjeu : ce que l'athlète tape pendant sa séance doit arriver jusqu'au
// prompt, au même format que le tracker manuel, sans code de lecture en plus.
//
// Depuis la refonte de l'écran live, la saisie ne passe plus par un lien
// replié (_lsSaveLog) mais par le mode reps, et TOUTES les écritures — charge,
// temps tenu, chrono de sprint — passent par _lsQuickLog.
//   node scripts/test-live-log.js
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

function harness(store, sessName, progKey) {
  const localStorage = {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; },
  };
  const _LS = { sessName: sessName || 'Jour 2 — Force', progKey: progKey || 'vd' };
  const src = grab(html, 'function _lsQuickLog(') + ';\n'
            + grab(html, 'function _lsLastPerf(') + ';\n'
            + grab(html, 'function _lsBestLoad(');
  const api = new Function('localStorage', 'window', 'console', '_LS',
    src + '\nreturn { log: _lsQuickLog, last: _lsLastPerf, best: _lsBestLoad };')(
      localStorage, {}, console, _LS);
  return { api, store, hist: () => JSON.parse(store.ah_track_history || '[]') };
}

const R = [];
const ok = (l, c, d) => { R.push(c); console.log((c ? '  PASS  ' : '  FAIL  ') + l + (d && !c ? '  → ' + d : '')); };

console.log('\n=== UNE SÉRIE CHARGÉE ===\n');
{
  const h = harness({});
  h.api.log('Back Squat', { load: 120, reps: 5 }, 'charge', 8);
  const e = h.hist()[0];
  ok('entrée créée', h.hist().length === 1);
  ok('charge et reps enregistrées', e.essais[0].load === 120 && e.essais[0].reps === 5,
     JSON.stringify(e.essais));
  ok('RPE enregistré', e.rpe === 8, String(e.rpe));
  ok('marquée comme venant de la séance', e.source === 'live_session');
  ok('séance et programme conservés', e.sessName === 'Jour 2 — Force' && e.progKey === 'vd');
  ok('format identique au tracker manuel',
     e.trackingMethod === 'charge' && e.method === 'charge' && Array.isArray(e.essais));
}

console.log('\n=== POIDS DU CORPS : LES REPS SEULES SUFFISENT ===\n');
{
  const h = harness({});
  h.api.log('Toe taps', { reps: 20 }, 'charge', 6);
  const e = h.hist()[0];
  ok('la perf est enregistrée sans charge', h.hist().length === 1 && e.essais[0].reps === 20);
  ok('aucune charge inventée', e.essais[0].load === undefined, JSON.stringify(e.essais[0]));
}

console.log('\n=== PLUSIEURS SÉRIES SUR LE MÊME EXERCICE ===\n');
{
  const h = harness({});
  h.api.log('Back Squat', { load: 110, reps: 5 }, 'charge', 7);
  h.api.log('Back Squat', { load: 120, reps: 5 }, 'charge', 8);
  h.api.log('Back Squat', { load: 125, reps: 3 }, 'charge', 9);
  ok('une seule entrée pour la séance du jour', h.hist().length === 1, String(h.hist().length));
  ok('les 3 séries cumulées', h.hist()[0].essais.length === 3, JSON.stringify(h.hist()[0].essais));
  ok('le dernier RPE fait foi', h.hist()[0].rpe === 9, String(h.hist()[0].rpe));
}
{
  const h = harness({});
  h.api.log('Back Squat', { load: 120 }, 'charge', 0);
  h.api.log('Hip Thrust', { load: 80 }, 'charge', 0);
  ok('exercices distincts → entrées distinctes', h.hist().length === 2, String(h.hist().length));
  ok('noms corrects', h.hist().map(x => x.exerciseName).join(', ') === 'Back Squat, Hip Thrust');
}

console.log('\n=== LES TROIS NATURES DE PERFORMANCE NE SE MÉLANGENT PAS ===\n');
{
  // Un temps TENU (isométrie, à l'échec) et un temps COURU (sprint) ne se
  // comparent pas dans le même sens : les stocker sous la même méthode ferait
  // passer un record d'isométrie pour une régression.
  const h = harness({});
  h.api.log('Wall sit', { secs: 62 }, 'duree', 0);
  h.api.log('Sprint 30 m', { time: 4.12 }, 'temps', 0);
  h.api.log('Back Squat', { load: 100, reps: 5 }, 'charge', 0);
  const by = {}; h.hist().forEach(e => { by[e.method] = e; });
  ok('trois entrées, trois méthodes', h.hist().length === 3 && by.duree && by.temps && by.charge,
     h.hist().map(e => e.method).join(', '));
  ok('le temps tenu est stocké en secondes', by.duree.essais[0].secs === 62);
  ok('le chrono de sprint garde son champ time', by.temps.essais[0].time === 4.12);
}
{
  // Même exercice, même jour, méthodes différentes → entrées séparées.
  const h = harness({});
  h.api.log('Squat isométrique', { secs: 30 }, 'duree', 0);
  h.api.log('Squat isométrique', { reps: 5, load: 60 }, 'charge', 0);
  ok('deux méthodes sur le même exercice ne fusionnent pas', h.hist().length === 2,
     JSON.stringify(h.hist().map(e => e.method)));
}

console.log('\n=== PRÉ-REMPLISSAGE DU MODE REPS ===\n');
{
  const h = harness({});
  h.api.log('Back Squat', { load: 100, reps: 5 }, 'charge', 7);
  h.api.log('Back Squat', { load: 110, reps: 5 }, 'charge', 8);
  const last = h.api.last('Back Squat');
  ok('la dernière perf est retrouvée', last && last.load === 110 && last.reps === 5,
     JSON.stringify(last));
  ok('le RPE de la dernière séance est repris', last.rpe === 8, String(last.rpe));
  ok('le record est la meilleure charge de tout l\'historique',
     h.api.best('Back Squat') === 110, String(h.api.best('Back Squat')));
  ok('un exercice jamais fait ne renvoie rien', h.api.last('Exercice inconnu') === null);
  ok('et son record vaut 0', h.api.best('Exercice inconnu') === 0);
}

console.log('\n=== CHAÎNE COMPLÈTE : SÉANCE → TITAN ===\n');
{
  const past = new Date(); past.setUTCDate(past.getUTCDate() - 7);
  const store = { ah_track_history: JSON.stringify([{
    exerciseName: 'Back Squat', exo: 'Back Squat', method: 'charge',
    essais: [{ load: 110, reps: 5 }], date: past.toISOString().slice(0, 10),
    source: 'live_session', rpe: 0
  }]) };
  const h = harness(store);
  h.api.log('Back Squat', { load: 120, reps: 5 }, 'charge', 8);
  h.api.log('Wall sit', { secs: 75 }, 'duree', 0);

  const CLIENT = 'var AS_MAX_SESSIONS = 5, AS_MAX_EXOS = 6;\n'
    + ['_ahSafeParse','_ahSessionHistory','_ahDaysBetween','_ahTrackValue',
       '_asRound','_asExerciseHistory','_asSessionFeedback','_asTrends']
        .map(n => grab(html, 'function ' + n + '(')).join('\n') + '\n'
    + grab(html, 'window._ahBuildAthleteState = function(') + ';';
  const st = new Function('localStorage', 'window', 'console',
    CLIENT + '\nreturn window._ahBuildAthleteState;')(
      { getItem: k => (k in store ? store[k] : null), setItem(){}, removeItem(){} },
      { _ahNextStep: () => null, _ahWeeksSinceTest: () => null, _ahStreakInfo: () => null },
      console)();
  const render = new Function(grab(srv, 'function daysAgoTxt(') + '\n'
    + grab(srv, 'function frDate(') + '\n'
    + grab(srv, 'function fmtVal(') + '\n'
    + grab(srv, 'function buildAthleteState(') + '\nreturn buildAthleteState;')();
  const txt = render(st);

  const e = st.exercises.find(x => x.name === 'Back Squat');
  ok('l\'exercice remonte dans l\'état athlète', !!e);
  ok('progression calculée depuis les saisies en séance',
     e && e.first === 110 && e.last === 120, e && JSON.stringify({ f: e.first, l: e.last }));
  ok('record détecté', e && e.isPR === true);
  ok('visible dans le prompt Titan', /Back Squat : 2 séance\(s\), dernière 120 kg/.test(txt),
     (txt.match(/- Back Squat[^\n]*/) || [''])[0]);
  ok('record annoncé à Titan', /RECORD à la dernière séance/.test(txt));
  ok('le manque de données a disparu', !/aucune performance d'exercice enregistrée/.test(txt));
  const w = st.exercises.find(x => x.name === 'Wall sit');
  ok('le temps tenu remonte aussi', !!w && w.last === 75, JSON.stringify(w && { l: w.last }));
  ok('et il est présenté comme un temps tenu, pas comme un chrono',
     /Wall sit[^\n]*75 s tenu/.test(txt), (txt.match(/- Wall sit[^\n]*/) || [''])[0]);
  ok('plus long = mieux sur un temps tenu', w && w.lowerIsBetter === false);
}

console.log('\n=== NON-RÉGRESSION ===\n');
{
  ok('un seul chemin d\'écriture', (html.match(/function _lsQuickLog\(/g) || []).length === 1
     && html.indexOf('_lsSaveLog') < 0);
  ok('aucun code de lecture ajouté (ah_track_history réutilisé)',
     (html.match(/_asExerciseHistory\(/g) || []).length === 2);
  ok('borne à 1000 entrées conservée', /hist\.length > 1000/.test(html));
  ok('la saisie vit dans le mode reps, plus derrière un lien replié',
     /_lsStepperHtml\('reps'/.test(html) && html.indexOf('Noter ma charge') < 0);
  const h = harness({ ah_track_history: 'CASSÉ{{' });
  let threw = false;
  try { h.api.log('Back Squat', { load: 100 }, 'charge', 0); } catch (e) { threw = true; }
  ok('historique corrompu → aucune exception', !threw);
  ok('historique corrompu → repart proprement', h.hist().length === 1);
  ok('rien à enregistrer → aucune entrée créée',
     (() => { const g = harness({}); g.api.log('X', null, 'charge', 0); return g.hist().length === 0; })());
}

const failed = R.filter(x => !x).length;
console.log('\n' + '='.repeat(60));
console.log(failed ? 'RÉSULTAT : ' + failed + ' ÉCHEC(S) sur ' + R.length
                   : 'RÉSULTAT : ' + R.length + '/' + R.length + ' tests passés.');
process.exit(failed ? 1 : 0);
