// Outils de contenu (surcouches de l'éditeur) : node tests/test-content.js
'use strict';
const assert = require('assert');
const C = require('../public/js/content-tools.js');
const E = require('../public/js/engine.js');
const base = require('../public/content/program.json');
let passed = 0, failed = 0;
function t(n, f) { try { f(); passed++; } catch (e) { failed++; console.error('✗ ' + n + '\n   ' + e.message); } }
const find = id => JSON.parse(JSON.stringify(base.missions.find(m => m.id === id)));
const throws = (f, re) => { try { f(); } catch (e) { assert.ok(re.test(e.message), e.message); return; } assert.fail('aurait dû échouer'); };

t('liens vidéo : YouTube (watch, youtu.be, shorts), Vimeo, mp4 https ; le reste refusé', () => {
  ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'https://youtu.be/dQw4w9WgXcQ', 'https://youtube.com/shorts/dQw4w9WgXcQ', 'https://m.youtube.com/watch?feature=x&v=dQw4w9WgXcQ']
    .forEach(u => assert.strictEqual(C.checkVideoUrl(u).id, 'dQw4w9WgXcQ', u));
  assert.strictEqual(C.checkVideoUrl('https://vimeo.com/123456').kind, 'vimeo');
  assert.strictEqual(C.checkVideoUrl('https://cdn.x.fr/v.mp4').kind, 'mp4');
  assert.ok(C.checkVideoUrl('').ok);
  ['javascript:alert(1)', 'http://x.fr/v.mp4', 'https://evil.com/watch?v=dQw4w9WgXcQ', 'https://youtube.com.evil.com/watch?v=dQw4w9WgXcQ'].forEach(u => assert.ok(!C.checkVideoUrl(u).ok, u));
});
t('surcouche : seuls les champs éditables passent (identité et règles protégées)', () => {
  const d = Object.assign(find('m3.2'), { title: 'Nouveau', id: 'hack', kind: 'boss', arena: 'a8', unlockDelayHours: 0, unlocksHabit: 'h8', num: '9.9' });
  const o = C.cleanMissionOverride(find('m3.2'), d, base.settings);
  assert.strictEqual(o.title, 'Nouveau');
  ['id', 'kind', 'arena', 'unlockDelayHours', 'num', 'unlocksHabit'].forEach(k => assert.ok(!(k in o), k));
  const merged = C.merge(base, { missions: { 'm3.2': o } }).missions.find(m => m.id === 'm3.2');
  assert.strictEqual(merged.arena, 'a3'); assert.strictEqual(merged.num, '3.2');
});
t('le type de support ne change pas ; les rappels gardent leur source', () => {
  const m = find('boss-a4');
  m.challenge.type = 'quiz';
  m.challenge.fields[0].from = [['m0.1', 'dl']];
  m.challenge.fields[0].label = 'Ta croyance du jour 1';
  const o = C.cleanMissionOverride(find('boss-a4'), m, base.settings);
  assert.strictEqual(o.challenge.type, 'fiche');
  assert.deepStrictEqual(o.challenge.fields[0].from, [['m4.1', 'belief']]);
  assert.strictEqual(o.challenge.fields[0].label, 'Ta croyance du jour 1');
});
t('boss : exactement 5 questions', () => {
  const m = find('boss-a1'); m.quiz.questions.pop();
  throws(() => C.cleanMissionOverride(find('boss-a1'), m, base.settings), /exactement 5/);
});
t('identifiants en double refusés, champ vide refusé', () => {
  const m = find('m1.2'); m.support.fields[1].id = m.support.fields[0].id;
  throws(() => C.cleanMissionOverride(find('m1.2'), m, base.settings), /double/);
  const m2 = find('m1.2'); m2.support.fields = [];
  throws(() => C.cleanMissionOverride(find('m1.2'), m2, base.settings), /au moins un champ/);
  const m3 = find('m1.2'); m3.title = '';
  throws(() => C.cleanMissionOverride(find('m1.2'), m3, base.settings), /titre/);
});
t('textes bornés', () => {
  const m = find('m1.1'); m.body = 'x'.repeat(30000);
  assert.strictEqual(C.cleanMissionOverride(find('m1.1'), m, base.settings).body.length, 20000);
});
t('réponses : limitées aux questions et aux options existantes', () => {
  const qs = [{ id: 'q1', q: 'a', options: ['x', 'y'] }];
  assert.deepStrictEqual(C.cleanKeys(qs, { q1: 1, q2: 0, q3: 'x' }), { q1: 1 });
  assert.deepStrictEqual(C.cleanKeys(qs, { q1: 5 }), {});
});
t('brouillon : enregistrer, revenir à l\'origine', () => {
  let d = C.draftOp(base, null, { action: 'saveMission', id: 'm1.1', data: Object.assign(find('m1.1'), { video: 'https://youtu.be/dQw4w9WgXcQ' }) });
  assert.ok(d.ov.missions['m1.1'].video);
  assert.ok(!C.sameDraft(d, null));
  d = C.draftOp(base, d, { action: 'revertMission', id: 'm1.1' });
  assert.ok(C.sameDraft(d, null));
});
t('la fusion n\'altère pas le programme de base', () => {
  const snap = JSON.stringify(base);
  C.merge(base, { missions: { 'm1.1': { title: 'X' } }, arenas: { a1: { name: 'Y' } } });
  assert.strictEqual(JSON.stringify(base), snap);
});
t('le moteur accepte un boss une fois les 5 questions et réponses publiées', () => {
  const m = find('boss-a1');
  m.quiz.questions.forEach((q, i) => { q.q = 'Q' + i; q.options = ['a', 'b']; });
  let d = C.draftOp(base, null, { action: 'saveMission', id: 'boss-a1', data: m, keys: { q1: 0, q2: 0, q3: 0, q4: 0, q5: 1 } });
  const eng = E.createEngine(C.merge(base, d.ov), { quizKeys: d.keys });
  assert.ok(eng.bossQuizReady(eng.mission('boss-a1')));
  const eng0 = E.createEngine(base, { quizKeys: {} });
  assert.ok(!eng0.bossQuizReady(eng0.mission('boss-a1')), 'emplacements vides → non jouable');
});
t('état de complétude', () => {
  const s = C.missionStatus(find('boss-a1'), {});
  assert.deepStrictEqual([s.video, s.body, s.questions, s.written, s.complete], [false, false, 5, 0, false]);
  assert.ok(C.missionStatus(find('m1.3'), {}).pending === 5, 'piliers MENER provisoires signalés');
});
console.log((failed ? '✗' : '✓') + ' test-content : ' + passed + ' réussis, ' + failed + ' échoués');
process.exit(failed ? 1 : 0);
