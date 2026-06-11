#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
// scripts/gen-book-challenges.js
// ────────────────────────────────────────────────────────────────────────────
// Régénère data/book-challenges.js à partir d'un seed local en clair
// (bookChallengesSeed.json, gitignored). Le seed contient les réponses brutes
// pour Alassane ; ce script les normalise + (optionnel) les hashe avec HMAC.
//
// Usage :
//   1. Copier bookChallengesSeed.example.json → bookChallengesSeed.json
//   2. Modifier les réponses si besoin
//   3. node scripts/gen-book-challenges.js
//
// Mode HMAC (v2 — recommandé pour la prod) :
//   ACCESS_CODE_SECRET=$(cat .env.local | grep ACCESS_CODE_SECRET | cut -d= -f2) \
//     node scripts/gen-book-challenges.js --hash
//
//   En mode --hash, data/book-challenges.js contient des `acceptedHash` au lieu
//   de `accepted`. La fonction book-challenge.js gère les deux schémas.
// ════════════════════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const SEED_PATH = path.join(ROOT, 'bookChallengesSeed.json');
const OUT_PATH  = path.join(ROOT, 'data', 'book-challenges.js');

const HASH_MODE = process.argv.includes('--hash');

function normalizeAnswer(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[. \s]+/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function hmac(s, secret) {
  return crypto.createHmac('sha256', secret).update(s).digest('hex');
}

if (!fs.existsSync(SEED_PATH)) {
  console.error('❌ Seed introuvable :', SEED_PATH);
  console.error('   → Copie bookChallengesSeed.example.json vers bookChallengesSeed.json puis relance.');
  process.exit(1);
}

let secret;
if (HASH_MODE) {
  secret = process.env.ACCESS_CODE_SECRET;
  if (!secret) {
    console.error('❌ ACCESS_CODE_SECRET non défini.');
    console.error('   → Mode --hash requiert le secret HMAC en env. Lance avec :');
    console.error('     ACCESS_CODE_SECRET="xxx" node scripts/gen-book-challenges.js --hash');
    process.exit(1);
  }
}

const seed = JSON.parse(fs.readFileSync(SEED_PATH, 'utf8'));
const challenges = (seed.challenges || []).map(c => {
  const variants = Array.isArray(c.accepted) ? c.accepted : [c.answer];
  const out = {
    id: c.id,
    section: c.section,
    questionText: c.questionText,
    difficulty: c.difficulty || 'medium'
  };
  if (HASH_MODE) {
    out.acceptedHash = variants.map(v => hmac(normalizeAnswer(v), secret));
  } else {
    out.accepted = variants;
  }
  return out;
});

const banner = `// ════════════════════════════════════════════════════════════════════════════
// LDV_V1_STABLE_INTRO — généré par scripts/gen-book-challenges.js
// Mode : ${HASH_MODE ? 'HMAC' : 'clair (normalisation au compare-time)'}
// ${HASH_MODE ? 'Les réponses sont HMAC-SHA256(normalize(answer), ACCESS_CODE_SECRET)' : 'Les variantes acceptées sont en clair, normalisées au runtime.'}
// Ne pas éditer à la main — relancer le script si besoin de modifier.
// ════════════════════════════════════════════════════════════════════════════
`;

const content = banner + '\nmodule.exports = ' +
  JSON.stringify({ bookVersion: seed.bookVersion, challenges }, null, 2) + ';\n';

fs.writeFileSync(OUT_PATH, content);
console.log('✓ Écrit :', OUT_PATH, '(' + challenges.length + ' questions, mode=' + (HASH_MODE ? 'hash' : 'clair') + ')');
