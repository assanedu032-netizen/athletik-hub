#!/usr/bin/env node
// scripts/gen-codes.js — Génère des codes d'accès signés HMAC pour Athletik Hub
//
// Usage :
//   ACCESS_CODE_SECRET="ton-secret-long-et-aleatoire" node scripts/gen-codes.js <tier> <count>
//
// Exemples :
//   ACCESS_CODE_SECRET=xxxxx node scripts/gen-codes.js beta 100
//   ACCESS_CODE_SECRET=xxxxx node scripts/gen-codes.js vip 50
//   ACCESS_CODE_SECRET=xxxxx node scripts/gen-codes.js master 10
//
// IMPORTANT :
//   Le ACCESS_CODE_SECRET doit être IDENTIQUE à celui défini dans
//   Netlify → Site config → Environment variables.
//   Génère-le une fois avec : node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"

const crypto = require('crypto');

const TIER_LETTER = { beta: 'B', vip: 'V', master: 'M' };
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sans 0/O/1/I/L pour éviter confusion

const SECRET = process.env.ACCESS_CODE_SECRET;
if (!SECRET) {
  console.error('ERROR: défini la variable ACCESS_CODE_SECRET avant de lancer ce script.');
  console.error('Ex: ACCESS_CODE_SECRET="..." node scripts/gen-codes.js beta 10');
  process.exit(1);
}

const tier  = (process.argv[2] || '').toLowerCase();
const count = parseInt(process.argv[3] || '10', 10);

if (!TIER_LETTER[tier] || !Number.isFinite(count) || count < 1) {
  console.error('Usage: ACCESS_CODE_SECRET=xxx node scripts/gen-codes.js <beta|vip|master> <count>');
  process.exit(1);
}

const letter = TIER_LETTER[tier];

function randomPart(n) {
  let s = '';
  for (let i = 0; i < n; i++) {
    s += ALPHABET[crypto.randomInt(0, ALPHABET.length)];
  }
  return s;
}

function check(letter, rand) {
  return crypto.createHmac('sha256', SECRET)
    .update(letter + '-' + rand)
    .digest('hex').toUpperCase().slice(0, 4);
}

console.log('# ' + count + ' codes ' + tier.toUpperCase() + ' générés le ' + new Date().toISOString());
const seen = new Set();
let generated = 0;
while (generated < count) {
  const r = randomPart(6);
  if (seen.has(r)) continue;
  seen.add(r);
  const c = check(letter, r);
  console.log(letter + '-' + r + '-' + c);
  generated++;
}
