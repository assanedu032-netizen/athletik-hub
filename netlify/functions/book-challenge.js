// ════════════════════════════════════════════════════════════════════════════
// netlify/functions/book-challenge.js
// ────────────────────────────────────────────────────────────────────────────
// Activation post-livre. Deux actions :
//
//   POST /api/book-challenge   { action: 'start' }
//     → Auth Bearer requise. Renvoie une question aléatoire + un sessionId
//       signé (HMAC) qui encode l'id de question + l'expiration. Le frontend
//       ne reçoit JAMAIS la réponse, juste questionText.
//
//   POST /api/book-challenge   { action: 'verify',
//                                sessionId, answer, amazonOrder }
//     → Auth Bearer requise. Vérifie la signature/non-expiration du
//       sessionId, normalise la réponse + matche contre la base, hashe le
//       numéro Amazon, vérifie via Netlify Blobs qu'il n'a jamais servi.
//       Si tout OK : Firestore users/{uid}.hasBookAccess=true,
//       bookAccessVerifiedAt=now, accessMethod='amazon_order_book_question',
//       trialStatus='converted'. Renvoie { ok:true, meta:{...} }.
//
// SÉCURITÉ
// - Auth : Firebase ID token (Bearer) — l'uid est lu côté serveur, jamais
//   accepté du body.
// - Rate limiting : 5 tentatives par IP / 15 min, blocage 1h (cf.
//   check-code.js même pattern).
// - Verrouillage par numéro Amazon : Netlify Blobs store `book-access` ⇒
//   set des hashes d'orderNumber déjà utilisés.
// - Le sessionId est un token HMAC(challengeId|expires, ACCESS_CODE_SECRET)
//   — stateless, validable sans persistance.
// - Réponses comparées timing-safe.
//
// CONFIG REQUISE (Netlify env)
// - ACCESS_CODE_SECRET : HMAC secret (réutilisé depuis check-code.js)
// - FIREBASE_SERVICE_ACCOUNT : Service Account JSON complet (réutilisé)
// ════════════════════════════════════════════════════════════════════════════

const crypto = require('crypto');
const admin = require('firebase-admin');
const { getStore } = require('@netlify/blobs');

// Questions embarquées via netlify.toml [functions."book-challenge"].included_files
const BOOK = require('../../data/book-challenges.js');

// ─── Firebase Admin (init paresseuse) ──────────────────────────────────────
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
    console.error('[book-challenge] firebase init failed:', e.message);
    return false;
  }
}

// ─── Normalisation des réponses ────────────────────────────────────────────
// "10 000" / "10000" / "10.000" → "10000"
// "Loïc" / "loic" → "loic"
// "vérité" / "verite" → "verite"
function normalizeAnswer(s) {
  if (s == null) return '';
  return String(s)
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')   // accents
    .replace(/[. \s]+/g, '')                       // espaces, NBSP, points → vide
    .replace(/[^a-z0-9]/g, '');                         // ne garder qu'alphanum
}

// Timing-safe equal (sans révéler la longueur en cas de réussite/échec)
function safeEq(a, b) {
  const A = Buffer.from(String(a));
  const B = Buffer.from(String(b));
  if (A.length !== B.length) {
    // Comparer quand même contre un buffer de longueur égale pour rester constant
    crypto.timingSafeEqual(A, Buffer.alloc(A.length));
    return false;
  }
  return crypto.timingSafeEqual(A, B);
}

// ─── Session token : payload.signature ─────────────────────────────────────
// payload = base64url(challengeId | "|" | expiresAtMs)
// signature = HMAC-SHA256(payload, ACCESS_CODE_SECRET) en hex
function b64urlEncode(buf) {
  return Buffer.from(buf).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}
function b64urlDecode(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return Buffer.from(s, 'base64').toString();
}
function signSession(challengeId, expiresAt, secret) {
  const payload = b64urlEncode(`${challengeId}|${expiresAt}`);
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return `${payload}.${sig}`;
}
function verifySession(token, secret) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  if (!safeEq(expected, sig)) return null;
  let decoded;
  try { decoded = b64urlDecode(payload); } catch (e) { return null; }
  const [challengeId, expStr] = decoded.split('|');
  const expiresAt = parseInt(expStr, 10);
  if (!challengeId || !Number.isFinite(expiresAt)) return null;
  if (Date.now() > expiresAt) return null;
  return { challengeId, expiresAt };
}

// ─── Rate limiting in-memory (même pattern que check-code.js) ──────────────
const RL_MAX        = 5;
const RL_WINDOW_MS  = 15 * 60 * 1000;
const RL_BLOCK_MS   = 60 * 60 * 1000;
const _rl = new Map();
function clientIp(event) {
  const h = event.headers || {};
  return h['x-nf-client-connection-ip']
      || (h['x-forwarded-for'] || '').split(',')[0].trim()
      || h['client-ip']
      || null;
}
function rateLimit(ip) {
  if (!ip) return { allowed: true };
  const now = Date.now();
  let st = _rl.get(ip);
  if (!st) { st = { count: 0, firstAt: now, blockedUntil: 0 }; _rl.set(ip, st); }
  if (st.blockedUntil > now) return { allowed: false, retryAfter: Math.ceil((st.blockedUntil - now) / 1000) };
  if (now - st.firstAt > RL_WINDOW_MS) { st.count = 0; st.firstAt = now; st.blockedUntil = 0; }
  st.count += 1;
  if (st.count > RL_MAX) {
    st.blockedUntil = now + RL_BLOCK_MS;
    return { allowed: false, retryAfter: Math.ceil(RL_BLOCK_MS / 1000) };
  }
  return { allowed: true };
}
function rateLimitReset(ip) { if (ip) _rl.delete(ip); }

// ─── Réponses utilitaires ──────────────────────────────────────────────────
function resp(statusCode, payload, extraHeaders) {
  return {
    statusCode,
    headers: Object.assign({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Content-Type': 'application/json',
    }, extraHeaders || {}),
    body: JSON.stringify(payload),
  };
}

// ─── Pioche une question aléatoire ─────────────────────────────────────────
function pickRandomChallenge() {
  const all = (BOOK && BOOK.challenges) || [];
  if (!all.length) return null;
  return all[Math.floor(Math.random() * all.length)];
}
function findChallenge(id) {
  return ((BOOK && BOOK.challenges) || []).find(c => c.id === id) || null;
}

// ─── Used Amazon orders : Netlify Blobs ────────────────────────────────────
// Store global ; clé = hash hex du numéro Amazon (HMAC-SHA256 avec ACCESS_CODE_SECRET).
// Le contenu est juste un JSON { uid, at, method } pour les logs SAV.
function hashOrder(orderRaw, secret) {
  const normalized = String(orderRaw || '').replace(/\s+/g, '').toUpperCase();
  return crypto.createHmac('sha256', secret).update(`amzn:${normalized}`).digest('hex');
}
async function isOrderUsed(orderHash) {
  try {
    const store = getStore('book-access');
    const existing = await store.get(orderHash);
    return !!existing;
  } catch (e) {
    console.warn('[book-challenge] Blobs read failed:', e.message);
    return false; // fail-open : on n'aime pas, mais on ne bloque pas un user légitime sur une panne infra
  }
}
async function markOrderUsed(orderHash, uid) {
  try {
    const store = getStore('book-access');
    await store.set(orderHash, JSON.stringify({ uid, at: Date.now(), method: 'amazon_order_book_question' }));
  } catch (e) {
    console.warn('[book-challenge] Blobs write failed:', e.message);
  }
}

// ─── Auth Bearer (Firebase ID token) ───────────────────────────────────────
async function authUser(event) {
  if (!initFirebase()) return { ok: false, code: 503, msg: 'FIREBASE_SERVICE_ACCOUNT non configurée.' };
  const h = event.headers || {};
  const ah = h.authorization || h.Authorization;
  if (!ah || !ah.startsWith('Bearer ')) return { ok: false, code: 401, msg: 'Auth required' };
  try {
    const decoded = await admin.auth().verifyIdToken(ah.slice(7));
    return { ok: true, uid: decoded.uid };
  } catch (e) {
    return { ok: false, code: 401, msg: 'Invalid token' };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// HANDLER
// ═══════════════════════════════════════════════════════════════════════════
exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') {
    return resp(204, '');
  }
  if (event.httpMethod !== 'POST') {
    return resp(405, { error: 'Method Not Allowed' });
  }

  const secret = process.env.ACCESS_CODE_SECRET;
  if (!secret) return resp(503, { error: 'ACCESS_CODE_SECRET non configurée.' });

  // Rate limit avant tout parsing
  const ip = clientIp(event);
  const rl = rateLimit(ip);
  if (!rl.allowed) {
    return resp(429, {
      ok: false,
      error: 'rate_limited',
      message: 'Trop de tentatives. Réessaie dans ' + Math.ceil(rl.retryAfter / 60) + ' min.'
    }, { 'Retry-After': String(rl.retryAfter) });
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return resp(400, { ok: false, error: 'invalid_json' }); }

  const action = body.action;

  // Auth requise pour les deux actions
  const auth = await authUser(event);
  if (!auth.ok) return resp(auth.code, { ok: false, error: 'unauthenticated', message: auth.msg });
  const uid = auth.uid;

  // ─── START : pioche une question + renvoie sessionId ───
  if (action === 'start') {
    const ch = pickRandomChallenge();
    if (!ch) return resp(503, { ok: false, error: 'no_challenges' });
    const expiresAt = Date.now() + 10 * 60 * 1000;
    const sessionId = signSession(ch.id, expiresAt, secret);
    // START ne consomme pas de tentative — on reset
    rateLimitReset(ip);
    return resp(200, {
      ok: true,
      sessionId,
      questionText: ch.questionText,
      section: ch.section,
      expiresAt
    });
  }

  // ─── VERIFY : vérifie sessionId + answer + amazonOrder ───
  if (action === 'verify') {
    const sessionId  = body.sessionId;
    const answer     = body.answer;
    const orderRaw   = body.amazonOrder;

    if (!sessionId || !answer || !orderRaw) {
      return resp(400, { ok: false, error: 'missing_fields', message: 'Numéro de commande Amazon et réponse requis.' });
    }

    const session = verifySession(sessionId, secret);
    if (!session) {
      return resp(400, { ok: false, error: 'session_invalid', message: 'Session expirée. Relance la procédure.' });
    }
    const ch = findChallenge(session.challengeId);
    if (!ch) return resp(400, { ok: false, error: 'unknown_challenge' });

    // Réponse : normalise + match timing-safe contre chaque variante acceptée
    const userN = normalizeAnswer(answer);
    let answerOk = false;
    for (let i = 0; i < ch.accepted.length; i++) {
      const exp = normalizeAnswer(ch.accepted[i]);
      if (exp && safeEq(userN, exp)) { answerOk = true; break; }
    }
    if (!answerOk) {
      return resp(200, { ok: false, error: 'wrong_answer', message: 'Réponse incorrecte. Vérifie ton livre et réessaie.' });
    }

    // Amazon order : hash + check unicité
    const orderHash = hashOrder(orderRaw, secret);
    if (await isOrderUsed(orderHash)) {
      return resp(200, { ok: false, error: 'order_already_used', message: 'Ce numéro de commande a déjà été utilisé pour activer un compte.' });
    }

    // Firestore : marque le user comme débloqué
    try {
      const db = admin.firestore();
      await db.doc(`users/${uid}`).set({
        hasBookAccess: true,
        bookAccessVerifiedAt: admin.firestore.FieldValue.serverTimestamp(),
        accessMethod: 'amazon_order_book_question',
        trialStatus: 'converted',
        bookVersionUsed: BOOK.bookVersion,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      // Trace anonymisée pour SAV
      await db.collection('accessRedemptions').add({
        uid,
        method: 'amazon_order_book_question',
        challengeId: ch.id,
        bookVersion: BOOK.bookVersion,
        redeemedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    } catch (e) {
      console.error('[book-challenge] Firestore write failed:', e.message);
      return resp(500, { ok: false, error: 'storage_failed', message: 'Erreur serveur. Réessaie dans quelques instants.' });
    }

    // Verrouille le numéro Amazon (après le succès Firestore pour éviter de griller un numéro
    // si la persistance échoue avant).
    await markOrderUsed(orderHash, uid);

    rateLimitReset(ip);
    return resp(200, {
      ok: true,
      meta: {
        method: 'amazon_order_book_question',
        message: 'Accès débloqué. Bienvenue dans ton espace Athletik Hub.'
      }
    });
  }

  return resp(400, { ok: false, error: 'unknown_action' });
};
