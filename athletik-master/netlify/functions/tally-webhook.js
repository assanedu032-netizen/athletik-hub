// ════════════════════════════════════════════════════════════════════════════
// POST /.netlify/functions/tally-webhook — confirmation de livraison du kit
// ────────────────────────────────────────────────────────────────────────────
// Tally appelle cette URL à chaque envoi du formulaire « Ta livraison »
// (https://tally.so/r/4aQp4o). Le participant y arrive depuis Athletik Master
// avec uid / email / prénom en champs cachés.
//
// Ce qu'on enregistre : masterParticipants/{uid}.shipping =
//   { confirmedAt, submissionId, responseId }
// Ce qu'on N'enregistre PAS : l'adresse. Elle reste dans Tally (une seule
// copie des données personnelles) ; l'admin la consulte dans les réponses Tally.
//
// Sécurité :
//   - signature Tally obligatoire : en-tête « tally-signature » =
//     base64(HMAC-SHA256(corps brut, TALLY_SIGNING_SECRET)) ;
//   - seul le formulaire attendu est accepté (TALLY_DELIVERY_FORM_ID) ;
//   - l'email caché doit être celui du participant : un uid seul ne suffit
//     pas à marquer la livraison de quelqu'un d'autre.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const crypto = require('crypto');
const C = require('./lib/common');

function safeEqual(a, b) {
  const x = Buffer.from(String(a || '')), y = Buffer.from(String(b || ''));
  return x.length === y.length && x.length > 0 && crypto.timingSafeEqual(x, y);
}

// Lit un champ caché par son nom (Tally : fields[].label === nom du paramètre)
function hidden(fields, name) {
  const f = (fields || []).find(x => x && x.type === 'HIDDEN_FIELDS' && x.label === name) ||
    (fields || []).find(x => x && x.label === name);
  return f && typeof f.value === 'string' ? f.value.trim() : '';
}

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') return C.resp(405, { error: 'method_not_allowed' });
  const secret = process.env.TALLY_SIGNING_SECRET;
  if (!secret) return C.resp(503, { error: 'not_configured' });

  const raw = event.isBase64Encoded ? Buffer.from(event.body || '', 'base64').toString('utf8') : (event.body || '');
  const headers = {};
  Object.keys(event.headers || {}).forEach(k => { headers[k.toLowerCase()] = event.headers[k]; });
  const expected = crypto.createHmac('sha256', secret).update(raw).digest('base64');
  if (!safeEqual(headers['tally-signature'], expected)) return C.resp(401, { error: 'bad_signature' });

  let payload;
  try { payload = JSON.parse(raw); } catch (e) { return C.resp(400, { error: 'bad_json' }); }
  const data = payload.data || {};
  const formId = process.env.TALLY_DELIVERY_FORM_ID || '4aQp4o';
  if (payload.eventType !== 'FORM_RESPONSE' || data.formId !== formId) return C.resp(200, { ignored: true });

  const uid = hidden(data.fields, 'uid');
  const email = C.Access.emailKey(hidden(data.fields, 'email'));
  if (!uid || !email || uid.length > 128 || uid.indexOf('/') >= 0) return C.resp(200, { ignored: 'missing_identity' });

  if (!C.initFirebase()) return C.resp(503, { error: 'not_configured' });
  const ref = C.admin.firestore().collection('masterParticipants').doc(uid);
  try {
    const snap = await ref.get();
    if (!snap.exists || C.Access.emailKey(snap.data().email) !== email) return C.resp(200, { ignored: 'unknown_participant' });
    await ref.set({
      shipping: {
        confirmedAt: Date.now(),
        submissionId: String(data.submissionId || '').slice(0, 64),
        responseId: String(data.responseId || '').slice(0, 64)
      }
    }, { merge: true });
    return C.resp(200, { ok: true });
  } catch (e) {
    console.error('[tally-webhook]', e);
    return C.resp(500, { error: 'server_error' });
  }
};
