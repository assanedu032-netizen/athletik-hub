// Moteur de feedback post-séance (brique 1) — cas du §25 du brief.
// Extrait les VRAIES fonctions d'index.html et les exécute sur des historiques
// fabriqués. Vérifie surtout qu'aucun chiffre n'est inventé.
//   node scripts/test-feedback-engine.js [autre.html]
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

const NAMES = ['_ahSafeParse','_ahSessionHistory','_ahSameDay','_ahDaysBetween',
  '_ahFeedbackStage','_ahFeedbackRecord','_ahTrackValue','_ahFmtVal',
  '_ahFeedbackRegularity','_ahFeedbackProgress','_ahFeedbackTemporal',
  '_ahFeedbackFallback','_ahPickFeedback'];
// Constantes de la sélection (brique 5) — _ahPickFeedback les utilise.
const src = 'var AH_STRONG_SIGNAL = 85; var AH_COMPARABLE_GAP = 20;\n'
  + NAMES.map(n => grab('function ' + n + '(')).join('\n')
  + '\n' + grab('window._ahBuildSessionFeedback = function(');

function build(store, programs, progressState) {
  const localStorage = {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; },
  };
  const window_ = {};
  const getProgramProgress = () => progressState || { phaseIdx: 0, week: 1, doneThisWeek: {} };
  const fn = new Function('localStorage', 'window', 'console', 'PROGRAMS_V2', 'getProgramProgress',
    src + '\nreturn window._ahBuildSessionFeedback;');
  return fn(localStorage, window_, console, programs || {}, getProgramProgress);
}

const iso = (daysAgo) => {
  const d = new Date('2026-06-15T10:00:00Z');
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString();
};
const sess = (daysAgo, name, score) => {
  const e = { type: 'session', date: iso(daysAgo), sessName: name || 'Séance A', progKey: 'vd', sessKey: 's1' };
  if (score != null) e.sessionEndFeedback = { sessionQualityScore: score };
  return e;
};

const R = [];
function ok(label, cond, detail) {
  R.push(cond);
  console.log((cond ? '  PASS  ' : '  FAIL  ') + label + (detail && !cond ? '  → ' + detail : ''));
}

// ── Utilisateur vierge : séances 1, 2, 3 ──
console.log('\n=== UTILISATEUR VIERGE ===\n');
[[1, 'Séance 1. Ton point de départ est enregistré.'],
 [2, '2 séances. Ton historique commence à se construire.'],
 [3, 'Séance 3. Historique à jour.']].forEach(([n, expected]) => {
  // Séances espacées de 10 jours : aucun jalon de régularité ne peut
  // s'appliquer, on isole donc bien le fallback G.
  const hist = []; for (let i = 0; i < n; i++) hist.push(sess((n - i - 1) * 10, 'S' + i));
  const api = build({ ah_set_history: JSON.stringify(hist), ah_profile: '{}' });
  const r = api({ now: iso(0) });
  ok('séance ' + n + ' → fallback G exact', r.best && r.best.type === 'G' && r.best.message === expected,
     r.best && r.best.message);
});
// Cas complémentaire : 3 séances rapprochées → le jalon réel prime sur G.
{
  const hist = [sess(2, 'S'), sess(1, 'S'), sess(0, 'S')];
  const api = build({ ah_set_history: JSON.stringify(hist), ah_profile: '{}' });
  const r = api({ now: iso(0) });
  ok('3 séances en 7 jours → jalon réel prime sur le fallback', r.best.type === 'B', r.best.type);
  ok('le fallback reste disponible', r.candidates.some(c => c.type === 'G'));
}

// ── Records ──
console.log('\n=== RECORDS (type A) ===\n');
{
  const today = iso(0).slice(0, 10);
  const track = [
    { exerciseName: 'Squat', method: 'charge', date: iso(20).slice(0, 10), essais: [{ load: 80, reps: 5 }] },
    { exerciseName: 'Squat', method: 'charge', date: today,               essais: [{ load: 95, reps: 5 }] },
  ];
  const api = build({ ah_set_history: JSON.stringify([sess(20), sess(0)]),
                      ah_track_history: JSON.stringify(track), ah_profile: '{}' });
  const r = api({ now: iso(0) });
  const a = r.candidates.find(c => c.type === 'A');
  ok('record détecté', !!a);
  ok('valeur réelle, non inventée', a && a.data.value === 95 && a.data.previous === 80,
     a && JSON.stringify(a.data));
  ok('message conforme au brief', a && a.message === 'Nouveau record : Squat — 95 kg.', a && a.message);
}
{
  // Premier passage sur un exercice → PAS un record
  const today = iso(0).slice(0, 10);
  const track = [{ exerciseName: 'Dev', method: 'charge', date: today, essais: [{ load: 60 }] }];
  const api = build({ ah_set_history: JSON.stringify([sess(0)]),
                      ah_track_history: JSON.stringify(track), ah_profile: '{}' });
  ok('1er essai n\'est pas un record', !api({ now: iso(0) }).candidates.some(c => c.type === 'A'));
}
{
  // Temps : plus bas = meilleur
  const today = iso(0).slice(0, 10);
  const track = [
    { exerciseName: 'Sprint', method: 'temps', date: iso(10).slice(0, 10), essais: [{ time: 4.5 }] },
    { exerciseName: 'Sprint', method: 'temps', date: today,               essais: [{ time: 4.1 }] },
  ];
  const api = build({ ah_set_history: JSON.stringify([sess(10), sess(0)]),
                      ah_track_history: JSON.stringify(track), ah_profile: '{}' });
  const a = api({ now: iso(0) }).candidates.find(c => c.type === 'A');
  ok('temps : baisse = record', !!a && a.data.value === 4.1);
  // et l'inverse ne doit PAS déclencher
  track[1].essais = [{ time: 4.9 }];
  const api2 = build({ ah_set_history: JSON.stringify([sess(10), sess(0)]),
                       ah_track_history: JSON.stringify(track), ah_profile: '{}' });
  ok('temps : hausse ≠ record', !api2({ now: iso(0) }).candidates.some(c => c.type === 'A'));
}

// ── Progression (type D) ──
console.log('\n=== PROGRESSION (type D) ===\n');
{
  const api = build({ ah_set_history: JSON.stringify([sess(7, 'A', 70), sess(0, 'A', 82)]), ah_profile: '{}' });
  const d = api({ now: iso(0) }).candidates.find(c => c.type === 'D');
  ok('delta calculé sur données réelles', d && d.data.delta === 12, d && JSON.stringify(d.data));
  const api2 = build({ ah_set_history: JSON.stringify([sess(7, 'A', 82), sess(0, 'A', 70)]), ah_profile: '{}' });
  ok('régression → aucun message de progression', !api2({ now: iso(0) }).candidates.some(c => c.type === 'D'));
  const api3 = build({ ah_set_history: JSON.stringify([sess(7, 'A'), sess(0, 'A')]), ah_profile: '{}' });
  ok('sans score → rien d\'inventé', !api3({ now: iso(0) }).candidates.some(c => c.type === 'D'));
}

// ── Comparaison temporelle (type C) ──
console.log('\n=== COMPARAISON TEMPORELLE (type C) ===\n');
{
  const api = build({ ah_set_history: JSON.stringify([sess(21, 'Puissance'), sess(0, 'Puissance')]), ah_profile: '{}' });
  const c = api({ now: iso(0) }).candidates.find(x => x.type === 'C');
  ok('écart en jours exact', c && c.data.days === 21, c && JSON.stringify(c.data));
  const api2 = build({ ah_set_history: JSON.stringify([sess(3, 'Puissance'), sess(0, 'Puissance')]), ah_profile: '{}' });
  ok('moins de 7 jours → pas de comparaison', !api2({ now: iso(0) }).candidates.some(x => x.type === 'C'));
}

// ── Jalons de régularité (type B) ──
console.log('\n=== JALONS (type B) ===\n');
{
  const hist = []; for (let i = 0; i < 10; i++) hist.push(sess(9 - i, 'S'));
  const api = build({ ah_set_history: JSON.stringify(hist), ah_profile: '{}' });
  const b = api({ now: iso(0) }).candidates.find(c => c.type === 'B' && /10e séance au total/.test(c.message));
  ok('10e séance déclenche le jalon', !!b);
  const hist11 = hist.concat([sess(0, 'S')]);
  const api2 = build({ ah_set_history: JSON.stringify(hist11), ah_profile: '{}' });
  ok('11e séance ne rejoue pas le jalon',
     !api2({ now: iso(0) }).candidates.some(c => c.type === 'B' && /au total/.test(c.message)));
}

// ── Étapes de parcours (type F) ──
console.log('\n=== ÉTAPES DE PARCOURS (type F) ===\n');
{
  const PROGRAMS = { vd: { phases: [{ weeks: 4 }, { weeks: 4 }] } };
  const api = build({ ah_set_history: JSON.stringify([sess(0)]), ah_profile: '{}' },
                    PROGRAMS, { phaseIdx: 0, week: 2, doneThisWeek: {} });
  const r = api({ progKey: 'vd', rec: { weekDone: true }, phaseIdxBefore: 0 });
  ok('semaine terminée annoncée', r.best.type === 'F' && /Semaine 1\/4 terminée/.test(r.best.message), r.best.message);

  const api2 = build({ ah_set_history: JSON.stringify([sess(0)]), ah_profile: '{}' },
                     PROGRAMS, { phaseIdx: 1, week: 1, doneThisWeek: {} });
  const r2 = api2({ progKey: 'vd', rec: { weekDone: true }, phaseIdxBefore: 0 });
  ok('phase terminée prioritaire sur semaine', r2.best.type === 'F' && /Phase 0 terminée/.test(r2.best.message), r2.best.message);

  const api3 = build({ ah_set_history: JSON.stringify([sess(0)]), ah_profile: '{}' }, PROGRAMS);
  const r3 = api3({ progKey: 'vd', progName: 'Vertical Dunk', rec: { programDone: true } });
  ok('programme terminé = signal max', r3.best.type === 'F' && /Programme Vertical Dunk terminé/.test(r3.best.message), r3.best.message);
}

// ── Priorité et robustesse ──
console.log('\n=== PRIORITÉ ET ROBUSTESSE ===\n');
{
  const today = iso(0).slice(0, 10);
  const hist = []; for (let i = 0; i < 10; i++) hist.push(sess(9 - i, 'S', 60 + i));
  const track = [
    { exerciseName: 'Squat', method: 'charge', date: iso(5).slice(0, 10), essais: [{ load: 80 }] },
    { exerciseName: 'Squat', method: 'charge', date: today,              essais: [{ load: 90 }] },
  ];
  const api = build({ ah_set_history: JSON.stringify(hist), ah_track_history: JSON.stringify(track), ah_profile: '{}' });
  const r = api({ now: iso(0) });
  ok('plusieurs candidats valides coexistent', r.candidates.length >= 3, r.candidates.length + ' candidat(s)');
  ok('record prioritaire sur jalon et progression', r.best.type === 'A', r.best.type);
  ok('le fallback G est toujours présent en dernier recours', r.candidates.some(c => c.type === 'G'));
}
{
  const api = build({ ah_set_history: 'JSON CASSÉ{{{', ah_track_history: 'nope', ah_profile: '}}' });
  let threw = false, r = null;
  try { r = api({ now: iso(0) }); } catch (e) { threw = true; }
  ok('données corrompues → aucune exception', !threw);
  ok('données corrompues → fallback quand même', r && r.best && r.best.type === 'G', r && r.best && r.best.type);
}
{
  const api = build({});
  ok('localStorage vide → aucune exception', !!api({ now: iso(0) }).best);
}

const failed = R.filter(x => !x).length;
console.log('\n' + '='.repeat(60));
console.log(failed ? 'RÉSULTAT : ' + failed + ' ÉCHEC(S) sur ' + R.length
                   : 'RÉSULTAT : ' + R.length + '/' + R.length + ' tests passés.');
process.exit(failed ? 1 : 0);
