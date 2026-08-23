// Streak + jokers + micro-actions (brique 4) — §13 et §25 du brief.
// Point critique : profile.streak garde sa sémantique d'origine (jours
// consécutifs), lue à 14 endroits. Les jokers viennent PAR-DESSUS.
//   node scripts/test-streak.js [autre.html]
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

const src = 'var AH_JOKERS_PER_MONTH = 2;\n'
  + grab('function _ahSafeParse(') + '\n'
  + grab('function _ahJokersAvailable(') + '\n'
  + grab('function _bumpSessionStreak(') + '\n'
  + grabVar('AH_MICRO_ACTIONS') + '\n'
  + ['_ahRecordMicroAction', '_ahWeeksPresent', '_ahStreakInfo']
      .map(n => grab('window.' + n + ' = function(')).join(';\n') + ';';

function build(profile, hist) {
  const store = { ah_profile: JSON.stringify(profile || {}) };
  if (hist) store.ah_set_history = JSON.stringify(hist);
  const localStorage = {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; },
  };
  const window_ = {};
  const toasts = [];
  const fn = new Function('localStorage', 'window', 'console', 'showToast', 'fbSaveProfile', 'escapeHtml',
    src + '\nreturn { w: window, bump: _bumpSessionStreak, jokers: _ahJokersAvailable };');
  const api = fn(localStorage, window_, console, (m) => toasts.push(m), () => {}, s => s);
  return {
    bump: api.bump, w: api.w, jokers: api.jokers, toasts,
    prof: () => JSON.parse(store.ah_profile),
    hist: () => JSON.parse(store.ah_set_history || '[]'),
    store
  };
}

const D = (s) => s + 'T10:00:00.000Z';
const R = [];
const ok = (l, c, d) => { R.push(c); console.log((c ? '  PASS  ' : '  FAIL  ') + l + (d && !c ? '  → ' + d : '')); };

console.log('\n=== ACTIVITÉ NORMALE (comportement d\'origine préservé) ===\n');
{
  const a = build({});
  a.bump(D('2026-06-01'));
  ok('1re activité → série à 1', a.prof().streak === 1, String(a.prof().streak));
  a.bump(D('2026-06-02'));
  ok('jour suivant → série à 2', a.prof().streak === 2, String(a.prof().streak));
  a.bump(D('2026-06-02'));
  ok('2e activité le même jour → aucun double comptage', a.prof().streak === 2, String(a.prof().streak));
}
{
  const a = build({ streak: 5, lastSessionDay: '2026-06-10', bestStreak: 5 });
  a.bump(D('2026-06-11'));
  ok('série existante poursuivie', a.prof().streak === 6);
  ok('meilleure série suivie', a.prof().bestStreak === 6, String(a.prof().bestStreak));
}

console.log('\n=== JOKERS ===\n');
{
  // 1 jour manqué, jokers pleins → série préservée
  const a = build({ streak: 4, lastSessionDay: '2026-06-10' });
  a.bump(D('2026-06-12'));
  ok('1 jour manqué → série préservée', a.prof().streak === 5, String(a.prof().streak));
  ok('1 joker consommé', a.prof().streakJokers === 1, String(a.prof().streakJokers));
  ok('message sans culpabilisation',
     a.toasts.some(t => /Série préservée — 1 joker restant ce mois\./.test(t)), JSON.stringify(a.toasts));
}
{
  // 2 jours manqués, 2 jokers → couverts
  const a = build({ streak: 3, lastSessionDay: '2026-06-10' });
  a.bump(D('2026-06-13'));
  ok('2 jours manqués couverts par 2 jokers', a.prof().streak === 4, String(a.prof().streak));
  ok('solde à 0', a.prof().streakJokers === 0, String(a.prof().streakJokers));
}
{
  // 3 jours manqués > 2 jokers → série repart, SANS message de perte
  const a = build({ streak: 9, lastSessionDay: '2026-06-10' });
  a.bump(D('2026-06-14'));
  ok('3 jours manqués → série repart à 1', a.prof().streak === 1, String(a.prof().streak));
  ok('meilleure série archivée', a.prof().bestStreak === 9, String(a.prof().bestStreak));
  ok('jokers non gaspillés', a.prof().streakJokers === 2, String(a.prof().streakJokers));
  ok('AUCUN message de perte ou de reproche',
     !a.toasts.some(t => /perdu|dommage|abandonn|raté|échec/i.test(t)), JSON.stringify(a.toasts));
}
{
  // Solde déjà épuisé ce mois
  const a = build({ streak: 6, lastSessionDay: '2026-06-10', streakJokers: 0, jokersMonth: '2026-06' });
  a.bump(D('2026-06-12'));
  ok('sans joker restant → série repart', a.prof().streak === 1, String(a.prof().streak));
  ok('meilleure série conservée', a.prof().bestStreak === 6);
}

console.log('\n=== RECHARGE MENSUELLE ===\n');
{
  // 30/06 -> 02/07 : 1 seul jour manqué (le 01/07). Solde épuisé en juin,
  // mais on est en juillet : la recharge doit le couvrir.
  const a = build({ streak: 6, lastSessionDay: '2026-06-30', streakJokers: 0, jokersMonth: '2026-06' });
  a.bump(D('2026-07-02'));
  ok('mois suivant → jokers rechargés et utilisés', a.prof().streak === 7, String(a.prof().streak));
  ok('mois mis à jour', a.prof().jokersMonth === '2026-07', a.prof().jokersMonth);
  ok('1 joker consommé sur les 2 rechargés', a.prof().streakJokers === 1, String(a.prof().streakJokers));
}
{
  const a = build({ streakJokers: 0, jokersMonth: '2026-05' });
  const jk = a.jokers(a.prof(), '2026-06-01');
  ok('recharge détectée au changement de mois', jk.left === 2 && jk.recharged === true, JSON.stringify(jk));
}

console.log('\n=== MICRO-ACTIONS ===\n');
{
  const a = build({}, []);
  const done = a.w._ahRecordMicroAction('sauts', D('2026-06-05'));
  ok('micro-action enregistrée', done === true);
  ok('écrite avec type micro', a.hist()[0].type === 'micro' && a.hist()[0].kind === 'sauts',
     JSON.stringify(a.hist()[0]));
  ok('la série avance', a.prof().streak === 1, String(a.prof().streak));
}
{
  const a = build({}, []);
  ok('type inconnu refusé', a.w._ahRecordMicroAction('nawak') === false);
  ok('rien écrit', a.hist().length === 0);
}
{
  // Une micro-action ne doit JAMAIS compter comme une séance
  const a = build({}, []);
  a.w._ahRecordMicroAction('mobilite', D('2026-06-05'));
  const sessions = a.hist().filter(e => e.type === 'session');
  ok('aucune séance créée par une micro-action', sessions.length === 0);
  ok('sessionsDone non incrémenté', a.prof().sessionsDone === undefined,
     String(a.prof().sessionsDone));
}
{
  // Micro-action un jour, séance le lendemain → continuité
  const a = build({}, []);
  a.w._ahRecordMicroAction('forme', D('2026-06-05'));
  a.bump(D('2026-06-06'));
  ok('micro puis séance → série continue', a.prof().streak === 2, String(a.prof().streak));
}

console.log('\n=== SEMAINES DE PRÉSENCE ===\n');
{
  const hist = [
    { type:'session', date: D('2026-06-01') },  // lundi S1
    { type:'micro',   date: D('2026-06-03') },  // mercredi S1
    { type:'session', date: D('2026-06-09') },  // S2
    { type:'session', date: D('2026-06-22') },  // S4
  ];
  const a = build({}, hist);
  ok('semaines distinctes comptées', a.w._ahWeeksPresent() === 3, String(a.w._ahWeeksPresent()));
}
{
  const a = build({}, [{ type:'track', date: D('2026-06-01') }]);
  ok('les entrées non-activité ne comptent pas', a.w._ahWeeksPresent() === 0, String(a.w._ahWeeksPresent()));
}

console.log('\n=== ROBUSTESSE ===\n');
{
  const store = { ah_profile: 'CASSÉ{{', ah_set_history: '((' };
  const localStorage = { getItem: k => store[k] || null, setItem: (k,v) => { store[k]=v; }, removeItem: k => { delete store[k]; } };
  const window_ = {};
  const fn = new Function('localStorage','window','console','showToast','fbSaveProfile','escapeHtml',
    src + '\nreturn { w: window, bump: _bumpSessionStreak };');
  const api = fn(localStorage, window_, console, ()=>{}, ()=>{}, s=>s);
  let threw = false;
  try { api.bump(D('2026-06-01')); api.w._ahWeeksPresent(); api.w._ahStreakInfo(); } catch(e) { threw = true; }
  ok('données corrompues → aucune exception', !threw);
}

console.log('\n=== NON-RÉGRESSION DE LA SÉMANTIQUE ===\n');
{
  ok('profile.streak reste "jours consécutifs"', /profile\.streak = streak;/.test(html));
  ok('badges streak7 / streak30 intacts',
     /id:'streak7'[\s\S]{0,140}\(s\.streak\|\|0\) >= 7/.test(html) &&
     /id:'streak30'[\s\S]{0,140}\(s\.streak\|\|0\) >= 30/.test(html));
  const code = html.split('\n').filter(l => !l.trim().startsWith('//')).join('\n');
  ok('aucun vocabulaire culpabilisant introduit',
     !/Ton streak est perdu|Dommage|Tu as abandonné/i.test(code));
}

const failed = R.filter(x => !x).length;
console.log('\n' + '='.repeat(60));
console.log(failed ? 'RÉSULTAT : ' + failed + ' ÉCHEC(S) sur ' + R.length
                   : 'RÉSULTAT : ' + R.length + '/' + R.length + ' tests passés.');
process.exit(failed ? 1 : 0);
