// ════════════════════════════════════════════════════════════════════════════
// POST /.netlify/functions/master-admin   (Bearer token d'un compte admin)
// ────────────────────────────────────────────────────────────────────────────
// Admin = email présent dans MASTER_ADMIN_EMAILS (variable Netlify) ET vérifié.
//   { action: 'list' }                                → participants + résumé
//   { action: 'contacted', uid, day: 30|60 }          → marque le contact humain
//   { action: 'grantAccess', email, plan }            → accès manuel (avant webhook)
//   { action: 'addPayment', email }                   → échéance payée hors webhook
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const C = require('./lib/common');

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') return C.resp(204, '');
  if (event.httpMethod !== 'POST') return C.resp(405, { error: 'method_not_allowed' });
  if (!C.initFirebase()) return C.resp(503, { error: 'not_configured' });
  const user = await C.verifyUser(event);
  if (!user) return C.resp(401, { error: 'auth_required' });
  if (!C.isAdmin(user)) return C.resp(403, { error: 'forbidden' });
  const body = C.parseBody(event) || {};
  const db = C.admin.firestore();
  const now = Date.now();
  const engine = await C.getEngine();

  try {
    if (body.action === 'list') {
      const [ps, as] = await Promise.all([
        db.collection('masterParticipants').limit(1000).get(),
        db.collection('masterAccess').limit(2000).get()
      ]);
      const access = {};
      as.forEach(d => { const a = d.data(); access[C.Access.emailKey(a.email)] = a; });
      const rows = [];
      const seen = {};
      ps.forEach(d => {
        const p = d.data();
        seen[p.email] = true;
        rows.push(C.Access.participantSummary(engine, {
          uid: d.id, name: p.name, email: p.email, state: p.state, access: access[p.email] || null, contacted: p.contacted, shipping: p.shipping || null
        }, now));
      });
      // Acheteurs qui ne se sont pas encore connectés
      Object.keys(access).forEach(email => {
        if (!seen[email]) rows.push(C.Access.participantSummary(engine, { email, access: access[email] }, now));
      });
      return C.resp(200, { serverNow: now, participants: rows });
    }

    if (body.action === 'contacted') {
      const day = Number(body.day);
      if (!body.uid || ![30, 60].includes(day)) return C.resp(400, { error: 'bad_request' });
      await db.collection('masterParticipants').doc(String(body.uid)).set({ contacted: { ['d' + day]: now } }, { merge: true });
      return C.resp(200, { ok: true });
    }

    if (body.action === 'grantAccess' || body.action === 'addPayment') {
      const email = C.Access.emailKey(body.email);
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return C.resp(400, { error: 'bad_email' });
      const ref = db.collection('masterAccess').doc(C.accessDocId(email));
      await db.runTransaction(async tx => {
        const s = await tx.get(ref);
        let rec = s.exists ? s.data() : null;
        const plan = ['one_time', 'installments'].includes(body.plan) ? body.plan : (rec && rec.plan) || 'unknown';
        rec = C.Access.applyEvent(rec, { kind: 'payment', email, paymentId: 'manual-' + now, at: now, plan, amount: null }, { installments: 3 });
        rec.email = email;
        if (!s.exists) { rec.source = 'admin'; rec.createdAt = now; }
        rec.updatedAt = now;
        tx.set(ref, rec);
      });
      return C.resp(200, { ok: true });
    }

    return C.resp(400, { error: 'bad_action' });
  } catch (e) {
    console.error('[master-admin]', e);
    return C.resp(500, { error: 'server_error' });
  }
};
