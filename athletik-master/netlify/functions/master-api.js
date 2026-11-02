// ════════════════════════════════════════════════════════════════════════════
// POST /.netlify/functions/master-api   (Authorization: Bearer <Firebase ID token>)
// ────────────────────────────────────────────────────────────────────────────
// Toutes les actions du participant passent ici. Le serveur applique le MÊME
// moteur que le navigateur (public/js/engine.js) avec SON heure : avancer la
// montre du téléphone ou forger une requête ne débloque rien.
//
//   { action: 'state', tz }                      → état + droits
//   { action: 'intro'|'video'|'support'|'checkin'|'quiz'|'validate'|'boss'|'habit'|'restart', ... }
//
// Accès : un dossier masterAccess/{email} actif (paiement confirmé par le
// webhook Systeme.io, ou accès accordé par l'admin) ET un email vérifié.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const C = require('./lib/common');

const ACTIONS = ['intro', 'video', 'support', 'checkin', 'quiz', 'validate', 'boss', 'habit', 'restart'];

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') return C.resp(204, '');
  if (event.httpMethod !== 'POST') return C.resp(405, { error: 'method_not_allowed' });
  if (!C.initFirebase()) return C.resp(503, { error: 'not_configured', message: 'FIREBASE_SERVICE_ACCOUNT non configurée.' });

  const user = await C.verifyUser(event);
  if (!user) return C.resp(401, { error: 'auth_required' });
  const body = C.parseBody(event);
  if (!body || typeof body.action !== 'string') return C.resp(400, { error: 'bad_request' });

  const db = C.admin.firestore();
  const engine = await C.getEngine();
  const now = Date.now();
  const pRef = db.collection('masterParticipants').doc(user.uid);

  // ─── Droits ──────────────────────────────────────────────────────────────
  if (!user.email) return C.resp(403, { error: 'no_email' });
  const aRef = db.collection('masterAccess').doc(C.accessDocId(user.email));
  const aSnap = await aRef.get();
  const accessRec = aSnap.exists ? aSnap.data() : null;
  const acc = C.Access.summarize(accessRec, now);
  const admin = C.isAdmin(user);

  if (!acc.active && !admin) {
    return C.resp(403, { error: 'no_access', access: { status: acc.status } });
  }
  // L'email doit être vérifié : sinon n'importe qui pourrait créer un compte
  // avec l'email d'un acheteur avant lui.
  if (!user.emailVerified) return C.resp(403, { error: 'email_not_verified' });

  try {
    const out = await db.runTransaction(async (tx) => {
      const snap = await tx.get(pRef);
      let doc = snap.exists ? snap.data() : null;
      if (!doc) {
        doc = {
          uid: user.uid, email: C.Access.emailKey(user.email), name: user.name || '',
          state: engine.newState(now, typeof body.tz === 'number' ? body.tz : 0),
          contacted: {}, createdAt: now, updatedAt: now
        };
        tx.set(pRef, doc);
        if (aSnap.exists && !accessRec.uid) tx.set(aRef, { uid: user.uid }, { merge: true });
      }
      if (body.action === 'state') return { state: doc.state, events: [], result: null };
      if (body.action === 'profile') {
        const name = String(body.name || '').trim().slice(0, 60);
        tx.set(pRef, { name, updatedAt: now }, { merge: true });
        return { state: doc.state, events: [], result: null, name };
      }
      if (!ACTIONS.includes(body.action)) {
        const e = new Error('Action inconnue'); e.code = 'bad_action'; e.isEngineError = true; throw e;
      }
      const action = Object.assign({}, body, { type: body.action });
      delete action.action;
      const r = engine.apply(doc.state, action, now);
      tx.set(pRef, { state: r.state, updatedAt: now }, { merge: true });
      return r;
    });

    // Lecture SEULE du profil Hub pour calculer les droits Hub (jamais écrit).
    let hubDoc = null;
    try {
      const hs = await db.collection('users').doc(user.uid).get();
      if (hs.exists) {
        const d = hs.data();
        hubDoc = { hasBookAccess: d.hasBookAccess === true, accessTier: d.accessTier || null, accessExpiresAt: d.accessExpiresAt || null };
      }
    } catch (e) { /* droits Hub indisponibles : on continue sans */ }

    const pSnap = await pRef.get();
    const p = pSnap.data() || {};
    return C.resp(200, {
      serverNow: now,
      state: out.state,
      events: out.events,
      result: out.result,
      profile: { name: out.name != null ? out.name : (p.name || user.name || ''), email: user.email },
      access: {
        status: acc.status, plan: acc.plan, paid: acc.paid, needed: acc.needed, fullyPaid: acc.fullyPaid,
        // Le kit est une surprise : on n'envoie qu'un booléen « colis en route ».
        parcel: acc.kit.eligible
      },
      roles: C.Access.roles({ now, access: accessRec, hubDoc, grants: out.state.grants, isAdmin: admin })
    });
  } catch (e) {
    if (e && e.isEngineError) return C.resp(400, { error: e.code, message: e.message });
    console.error('[master-api]', e);
    return C.resp(500, { error: 'server_error' });
  }
};
