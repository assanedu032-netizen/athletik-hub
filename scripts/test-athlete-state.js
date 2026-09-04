// Athlete State → Titan. Les 10 tests du §18 du brief.
// La chaîne testée : données réelles → état client → rendu serveur → prompt.
//   node scripts/test-athlete-state.js
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(process.argv[2] || path.join(ROOT, 'index.html'), 'utf8');
const srv  = fs.readFileSync(process.argv[3] || path.join(ROOT, 'netlify', 'functions', 'titan.js'), 'utf8');

function grabFrom(text, decl) {
  const start = text.indexOf(decl);
  if (start < 0) throw new Error('introuvable: ' + decl);
  let i = text.indexOf('{', text.indexOf('(', start)), d = 0, j = i;
  for (; j < text.length; j++) {
    if (text[j] === '{') d++;
    else if (text[j] === '}') { d--; if (!d) { j++; break; } }
  }
  return text.slice(start, j);
}

// ── Côté client : construction de l'état ──
const CLIENT_SRC = 'var AS_MAX_SESSIONS = 5, AS_MAX_EXOS = 6;\n'
  + ['_ahSafeParse','_ahSessionHistory','_ahDaysBetween','_ahTrackValue',
     '_asRound','_asExerciseHistory','_asSessionFeedback','_asTrends']
      .map(n => grabFrom(html, 'function ' + n + '(')).join('\n') + '\n'
  + grabFrom(html, 'window._ahBuildAthleteState = function(') + ';';

function buildState(store, next, streakInfo) {
  const localStorage = {
    getItem: k => (k in store ? store[k] : null),
    setItem: () => {}, removeItem: () => {},
  };
  const window_ = {
    _ahNextStep: () => next || null,
    _ahWeeksSinceTest: () => (store._weeks == null ? null : store._weeks),
    _ahStreakInfo: () => streakInfo || null,
  };
  const fn = new Function('localStorage', 'window', 'console',
    CLIENT_SRC + '\nreturn window._ahBuildAthleteState;');
  return fn(localStorage, window_, console);
}

// ── Côté serveur : rendu textuel ──
const SERVER_SRC = grabFrom(srv, 'function daysAgoTxt(') + '\n'
  + grabFrom(srv, 'function frDate(') + '\n'
  + grabFrom(srv, 'function fmtVal(') + '\n' + grabFrom(srv, 'function buildAthleteState(');
const render = new Function(SERVER_SRC + '\nreturn buildAthleteState;')();

const iso = (daysAgo) => {
  const d = new Date('2026-06-15T10:00:00Z');
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString();
};
const NOW = iso(0);
const sess = (daysAgo, name, fb) => {
  const e = { type: 'session', date: iso(daysAgo), sessName: name || 'Jour 1', progKey: 'vd', sessKey: 'j1' };
  if (fb) e.sessionEndFeedback = fb;
  return e;
};
const trk = (daysAgo, name, load, rpe) => ({
  exerciseName: name, method: 'charge', date: iso(daysAgo).slice(0, 10),
  essais: [{ load: load, reps: 5 }], rpe: rpe
});

const R = [];
const ok = (l, c, d) => { R.push(c); console.log((c ? '  PASS  ' : '  FAIL  ') + l + (d && !c ? '  → ' + d : '')); };

console.log('\n=== TEST 1 — une séance terminée → Titan la reçoit ===\n');
{
  const st = buildState({ ah_set_history: JSON.stringify([sess(0, 'Jour 1 — Pliométrie',
                            { sessionQualityScore: 82, productivity: 80, intensity: 85, focus: 80 })]),
                          ah_profile: '{}' })({ now: NOW });
  ok('séance présente dans l\'état', st.lastSession && st.lastSession.name === 'Jour 1 — Pliométrie',
     JSON.stringify(st.lastSession));
  ok('score de séance récupéré', st.lastSession.score === 82);
  const txt = render(st);
  ok('le nom apparaît dans le prompt', /Jour 1 — Pliométrie/.test(txt));
  ok('le score apparaît dans le prompt', /score de séance 82\/100/.test(txt), txt.slice(0, 300));
  ok('le ressenti apparaît', /productivité 80.*intensité 85.*focus 80/.test(txt));
}

console.log('\n=== TEST 2 — nouvelle séance → contexte actualisé ===\n');
{
  const h1 = [sess(3, 'A', { sessionQualityScore: 70 })];
  const s1 = buildState({ ah_set_history: JSON.stringify(h1), ah_profile: '{}' })({ now: NOW });
  const h2 = h1.concat([sess(0, 'B', { sessionQualityScore: 88 })]);
  const s2 = buildState({ ah_set_history: JSON.stringify(h2), ah_profile: '{}' })({ now: NOW });
  ok('la dernière séance change', s1.lastSession.name === 'A' && s2.lastSession.name === 'B');
  ok('le total est recalculé', s1.adherence.sessionsTotal === 1 && s2.adherence.sessionsTotal === 2);
  ok('le nouveau score est visible', /score de séance 88/.test(render(s2)));
}

console.log('\n=== TEST 3 — progression sur un exercice → identifiée ===\n');
{
  const st = buildState({ ah_set_history: JSON.stringify([sess(0)]), ah_profile: '{}',
    ah_track_history: JSON.stringify([trk(20, 'Squat', 110), trk(10, 'Squat', 115), trk(0, 'Squat', 120)]) })({ now: NOW });
  const e = st.exercises.find(x => x.name === 'Squat');
  ok('départ, dernière et record calculés', e.first === 110 && e.last === 120 && e.best === 120,
     JSON.stringify({ f: e.first, l: e.last, b: e.best }));
  ok('évolution en pourcentage', e.deltaPct === 9.1, String(e.deltaPct));
  const txt = render(st);
  ok('progression lisible dans le prompt', /Squat.*départ 110 kg, record 120 kg, évolution \+9\.1 %/.test(txt),
     (txt.match(/- Squat[^\n]*/) || [''])[0]);
}

console.log('\n=== TEST 4 — aucune donnée → Titan n\'invente rien ===\n');
{
  const st = buildState({ ah_profile: '{}' })({ now: NOW });
  ok('manques déclarés', st.missing.length >= 2, JSON.stringify(st.missing));
  const txt = render(st);
  ok('section "DONNÉES NON DISPONIBLES" présente', /DONNÉES NON DISPONIBLES/.test(txt));
  ok('absence de séance annoncée', /aucune séance enregistrée/.test(txt));
  ok('absence de perf annoncée', /aucune performance d'exercice enregistrée/.test(txt));
  ok('consigne anti-invention présente', /ne dois jamais\s*\n?citer une performance/.test(txt.replace(/\s+/g, ' ')) || /jamais citer une performance/.test(txt.replace(/\s+/g, ' ')));
}
{
  const txt = render(null);
  ok('état absent → message explicite, pas de silence', /Aucune donnée d'entraînement n'a pu être chargée/.test(txt));
  ok('consigne anti-invention même sans état', /N'invente rien/.test(txt));
}

console.log('\n=== TEST 5 — cloisonnement entre utilisateurs ===\n');
{
  const A = buildState({ ah_set_history: JSON.stringify([sess(0, 'Séance de A')]), ah_profile: '{}' })({ now: NOW });
  const B = buildState({ ah_set_history: JSON.stringify([sess(0, 'Séance de B')]), ah_profile: '{}' })({ now: NOW });
  ok('chaque état ne contient que ses propres données',
     !/Séance de B/.test(render(A)) && !/Séance de A/.test(render(B)));
  // Le serveur dérive l'uid du token, jamais du corps de la requête
  ok('uid dérivé du token Firebase, jamais du client',
     /verifyIdToken/.test(srv) && /uid = decoded\.uid/.test(srv));
  ok('aucun uid lu depuis le body', !/body\.uid|body\.userId/.test(srv));
}

console.log('\n=== TEST 6 — plusieurs séances → comparaison possible ===\n');
{
  const hist = [sess(21, 'A', { sessionQualityScore: 60 }), sess(14, 'A', { sessionQualityScore: 65 }),
                sess(9, 'A', { sessionQualityScore: 68 }), sess(6, 'A', { sessionQualityScore: 80 }),
                sess(3, 'A', { sessionQualityScore: 82 }), sess(0, 'A', { sessionQualityScore: 85 })];
  const st = buildState({ ah_set_history: JSON.stringify(hist), ah_profile: '{}' })({ now: NOW });
  ok('5 séances récentes transmises (borne respectée)', st.recentSessions.length === 5,
     String(st.recentSessions.length));
  ok('ordre du plus récent au plus ancien', st.recentSessions[0].daysAgo === 0);
  ok('tendance de score calculée', st.trends.some(t => /Score de séance en hausse/.test(t)),
     JSON.stringify(st.trends));
}

console.log('\n=== TEST 7 — RPE enregistré → exploitable ===\n');
{
  const st = buildState({ ah_set_history: JSON.stringify([sess(0)]), ah_profile: '{}',
    ah_track_history: JSON.stringify([trk(10, 'Squat', 110, 7), trk(5, 'Squat', 115, 7), trk(0, 'Squat', 120, 9)]) })({ now: NOW });
  const e = st.exercises[0];
  ok('RPE de la dernière séance', e.rpeLast === 9, String(e.rpeLast));
  ok('RPE moyen calculé', e.rpeAvg === 7.7, String(e.rpeAvg));
  ok('RPE visible dans le prompt', /RPE 9 \(moyenne 7\.7\)/.test(render(st)));
  ok('hausse de RPE signalée', st.trends.some(t => /RPE en hausse sur Squat/.test(t)), JSON.stringify(st.trends));
}

console.log('\n=== TEST 8 — record → identifié ===\n');
{
  const st = buildState({ ah_set_history: JSON.stringify([sess(0)]), ah_profile: '{}',
    ah_track_history: JSON.stringify([trk(10, 'Squat', 110), trk(0, 'Squat', 125)]) })({ now: NOW });
  ok('record détecté', st.exercises[0].isPR === true);
  ok('record annoncé dans le prompt', /RECORD à la dernière séance/.test(render(st)));
  // Régression = pas un record
  const st2 = buildState({ ah_set_history: JSON.stringify([sess(0)]), ah_profile: '{}',
    ah_track_history: JSON.stringify([trk(10, 'Squat', 125), trk(0, 'Squat', 110)]) })({ now: NOW });
  ok('une baisse n\'est pas un record', st2.exercises[0].isPR === false);
  ok('le record historique reste le meilleur', st2.exercises[0].best === 125, String(st2.exercises[0].best));
}

console.log('\n=== TEST 9 — tests SAT/SET → comparables ===\n');
{
  const st = buildState({ ah_set_history: JSON.stringify([sess(0)]), _weeks: 5,
    ah_profile: JSON.stringify({ athScore: 72, vertJump: 62, satSprintTime: 4.1,
                                 satForce1RM: 120, satCompletedAt: iso(35) }) })({ now: NOW });
  ok('valeurs de test récupérées', st.tests.athScore === 72 && st.tests.vertJump === 62);
  const txt = render(st);
  ok('tests visibles dans le prompt', /score 72\/100 · détente 62 cm · sprint 4\.1 s/.test(txt),
     (txt.match(/TESTS PHYSIQUES[^\n]*/) || [''])[0]);
  ok('ancienneté du test transmise', /Dernier test il y a 5 semaine/.test(txt));
}
{
  const st = buildState({ ah_set_history: JSON.stringify([sess(0)]), ah_profile: '{}' })({ now: NOW });
  ok('sans test → déclaré manquant', st.tests === null && st.missing.some(m => /aucun test physique/.test(m)));
}

console.log('\n=== TEST 10 — contexte de la séance en cours ===\n');
{
  const next = { phaseIdx: 1, week: 3, totalWeeks: 4, sessName: 'Jour 2 — Force',
                 exoCount: 5, remainingThisWeek: 2 };
  const st = buildState({ ah_set_history: JSON.stringify([sess(0, 'Jour 1')]),
                          ah_profile: JSON.stringify({ program: 'Vertical Dunk', programKey: 'vd' }) }, next)({ now: NOW });
  ok('phase et semaine réelles', st.program.phase === 2 && st.program.week === 3);
  const txt = render(st);
  ok('programme et position dans le prompt', /Vertical Dunk — phase 2, semaine 3\/4/.test(txt),
     (txt.match(/Programme :[^\n]*/) || [''])[0]);
  ok('prochaine séance annoncée', /Jour 2 — Force \(5 exercices\)/.test(txt));
  ok('séances restantes', /Séances restantes cette semaine : 2/.test(txt));
}

console.log('\n=== INTÉGRATION ET NON-RÉGRESSION ===\n');
{
  ok('athleteState réellement envoyé au serveur', /ctx\.athleteState = window\._ahBuildAthleteState\(\)/.test(html));
  ok('construction isolée en try/catch', /try \{[\s\S]{0,220}ctx\.athleteState[\s\S]{0,120}catch/.test(html));
  ok('bloc système séparé du profil (cache préservé)',
     /buildAthleteContext\(ctx\) \},\s*\n[\s\S]{0,200}buildAthleteState\(ctx && ctx\.athleteState\)/.test(srv));
  ok('profil existant conservé intact', /PROFIL ATHLÈTE[\s\S]{0,60}Prénom :/.test(srv));
  ok('RAG du livre conservé', /if \(ragBlock\) systemBlocks\.push/.test(srv));
  ok('quota et auth conservés', /checkQuota\(uid, quotaFor/.test(srv) && /hasValidAccess\(userData, email\)/.test(srv));
  ok('outil de debug développeur présent', /window\._titanDebugContext = function/.test(html));
  const st = buildState({ ah_set_history: JSON.stringify(Array.from({length:40}, (_,i)=>sess(i,'S',{sessionQualityScore:70}))),
    ah_track_history: JSON.stringify(Array.from({length:60}, (_,i)=>trk(i%30,'Exo'+(i%12),100+i,7))),
    ah_profile: '{}' })({ now: NOW });
  const size = render(st).length;
  ok('prompt borné même avec un gros historique (< 4000 car.)', size < 4000, size + ' caractères');
  ok('bornes respectées', st.recentSessions.length <= 5 && st.exercises.length <= 6,
     st.recentSessions.length + ' séances / ' + st.exercises.length + ' exos');
}
{
  let threw = false;
  try {
    buildState({ ah_set_history: 'CASSÉ{{', ah_track_history: '((', ah_profile: '}}' })({ now: NOW });
  } catch (e) { threw = true; }
  ok('données corrompues → aucune exception', !threw);
}

console.log('\n=== UNE SÉANCE WORKOUT BUILDER ARRIVE JUSQU\'À TITAN ===\n');
{
  // Le doute de départ : « j'ai fait une séance Builder, Titan n'est pas au
  // courant ». Enregistrement ET restitution doivent être prouvés.
  const entry = {
    type: 'session', date: iso(0), progKey: '', sessKey: '',
    progName: 'WORKOUT BUILDER', sessName: 'Développer la détente verticale',
    builder: true, exoCount: 12,
    exoNames: ['Squat jump', 'Fentes sautées', 'Nordic hamstring', 'Gainage'],
    sessionEndFeedback: { sessionQualityScore: 80, productivity: 80 }
  };
  const st = buildState({ ah_set_history: JSON.stringify([entry]) })({ now: NOW });
  ok('la séance Builder est dans l\'état athlète',
     st.lastSession && st.lastSession.name === 'Développer la détente verticale',
     JSON.stringify(st.lastSession));
  ok('elle est marquée comme venant du Builder',
     st.lastSession.source === 'workout_builder', st.lastSession.source);
  ok('elle compte dans l\'assiduité', st.adherence.sessionsTotal === 1 && st.adherence.last7Days === 1);
  ok('son contenu est transmis', st.lastSession.exoCount === 12 &&
     st.lastSession.exoNames.length === 4, JSON.stringify(st.lastSession.exoNames));

  const txt = render(st);
  // On vérifie la LIGNE DE LA SÉANCE : « 0 sur 7 jours » de la ligne
  // d'assiduité est légitime et n'a rien à voir.
  const ligneSeance = txt.split('\n').find(l => /Développer/.test(l)) || '';
  ok('Titan lit « AUJOURD\'HUI », pas « il y a 0 jour(s) »',
     /AUJOURD'HUI/.test(ligneSeance) && !/0 jour/.test(ligneSeance), ligneSeance);
  ok('Titan lit les mots « Workout Builder »', /Workout Builder/.test(txt));
  ok('Titan lit les exercices de la séance',
     /Squat jump, Fentes sautées/.test(txt) && /\+8 autres/.test(txt),
     txt.split('\n').find(l => /exercices :/.test(l)));
  ok('Titan connaît la date du jour', /Nous sommes le .*2026/.test(txt),
     txt.split('\n')[1]);
}
{
  // Une séance de programme garde son nom de programme, pas la mention Builder.
  const e = { type: 'session', date: iso(1), progName: 'SHRED EXPLOSE',
              sessName: 'Jour 6 — LOWER', progKey: 'se', sessKey: 'j6',
              exoCount: 8, exoNames: ['Squat', 'Depth jump'] };
  const txt = render(buildState({ ah_set_history: JSON.stringify([e]) })({ now: NOW }));
  ok('une séance de programme est datée « hier »', /— hier —/.test(txt),
     txt.split('\n').find(l => /Jour 6/.test(l)));
  ok('  et porte le nom de son programme', /SHRED EXPLOSE/.test(txt));
  ok('  sans être attribuée au Builder', !/Workout Builder/.test(txt));
}
{
  // Les séances déjà enregistrées n'ont pas de contenu : rien ne doit casser
  // ni être inventé pour elles.
  const vieille = { type: 'session', date: iso(3), progName: 'VERTICAL DUNK',
                    sessName: 'Jour 2', progKey: 'vd', sessKey: 'j2' };
  const st = buildState({ ah_set_history: JSON.stringify([vieille]) })({ now: NOW });
  ok('une séance d\'avant la mise à jour n\'a pas de contenu',
     st.lastSession.exoNames === null && st.lastSession.exoCount === null);
  const txt = render(st);
  ok('  elle s\'affiche quand même', /Jour 2 — il y a 3 jours/.test(txt),
     txt.split('\n').find(l => /Jour 2/.test(l)));
  ok('  sans ligne « exercices » vide', !/exercices : *$/m.test(txt));
  ok('  et sans nombre d\'exercices inventé', !/— 0 exercice/.test(txt));
}
{
  // Le détail du contenu ne doit pas noyer le contexte : 2 séances au plus.
  const many = [0, 1, 2, 3].map(d => ({
    type: 'session', date: iso(d), sessName: 'S' + d, progName: 'P', progKey: 'vd', sessKey: 'j1',
    exoCount: 3, exoNames: ['A' + d, 'B' + d]
  }));
  const txt = render(buildState({ ah_set_history: JSON.stringify(many.reverse()) })({ now: NOW }));
  const lignes = txt.split('\n').filter(l => /^ {3}exercices :/.test(l));
  ok('le contenu n\'est détaillé que pour les 2 séances les plus récentes',
     lignes.length === 2, String(lignes.length));
}

const failed = R.filter(x => !x).length;
console.log('\n' + '='.repeat(60));
console.log(failed ? 'RÉSULTAT : ' + failed + ' ÉCHEC(S) sur ' + R.length
                   : 'RÉSULTAT : ' + R.length + '/' + R.length + ' tests passés.');
process.exit(failed ? 1 : 0);
