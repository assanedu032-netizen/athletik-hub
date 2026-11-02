// Droits, paiements, kit, webhook, suivi humain : node tests/test-access.js
'use strict';
const assert = require('assert');
const A = require('../public/js/access.js');
const D = A.DAY, T0 = Date.parse('2026-11-02T10:00:00Z');
let passed = 0, failed = 0;
function t(n, f) { try { f(); passed++; } catch (e) { failed++; console.error('✗ ' + n + '\n   ' + e.message); } }

t('aucun dossier → pas d\'accès', () => { const s = A.summarize(null, T0); assert.strictEqual(s.active, false); });
t('paiement en une fois → accès + paiement complet', () => {
  const s = A.summarize({ plan: 'one_time', payments: [{ id: 'a', at: T0 }] }, T0);
  assert.ok(s.active && s.fullyPaid);
});
t('kit : jamais avant 14 jours (rétractation)', () => {
  const r = { plan: 'one_time', payments: [{ id: 'a', at: T0 }] };
  assert.strictEqual(A.summarize(r, T0 + 13 * D).kit.eligible, false);
  assert.strictEqual(A.summarize(r, T0 + 13 * D).kit.reason, 'retractation');
  assert.strictEqual(A.summarize(r, T0 + 14 * D).kit.eligible, true);
});
t('3 fois : accès dès la 1re échéance, kit seulement après la 3e', () => {
  const r = { plan: 'installments', installments: 3, payments: [{ id: '1', at: T0 }] };
  assert.ok(A.summarize(r, T0).active);
  assert.strictEqual(A.summarize(r, T0 + 40 * D).kit.reason, 'installments_pending');
  r.payments.push({ id: '2', at: T0 + 30 * D }, { id: '3', at: T0 + 60 * D });
  assert.strictEqual(A.summarize(r, T0 + 59 * D).kit.eligible, false);
  assert.strictEqual(A.summarize(r, T0 + 60 * D).kit.eligible, true);
});
t('formule inconnue → jamais de kit par défaut', () => {
  assert.strictEqual(A.summarize({ plan: 'unknown', payments: [{ id: '1', at: T0 }] }, T0 + 99 * D).kit.reason, 'plan_unknown');
});
t('remboursement → accès coupé, pas de kit', () => {
  const s = A.summarize({ plan: 'one_time', payments: [{ id: 'a', at: T0 }], refundedAt: T0 + D }, T0 + 20 * D);
  assert.strictEqual(s.active, false); assert.strictEqual(s.kit.eligible, false);
});
t('rôles : Master donne Hub Standard, pas Premium', () => {
  const r = A.roles({ now: T0, access: { plan: 'one_time', payments: [{ id: 'a', at: T0 }] } });
  assert.deepStrictEqual([r.master, r.hubStandard, r.hubPremium, r.admin], [true, true, false, false]);
});
t('rôles : Premium du boss Tout Donner pendant 1 mois', () => {
  const g = [{ type: 'hubPremium', months: 1, at: T0 }];
  assert.ok(A.roles({ now: T0 + 10 * D, access: null, grants: g }).hubPremium);
  assert.ok(!A.roles({ now: T0 + 31 * D, access: null, grants: g }).hubPremium);
});
t('rôles : Premium natif Hub (livre / tier) reconnu', () => {
  assert.ok(A.roles({ now: T0, hubDoc: { hasBookAccess: true } }).hubPremium);
  assert.ok(!A.roles({ now: T0, hubDoc: { accessTier: 'VIP', accessExpiresAt: T0 - 1 } }).hubPremium);
});
t('webhook : vente reconnue, email normalisé, formule via MASTER_OFFER_PLANS', () => {
  const ev = A.normalizeEvent({ type: 'SALE_NEW', data: { customer: { email: ' Jo@Ex.com ' }, offer_price_plan: { id: 42 }, order: { id: 9 } } }, {}, { now: T0, offerPlans: { 42: 'installments' } });
  assert.strictEqual(ev.kind, 'payment'); assert.strictEqual(ev.email, 'jo@ex.com'); assert.strictEqual(ev.plan, 'installments');
});
t('webhook : événement inconnu → aucun effet', () => {
  assert.strictEqual(A.normalizeEvent({ type: 'CONTACT_CREATED', data: { contact: { email: 'a@b.c' } } }, {}, { now: T0 }).kind, 'unknown');
});
t('webhook : un paiement rejoué ne compte qu\'une fois', () => {
  const ev = { kind: 'payment', email: 'a@b.c', paymentId: 'p1', at: T0, plan: 'one_time' };
  const r = A.applyEvent(A.applyEvent(null, ev), ev);
  assert.strictEqual(r.payments.length, 1);
});
t('suivi humain J30 / J60', () => {
  const tt = A.humanTouch(T0, [30, 60], {}, T0 + 29 * D);
  assert.strictEqual(tt[0].status, 'due'); assert.strictEqual(tt[1].status, 'upcoming');
  assert.strictEqual(A.humanTouch(T0, [30], {}, T0 + 40 * D)[0].status, 'late');
  assert.strictEqual(A.humanTouch(T0, [30], { d30: T0 + 29 * D }, T0 + 40 * D)[0].status, 'done');
});
console.log((failed ? '✗' : '✓') + ' test-access : ' + passed + ' réussis, ' + failed + ' échoués');
process.exit(failed ? 1 : 0);
