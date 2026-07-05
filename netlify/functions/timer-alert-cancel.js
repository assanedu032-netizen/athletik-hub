// ════════════════════════════════════════════════════════════════════════════
// timer-alert-cancel.js — Annule une alerte timer différée (push FCM)
// ────────────────────────────────────────────────────────────────────────────
// Pose un flag d'annulation dans Netlify Blobs (store 'timer-alerts').
// timer-alert-background.js vérifie ce flag juste avant d'envoyer le push :
// s'il existe, le push est abandonné (l'user a mis pause, annulé, ou le
// timer a déjà sonné au premier plan → pas de doublon système).
//
// Body : { timerId }
// ════════════════════════════════════════════════════════════════════════════

const { getStore } = require('@netlify/blobs');

exports.handler = async function (event) {
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
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return resp(400, { ok: false }); }

  const timerId = String(body.timerId || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
  if (!timerId) return resp(400, { ok: false });

  try {
    const store = getStore('timer-alerts');
    await store.set('cancel-' + timerId, String(Date.now()));
    return resp(200, { ok: true });
  } catch (e) {
    console.warn('[timer-alert-cancel]', e.message);
    return resp(502, { ok: false });
  }
};

function resp(statusCode, body) {
  return {
    statusCode,
    headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}
