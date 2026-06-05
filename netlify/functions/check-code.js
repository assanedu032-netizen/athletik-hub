// Netlify Function — Validation des codes d'accès post-livre
// Format : TIER-RANDOM6-CHECK4
//   B-XXXXXX-YYYY   → BETA  (14 jours)
//   V-XXXXXX-YYYY   → VIP   (à vie)
//   M-XXXXXX-YYYY   → MASTER (à vie + tout débloqué)
// CHECK4 = 4 premiers chars de HMAC-SHA256(TIER-RANDOM, ACCESS_CODE_SECRET) en hex maj
//
// Codes "legacy" (3 codes fixes hérités) toujours acceptés pour rétro-compat.
// Le secret HMAC vit UNIQUEMENT dans la variable d'env Netlify ACCESS_CODE_SECRET.
//
// ── Rate limiting (P4 sécurité — anti-bruteforce) ──
// Max RL_MAX tentatives par IP toutes les RL_WINDOW_MS ms. Stocké en mémoire
// de l'instance Lambda (warm). En cold start le compteur repart à zéro, c'est
// acceptable : un attaquant qui forcerait des cold starts paye plus que ce que
// ça coûte de bloquer. Pour anti-bruteforce distribué (botnet), Phase 3
// passera sur Upstash Redis ou Firestore counter.

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

// ─── Rate limiting in-memory ────────────────────────────────────────────────
const RL_MAX        = 5;             // 5 tentatives
const RL_WINDOW_MS  = 15 * 60 * 1000; // par 15 minutes
const RL_BLOCK_MS   = 60 * 60 * 1000; // bloqué 1h après dépassement
const _rlAttempts   = new Map();     // ip → { count, firstAt, blockedUntil }

function _rlGc() {
  const now = Date.now();
  if (_rlAttempts.size < 1000) return;
  for (const [ip, st] of _rlAttempts) {
    if ((st.blockedUntil || 0) < now && (now - st.firstAt) > RL_WINDOW_MS) {
      _rlAttempts.delete(ip);
    }
  }
}

// Renvoie { allowed: bool, retryAfter?: seconds }
function rateLimit(ip) {
  if (!ip) return { allowed: true }; // pas d'IP → on laisse passer (proxy mal configuré)
  const now = Date.now();
  let st = _rlAttempts.get(ip);
  if (!st) {
    st = { count: 0, firstAt: now, blockedUntil: 0 };
    _rlAttempts.set(ip, st);
  }
  // Encore bloqué ?
  if (st.blockedUntil > now) {
    return { allowed: false, retryAfter: Math.ceil((st.blockedUntil - now) / 1000) };
  }
  // Fenêtre expirée → reset
  if (now - st.firstAt > RL_WINDOW_MS) {
    st.count = 0;
    st.firstAt = now;
    st.blockedUntil = 0;
  }
  st.count += 1;
  if (st.count > RL_MAX) {
    st.blockedUntil = now + RL_BLOCK_MS;
    _rlGc();
    return { allowed: false, retryAfter: Math.ceil(RL_BLOCK_MS / 1000) };
  }
  return { allowed: true };
}

// Sur succès, on reset le compteur pour ne pas pénaliser un user légitime
// qui a tapé son code correctement après un essai foireux.
function rateLimitReset(ip) {
  if (ip) _rlAttempts.delete(ip);
}

function clientIp(event) {
  const h = event.headers || {};
  // Netlify priorité, puis fallback CloudFront / standard
  return h['x-nf-client-connection-ip']
      || (h['x-forwarded-for'] || '').split(',')[0].trim()
      || h['client-ip']
      || null;
}

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

function resp(statusCode, payload, extraHeaders) {
  return {
    statusCode: statusCode,
    headers: Object.assign({
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json',
    }, extraHeaders || {}),
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

  // ─── Rate limiting (avant parsing du body, économise du CPU) ───
  const ip = clientIp(event);
  const rl = rateLimit(ip);
  if (!rl.allowed) {
    return resp(429, {
      ok: false,
      error: 'rate_limited',
      message: 'Trop de tentatives. Réessaie dans ' + Math.ceil(rl.retryAfter / 60) + ' min.',
    }, { 'Retry-After': String(rl.retryAfter) });
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return resp(400, { ok: false, error: 'invalid_json' }); }

  const code = ((body.code || '') + '').trim().toUpperCase();
  if (!code) return resp(400, { ok: false, error: 'missing_code' });

  // 1) Codes legacy fixes (toujours acceptés)
  if (LEGACY_CODES[code]) {
    const tier = LEGACY_CODES[code];
    rateLimitReset(ip);
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

  rateLimitReset(ip);
  return resp(200, { ok: true, tier: tier, meta: TIER_META[tier] });
};
