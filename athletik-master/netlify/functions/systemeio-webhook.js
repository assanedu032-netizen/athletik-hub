// ════════════════════════════════════════════════════════════════════════════
// POST /.netlify/functions/systemeio-webhook?key=<SYSTEMEIO_WEBHOOK_SECRET>
// ────────────────────────────────────────────────────────────────────────────
// Reçoit les événements de vente de Systeme.io et met à jour masterAccess.
// C'est la SEULE preuve de paiement acceptée : une redirection vers une page
// de confirmation ne donne jamais accès.
//
// Sécurité :
//   1. secret partagé dans l'URL (?key=…), comparé à temps constant ;
//   2. si Systeme.io signe ses envois et que SYSTEMEIO_SIGNING_SECRET est
//      défini, la signature HMAC-SHA256 du corps (en-tête X-Webhook-Signature)
//      est aussi vérifiée.
//   3. idempotence : chaque événement est journalisé dans masterPaymentEvents ;
//      un même paiement rejoué n'est compté qu'une fois.
//
// ⚠ À CONFIRMER sur un vrai envoi : le nom des événements et la forme du JSON
// (voir README § Systeme.io). Un événement non reconnu est journalisé avec
// kind:'unknown' et n'a AUCUN effet sur les droits.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const crypto = require('crypto');
const C = require('./lib/common');

function safeEqual(a, b) {
  const x = Buffer.from(String(a || '')), y = Buffer.from(String(b || ''));
  return x.length === y.length && x.length > 0 && crypto.timingSafeEqual(x, y);
}

function offerPlans() {
  // MASTER_OFFER_PLANS='{"12345":"one_time","12346":"installments"}'
  try { return JSON.parse(process.env.MASTER_OFFER_PLANS || '{}'); } catch (e) { return {}; }
}

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') return C.resp(405, { error: 'method_not_allowed' });
  const secret = process.env.SYSTEMEIO_WEBHOOK_SECRET;
  if (!secret) return C.resp(503, { error: 'not_configured' });
  const key = (event.queryStringParameters || {}).key;
  if (!safeEqual(key, secret)) return C.resp(401, { error: 'unauthorized' });

  const headers = {};
  Object.keys(event.headers || {}).forEach(k => { headers[k.toLowerCase()] = event.headers[k]; });
  const rawBody = event.isBase64Encoded ? Buffer.from(event.body || '', 'base64').toString('utf8') : (event.body || '');
  const signingSecret = process.env.SYSTEMEIO_SIGNING_SECRET;
  if (signingSecret) {
    const sig = headers['x-webhook-signature'];
    const expected = crypto.createHmac('sha256', signingSecret).update(rawBody).digest('hex');
    if (!safeEqual(sig, expected)) return C.resp(401, { error: 'bad_signature' });
  }

  let payload;
  try { payload = JSON.parse(rawBody || '{}'); } catch (e) { return C.resp(400, { error: 'bad_json' }); }
  if (!C.initFirebase()) return C.resp(503, { error: 'not_configured' });

  const now = Date.now();
  const ev = C.Access.normalizeEvent(payload, headers, { now, offerPlans: offerPlans() });
  const db = C.admin.firestore();
  const eventId = crypto.createHash('sha256').update(rawBody).digest('hex').slice(0, 40);
  const evRef = db.collection('masterPaymentEvents').doc(eventId);

  try {
    const res = await db.runTransaction(async tx => {
      const prev = await tx.get(evRef);
      if (prev.exists) return { duplicate: true };
      // Le corps brut est conservé tel quel (audit) — il ne contient pas de
      // données bancaires, seulement ce que Systeme.io choisit d'envoyer.
      tx.set(evRef, { receivedAt: now, kind: ev.kind, type: ev.type, email: ev.email, offerId: ev.offerId, raw: rawBody.slice(0, 20000) });
      if (ev.kind === 'unknown' || !ev.email) return { ignored: true };
      const aRef = db.collection('masterAccess').doc(C.accessDocId(ev.email));
      const aSnap = await tx.get(aRef);
      const rec = C.Access.applyEvent(aSnap.exists ? aSnap.data() : null, ev, { installments: Number(process.env.MASTER_INSTALLMENTS || 3) });
      rec.email = ev.email;
      rec.updatedAt = now;
      if (!aSnap.exists) rec.createdAt = now;
      tx.set(aRef, rec);
      return { applied: ev.kind };
    });
    return C.resp(200, Object.assign({ ok: true }, res));
  } catch (e) {
    console.error('[systemeio-webhook]', e);
    return C.resp(500, { error: 'server_error' });
  }
};
