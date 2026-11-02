// Tests des règles du jeu : node tests/test-engine.js
// Le moteur est le VRAI fichier public/js/engine.js, celui que le serveur exécute.
'use strict';
const path = require('path');
const assert = require('assert');
const E = require('../public/js/engine.js');
const Demo = require('../public/js/demo.js');
const program = require('../public/content/program.json');

let passed = 0, failed = 0;
function t(name, fn) {
  try { fn(); passed++; }
  catch (e) { failed++; console.error('✗ ' + name + '\n   ' + (e && e.stack || e)); }
}
function throwsCode(fn, code) {
  try { fn(); } catch (e) { assert.strictEqual(e.code, code, 'code attendu ' + code + ', reçu ' + e.code + ' (' + e.message + ')'); return; }
  assert.fail('aurait dû lever ' + code);
}

const H = E.HOUR, D = E.DAY;
const T0 = Date.parse('2026-11-02T08:00:00Z');
const TZ = 60; // Paris (hiver)
const demo = Demo.withDemoQuizzes(program);
const eng = E.createEngine(demo.content, { quizKeys: demo.quizKeys });
const prodEng = E.createEngine(program, { quizKeys: {} });

// Petit harnais : applique une action et renvoie le nouvel état
function run(engine, st, action, now) { return engine.apply(st, action, now).state; }

function fillSupport(engine, st, id, now) {
  const m = engine.mission(id);
  const sup = engine.supportOf(m);
  if (sup.type === 'checklist' && !sup.daily) {
    const data = {};
    sup.items.forEach(it => { data[it.id] = it.choices ? it.choices[0] : true; });
    st = run(engine, st, { type: 'support', id, data }, now);
  } else if (sup.type === 'fiche') {
    const data = {};
    sup.fields.forEach(f => {
      if (f.type === 'recall') return;
      data[f.id] = f.type === 'check' ? true : f.type === 'number' || f.type === 'scale' ? 7 : 'texte';
    });
    st = run(engine, st, { type: 'support', id, data }, now);
  } else if (sup.type === 'quiz') {
    const answers = {};
    sup.questions.forEach(q => { answers[q.id] = 1; });
    st = run(engine, st, { type: 'quiz', id, answers }, now);
  }
  return st;
}
function dailyItems(engine, id) {
  const sup = engine.supportOf(engine.mission(id));
  const o = {};
  if (sup.type === 'checklist' && sup.daily) sup.items.forEach(i => { o[i.id] = true; });
  return o;
}
// Joue une mission complète (support + jours) et la valide ; renvoie {st, now}
function complete(engine, st, id, now) {
  const m = engine.mission(id);
  st = fillSupport(engine, st, id, now);
  if (m.durationDays) {
    for (let d = 0; d < m.durationDays; d++) {
      st = run(engine, st, { type: 'checkin', id, items: dailyItems(engine, id) }, now);
      if (d < m.durationDays - 1) now += D;
    }
  }
  if (m.kind === 'boss' && !m.final) {
    const answers = {};
    m.quiz.questions.forEach(q => { answers[q.id] = 1; });
    const r = engine.apply(st, { type: 'boss', id, answers }, now);
    assert.ok(r.result.won, 'boss ' + id + ' gagné');
    return { st: r.state, now };
  }
  st = run(engine, st, { type: 'validate', id }, now);
  return { st, now };
}

// ─── Niveau 0 ───────────────────────────────────────────────────────────────
t('niveau 0 : les 6 étapes sont ouvertes immédiatement', () => {
  const st = eng.newState(T0, TZ);
  ['m0.1', 'm0.2', 'm0.3', 'm0.4', 'm0.5', 'm0.6'].forEach(id => assert.strictEqual(eng.status(st, id, T0), 'open', id));
  assert.strictEqual(eng.status(st, 'm1.1', T0), 'locked');
});

t('niveau 0 : on peut tout valider le jour même, dans n\'importe quel ordre', () => {
  let st = eng.newState(T0, TZ), now = T0;
  ['m0.6', 'm0.1', 'm0.4', 'm0.2', 'm0.5', 'm0.3'].forEach(id => { ({ st } = complete(eng, st, id, now)); now += 60000; });
  assert.ok(st.rewards.some(r => r.id === 'rookie'), 'carte Rookie');
  assert.strictEqual(eng.view(st, now).rank, 'Rookie');
});

t('pas de validation sans support complété', () => {
  const st = eng.newState(T0, TZ);
  throwsCode(() => eng.apply(st, { type: 'validate', id: 'm0.1' }, T0), 'incomplete');
  const st2 = run(eng, st, { type: 'support', id: 'm0.1', data: { dl: true } }, T0);
  throwsCode(() => eng.apply(st2, { type: 'validate', id: 'm0.1' }, T0), 'incomplete');
  const st3 = run(eng, st2, { type: 'support', id: 'm0.1', data: { account: true } }, T0);
  assert.ok(eng.apply(st3, { type: 'validate', id: 'm0.1' }, T0).state.missions['m0.1'].validatedAt);
});

t('fiche : champ requis vide → refus ; réponses sauvegardées', () => {
  let st = eng.newState(T0, TZ);
  st = run(eng, st, { type: 'support', id: 'm0.5', data: { smart: '   ', sent: true } }, T0);
  throwsCode(() => eng.apply(st, { type: 'validate', id: 'm0.5' }, T0), 'incomplete');
  st = run(eng, st, { type: 'support', id: 'm0.5', data: { smart: 'Gagner 10 cm en 90 jours' } }, T0);
  assert.strictEqual(st.missions['m0.5'].support.smart, 'Gagner 10 cm en 90 jours');
  assert.strictEqual(st.missions['m0.5'].support.sent, true, 'fusion des sauvegardes partielles');
});

t('support : champs inconnus et choix hors liste ignorés', () => {
  let st = eng.newState(T0, TZ);
  st = run(eng, st, { type: 'support', id: 'm0.6', data: { choice: 'Fromage', hack: true } }, T0);
  assert.deepStrictEqual(st.missions['m0.6'].support, {});
  st = run(eng, st, { type: 'support', id: 'm0.6', data: { choice: 'Stricte' } }, T0);
  assert.strictEqual(st.missions['m0.6'].support.choice, 'Stricte');
});

t('vidéo exigée seulement quand une URL existe', () => {
  const c = JSON.parse(JSON.stringify(program));
  c.missions.find(m => m.id === 'm0.1').video = 'https://example.com/v.mp4';
  const e2 = E.createEngine(c, {});
  let st = e2.newState(T0, TZ);
  st = run(e2, st, { type: 'support', id: 'm0.1', data: { dl: true, account: true } }, T0);
  throwsCode(() => e2.apply(st, { type: 'validate', id: 'm0.1' }, T0), 'incomplete');
  st = run(e2, st, { type: 'video', id: 'm0.1' }, T0);
  assert.ok(e2.apply(st, { type: 'validate', id: 'm0.1' }, T0).state.missions['m0.1'].validatedAt);
  // sans URL (programme actuel) : pas de condition vidéo
  assert.ok(!eng.checks(eng.newState(T0, TZ), 'm0.1', T0).some(c => c.key === 'video'));
});

// ─── 24 heures ──────────────────────────────────────────────────────────────
function afterLevel0() {
  let st = eng.newState(T0, TZ), now = T0;
  ['m0.1', 'm0.2', 'm0.3', 'm0.4', 'm0.5', 'm0.6'].forEach(id => { ({ st } = complete(eng, st, id, now)); });
  return { st, now };
}

t('1.1 s\'ouvre 24 h après la fin du niveau 0, pas avant', () => {
  const { st, now } = afterLevel0();
  assert.strictEqual(eng.status(st, 'm1.1', now), 'waiting');
  assert.strictEqual(eng.view(st, now).items['m1.1'].unlockAt, now + 24 * H);
  assert.strictEqual(eng.status(st, 'm1.1', now + 24 * H - 1), 'waiting');
  assert.strictEqual(eng.status(st, 'm1.1', now + 24 * H), 'open');
  throwsCode(() => eng.apply(st, { type: 'support', id: 'm1.1', data: { habit: 'x' } }, now + H), 'waiting');
});

t('une seule nouvelle mission ouverte à la fois', () => {
  let { st, now } = afterLevel0();
  now += 24 * H;
  const v = eng.view(st, now);
  const open = Object.keys(v.items).filter(id => v.items[id].status === 'open');
  assert.deepStrictEqual(open, ['m1.1']);
  ({ st } = complete(eng, st, 'm1.1', now));
  assert.strictEqual(eng.status(st, 'm1.2', now), 'waiting');
  assert.strictEqual(eng.status(st, 'm1.3', now + 48 * H), 'locked', 'pas de saut de mission');
  assert.strictEqual(eng.status(st, 'm1.2', now + 24 * H), 'open');
});

t('une mission validée reste consultable et ses réponses modifiables', () => {
  let { st, now } = afterLevel0();
  assert.strictEqual(eng.status(st, 'm0.5', now + 50 * D), 'validated');
  st = run(eng, st, { type: 'support', id: 'm0.5', data: { smart: 'Objectif révisé' } }, now + 2 * D);
  assert.strictEqual(st.missions['m0.5'].support.smart, 'Objectif révisé');
  throwsCode(() => eng.apply(st, { type: 'validate', id: 'm0.5' }, now), 'not_allowed');
});

// ─── Missions sur plusieurs jours ───────────────────────────────────────────
function reach(id) {
  let st = eng.newState(T0, TZ), now = T0;
  for (const m of eng.playable) {
    if (m.id === id) break;
    const v = eng.view(st, now).items[m.id];
    if (v.status === 'waiting') now = v.unlockAt;
    ({ st, now } = complete(eng, st, m.id, now));
  }
  const v = eng.view(st, now).items[id];
  if (v.status === 'waiting') now = v.unlockAt;
  return { st, now };
}

t('3.2 : 7 jours d\'affilée, pas validable avant', () => {
  let { st, now } = reach('m3.2');
  for (let d = 0; d < 6; d++) {
    st = run(eng, st, { type: 'checkin', id: 'm3.2', items: { streak: true } }, now);
    throwsCode(() => eng.apply(st, { type: 'validate', id: 'm3.2' }, now), 'incomplete');
    now += D;
  }
  st = run(eng, st, { type: 'checkin', id: 'm3.2', items: { streak: true } }, now);
  assert.ok(eng.apply(st, { type: 'validate', id: 'm3.2' }, now).state.missions['m3.2'].validatedAt);
});

t('une seule coche par jour', () => {
  let { st, now } = reach('m3.2');
  st = run(eng, st, { type: 'checkin', id: 'm3.2', items: { streak: true } }, now);
  throwsCode(() => eng.apply(st, { type: 'checkin', id: 'm3.2', items: { streak: true } }, now + H), 'already');
});

t('coche du jour incomplète refusée', () => {
  const { st, now } = reach('m5.4');
  throwsCode(() => eng.apply(st, { type: 'checkin', id: 'm5.4', items: { session: true } }, now), 'incomplete');
});

t('série cassée : on repart de zéro', () => {
  let { st, now } = reach('m3.2');
  for (let d = 0; d < 4; d++) { st = run(eng, st, { type: 'checkin', id: 'm3.2', items: { streak: true } }, now); now += D; }
  now += D; // un jour manqué
  assert.strictEqual(eng.view(st, now).items['m3.2'].run.broken, true);
  st = run(eng, st, { type: 'checkin', id: 'm3.2', items: { streak: true } }, now);
  assert.strictEqual(eng.view(st, now).items['m3.2'].run.current, 1);
});

t('jours calculés sur le fuseau du participant (minuit local)', () => {
  let { st, now } = reach('m3.2');
  // 23:30 heure de Paris puis 00:30 : deux jours différents
  const base = Date.parse(E.dayKey(now, TZ) + 'T22:30:00Z'); // 23:30 Paris
  const late = Math.max(base, now);
  st = run(eng, st, { type: 'checkin', id: 'm3.2', items: { streak: true } }, late);
  st = run(eng, st, { type: 'checkin', id: 'm3.2', items: { streak: true } }, late + H);
  assert.strictEqual(st.missions['m3.2'].checkins.length, 2);
});

t('6.1 : 3 jours + fiche exigés', () => {
  let { st, now } = reach('m6.1');
  for (let d = 0; d < 3; d++) { st = run(eng, st, { type: 'checkin', id: 'm6.1' }, now); if (d < 2) now += D; }
  throwsCode(() => eng.apply(st, { type: 'validate', id: 'm6.1' }, now), 'incomplete');
  st = run(eng, st, { type: 'support', id: 'm6.1', data: { change: 'Plus de légumes' } }, now);
  assert.ok(eng.apply(st, { type: 'validate', id: 'm6.1' }, now).state.missions['m6.1'].validatedAt);
});

// ─── Boss ───────────────────────────────────────────────────────────────────
t('le boss s\'ouvre quand toutes les missions de l\'arène sont validées (+24 h)', () => {
  let { st, now } = reach('m1.5');
  assert.strictEqual(eng.status(st, 'boss-a1', now), 'locked');
  ({ st, now } = complete(eng, st, 'm1.5', now));
  assert.strictEqual(eng.status(st, 'boss-a1', now), 'waiting');
  assert.strictEqual(eng.status(st, 'boss-a1', now + 24 * H), 'open');
});

t('boss : 4/5 gagne, débloque l\'arène suivante', () => {
  let { st, now } = reach('boss-a1');
  st = fillSupport(eng, st, 'boss-a1', now);
  const r = eng.apply(st, { type: 'boss', id: 'boss-a1', answers: { dq1: 1, dq2: 1, dq3: 1, dq4: 1, dq5: 0 } }, now);
  assert.strictEqual(r.result.won, true);
  assert.strictEqual(r.result.score, 4);
  assert.ok(r.state.rewards.some(x => x.id === 'badge-a1'));
  assert.strictEqual(eng.status(r.state, 'm2.1', now + 24 * H), 'open');
});

t('boss : 3/5 perd ; nouvel essai le lendemain seulement, sans pénalité', () => {
  let { st, now } = reach('boss-a1');
  st = fillSupport(eng, st, 'boss-a1', now);
  const bad = { dq1: 1, dq2: 1, dq3: 1, dq4: 0, dq5: 0 };
  const r = eng.apply(st, { type: 'boss', id: 'boss-a1', answers: bad }, now);
  assert.strictEqual(r.result.won, false);
  assert.ok(r.result.retryAt > now);
  assert.strictEqual(eng.status(r.state, 'm2.1', now + 3 * D), 'locked');
  throwsCode(() => eng.apply(r.state, { type: 'boss', id: 'boss-a1', answers: bad }, now + H), 'retry_tomorrow');
  const next = r.result.retryAt;
  const r2 = eng.apply(r.state, { type: 'boss', id: 'boss-a1', answers: { dq1: 1, dq2: 1, dq3: 1, dq4: 1, dq5: 1 } }, next);
  assert.strictEqual(r2.result.won, true);
  assert.strictEqual(r2.state.missions['boss-a1'].support.priority, 'texte', 'défi conservé');
});

t('boss : défi pratique non validé → pas d\'essai consommé', () => {
  const { st, now } = reach('boss-a2');
  throwsCode(() => eng.apply(st, { type: 'boss', id: 'boss-a2', answers: { dq1: 1, dq2: 1, dq3: 1, dq4: 1, dq5: 1 } }, now), 'challenge_incomplete');
});

t('boss : on ne peut pas le « valider » sans les questions', () => {
  const { st, now } = reach('boss-a2');
  throwsCode(() => eng.apply(st, { type: 'validate', id: 'boss-a2' }, now), 'bad_action');
});

t('boss sur plusieurs jours (semaine parfaite) : quiz refusé avant 7 jours', () => {
  let { st, now } = reach('boss-a3');
  const all = { dq1: 1, dq2: 1, dq3: 1, dq4: 1, dq5: 1 };
  st = run(eng, st, { type: 'checkin', id: 'boss-a3', items: { day: true } }, now);
  throwsCode(() => eng.apply(st, { type: 'boss', id: 'boss-a3', answers: all }, now), 'challenge_incomplete');
});

t('production : boss sans les 5 questions → content_missing, jamais gagné par défaut', () => {
  let st = prodEng.newState(T0, TZ);
  // fabrique un état où boss-a1 est ouvert
  prodEng.playable.forEach(m => { if (m.arena === 'n0' || (m.arena === 'a1' && m.kind !== 'boss')) st.missions[m.id] = { validatedAt: T0 }; });
  st.missions['boss-a1'] = { support: { priority: 'x' } };
  const now = T0 + 2 * D;
  assert.strictEqual(prodEng.status(st, 'boss-a1', now), 'open');
  throwsCode(() => prodEng.apply(st, { type: 'boss', id: 'boss-a1', answers: {} }, now), 'content_missing');
  assert.strictEqual(prodEng.view(st, now).items['boss-a1'].quizReady, false);
});

t('production : quiz de mission sans questions → non validable', () => {
  let st = prodEng.newState(T0, TZ);
  prodEng.playable.forEach(m => { if (m.arena === 'n0' || ['m1.1', 'm1.2', 'm1.3'].includes(m.id)) st.missions[m.id] = { validatedAt: T0 }; });
  const now = T0 + 2 * D;
  assert.strictEqual(prodEng.status(st, 'm1.4', now), 'open');
  const c = prodEng.checks(st, 'm1.4', now).find(x => x.key === 'support');
  assert.strictEqual(c.ok, false); assert.strictEqual(c.contentMissing, true);
});

t('les bonnes réponses des quiz ne sont jamais dans program.json', () => {
  program.missions.forEach(m => {
    const qs = [].concat((m.quiz && m.quiz.questions) || [], (m.support && m.support.questions) || []);
    qs.forEach(q => assert.ok(!('correct' in q) && !('answer' in q), m.id));
  });
});

// ─── Parcours complet, boss final, récompenses ──────────────────────────────
t('parcours complet : 9 récompenses, rangs, Premium, boss final sans performance', () => {
  let { st, now } = reach('boss-a8');
  // Boss final : résultats physiques VIDES (pires possibles) → gagné quand même
  st = run(eng, st, { type: 'support', id: 'boss-a8', data: { tests: true } }, now);
  throwsCode(() => eng.apply(st, { type: 'validate', id: 'boss-a8' }, now), 'incomplete');
  st = run(eng, st, { type: 'support', id: 'boss-a8', data: { video: true } }, now);
  const r = eng.apply(st, { type: 'validate', id: 'boss-a8' }, now);
  st = r.state;
  assert.ok(r.events.some(e => e.type === 'finished'));
  const ids = st.rewards.map(x => x.id);
  assert.deepStrictEqual(ids, ['rookie', 'badge-a1', 'badge-a2', 'titulaire', 'badge-a4', 'allstar', 'badge-a6', 'mvp', 'master']);
  assert.strictEqual(eng.view(st, now).rank, 'Athletik Master');
  assert.strictEqual(st.grants.length, 1);
  assert.strictEqual(st.grants[0].type, 'hubPremium');
  assert.strictEqual(st.grants[0].status, 'pending_hub_integration');
  assert.strictEqual(eng.view(st, now).progress, 100);
  // 8 habitudes débloquées
  assert.strictEqual(Object.keys(st.habits).length, 8);
  // le parcours tient sur ~90 jours
  const days = Math.round((now - T0) / D);
  assert.ok(days > 60 && days < 110, 'durée du parcours = ' + days + ' jours');
});

t('la carte Titulaire tombe au boss Zéro Excuse, All-Star au boss Tout Donner', () => {
  let { st, now } = reach('boss-a5');
  assert.strictEqual(eng.view(st, now).rank, 'Titulaire');
  ({ st, now } = complete(eng, st, 'boss-a5', now));
  assert.strictEqual(eng.view(st, now).rank, 'All-Star');
});

t('une récompense n\'est jamais attribuée deux fois', () => {
  let { st, now } = reach('m1.1');
  const before = st.rewards.length;
  st = run(eng, st, { type: 'support', id: 'm0.1', data: { dl: true } }, now);
  assert.strictEqual(st.rewards.length, before);
});

t('mission brouillon (7.x) visible, mais ne bloque pas la progression', () => {
  let { st, now } = reach('boss-a7');
  assert.strictEqual(eng.status(st, 'm7.x', now), 'draft');
  assert.strictEqual(eng.status(st, 'boss-a7', now), 'open');
});

t('recommencer le parcours conserve récompenses et habitudes', () => {
  let { st, now } = reach('boss-a8');
  st = run(eng, st, { type: 'support', id: 'boss-a8', data: { tests: true, video: true } }, now);
  st = run(eng, st, { type: 'validate', id: 'boss-a8' }, now);
  throwsCode(() => eng.apply(eng.newState(T0, TZ), { type: 'restart' }, now), 'not_allowed');
  const st2 = run(eng, st, { type: 'restart' }, now + D);
  assert.strictEqual(st2.runs.length, 1);
  assert.strictEqual(st2.rewards.length, 9);
  assert.strictEqual(Object.keys(st2.habits).length, 8);
  assert.strictEqual(eng.status(st2, 'm0.1', now + D), 'open');
});

// ─── Habitudes ──────────────────────────────────────────────────────────────
t('habitude débloquée par la mission qui l\'enseigne (2.2 → respiration)', () => {
  let { st, now } = reach('m2.2');
  assert.ok(!st.habits.h2);
  const r = eng.apply(fillSupport(eng, st, 'm2.2', now), { type: 'validate', id: 'm2.2' }, now);
  assert.ok(r.state.habits.h2);
  assert.ok(r.events.some(e => e.type === 'habit' && e.id === 'h2'));
});

t('habitude verrouillée : impossible de cocher', () => {
  throwsCode(() => eng.apply(eng.newState(T0, TZ), { type: 'habit', id: 'h1', value: 'yes' }, T0), 'locked');
});

t('série d\'habitude : oui consécutifs, « pas de séance » neutre, non casse', () => {
  let { st, now } = reach('m2.3'); // h1 et h2 débloquées
  st = run(eng, st, { type: 'habit', id: 'h2', value: 'yes' }, now);
  st = run(eng, st, { type: 'habit', id: 'h2', value: 'skip' }, now + D);
  st = run(eng, st, { type: 'habit', id: 'h2', value: 'yes' }, now + 2 * D);
  assert.strictEqual(eng.habitStreak(st, 'h2', now + 2 * D), 2);
  // pas encore répondu aujourd'hui : la série d'hier compte toujours
  assert.strictEqual(eng.habitStreak(st, 'h2', now + 3 * D), 2);
  st = run(eng, st, { type: 'habit', id: 'h2', value: 'no' }, now + 3 * D);
  assert.strictEqual(eng.habitStreak(st, 'h2', now + 3 * D), 0);
  throwsCode(() => eng.apply(st, { type: 'habit', id: 'h1', value: 'skip' }, now), 'bad_action');
});

t('habitude : réponse possible pour hier (oubli), pas pour avant-hier', () => {
  let { st, now } = reach('m2.3');
  const y = E.dayKey(now - D, TZ);
  st = run(eng, st, { type: 'habit', id: 'h1', value: 'yes', day: y }, now);
  throwsCode(() => eng.apply(st, { type: 'habit', id: 'h1', value: 'yes', day: E.dayKey(now - 2 * D, TZ) }, now), 'bad_day');
});

t('habitude hebdomadaire : seulement le dimanche', () => {
  let { st, now } = reach('m3.5'); // h3 débloquée par 3.4
  assert.ok(st.habits.h3);
  let sunday = now; while (new Date(sunday + TZ * 60000).getUTCDay() !== 0) sunday += D;
  const monday = sunday + D;
  throwsCode(() => eng.apply(st, { type: 'habit', id: 'h3', value: 'yes' }, monday), 'bad_day');
  st = run(eng, st, { type: 'habit', id: 'h3', value: 'yes' }, sunday);
  st = run(eng, st, { type: 'habit', id: 'h3', value: 'yes' }, sunday + 7 * D);
  assert.strictEqual(eng.habitStreak(st, 'h3', sunday + 9 * D), 2);
});

t('les habitudes s\'additionnent arène après arène', () => {
  const { st, now } = reach('boss-a4');
  assert.deepStrictEqual(Object.keys(st.habits).sort(), ['h1', 'h2', 'h3', 'h4']);
});

t('règle optionnelle « habitude 5/7 » pour le défi du boss', () => {
  const c = JSON.parse(JSON.stringify(demo.content));
  c.settings.bossHabitRule.enabled = true;
  const e2 = E.createEngine(c, { quizKeys: demo.quizKeys });
  // on rejoue l'arène 1 avec ce moteur
  let st = e2.newState(T0, TZ), now = T0;
  for (const m of e2.playable) {
    if (m.id === 'boss-a1') break;
    const v = e2.view(st, now).items[m.id];
    if (v.status === 'waiting') now = v.unlockAt;
    ({ st, now } = complete(e2, st, m.id, now));
  }
  now = e2.view(st, now).items['boss-a1'].unlockAt;
  st = fillSupport(e2, st, 'boss-a1', now);
  const hab = e2.checks(st, 'boss-a1', now).find(x => x.key === 'habit');
  assert.ok(hab && !hab.ok);
  for (let d = 0; d < 5; d++) st = run(e2, st, { type: 'habit', id: 'h1', value: 'yes' }, now - d * D + 1);
  assert.ok(e2.checks(st, 'boss-a1', now).find(x => x.key === 'habit').ok);
});

// ─── Divers ─────────────────────────────────────────────────────────────────
t('apply() ne modifie jamais l\'état reçu', () => {
  const st = eng.newState(T0, TZ);
  const snap = JSON.stringify(st);
  eng.apply(st, { type: 'support', id: 'm0.1', data: { dl: true } }, T0);
  assert.strictEqual(JSON.stringify(st), snap);
});

t('textes tronqués à 2000 caractères', () => {
  const st = run(eng, eng.newState(T0, TZ), { type: 'support', id: 'm0.5', data: { smart: 'x'.repeat(5000) } }, T0);
  assert.strictEqual(st.missions['m0.5'].support.smart.length, 2000);
});

t('le contenu reprend les 51 lignes du document (43 missions + 8 boss)', () => {
  assert.strictEqual(program.missions.length, 51);
  assert.strictEqual(program.missions.filter(m => m.kind === 'boss').length, 8);
  assert.strictEqual(program.arenas.length, 9);
  assert.strictEqual(program.habits.length, 8);
  assert.strictEqual(program.rewards.length, 9);
  program.habits.forEach(h => assert.ok(program.missions.some(m => m.id === h.unlockedBy), h.id));
});

console.log((failed ? '✗' : '✓') + ' test-engine : ' + passed + ' réussis, ' + failed + ' échoués');
process.exit(failed ? 1 : 0);
