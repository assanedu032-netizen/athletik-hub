// ════════════════════════════════════════════════════════════════════════════
// timer-alert-background.js — Alerte timer différée via push FCM
// ────────────────────────────────────────────────────────────────────────────
// POURQUOI : quand la PWA est en arrière-plan (user sur YouTube etc.), TOUTES
// les couches locales d'alerte du timer finissent par échouer :
//   - TimestampTrigger : jamais activé par Chrome (origin trial abandonné)
//   - setTimeout du SW : meurt quand Android tue le Service Worker
//   - setTimeout de la page : gelé par le throttling background
//   - audio-loop silencieux : coupé quand YouTube prend le focus audio
// Le SEUL canal fiable app-endormie est un push FCM : il transite par Google
// Play Services et réveille l'appareil, exactement comme un vrai réveil.
//
// COMMENT : Netlify Background Function (suffixe `-background` → runtime
// jusqu'à 15 min, répond 202 immédiatement au client). La fonction dort
// jusqu'à endsAt + 1,5 s de grâce, vérifie un flag d'annulation dans
// Netlify Blobs (posé par timer-alert-cancel.js si l'user a annulé/mis en
// pause OU si le timer a sonné au premier plan), puis envoie le push via
// FCM v1 (même mécanique JWT → OAuth que send-notif.js).
//
// LIMITE : delay max accepté ~14,5 min (borne du runtime background). Le
// client n'appelle cette couche que si le délai tient dans la fenêtre —
// au-delà, les couches locales + resync au retour restent le comportement.
//
// NOTE PLAN NETLIFY : les Background Functions nécessitent un plan qui les
// supporte. Si indisponibles, cette fonction s'exécute avec le timeout
// standard (~10-26 s) et l'alerte différée > 10 s ne partira pas — les
// couches locales existantes restent actives, zéro régression.
//
// Body : { token, endsAt, timerId, body? }
// ════════════════════════════════════════════════════════════════════════════

const crypto = require('crypto');
const { getStore } = require('@netlify/blobs');

const MAX_DELAY_MS = 14.5 * 60 * 1000; // fenêtre runtime background
const GRACE_MS = 1500;                 // laisse le foreground poser son cancel

let _cachedAccessToken = null;
let _cachedAccessTokenExpiry = 0;

function base64UrlEncode(input) {
  const b64 = (Buffer.isBuffer(input) ? input : Buffer.from(input)).toString('base64');
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function parseServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT || process.env.FIREBASE_SERVER_KEY;
  if (!raw) return null;
  try { return typeof raw === 'string' ? JSON.parse(raw) : raw; }
  catch (e) { console.error('[timer-alert] SA JSON invalide:', e.message); return null; }
}

async function getAccessToken(sa) {
  const now = Math.floor(Date.now() / 1000);
  if (_cachedAccessToken && _cachedAccessTokenExpiry > now + 60) return _cachedAccessToken;
  const header = base64UrlEncode(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: sa.private_key_id }));
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
  const jwt = unsigned + '.' + base64UrlEncode(signer.sign(sa.private_key));
  const res = await fetch(sa.token_uri || 'https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }).toString(),
  });
  const json = await res.json();
  if (!res.ok || !json.access_token) throw new Error('OAuth refusé : ' + JSON.stringify(json));
  _cachedAccessToken = json.access_token;
  _cachedAccessTokenExpiry = now + (json.expires_in || 3600);
  return _cachedAccessToken;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  const sa = parseServiceAccount();
  if (!sa || !sa.private_key || !sa.client_email || !sa.project_id) {
    console.error('[timer-alert] service account manquant');
    return { statusCode: 503, body: '' };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, body: '' }; }

  const token   = (body.token || '').trim();
  const endsAt  = Number(body.endsAt) || 0;
  const timerId = String(body.timerId || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
  const text    = (body.body || 'Le minuteur a sonné').toString().slice(0, 140);

  const delay = endsAt - Date.now();
  if (!token || token.length < 20 || !timerId) return { statusCode: 400, body: '' };
  if (delay > MAX_DELAY_MS) return { statusCode: 422, body: '' }; // hors fenêtre background
  // delay négatif toléré (petit retard réseau) : on envoie direct.

  // Dort jusqu'à l'échéance + grâce (le foreground a le temps d'annuler
  // si le timer a sonné dans l'app ouverte).
  await sleep(Math.max(0, delay) + GRACE_MS);

  // Annulé entre-temps ? (pause, reset, ou complétion au premier plan)
  try {
    const store = getStore('timer-alerts');
    const cancelled = await store.get('cancel-' + timerId);
    if (cancelled) {
      console.log('[timer-alert] annulé, push non envoyé:', timerId);
      try { await store.delete('cancel-' + timerId); } catch (_) {}
      return { statusCode: 200, body: '' };
    }
  } catch (e) {
    // Blobs indisponible → on envoie quand même (mieux une notif en trop
    // qu'un timer silencieux).
    console.warn('[timer-alert] blobs check fail:', e.message);
  }

  const fcmPayload = {
    message: {
      token: token,
      notification: { title: '⏰ Timer terminé', body: text },
      webpush: {
        notification: {
          icon: '/icons/icon-192.png',
          badge: '/icons/icon-192.png',
          vibrate: [1000, 300, 1000, 300, 1500],
          tag: 'tim-minut-push',
          requireInteraction: true,
          renotify: true,
        },
        fcm_options: { link: '/' },
      },
      data: { kind: 'timer-alert', timerId: timerId },
    },
  };

  try {
    const accessToken = await getAccessToken(sa);
    const r = await fetch(
      'https://fcm.googleapis.com/v1/projects/' + sa.project_id + '/messages:send',
      {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
        body: JSON.stringify(fcmPayload),
      }
    );
    const result = await r.json();
    if (r.ok && result.name) {
      console.log('[timer-alert] push envoyé:', timerId);
      return { statusCode: 200, body: '' };
    }
    console.error('[timer-alert] FCM rejeté:', JSON.stringify(result));
    return { statusCode: 502, body: '' };
  } catch (err) {
    console.error('[timer-alert]', err.message);
    return { statusCode: 502, body: '' };
  }
};
