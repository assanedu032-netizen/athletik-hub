// ════════════════════════════════════════════════════════════════════════════
// netlify/functions/init-user.js
// ────────────────────────────────────────────────────────────────────────────
// Initialise / synchronise les champs serveur du profil utilisateur dans
// Firestore. Appelé par le client à chaque sign-in (idempotent).
//
//   POST /api/init-user   (Auth Bearer Firebase ID token requise)
//
// Si users/{uid}/trialStartedAt n'existe pas → créé avec serverTimestamp().
// Si trialEndsAt n'existe pas → trialStartedAt + 3 jours.
// trialStatus = 'expired' si maintenant > trialEndsAt et hasBookAccess≠true.
//
// Le client ne peut PAS écrire ces champs (cf. firestore.rules) — la
// fonction serveur est la seule autorité. Empêche un utilisateur de
// trafiquer son localStorage pour étendre son trial.
//
// Renvoie l'état d'accès courant :
//   { trialStartedAt, trialEndsAt, trialStatus, trialRemainingMs,
//     hasBookAccess, accessMethod, hasValidAccess }
// ════════════════════════════════════════════════════════════════════════════

const admin = require('firebase-admin');

const TRIAL_MS = 3 * 24 * 60 * 60 * 1000; // 72h

let firebaseReady = false;
function initFirebase() {
  if (firebaseReady) return true;
  const sa = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!sa) return false;
  try {
    if (!admin.apps.length) {
      admin.initializeApp({ credential: admin.credential.cert(JSON.parse(sa)) });
    }
    firebaseReady = true;
    return true;
  } catch (e) {
    console.error('[init-user] firebase init failed:', e.message);
    return false;
  }
}

function resp(statusCode, payload) {
  return {
    statusCode,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  };
}

// Convertit un Firestore Timestamp ou ms vers ms (millisecondes epoch).
function tsToMs(v) {
  if (!v) return null;
  if (typeof v === 'number') return v;
  if (typeof v.toMillis === 'function') return v.toMillis();
  if (typeof v._seconds === 'number') return v._seconds * 1000;
  return null;
}

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') return resp(204, '');
  if (event.httpMethod !== 'POST') return resp(405, { error: 'Method Not Allowed' });

  if (!initFirebase()) return resp(503, { error: 'FIREBASE_SERVICE_ACCOUNT non configurée.' });

  // Auth Bearer
  const h = event.headers || {};
  const ah = h.authorization || h.Authorization;
  if (!ah || !ah.startsWith('Bearer ')) return resp(401, { error: 'Auth required' });
  let uid, email, displayName;
  try {
    const decoded = await admin.auth().verifyIdToken(ah.slice(7));
    uid = decoded.uid;
    email = decoded.email || null;
    displayName = decoded.name || null;
  } catch (e) {
    return resp(401, { error: 'Invalid token' });
  }

  const db = admin.firestore();
  const userRef = db.doc(`users/${uid}`);
  const now = Date.now();

  try {
    // Transaction pour rester atomique sur create-if-missing
    const out = await db.runTransaction(async (tx) => {
      const snap = await tx.get(userRef);
      const cur = snap.exists ? snap.data() : {};
      const update = {
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      // Première fois → créer le doc avec serverTimestamps
      if (!snap.exists || !cur.trialStartedAt) {
        update.createdAt = admin.firestore.FieldValue.serverTimestamp();
        update.trialStartedAt = admin.firestore.FieldValue.serverTimestamp();
        // trialEndsAt = now + TRIAL_MS (en ms client-server proche assez pour ne pas tricher)
        update.trialEndsAt = now + TRIAL_MS;
        update.trialStatus = 'active';
        update.hasBookAccess = cur.hasBookAccess === true; // préserve si déjà true
        update.accessMethod  = cur.accessMethod || null;
        if (email) update.email = email;
        if (displayName) update.displayName = displayName;
      }
      // Statut trial : recalculé à chaque appel (active / expired / converted)
      const startedMs = tsToMs(cur.trialStartedAt) || (snap.exists ? null : now);
      const endsMs = (typeof cur.trialEndsAt === 'number')
        ? cur.trialEndsAt
        : (startedMs ? startedMs + TRIAL_MS : now + TRIAL_MS);
      const hasBookAccess = (update.hasBookAccess === true) || (cur.hasBookAccess === true);
      let trialStatus = 'active';
      if (hasBookAccess) trialStatus = 'converted';
      else if (now >= endsMs) trialStatus = 'expired';
      if (cur.trialStatus !== trialStatus) update.trialStatus = trialStatus;

      tx.set(userRef, update, { merge: true });

      return {
        trialStartedAt: startedMs || now,
        trialEndsAt: endsMs,
        trialStatus,
        trialRemainingMs: Math.max(0, endsMs - now),
        hasBookAccess,
        accessMethod: cur.accessMethod || null,
        hasValidAccess: hasBookAccess || now < endsMs
      };
    });

    return resp(200, { ok: true, access: out });
  } catch (e) {
    console.error('[init-user] tx failed:', e.message);
    return resp(500, { ok: false, error: 'storage_failed' });
  }
};
