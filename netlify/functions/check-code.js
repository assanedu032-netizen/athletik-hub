// Netlify Function — Validation des codes d'accès post-livre
// Format : TIER-RANDOM6-CHECK4
//   B-XXXXXX-YYYY   → BETA  (14 jours)
//   V-XXXXXX-YYYY   → VIP   (à vie)
//   M-XXXXXX-YYYY   → MASTER (à vie + tout débloqué)
// CHECK4 = 4 premiers chars de HMAC-SHA256(TIER-RANDOM, ACCESS_CODE_SECRET) en hex maj
//
// Codes "legacy" (3 codes fixes hérités) toujours acceptés pour rétro-compat.
// Le secret HMAC vit UNIQUEMENT dans la variable d'env Netlify ACCESS_CODE_SECRET.

const crypto = require('crypto');

const TIER_MAP = { B: 'BETA', V: 'VIP', M: 'MASTER' };

const LEGACY_CODES = {
  'AL-88ND89':      'BETA',
  'KEVIN-JEAN2478': 'VIP',
  'ONANDULU78':     'MASTER',
};

const TIER_META = {
  BETA:   { label: 'BETA',   color: '#10B981', valid: 14,   msg: 'Accès BETA — 14 jours d\'essai.' },
  VIP:    { label: 'VIP',    color: '#D4AF37', valid: null, msg: 'Accès VIP — à vie. Bienvenue, athlète.' },
  MASTER: { label: 'MASTER', color: '#EF4444', valid: null, msg: 'Accès MASTER — Titan illimité + tout débloqué.' },
};

function computeCheck(tierLetter, random, secret) {
  return crypto.createHmac('sha256', secret)
    .update(tierLetter + '-' + random)
    .digest('hex')
    .toUpperCase()
    .slice(0, 4);
}

function safeEq(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

function resp(statusCode, payload) {
  return {
    statusCode: statusCode,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  };
}

exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return resp(400, { ok: false, error: 'invalid_json' }); }

  const code = ((body.code || '') + '').trim().toUpperCase();
  if (!code) return resp(400, { ok: false, error: 'missing_code' });

  // 1) Codes legacy fixes (toujours acceptés)
  if (LEGACY_CODES[code]) {
    const tier = LEGACY_CODES[code];
    return resp(200, { ok: true, tier: tier, meta: TIER_META[tier] });
  }

  // 2) Codes HMAC : LETTRE-RANDOM6-CHECK4
  const parts = code.split('-');
  if (parts.length !== 3) {
    return resp(200, { ok: false, error: 'format' });
  }
  const letter = parts[0];
  const rand   = parts[1];
  const check  = parts[2];

  const tier = TIER_MAP[letter];
  if (!tier) return resp(200, { ok: false, error: 'tier' });
  if (!/^[A-Z0-9]{6}$/.test(rand))  return resp(200, { ok: false, error: 'random_format' });
  if (!/^[A-F0-9]{4}$/.test(check)) return resp(200, { ok: false, error: 'check_format' });

  const secret = process.env.ACCESS_CODE_SECRET;
  if (!secret) {
    return resp(503, { ok: false, error: 'server_not_configured' });
  }

  const expected = computeCheck(letter, rand, secret);
  if (!safeEq(expected, check)) {
    return resp(200, { ok: false, error: 'invalid' });
  }

  return resp(200, { ok: true, tier: tier, meta: TIER_META[tier] });
};
