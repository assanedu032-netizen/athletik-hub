#!/usr/bin/env node
// Reconstruit l'index RAG côté production en appelant la function
// admin-build-index. Le token reste local (.env, gitignoré).
//
// Usage :
//   1. Crée un fichier .env à la racine (PAS commité) avec :
//        ADMIN_BUILD_TOKEN=ton_secret_exact_de_netlify
//        SITE_URL=https://athletikhub.netlify.app    (optionnel, défaut)
//   2. Lance : npm run rebuild-rag
//
// Le script affiche la réponse JSON et un summary.

'use strict';
const fs = require('fs');
const path = require('path');
const https = require('https');

// ── 1. Charge .env (parser minimal, pas de dépendance npm) ──
function loadDotenv() {
  const p = path.join(process.cwd(), '.env');
  if (!fs.existsSync(p)) return;
  const lines = fs.readFileSync(p, 'utf8').split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    // Strip surrounding quotes si présentes
    if ((val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}
loadDotenv();

const TOKEN = process.env.ADMIN_BUILD_TOKEN;
const SITE  = process.env.SITE_URL || 'https://athletikhub.netlify.app';

if (!TOKEN) {
  console.error('\n❌ ADMIN_BUILD_TOKEN absent.\n');
  console.error('Crée un fichier .env à la racine avec :\n');
  console.error('  ADMIN_BUILD_TOKEN=ton_secret_exact_de_netlify');
  console.error('\nLa valeur doit matcher EXACTEMENT la variable du même nom');
  console.error('dans Netlify > Site config > Environment variables.\n');
  process.exit(1);
}

// ── 2. Appel HTTPS direct (pas de dépendance) ──
const url = new URL(SITE + '/.netlify/functions/admin-build-index');
url.searchParams.set('token', TOKEN);

console.log('\n🚀 Reconstruction de l\'index RAG…');
console.log('   Site  : ' + SITE);
console.log('   Token : ' + TOKEN.slice(0, 4) + '…' + TOKEN.slice(-4) + ' (masqué)');
console.log('   ⏳ Le serveur chunke le livre + appelle OpenAI embeddings, ça peut prendre 30-60s.\n');

const started = Date.now();
const req = https.request(url, { method: 'GET', timeout: 120000 }, res => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    const elapsed = ((Date.now() - started) / 1000).toFixed(1);
    let data;
    try { data = JSON.parse(body); } catch (e) { data = null; }

    if (res.statusCode === 200 && data && data.ok) {
      console.log('✅ Index reconstruit avec succès.');
      console.log('   Chunks  : ' + data.chunks);
      console.log('   Built at: ' + (data.builtAt || '—'));
      console.log('   Durée   : ' + elapsed + 's\n');
      console.log('📚 Titan utilise désormais ton nouveau livre. Teste-le :');
      console.log('   "C\'est quoi la triple extension ?" → doit citer le Cours 5 avec une page.\n');
      process.exit(0);
    }

    console.error('❌ Échec (HTTP ' + res.statusCode + ', ' + elapsed + 's).');
    if (data && data.error) {
      console.error('   Erreur serveur : ' + data.error);
    } else {
      console.error('   Réponse brute  : ' + body.slice(0, 400));
    }
    console.error('');
    process.exit(2);
  });
});

req.on('timeout', () => {
  console.error('⏱  Timeout 120s. Le serveur n\'a pas répondu à temps.');
  console.error('   → Vérifie que le site est bien déployé et que les env vars sont OK.\n');
  req.destroy();
  process.exit(3);
});

req.on('error', err => {
  console.error('❌ Erreur réseau : ' + err.message + '\n');
  process.exit(4);
});

req.end();
