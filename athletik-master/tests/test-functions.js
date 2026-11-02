// Fonctions serveur contre un Firebase simulé en mémoire : node tests/test-functions.js
// Vérifie le chemin complet : webhook Systeme.io → droits → API → moteur → admin,
// et qu'aucune écriture ne touche les collections d'Athletik Hub.
'use strict';
const assert = require('assert');
const Module = require('module');

// ─── Faux firebase-admin ────────────────────────────────────────────────────
const DB = {};      // { 'coll/id': data }
const WRITES = [];  // chemins écrits
const TOKENS = {};  // token → claims
function clone(o) { return o === undefined ? undefined : JSON.parse(JSON.stringify(o)); }
function deepMerge(a, b) {
  const out = clone(a) || {};
  Object.keys(b).forEach(k => {
    if (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && out[k] && typeof out[k] === 'object') out[k] = deepMerge(out[k], b[k]);
    else out[k] = clone(b[k]);
  });
  return out;
}
function docRef(path) {
  return {
    path,
    async get() { return snap(path); },
    async set(data, opt) { write(path, data, opt); }
  };
}
function snap(path) { const d = DB[path]; return { exists: d !== undefined, id: path.split('/').pop(), data: () => clone(d) }; }
function write(path, data, opt) { WRITES.push(path); DB[path] = opt && opt.merge ? deepMerge(DB[path], data) : clone(data); }
const fakeAdmin = {
  apps: [1],
  initializeApp() {}, credential: { cert() {} },
  auth: () => ({ async verifyIdToken(tok) { if (!TOKENS[tok]) throw new Error('bad token'); return TOKENS[tok]; } }),
  firestore: () => ({
    collection: (c) => ({
      doc: (id) => docRef(c + '/' + id),
      limit: () => ({ async get() {
        const docs = Object.keys(DB).filter(k => k.startsWith(c + '/')).map(k => snap(k));
        return { forEach: (fn) => docs.forEach(fn) };
      } })
    }),
    async runTransaction(fn) {
      const tx = { get: (r) => r.get(), set: (r, d, o) => write(r.path, d, o) };
      return fn(tx);
    }
  })
};
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (req, ...rest) { return req === 'firebase-admin' ? 'firebase-admin' : origResolve.call(this, req, ...rest); };
require.cache['firebase-admin'] = { id: 'firebase-admin', filename: 'firebase-admin', loaded: true, exports: fakeAdmin };

process.env.FIREBASE_SERVICE_ACCOUNT = '{}';
process.env.SYSTEMEIO_WEBHOOK_SECRET = 'sekret';
process.env.MASTER_ADMIN_EMAILS = 'boss@athletik.fr';
process.env.MASTER_OFFER_PLANS = '{"77":"one_time"}';

const api = require('../netlify/functions/master-api.js').handler;
const adm = require('../netlify/functions/master-admin.js').handler;
const hook = require('../netlify/functions/systemeio-webhook.js').handler;
const content = require('../netlify/functions/master-content.js').handler;
const program = require('../public/content/program.json');

TOKENS.alice = { uid: 'u-alice', email: 'Alice@Ex.com', email_verified: true, name: 'Alice' };
TOKENS.bob = { uid: 'u-bob', email: 'bob@ex.com', email_verified: false };
TOKENS.carl = { uid: 'u-carl', email: 'carl@ex.com', email_verified: true };
TOKENS.boss = { uid: 'u-boss', email: 'boss@athletik.fr', email_verified: true };
DB['users/u-alice'] = { hasBookAccess: true, profile: { prenom: 'Alice' } }; // doc Athletik Hub existant

const call = (fn, tok, body, extra) => fn(Object.assign({ httpMethod: 'POST', headers: tok ? { authorization: 'Bearer ' + tok } : {}, body: JSON.stringify(body) }, extra || {}))
  .then(r => ({ status: r.statusCode, body: r.body ? JSON.parse(r.body) : null }));
const sale = (email, id, type) => hook({ httpMethod: 'POST', queryStringParameters: { key: 'sekret' }, headers: {}, body: JSON.stringify({ type: type || 'SALE_NEW', data: { customer: { email }, offer_price_plan: { id: 77 }, order: { id } } }) })
  .then(r => ({ status: r.statusCode, body: JSON.parse(r.body) }));

let passed = 0, failed = 0;
async function t(n, f) { try { await f(); passed++; } catch (e) { failed++; console.error('✗ ' + n + '\n   ' + (e.stack || e).split('\n').slice(0, 3).join('\n   ')); } }

(async () => {
  await t('API : sans jeton → 401', async () => { assert.strictEqual((await call(api, null, { action: 'state' })).status, 401); });
  await t('API : sans paiement → 403 no_access', async () => {
    const r = await call(api, 'alice', { action: 'state' });
    assert.strictEqual(r.status, 403); assert.strictEqual(r.body.error, 'no_access');
  });
  await t('webhook : mauvaise clé → 401, aucun effet', async () => {
    const r = await hook({ httpMethod: 'POST', queryStringParameters: { key: 'nope' }, headers: {}, body: '{}' });
    assert.strictEqual(r.statusCode, 401);
    assert.ok(!Object.keys(DB).some(k => k.startsWith('masterAccess/')));
  });
  await t('webhook : événement inconnu journalisé sans droit', async () => {
    const r = await sale('alice@ex.com', 1, 'CONTACT_CREATED');
    assert.strictEqual(r.body.ignored, true);
    assert.strictEqual((await call(api, 'alice', { action: 'state' })).status, 403);
  });
  await t('webhook : vente → accès ; rejeu idempotent', async () => {
    assert.strictEqual((await sale('alice@ex.com', 1001)).status, 200);
    const dup = await sale('alice@ex.com', 1001);
    assert.strictEqual(dup.body.duplicate, true);
    const acc = DB['masterAccess/' + encodeURIComponent('alice@ex.com')];
    assert.strictEqual(acc.payments.length, 1); assert.strictEqual(acc.plan, 'one_time');
  });
  await t('API : accès actif (email insensible à la casse) → état créé', async () => {
    const r = await call(api, 'alice', { action: 'state', tz: 60 });
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.body.state.tz, 60);
    assert.strictEqual(r.body.access.parcel, false, 'kit : délai de rétractation');
    assert.deepStrictEqual([r.body.roles.master, r.body.roles.hubStandard, r.body.roles.hubPremium], [true, true, true]);
    assert.ok(DB['masterParticipants/u-alice']);
  });
  await t('API : actions appliquées par le moteur avec l\'heure serveur', async () => {
    let r = await call(api, 'alice', { action: 'support', id: 'm0.1', data: { dl: true, account: true } });
    assert.strictEqual(r.status, 200);
    r = await call(api, 'alice', { action: 'validate', id: 'm0.1' });
    assert.strictEqual(r.status, 200);
    assert.ok(r.body.state.missions['m0.1'].validatedAt);
  });
  await t('API : règle violée → 400 avec message (pas de saut de mission)', async () => {
    const r = await call(api, 'alice', { action: 'validate', id: 'm1.1' });
    assert.strictEqual(r.status, 400); assert.strictEqual(r.body.error, 'locked');
  });
  await t('API : impossible de forger l\'état ou la date', async () => {
    const r = await call(api, 'alice', { action: 'support', id: 'm0.2', data: { quest: true }, state: { missions: { 'boss-a8': { validatedAt: 1 } } }, now: 9e15 });
    assert.strictEqual(r.status, 200);
    assert.ok(!r.body.state.missions['boss-a8']);
  });
  await t('API : boss sans les 5 questions en production → content_missing', async () => {
    const st = DB['masterParticipants/u-alice'].state;
    ['m0.1', 'm0.2', 'm0.3', 'm0.4', 'm0.5', 'm0.6', 'm1.1', 'm1.2', 'm1.3', 'm1.4', 'm1.5'].forEach(id => { st.missions[id] = { validatedAt: 1 }; });
    st.missions['boss-a1'] = { support: { priority: 'x' } };
    const r = await call(api, 'alice', { action: 'boss', id: 'boss-a1', answers: {} });
    assert.strictEqual(r.body.error, 'content_missing');
  });
  await t('API : email non vérifié → 403 même avec paiement', async () => {
    await sale('bob@ex.com', 2001);
    const r = await call(api, 'bob', { action: 'state' });
    assert.strictEqual(r.body.error, 'email_not_verified');
  });
  await t('remboursement → accès coupé', async () => {
    await sale('carl@ex.com', 3001);
    assert.strictEqual((await call(api, 'carl', { action: 'state' })).status, 200);
    await sale('carl@ex.com', 3001, 'SALE_CANCELED');
    assert.strictEqual((await call(api, 'carl', { action: 'state' })).body.error, 'no_access');
  });
  await t('admin : refusé aux participants', async () => {
    assert.strictEqual((await call(adm, 'alice', { action: 'list' })).status, 403);
  });
  await t('admin : liste, J30/J60, acheteurs pas encore connectés', async () => {
    const r = await call(adm, 'boss', { action: 'list' });
    assert.strictEqual(r.status, 200);
    const a = r.body.participants.find(p => p.email === 'alice@ex.com');
    assert.ok(a.started && a.touch.length === 2);
    assert.ok(r.body.participants.some(p => p.email === 'bob@ex.com' && !p.started));
  });
  await t('admin : accès manuel + marquer contacté', async () => {
    assert.strictEqual((await call(adm, 'boss', { action: 'grantAccess', email: 'new@ex.com', plan: 'installments' })).status, 200);
    assert.strictEqual(DB['masterAccess/' + encodeURIComponent('new@ex.com')].source, 'admin');
    await call(adm, 'boss', { action: 'contacted', uid: 'u-alice', day: 30 });
    assert.ok(DB['masterParticipants/u-alice'].contacted.d30);
  });

  await t('contenu : GET public sans surcouche au départ', async () => {
    const r = await content({ httpMethod: 'GET', headers: {} });
    assert.strictEqual(r.statusCode, 200);
    assert.strictEqual(JSON.parse(r.body).ov, null);
  });
  await t('contenu : éditeur réservé à l\'admin', async () => {
    assert.strictEqual((await call(content, 'alice', { action: 'get' })).status, 403);
    assert.strictEqual((await call(content, null, { action: 'get' })).status, 401);
  });
  await t('contenu : lien vidéo invalide → 400', async () => {
    const m = JSON.parse(JSON.stringify(program.missions.find(x => x.id === 'm1.1')));
    m.video = 'javascript:alert(1)';
    const r = await call(content, 'boss', { action: 'saveMission', id: 'm1.1', data: m });
    assert.strictEqual(r.status, 400);
  });
  await t('contenu : brouillon invisible tant que non publié, puis publié sans redéploiement', async () => {
    const m = JSON.parse(JSON.stringify(program.missions.find(x => x.id === 'boss-a1')));
    m.video = 'https://youtu.be/dQw4w9WgXcQ';
    m.quiz.questions.forEach((q, i) => { q.q = 'Vraie question ' + (i + 1); q.options = ['a', 'b', 'c']; });
    let r = await call(content, 'boss', { action: 'saveMission', id: 'boss-a1', data: m, keys: { q1: 0, q2: 0, q3: 0, q4: 0, q5: 0 } });
    assert.strictEqual(r.status, 200);
    assert.strictEqual(JSON.parse((await content({ httpMethod: 'GET', headers: {} })).body).ov, null, 'brouillon non public');
    r = await call(content, 'boss', { action: 'publish' });
    assert.strictEqual(r.body.version, 1);
    const pub = JSON.parse((await content({ httpMethod: 'GET', headers: {} })).body);
    assert.strictEqual(pub.ov.missions['boss-a1'].video, 'https://youtu.be/dQw4w9WgXcQ');
    assert.ok(!JSON.stringify(pub).includes('keys'), 'réponses jamais publiques');
    assert.ok(DB['masterContent/v1'], 'version archivée');
  });
  await t('contenu publié → le moteur serveur fait jouer le boss avec les vraies réponses', async () => {
    // la vidéo publiée devient une condition du défi
    let r = await call(api, 'alice', { action: 'boss', id: 'boss-a1', answers: { q1: 0, q2: 0, q3: 0, q4: 0, q5: 1 } });
    assert.strictEqual(r.body.error, 'challenge_incomplete');
    await call(api, 'alice', { action: 'video', id: 'boss-a1' });
    r = await call(api, 'alice', { action: 'boss', id: 'boss-a1', answers: { q1: 0, q2: 0, q3: 0, q4: 0, q5: 1 } });
    assert.strictEqual(r.status, 200, JSON.stringify(r.body));
    assert.strictEqual(r.body.result.won, true);
    assert.strictEqual(r.body.result.score, 4);
  });
  await t('aucune écriture hors des collections master*', async () => {
    const bad = WRITES.filter(p => !/^master(Participants|Access|PaymentEvents|Content|Config)\//.test(p));
    assert.deepStrictEqual(bad, []);
    assert.deepStrictEqual(DB['users/u-alice'], { hasBookAccess: true, profile: { prenom: 'Alice' } }, 'doc Hub intact');
  });

  console.log((failed ? '✗' : '✓') + ' test-functions : ' + passed + ' réussis, ' + failed + ' échoués');
  process.exit(failed ? 1 : 0);
})();
