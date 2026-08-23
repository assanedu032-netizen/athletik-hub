// Progression Loop (brique 2) — anticipation + jalons.
// Vérifie les 3 questions du §22 : où j'en suis, ce que j'ai accompli, ce qui
// arrive ensuite — et surtout qu'aucune de ces réponses n'est inventée.
//   node scripts/test-progression-loop.js [autre.html]
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
function grabVar(name) {
  const s = html.indexOf('var ' + name + ' = [');
  return html.slice(s, html.indexOf('\n];', s) + 3);
}

const FN = ['_ahSafeParse','_ahSessionHistory','_ahDaysBetween','_ahTrackValue','_ahNextStepLabel']
  .map(n => grab('function ' + n + '(')).join('\n');
const WIN = ['_ahNextStep','_ahWeeksSinceTest','_ahJourneyStats','_ahCheckMilestones']
  .map(n => grab('window.' + n + ' = function(')).join(';\n') + ';';
const src = FN + '\n' + grabVar('AH_MILESTONES') + '\n' + WIN;

function build(store, programs, progressState) {
  const localStorage = {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; },
  };
  const window_ = {};
  const getProgramProgress = () => progressState || { phaseIdx: 0, week: 1, doneThisWeek: {} };
  const _requiredSessionKeys = (phase) => {
    const out = [], seen = {};
    (phase && phase.weekDays || []).forEach(d => {
      const k = d && d.s;
      if (!k || ['rest','opt','mener','bilan'].includes(k)) return;
      if (phase.sessions && phase.sessions[k] && !seen[k]) { seen[k] = true; out.push(k); }
    });
    return out;
  };
  const fn = new Function('localStorage', 'window', 'console', 'PROGRAMS_V2',
    'getProgramProgress', '_requiredSessionKeys', 'fbSaveProfile',
    src + '\nreturn { w: window, nextLabel: _ahNextStepLabel };');
  const api = fn(localStorage, window_, console, programs || {}, getProgramProgress,
                 _requiredSessionKeys, () => {});
  return { ...api.w, nextLabel: api.nextLabel, store };
}

const PROG = { vd: { phases: [
  { weeks: 4,
    weekDays: [{d:'Lun',s:'j1'},{d:'Mar',s:'rest'},{d:'Mer',s:'j2'},{d:'Ven',s:'j3'}],
    sessions: { j1:{name:'Jour 1 — Pliométrie',exos:[1,2,3,4,5]},
                j2:{name:'Jour 2 — Force',exos:[1,2,3]},
                j3:{name:'Jour 3 — Vitesse',exos:[1,2]} } },
  { weeks: 3, weekDays: [{d:'Lun',s:'j1'}], sessions: { j1:{name:'P2 J1',exos:[1]} } }
] } };

const iso = (daysAgo) => {
  const d = new Date('2026-06-15T10:00:00Z');
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString();
};
const sess = (daysAgo) => ({ type:'session', date: iso(daysAgo), sessName:'S', progKey:'vd', sessKey:'j1' });

const R = [];
const ok = (l, c, d) => { R.push(c); console.log((c?'  PASS  ':'  FAIL  ')+l+(d&&!c?'  → '+d:'')); };

console.log('\n=== OÙ J\'EN SUIS ===\n');
{
  const api = build({ ah_profile: JSON.stringify({ programKey:'vd' }) }, PROG,
                    { phaseIdx: 0, week: 2, doneThisWeek: { j1:true } });
  const n = api._ahNextStep();
  ok('phase et semaine lues du programme réel', n && n.phaseIdx === 0 && n.week === 2 && n.totalWeeks === 4,
     n && JSON.stringify({p:n.phaseIdx,w:n.week,t:n.totalWeeks}));
}
{
  const api = build({ ah_profile: '{}' }, PROG);
  ok('sans programme → null, rien d\'inventé', api._ahNextStep() === null);
}
{
  const api = build({ ah_profile: JSON.stringify({ programKey:'inconnu' }) }, PROG);
  ok('programme inconnu → null', api._ahNextStep() === null);
}

console.log('\n=== CE QUI ARRIVE ENSUITE ===\n');
{
  const api = build({ ah_profile: JSON.stringify({ programKey:'vd' }) }, PROG,
                    { phaseIdx: 0, week: 1, doneThisWeek: { j1:true } });
  const n = api._ahNextStep();
  ok('prochaine séance = 1re non faite', n.sessKey === 'j2' && n.sessName === 'Jour 2 — Force', n && n.sessName);
  ok('nombre d\'exercices réel', n.exoCount === 3, String(n.exoCount));
  ok('restantes cette semaine', n.remainingThisWeek === 2, String(n.remainingThisWeek));
  ok('libellé construit sur du réel',
     api.nextLabel(n, {}) === 'Séance : Jour 2 — Force — 3 exercices', api.nextLabel(n, {}));
}
{
  const api = build({ ah_profile: JSON.stringify({ programKey:'vd' }) }, PROG,
                    { phaseIdx: 0, week: 2, doneThisWeek: { j1:true, j2:true, j3:true } });
  const n = api._ahNextStep();
  ok('semaine complète détectée', n.weekComplete === true && n.sessKey === null);
  ok('libellé de fin de semaine', api.nextLabel(n, {}) === 'Semaine terminée. La suivante commence.', api.nextLabel(n, {}));
}
{
  const api = build({ ah_profile: JSON.stringify({ programKey:'vd' }) }, PROG,
                    { phaseIdx: 0, week: 4, doneThisWeek: { j1:true, j2:true, j3:true } });
  ok('dernière semaine de phase', api.nextLabel(api._ahNextStep(), {}) === 'Dernière semaine de la phase terminée.');
}
{
  const api = build({ ah_profile: '{}' }, PROG);
  ok('aucune donnée → aucun libellé', api.nextLabel(null, {}) === null);
}

console.log('\n=== RAPPEL TEST SAT ===\n');
{
  const api = build({ ah_profile: JSON.stringify({ satCompletedAt: iso(40) }) }, PROG);
  const w = api._ahWeeksSinceTest(iso(0));
  ok('semaines depuis le test calculées', w === 5, String(w));
  ok('rappel prioritaire au-delà de 4 semaines',
     /5 semaines depuis ton dernier test/.test(api.nextLabel({ sessName:'X' }, { weeksSinceTest: 5 })));
  ok('pas de rappel avant 4 semaines',
     api.nextLabel({ sessName:'X', exoCount:2 }, { weeksSinceTest: 2 }) === 'Séance : X — 2 exercices');
}
{
  const api = build({ ah_profile: '{}' }, PROG);
  ok('jamais testé → null, aucun rappel inventé', api._ahWeeksSinceTest() === null);
}

console.log('\n=== CE QUE J\'AI ACCOMPLI ===\n');
{
  const hist = [sess(5), sess(3), sess(0)];
  const track = [
    { exerciseName:'Squat', method:'charge', date: iso(9).slice(0,10), essais:[{load:80}] },
    { exerciseName:'Squat', method:'charge', date: iso(0).slice(0,10), essais:[{load:95}] },
    { exerciseName:'Dev',   method:'charge', date: iso(0).slice(0,10), essais:[{load:50}] },
  ];
  const api = build({ ah_set_history: JSON.stringify(hist), ah_track_history: JSON.stringify(track),
                      ah_profile: JSON.stringify({ phasesDone: 1 }) }, PROG);
  const s = api._ahJourneyStats();
  ok('séances comptées réellement', s.sessionsTotal === 3, String(s.sessionsTotal));
  ok('records comptés (Squat oui, Dev non car 1 seule entrée)', s.prCount === 1, String(s.prCount));
  ok('phases lues du profil', s.phasesDone === 1);
}

console.log('\n=== JALONS — UNE SEULE FOIS ===\n');
{
  const store = { ah_set_history: JSON.stringify([sess(0)]), ah_profile: '{}' };
  const api = build(store, PROG);
  const first = api._ahCheckMilestones();
  ok('1re séance → jalon annoncé', first.length === 1 && first[0].id === 'first_session',
     JSON.stringify(first.map(m=>m.id)));
  const again = api._ahCheckMilestones();
  ok('même jalon jamais rejoué', again.length === 0, JSON.stringify(again.map(m=>m.id)));
  ok('jalon persisté', JSON.parse(store.ah_milestones_shown).indexOf('first_session') > -1);
}
{
  const hist = []; for (let i = 0; i < 10; i++) hist.push(sess(9 - i));
  const store = { ah_set_history: JSON.stringify(hist),
                  ah_profile: '{}', ah_milestones_shown: JSON.stringify(['first_session']) };
  const api = build(store, PROG);
  const m = api._ahCheckMilestones();
  ok('10 séances → nouveau jalon, sans rejouer le premier',
     m.length === 1 && m[0].id === 'sessions_10', JSON.stringify(m.map(x=>x.id)));
}

console.log('\n=== ROBUSTESSE ===\n');
{
  const api = build({ ah_set_history: 'CASSÉ{{', ah_track_history: '((', ah_profile: '}}' }, PROG);
  let threw = false;
  try { api._ahJourneyStats(); api._ahNextStep(); api._ahCheckMilestones(); } catch(e) { threw = true; }
  ok('données corrompues → aucune exception', !threw);
}
{
  const api = build({}, PROG);
  let threw = false;
  try { api._ahJourneyStats(); api._ahNextStep(); api._ahCheckMilestones(); } catch(e) { threw = true; }
  ok('localStorage vide → aucune exception', !threw);
}

const failed = R.filter(x => !x).length;
console.log('\n' + '='.repeat(60));
console.log(failed ? 'RÉSULTAT : ' + failed + ' ÉCHEC(S) sur ' + R.length
                   : 'RÉSULTAT : ' + R.length + '/' + R.length + ' tests passés.');
process.exit(failed ? 1 : 0);
