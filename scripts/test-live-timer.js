// Le chrono de l'écran de séance, rejoué contre une horloge simulée.
// Deux acquis à prouver :
//  1. il lit l'HORLOGE, il ne compte pas les ticks — un onglet étranglé en
//     arrière-plan ne le fait plus dériver ;
//  2. une micro-récup EST une récupération : elle dégrise le bouton et arme
//     la notification système, comme le repos entre séries.
//   node scripts/test-live-timer.js [autre.html]
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(process.argv[2] || path.join(__dirname, '..', 'index.html'), 'utf8');

function balance(from, braceFrom) {
  let d = 0, j = html.indexOf('{', braceFrom === undefined ? from : braceFrom);
  for (; j < html.length; j++) {
    if (html[j] === '{') d++;
    else if (html[j] === '}') { d--; if (!d) { j++; break; } }
  }
  return html.slice(from, j);
}
const grab = (n) => {
  const s = html.indexOf('function ' + n + '(');
  if (s < 0) throw new Error('introuvable: ' + n);
  return balance(s, html.indexOf('(', s));
};

const R = [];
const ok = (l, c, d) => { R.push(c); console.log((c ? '  PASS  ' : '  FAIL  ') + l + (d && !c ? '  → ' + d : '')); };

// ── Un banc d'essai : horloge, intervalles et DOM sous notre contrôle ──
function bench() {
  const env = {
    now: 1_000_000,
    timers: [],          // les setInterval enregistrés
    notifs: [],          // tim_minutScheduleNotif / Cancel
    painted: [],         // valeurs affichées
    finished: 0,
    beeps: 0
  };
  const _LS = { tmr: null, vm: null, restActive: false, sq: null };
  const doc = {
    getElementById: (id) => {
      if (id === 'lsBigVal') return { set textContent(v) { env.painted.push(v); }, get textContent() { return ''; } };
      if (id === 'lsTimerFill') return { style: {} };
      if (id === 'lsBtnDone') return env.btn;
      return null;
    }
  };
  env.btn = {
    textContent: '', _cls: new Set(),
    classList: {
      add: (c) => env.btn._cls.add(c),
      remove: (c) => env.btn._cls.delete(c),
      toggle: (c, on) => { on ? env.btn._cls.add(c) : env.btn._cls.delete(c); },
      contains: (c) => env.btn._cls.has(c)
    }
  };

  const src = [
    grab('_lsFmt'), grab('_lsTimerStop'), grab('_lsTimerReset'), grab('_lsTimerPaint'),
    grab('_lsTimerRemaining'), grab('_lsTimerTick'), grab('_lsTimerStart'),
    grab('_lsTimerToggle'), grab('_lsInRest'), grab('_lsPaintPrimary')
  ].join('\n');

  const api = new Function(
    '_LS', 'document', 'window', 'navigator', 'Date', 'setInterval', 'clearInterval',
    '_lsPrimaryLabel',
    src + '\nreturn { start:_lsTimerStart, stop:_lsTimerStop, reset:_lsTimerReset,'
        + ' tick:_lsTimerTick, toggle:_lsTimerToggle, remaining:_lsTimerRemaining,'
        + ' paint:_lsPaintPrimary, inRest:_lsInRest };'
  )(
    _LS, doc,
    {
      tim_beepUnlock: () => {},
      tim_sndTick: () => { env.beeps++; },
      tim_sndFinish: () => {},
      tim_minutScheduleNotif: (at) => env.notifs.push({ kind: 'arm', at }),
      tim_minutCancelNotif: () => env.notifs.push({ kind: 'cancel' })
    },
    { vibrate: () => true },
    { now: () => env.now },
    (fn, ms) => { env.timers.push({ fn, ms }); return env.timers.length; },
    () => {},
    () => 'LIBELLÉ'
  );
  env.api = api;
  env._LS = _LS;
  // Avance l'horloge de `ms`, puis joue autant de ticks que l'appelant le dit.
  env.advance = (ms, ticks) => {
    env.now += ms;
    for (let i = 0; i < (ticks == null ? 1 : ticks); i++) api.tick();
  };
  return env;
}

console.log('\n=== LE CHRONO LIT L\'HORLOGE, PAS LES TICKS ===\n');
{
  const e = bench();
  e.api.start(60, 'down', () => { e.finished++; });
  ok('au départ, le restant est la durée prescrite', e._LS.tmr.sec === 60);
  // Un seul tick observé après 10 s réelles : un compteur décrémenté aurait
  // affiché 59. L'horloge dit 50.
  e.advance(10_000, 1);
  ok('10 s réelles, 1 seul tick reçu → 50 s restantes', e._LS.tmr.sec === 50, String(e._LS.tmr.sec));
  // Le cas de l'écran verrouillé : 45 s passent sans aucun tick.
  e.advance(45_000, 1);
  ok('45 s de plus sans ticks → 5 s, pas de dérive', e._LS.tmr.sec === 5, String(e._LS.tmr.sec));
  // Avec des ticks aussi espacés, la seconde « 3 » n'est jamais observée :
  // il n'y a donc rien à annoncer. Le son de FIN, lui, part quand même — et
  // c'est la notification système qui couvre l'écran verrouillé.
  ok('aucun bip d\'approche inventé sur une seconde jamais observée', e.beeps === 0, String(e.beeps));
  e.advance(6_000, 1);
  ok('le chrono se termine dès que l\'horloge l\'a dépassé', e.finished === 1);
  ok('  et il s\'arrête vraiment', e._LS.tmr.running === false);
}
{
  // Rythme normal, écran allumé : l'annonce des 3 s doit sonner une fois.
  const e = bench();
  e.api.start(10, 'down', () => {});
  for (let i = 0; i < 44; i++) e.advance(250, 1);
  ok('à l\'écran allumé, le bip d\'approche sonne — une seule fois', e.beeps === 1, String(e.beeps));
}
{
  const e = bench();
  e.api.start(30, 'down', () => {});
  // 120 ticks pour 30 s : le rythme de repeinture ne change pas le résultat.
  for (let i = 0; i < 40; i++) e.advance(250, 1);
  ok('40 repeintures en 10 s → 20 s restantes', e._LS.tmr.sec === 20, String(e._LS.tmr.sec));
}
{
  const e = bench();
  e.api.start(0, 'up', null);
  ok('chrono montant : départ à 0', e._LS.tmr.sec === 0);
  e.advance(12_000, 1);
  ok('  il monte avec l\'horloge, pas avec les ticks', e._LS.tmr.sec === 12, String(e._LS.tmr.sec));
  e.advance(90_000, 1);
  ok('  et ne décroche pas après 90 s sans tick', e._LS.tmr.sec === 102, String(e._LS.tmr.sec));
}

console.log('\n=== PAUSE ET REPRISE ===\n');
{
  const e = bench();
  e.api.start(60, 'down', () => {});
  e.advance(20_000, 1);
  e.api.toggle();
  ok('la pause fige le restant', e._LS.tmr.sec === 40, String(e._LS.tmr.sec));
  e.now += 300_000; // 5 minutes en pause
  e.api.tick();
  ok('  cinq minutes de pause ne consomment rien', e._LS.tmr.sec === 40, String(e._LS.tmr.sec));
  e.api.toggle();
  e.advance(10_000, 1);
  ok('la reprise repart du restant figé', e._LS.tmr.sec === 30, String(e._LS.tmr.sec));
}

console.log('\n=== LA NOTIFICATION SURVIT À L\'ÉCRAN VERROUILLÉ ===\n');
{
  const e = bench();
  e.api.start(45, 'down', () => {});
  const armed = e.notifs.filter(n => n.kind === 'arm');
  ok('un décompte arme une notification système', armed.length === 1, JSON.stringify(e.notifs));
  ok('  programmée à la bonne échéance',
     !!armed[0] && armed[0].at === 1_000_000 + 45_000,
     armed[0] ? String(armed[0].at) : 'aucune notification armée');
  e.api.stop();
  ok('l\'arrêt la désarme', e.notifs.some(n => n.kind === 'cancel'));
}
{
  const e = bench();
  e.api.start(0, 'up', null);
  ok('un chrono montant n\'en arme aucune (il n\'a pas de fin)',
     !e.notifs.some(n => n.kind === 'arm'), JSON.stringify(e.notifs));
}
{
  const e = bench();
  e.api.start(60, 'down', () => {});
  e.advance(20_000, 1);
  e.api.toggle();
  ok('la pause désarme la notification', e.notifs.some(n => n.kind === 'cancel'));
  const before = e.notifs.filter(n => n.kind === 'arm').length;
  e.api.toggle();
  ok('la reprise en réarme une', e.notifs.filter(n => n.kind === 'arm').length === before + 1);
}

console.log('\n=== UNE MICRO-RÉCUP EST UNE RÉCUPÉRATION ===\n');
{
  const e = bench();
  e._LS.vm = { metrique: 'sequence', method: { steps: [] }, series: { n: 1 } };
  e._LS.sq = { exo: 'X', i: 1, resting: true };
  e.api.paint();
  ok('pendant une micro-récup, le bouton est dégrisé',
     e.btn.classList.contains('ls-btn-rest'), [...e.btn._cls].join(','));
  ok('  il n\'est PAS en état "chrono qui tourne" (donc pas doré)',
     !e.btn.classList.contains('ls-btn-run'));
  ok('  et il dit exactement ce que le tap fera',
     e.btn.textContent === 'Passer la récup', e.btn.textContent);
  ok('_lsInRest reconnaît la micro-récup', e.api.inRest() === true);

  e._LS.sq.resting = false;
  e._LS.tmr = { running: false };
  e.api.paint();
  ok('hors récup, le bouton redevient l\'action principale',
     !e.btn.classList.contains('ls-btn-rest'), [...e.btn._cls].join(','));
  ok('_lsInRest redevient faux', e.api.inRest() === false);
}
{
  const e = bench();
  e._LS.restActive = true;
  e._LS.vm = { metrique: 'reps', series: { n: 3 } };
  e.api.paint();
  ok('le repos entre séries garde son comportement d\'avant',
     e.btn.textContent === 'Passer le repos' && e.btn.classList.contains('ls-btn-rest'),
     e.btn.textContent);
  ok('_lsInRest le reconnaît aussi', e.api.inRest() === true);
}

console.log('\n=== LES DEUX RÉCUPÉRATIONS NE SE RESSEMBLENT PLUS ===\n');
{
  const lbl = new Function(grab('_lsRestLabel') + '\nreturn _lsRestLabel;')();
  ok('le repos entre séries s\'appelle « Récupération complète »',
     lbl('classique', false, false, 1, 3) === 'Récupération complète',
     lbl('classique', false, false, 1, 3));
  ok('la transition entre exercices garde son nom',
     lbl('classique', true, false, 3, 3) === 'Transition');
  ok('le circuit garde le sien', /fin du tour/.test(lbl('classique', false, true, 2, 4)));
  const seqSrc = html.slice(html.indexOf("case 'sequence': {"), html.indexOf("// ── MODE SCORE"));
  ok('la micro-récup s\'appelle « Récupération courte »', /Récupération courte/.test(seqSrc));
  ok('  et elle est bleue, pas dorée', /Récupération courte<\/div>/.test(
     seqSrc.replace(/style="color:var\(--lv-rest\)"/g, '')) === false || /--lv-rest/.test(seqSrc));
  ok('l\'ancienne phrase en double a disparu',
     !/repars dès que ça sonne/.test(html));
}

console.log('\n=== L\'ACTION PASSE AVANT LE NOM DE LA MÉTHODE ===\n');
{
  const seqSrc = html.slice(html.indexOf("case 'sequence': {"), html.indexOf("// ── MODE SCORE"));
  const posBig = seqSrc.indexOf('ls-big');
  const posLabel = seqSrc.indexOf('vm.method.def.label');
  ok('la valeur en gros est rendue AVANT le nom de la méthode',
     posBig > -1 && posLabel > -1 && posBig < posLabel, posBig + ' / ' + posLabel);
  ok('le nom de la méthode reste présent, en secondaire',
     /ls-mode-hint">' \+ _lsEsc\(vm\.method\.def\.label\)/.test(seqSrc));
  ok('l\'unité est écrite en toutes lettres', /répétitions/.test(seqSrc));
}

console.log('\n=== LE COMPTEUR D\'EXERCICES EST NOMMÉ ===\n');
{
  ok('« 4 / 12 » devient « Exercice 4 / 12 »',
     /ls-dashnum-l">Exercice</.test(html));
  ok('l\'étiquette a son propre style, en retrait', /\.ls-dashnum-l \{/.test(html));
  ok('le compteur de séries dit toujours « Série »', /unit = \(vm\.metrique === 'distance'\) \? 'Sprint' : 'Série'/.test(html));
}

const bad = R.filter(x => !x).length;
console.log('\n' + '='.repeat(60));
console.log(bad ? 'RÉSULTAT : ' + bad + ' ÉCHEC(S) sur ' + R.length
                : 'RÉSULTAT : ' + R.length + '/' + R.length + ' tests passés.');
process.exit(bad ? 1 : 0);
