// Saisie de charge en séance → ah_track_history → contexte Titan.
// L'enjeu : ce que l'athlète tape pendant sa séance doit arriver jusqu'au
// prompt, au même format que le tracker manuel, sans code de lecture en plus.
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

// ── Bac à sable : DOM minimal + localStorage ──
function harness(store, exos, idx) {
  const els = {};
  const mk = (v) => ({ value: v || '', textContent: '', _cls: new Set(),
    classList: { add(c){ this._o._cls.add(c); }, remove(c){ this._o._cls.delete(c); },
                 toggle(c){ if (this._o._cls.has(c)) { this._o._cls.delete(c); return false; }
                            this._o._cls.add(c); return true; },
                 contains(c){ return this._o._cls.has(c); } }, focus(){} });
  ['lsLogLoad','lsLogReps','lsLogRow','lsLogToggle','lsLogDone'].forEach(id => {
    const e = mk(''); e.classList._o = e; els[id] = e;
  });
  const document_ = { getElementById: id => els[id] || null };
  const localStorage = {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; },
  };
  const _LS = { exos: exos, idx: idx || 0, sessName: 'Jour 2 — Force', progKey: 'vd' };
  const window_ = {};
  const toasts = [];
  const src = grab(html, 'window._lsToggleLog = function(') + ';\n'
            + grab(html, 'window._lsSaveLog = function(') + ';\n'
            + grab(html, 'function _lsResetLog(');
  const fn = new Function('document', 'localStorage', 'window', 'console', '_LS',
    'showToast', 'fbSaveProfile', 'navigator',
    src + '\nreturn { save: window._lsSaveLog, toggle: window._lsToggleLog, reset: _lsResetLog };');
  const api = fn(document_, localStorage, window_, console, _LS,
                 m => toasts.push(m), () => {}, {});
  return { api, els, toasts, hist: () => JSON.parse(store.ah_track_history || '[]'), store };
}

const R = [];
const ok = (l, c, d) => { R.push(c); console.log((c ? '  PASS  ' : '  FAIL  ') + l + (d && !c ? '  → ' + d : '')); };
const EXOS = [{ n: 'Back Squat — 4×5 lourd', s: '4', r: '5' }, { n: 'Hip Thrust', s: '3', r: '8' }];

console.log('\n=== SAISIE PENDANT LA SÉANCE ===\n');
{
  const h = harness({}, EXOS, 0);
  h.els.lsLogLoad.value = '120'; h.els.lsLogReps.value = '5';
  h.api.save();
  const e = h.hist()[0];
  ok('entrée créée', h.hist().length === 1);
  ok('charge et reps enregistrées', e.essais[0].load === 120 && e.essais[0].reps === 5,
     JSON.stringify(e.essais));
  ok('marquée comme venant de la séance', e.source === 'live_session');
  ok('séance et programme conservés', e.sessName === 'Jour 2 — Force' && e.progKey === 'vd');
}

console.log('\n=== NOM D\'EXERCICE NORMALISÉ — le point critique ===\n');
{
  // "Back Squat — 4×5 lourd" et "Back Squat" doivent être le MÊME exercice,
  // sinon aucune progression ne serait jamais détectée entre deux séances.
  const h = harness({}, EXOS, 0);
  h.els.lsLogLoad.value = '120'; h.api.save();
  ok('descriptif retiré du nom', h.hist()[0].exerciseName === 'Back Squat',
     h.hist()[0].exerciseName);
  ok('alias exo renseigné pour le tracker', h.hist()[0].exo === 'Back Squat');
}

console.log('\n=== PLUSIEURS SÉRIES SUR LE MÊME EXERCICE ===\n');
{
  const h = harness({}, EXOS, 0);
  h.els.lsLogLoad.value = '110'; h.els.lsLogReps.value = '5'; h.api.save();
  h.els.lsLogLoad.value = '120'; h.els.lsLogReps.value = '5'; h.api.save();
  h.els.lsLogLoad.value = '125'; h.els.lsLogReps.value = '3'; h.api.save();
  ok('une seule entrée pour la séance du jour', h.hist().length === 1, String(h.hist().length));
  ok('les 3 séries cumulées', h.hist()[0].essais.length === 3, JSON.stringify(h.hist()[0].essais));
}
{
  // Deux exercices différents → deux entrées
  const h = harness({}, EXOS, 0);
  h.els.lsLogLoad.value = '120'; h.api.save();
  const h2 = harness(h.store, EXOS, 1);
  h2.els.lsLogLoad.value = '80'; h2.api.save();
  ok('exercices distincts → entrées distinctes', h2.hist().length === 2, String(h2.hist().length));
  ok('noms corrects', h2.hist().map(x => x.exerciseName).join(', ') === 'Back Squat, Hip Thrust',
     h2.hist().map(x => x.exerciseName).join(', '));
}

console.log('\n=== RIEN N\'EST OBLIGATOIRE ===\n');
{
  const h = harness({}, EXOS, 0);
  h.api.save();   // champs vides
  ok('saisie vide → rien enregistré', h.hist().length === 0);
  ok('message d\'aide, pas de blocage', h.toasts.length === 1 && /au moins une charge/.test(h.toasts[0]),
     JSON.stringify(h.toasts));
}
{
  const h = harness({}, EXOS, 0);
  h.els.lsLogReps.value = '12';   // poids du corps : reps seules
  h.api.save();
  ok('reps seules acceptées', h.hist().length === 1 && h.hist()[0].essais[0].reps === 12);
  ok('aucune charge inventée', h.hist()[0].essais[0].load === undefined);
}

console.log('\n=== REPLI ET RÉINITIALISATION ===\n');
{
  const h = harness({}, EXOS, 0);
  ok('repliée au départ', !h.els.lsLogRow.classList.contains('on'));
  h.api.toggle();
  ok('ouverte au clic', h.els.lsLogRow.classList.contains('on'));
  ok('libellé inversé', h.els.lsLogToggle.textContent === '− Masquer', h.els.lsLogToggle.textContent);
  h.els.lsLogLoad.value = '120'; h.api.save();
  ok('confirmation affichée', h.els.lsLogDone.classList.contains('on'));
  ok('confirmation lisible', /Back Squat — 120 kg/.test(h.els.lsLogDone.textContent),
     h.els.lsLogDone.textContent);
  ok('champs vidés après enregistrement', h.els.lsLogLoad.value === '');
  h.api.reset();
  ok('exercice suivant → zone repliée et vidée',
     !h.els.lsLogRow.classList.contains('on') && !h.els.lsLogDone.classList.contains('on'));
}

console.log('\n=== CHAÎNE COMPLÈTE : SÉANCE → TITAN ===\n');
{
  // Séance d'il y a 7 jours, puis celle d'aujourd'hui, saisies en séance.
  const past = new Date(); past.setUTCDate(past.getUTCDate() - 7);
  const store = { ah_track_history: JSON.stringify([{
    exerciseName: 'Back Squat', exo: 'Back Squat', method: 'charge',
    essais: [{ load: 110, reps: 5 }], date: past.toISOString().slice(0, 10),
    source: 'live_session', rpe: 0
  }]) };
  const h = harness(store, EXOS, 0);
  h.els.lsLogLoad.value = '120'; h.els.lsLogReps.value = '5'; h.api.save();

  // On rejoue le vrai constructeur d'état + le vrai rendu serveur
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
  const render = new Function(grab(srv, 'function fmtVal(') + '\n'
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
}

console.log('\n=== NON-RÉGRESSION ===\n');
{
  ok('format identique au tracker manuel',
     /trackingMethod: 'charge'/.test(html) && /source: 'live_session'/.test(html));
  ok('aucun code de lecture ajouté (ah_track_history réutilisé)',
     (html.match(/_asExerciseHistory\(/g) || []).length === 2);
  ok('borne à 1000 entrées conservée', /hist\.length > 1000/.test(html));
  ok('zone réinitialisée au changement d\'exercice',
     /_lsRenderEx\(\)[\s\S]{0,220}_lsResetLog\(\)/.test(html));
  const h = harness({ ah_track_history: 'CASSÉ{{' }, EXOS, 0);
  h.els.lsLogLoad.value = '100';
  let threw = false;
  try { h.api.save(); } catch (e) { threw = true; }
  ok('historique corrompu → aucune exception', !threw);
  ok('historique corrompu → repart proprement', h.hist().length === 1);
}

const failed = R.filter(x => !x).length;
console.log('\n' + '='.repeat(60));
console.log(failed ? 'RÉSULTAT : ' + failed + ' ÉCHEC(S) sur ' + R.length
                   : 'RÉSULTAT : ' + R.length + '/' + R.length + ' tests passés.');
process.exit(failed ? 1 : 0);
