// Envoie une notification push à un token FCM via FCM v1 HTTP API.
// Auth : Service Account JSON Firebase (FIREBASE_SERVICE_ACCOUNT env var).
// Le Server Key legacy a été déprécié par Google en juin 2024 — on doit
// désormais signer un JWT, l'échanger contre un access token OAuth, puis
// l'utiliser pour appeler l'API v1.
//
// Body côté client : { token, title, body, data? }

const crypto = require('crypto');

// Cache du token OAuth en mémoire pour éviter de re-authentifier à chaque
// notif. Le token expire au bout d'1h, on prévoit 5 min de marge.
let _cachedAccessToken = null;
let _cachedAccessTokenExpiry = 0;

function base64UrlEncode(input) {
  const b64 = (Buffer.isBuffer(input) ? input : Buffer.from(input)).toString('base64');
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function parseServiceAccount() {
  // Supporte 2 noms d'env vars : FIREBASE_SERVICE_ACCOUNT (recommandé)
  // ou FIREBASE_SERVER_KEY (ancien nom, si l'utilisateur l'a déjà mis).
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT || process.env.FIREBASE_SERVER_KEY;
  if (!raw) return null;
  try {
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch (e) {
    console.error('[send-notif] Service Account JSON invalide:', e.message);
    return null;
  }
}

async function getAccessToken(sa) {
  const now = Math.floor(Date.now() / 1000);
  if (_cachedAccessToken && _cachedAccessTokenExpiry > now + 60) {
    return _cachedAccessToken;
  }
  const header = base64UrlEncode(JSON.stringify({
    alg: 'RS256',
    typ: 'JWT',
    kid: sa.private_key_id,
  }));
  const claims = base64UrlEncode(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: sa.token_uri || 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }));
  const unsigned = header + '.' + claims;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(unsigned);
  const signature = base64UrlEncode(signer.sign(sa.private_key));
  const jwt = unsigned + '.' + signature;

  const tokenRes = await fetch(sa.token_uri || 'https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }).toString(),
  });
  const tokenJson = await tokenRes.json();
  if (!tokenRes.ok || !tokenJson.access_token) {
    throw new Error('Token OAuth refusé : ' + JSON.stringify(tokenJson));
  }
  _cachedAccessToken = tokenJson.access_token;
  _cachedAccessTokenExpiry = now + (tokenJson.expires_in || 3600);
  return _cachedAccessToken;
}

exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
      body: '',
    };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const sa = parseServiceAccount();
  if (!sa || !sa.private_key || !sa.client_email || !sa.project_id) {
    return resp(503, { ok: false, error: 'service_account_missing_or_invalid' });
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return resp(400, { ok: false, error: 'invalid_json' }); }

  const token = (body.token || '').trim();
  const title = (body.title || 'Titan').toString();
  const text  = (body.body  || '').toString();
  const data  = body.data && typeof body.data === 'object' ? body.data : {};

  if (!token) return resp(400, { ok: false, error: 'missing_token' });

  // FCM v1 API : data values doivent être des strings.
  const stringData = {};
  Object.keys(data).forEach(k => { stringData[k] = String(data[k]); });

  const fcmPayload = {
    message: {
      token: token,
      notification: { title, body: text },
      webpush: {
        notification: {
          icon: '/icons/icon-192.png',
          badge: '/icons/icon-192.png',
          vibrate: [120, 60, 120],
        },
        fcm_options: { link: '/' },
      },
      data: stringData,
    },
  };

  try {
    const accessToken = await getAccessToken(sa);
    const r = await fetch(
      'https://fcm.googleapis.com/v1/projects/' + sa.project_id + '/messages:send',
      {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + accessToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(fcmPayload),
      }
    );
    const result = await r.json();
    if (r.ok && result.name) {
      return resp(200, { ok: true, name: result.name });
    }
    return resp(r.status || 502, { ok: false, error: 'fcm_rejected', fcm: result });
  } catch (err) {
    console.error('[send-notif]', err);
    return resp(502, { ok: false, error: 'network_or_auth_error', message: err.message });
  }
};

function resp(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  };
}
