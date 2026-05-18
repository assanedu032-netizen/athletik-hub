// Envoie une notification push à un token FCM via la legacy HTTP API.
// Body : { token, title, body, data? }
// Auth : FIREBASE_SERVER_KEY dans les env vars Netlify (Server key Firebase Cloud Messaging).
//
// Usage côté client : POST avec le fcmToken de l'utilisateur.
// Usage côté admin/cron : POST avec un token spécifique pour envoyer un push ciblé.

exports.handler = async function(event) {
  // CORS
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

  const serverKey = process.env.FIREBASE_SERVER_KEY;
  if (!serverKey) {
    return resp(503, { ok: false, error: 'server_not_configured' });
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return resp(400, { ok: false, error: 'invalid_json' }); }

  const token = (body.token || '').trim();
  const title = (body.title || 'Titan').toString();
  const text = (body.body || '').toString();
  const data = body.data || {};

  if (!token) return resp(400, { ok: false, error: 'missing_token' });

  // Format Legacy FCM (clé Server). Plus simple à utiliser que la v1 HTTP API
  // qui demande un service account JSON.
  const payload = {
    to: token,
    notification: {
      title: title,
      body: text,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      click_action: '/',
    },
    data: data,
    priority: 'high',
  };

  try {
    const r = await fetch('https://fcm.googleapis.com/fcm/send', {
      method: 'POST',
      headers: {
        'Authorization': 'key=' + serverKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    const result = await r.json();
    if (r.ok && result.success === 1) {
      return resp(200, { ok: true });
    }
    return resp(200, { ok: false, error: 'fcm_rejected', fcm: result });
  } catch (err) {
    console.error('[send-notif]', err);
    return resp(502, { ok: false, error: 'network_error' });
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
