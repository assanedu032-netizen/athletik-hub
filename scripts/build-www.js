#!/usr/bin/env node
// scripts/build-www.js — construit le dossier PUBLIÉ de l'application.
//
// POURQUOI : Netlify publiait la racine du dépôt (`publish = "."`). Tout ce qui
// s'y trouvait était donc téléchargeable par n'importe qui — y compris le livre
// complet (data/livre.md) et les réponses des questions d'activation
// (data/book-challenges.js), qui ne servent qu'aux fonctions serveur.
//
// PRINCIPE : une LISTE D'AUTORISATION, jamais une liste d'exclusion. Un fichier
// ajouté demain au dépôt n'est PAS publié tant qu'on ne l'a pas listé ici. Une
// liste d'exclusion ferait l'inverse : le premier fichier sensible oublié
// partirait en ligne sans que personne ne le voie.
//
// GARDE-FOU : après la copie, chaque fichier local référencé par les pages
// publiées doit exister dans le dossier produit. Sinon la construction ÉCHOUE —
// et Netlify ne publie jamais une construction en échec : le site en ligne
// reste sur la version précédente au lieu d'afficher une page cassée.
//
// Le même dossier servira à l'application mobile (Capacitor, `webDir`).
//
//   node scripts/build-www.js            → ./www
//   node scripts/build-www.js <dossier>  → <dossier> (utilisé par les tests)
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.resolve(process.argv[2] || path.join(ROOT, 'www'));

// ── Ce qui est publié — et rien d'autre ─────────────────────────────────────
const FICHIERS = [
  'index.html',
  'landing.html',
  'download.html',
  'manifest.json',
  'sw.js',
  'firebase-messaging-sw.js',
  'ciqual-data.js',
  // data/ : liste EXPLICITE, fichier par fichier. Le dossier contient aussi le
  // livre complet et les réponses d'activation, réservés aux fonctions serveur.
  'data/book-audio.js',
  'data/book-excerpt.js',
  'data/elite-athlete-program.js',
  'data/explose-plus-program.js',
  'data/microtraining-program.js',
  'data/shred-explose-program.js',
  'data/triphasique-program.js',
  'data/vertical-dunk-program.js',
];
// Dossiers de médias publiés en entier (images de recettes construites par
// concaténation, sons, audio du livre…). Aucun n'abrite de fichier sensible.
const DOSSIERS = ['icons', 'images', 'assets'];

// Ne doivent JAMAIS se retrouver dans le dossier publié. Vérifié à la fin, en
// plus de la liste d'autorisation : une seconde ceinture.
const INTERDITS = [
  'data/livre.md',
  'data/book-challenges.js',
  'bookChallengesSeed.json',
  'bookChallengesSeed.example.json',
  '.env',
  '.env.example',
  'CLAUDE.md',
  'netlify',
  'scripts',
  'docs',
  'openspec',
  'node_modules',
  'athletik_hub_modular',
  'package.json',
  'firestore.rules',
];

function copier(src, dst) {
  const st = fs.statSync(src);
  if (st.isDirectory()) {
    fs.mkdirSync(dst, { recursive: true });
    for (const nom of fs.readdirSync(src)) copier(path.join(src, nom), path.join(dst, nom));
  } else {
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(src, dst);
  }
}

// Références locales d'une page : src/href/url(), chaînes "/dossier/…" et
// fichiers racine (*.js, *.json, *.html…). Les URL externes sont ignorées.
function references(texte) {
  const out = new Set();
  const motifs = [
    /(?:src|href|content)\s*=\s*["']\/?((?:icons|images|assets|data)\/[^"'?#\s>]+)["'?#]/g,
    /url\(\s*["']?\/?((?:icons|images|assets|data)\/[^"')?#\s]+)/g,
    /["']\/((?:icons|images|assets|data)\/[^"'?#\s]+)["']/g,
    /(?:src|href)\s*=\s*["']\/?([\w.-]+\.(?:html|js|json|webmanifest))["'?#]/g,
    /["']\/([\w.-]+\.(?:html|js|json))["']/g,
  ];
  for (const re of motifs) {
    let m;
    while ((m = re.exec(texte))) {
      const p = decodeURIComponent(m[1]);
      // Gabarits dynamiques (« images/recipes/' + id + '.webp ») : on ne peut
      // pas les résoudre statiquement — le dossier entier est publié pour eux.
      if (/['"+${}]/.test(p)) continue;
      out.add(p);
    }
  }
  return out;
}

function construire() {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });

  const manquants = [];
  for (const f of FICHIERS.concat(DOSSIERS)) {
    const src = path.join(ROOT, f);
    if (!fs.existsSync(src)) { manquants.push(f); continue; }
    copier(src, path.join(OUT, f));
  }
  if (manquants.length) throw new Error('Fichiers de la liste absents du dépôt : ' + manquants.join(', '));

  // ── Garde-fou 1 : rien d'interdit n'a été publié ─────────────────────────
  const fuites = INTERDITS.filter((f) => fs.existsSync(path.join(OUT, f)));
  if (fuites.length) throw new Error('Fichiers interdits dans le dossier publié : ' + fuites.join(', '));

  // ── Garde-fou 2 : tout ce que les pages chargent est bien publié ─────────
  const pages = ['index.html', 'landing.html', 'download.html', 'sw.js', 'manifest.json', 'firebase-messaging-sw.js'];
  const casses = [];
  for (const page of pages) {
    const texte = fs.readFileSync(path.join(OUT, page), 'utf8');
    for (const ref of references(texte)) {
      if (!fs.existsSync(path.join(OUT, ref))) casses.push(page + ' → ' + ref);
    }
  }
  if (casses.length) {
    throw new Error('Références vers des fichiers non publiés :\n  ' + casses.join('\n  ') +
      '\nAjoute-les à FICHIERS dans scripts/build-www.js (s\'ils doivent être publics).');
  }

  let n = 0, octets = 0;
  (function compter(d) {
    for (const nom of fs.readdirSync(d)) {
      const p = path.join(d, nom), st = fs.statSync(p);
      if (st.isDirectory()) compter(p); else { n++; octets += st.size; }
    }
  })(OUT);
  console.log('[build-www] ' + n + ' fichiers, ' + (octets / 1048576).toFixed(1) + ' Mo → ' + path.relative(ROOT, OUT) || OUT);
}

try { construire(); }
catch (e) { console.error('[build-www] ÉCHEC — ' + e.message); process.exit(1); }
