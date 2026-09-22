#!/usr/bin/env node
/**
 * gen-book-excerpt.js — fabrique data/book-excerpt.js à partir du PDF de
 * l'extrait (44 premières pages des « Secrets de la Détente Verticale »).
 *
 *   node scripts/gen-book-excerpt.js <chemin/vers/extrait.pdf>
 *
 * Le PDF source ne vit PAS dans le dépôt : même motif que
 * `bookChallengesSeed.json`. Seul le texte extrait est commité, ce qui suffit
 * à l'app et évite de servir 1,3 Mo à chaque lecteur.
 *
 * Deux difficultés que ce script traite, et qu'il faut connaître avant d'y
 * toucher :
 *
 * 1. L'ENCODAGE EST CASSÉ DANS LES DEUX SENS. Le PDF vient d'un Mac. Selon les
 *    polices, un même fichier expose ses octets MacRoman comme du Latin-1
 *    (« DÈtente » pour « Détente ») OU l'inverse (« D…TENTE » pour
 *    « DÉTENTE »). On essaie donc les DEUX conversions sur chaque fragment et
 *    on garde celle qui produit le plus de français et le moins de charabia.
 *    Une conversion appliquée partout casserait les fragments déjà corrects —
 *    il y en a.
 *
 * 2. pdf.js DÉCOUPE LES MOTS. Recoller les fragments sans séparateur produit
 *    « C'estelle ». On insère donc une espace quand l'écart horizontal entre
 *    deux fragments dépasse un quart de cadratin.
 *
 * Dépendance : pdfjs-dist, installé à la demande et hors package.json —
 * `npm i --no-save pdfjs-dist@4.0.379`. Même parti pris que Playwright.
 */
const fs = require('fs');
const path = require('path');

const SRC = process.argv[2];
if (!SRC || !fs.existsSync(SRC)) {
  console.error('Usage : node scripts/gen-book-excerpt.js <extrait.pdf>');
  process.exit(1);
}
const OUT = path.join(__dirname, '..', 'data', 'book-excerpt.js');

// ── Tables MacRoman ↔ Latin-1, pour les deux sens de réparation ───────────
const MAC = 'ÄÅÇÉÑÖÜáàâäãåçéè'
          + 'êëíìîïñóòôöõúùûü'
          + '†°¢£§•¶ß®©™´¨≠ÆØ'
          + '∞±≤≥¥µ∂∑∏π∫ªºΩæø'
          + '¿¡¬√ƒ≈∆«»… ÀÃÕŒœ'
          + '–—“”‘’÷◊ÿŸ⁄€‹›ﬁﬂ'
          + '‡·‚„‰ÂÊÁËÈÍÎÏÌÓÔ'
          + 'ÒÚÛÙıˆ˜¯˘˙˚¸˝˛ˇ';
const macToOctet = new Map(); // caractère MacRoman -> son octet
for (let i = 0; i < MAC.length; i++) macToOctet.set(MAC[i], 0x80 + i);

function macVersLatin(s) { // le caractère EST du MacRoman, relis son octet en Latin-1
  let o = '';
  for (const ch of s) {
    const b = macToOctet.get(ch);
    o += (b !== undefined) ? String.fromCharCode(b) : ch;
  }
  return o;
}
function latinVersMac(s) { // l'octet Latin-1 doit être relu comme du MacRoman
  let o = '';
  for (const ch of s) {
    const c = ch.codePointAt(0);
    o += (c >= 0x80 && c <= 0xFF) ? MAC[c - 0x80] : ch;
  }
  return o;
}

const FR = /[éèêàçôîûùâëïüœÉÈÀÇÔÎÊ«»…–—’]/g;
const CHARABIA = /[ÈËÓ´ª‡˘Í…Ê∞ﬁ·°¿»]/g;
const qualite = (s) => (s.match(FR) || []).length - 3 * (s.match(CHARABIA) || []).length;

function repare(s) {
  let best = s, bq = qualite(s);
  for (const cand of [macVersLatin(s), latinVersMac(s)]) {
    const q = qualite(cand);
    if (q > bq) { best = cand; bq = q; }
  }
  return best
    .replace(/∞/g, '°')                                   // « Loi n∞1 » → « Loi n°1 »
    .replace(/(?<=[A-ZÀ-ÝŒ])»(?=[A-ZÀ-ÝŒ])/g, 'È');        // « MATI»RES » → « MATIÈRES »
}

const ENTETE = /^\s*Les Secrets de la D[ée]tente Verticale\s*$/i;

(async () => {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(fs.readFileSync(SRC)), useSystemFonts: true
  }).promise;

  const pages = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const items = (await (await doc.getPage(n)).getTextContent()).items
      .filter((i) => i.str)
      .map((i) => ({
        t: repare(i.str),
        h: Math.round(Math.abs(i.transform[3]) * 10) / 10,
        w: i.width || 0, x: i.transform[4], y: Math.round(i.transform[5])
      }));

    // Regrouper par ligne (ordonnée), de haut en bas
    const parY = new Map();
    for (const it of items) {
      if (!it.t.trim()) continue;
      if (!parY.has(it.y)) parY.set(it.y, []);
      parY.get(it.y).push(it);
    }
    const lignes = [];
    for (const y of [...parY.keys()].sort((a, b) => b - a)) {
      const its = parY.get(y).sort((a, b) => a.x - b.x);
      let txt = '';
      for (let k = 0; k < its.length; k++) {
        if (k > 0) {
          const fin = its[k - 1].x + its[k - 1].w;
          // pdf.js coupe les mots : sans ce test on obtient « C'estelle ».
          if (its[k].x - fin > its[k].h * 0.22 && !/\s$/.test(txt)) txt += ' ';
        }
        txt += its[k].t;
      }
      txt = txt.replace(/[ \t]+/g, ' ').trim();
      if (!txt || ENTETE.test(txt) || /^\d{1,3}$/.test(txt)) continue;
      lignes.push({ t: txt, h: Math.max(...its.map((i) => i.h)) });
    }

    // Lignes → blocs typés. Les paragraphes consécutifs se recollent.
    const blocs = [];
    for (const l of lignes) {
      const k = l.h >= 20 ? 'h1' : l.h >= 14.5 ? 'h2' : l.h >= 12.8 ? 'h3' : l.h >= 10.5 ? 'p' : 's';
      const prec = blocs[blocs.length - 1];
      if (prec && prec.k === k && (k === 'p' || k === 's')) {
        prec.t = /-$/.test(prec.t) ? prec.t.slice(0, -1) + l.t : prec.t + ' ' + l.t;
      } else {
        blocs.push({ k, t: l.t });
      }
    }
    pages.push({ p: n, b: blocs.map((b) => ({ k: b.k, t: b.t.replace(/\s+/g, ' ').trim() })).filter((b) => b.t) });
  }

  const json = JSON.stringify(pages);
  fs.writeFileSync(OUT,
    '// Généré par scripts/gen-book-excerpt.js — NE PAS ÉDITER À LA MAIN.\n'
    + '// Extrait des 44 premières pages de « Les Secrets de la Détente Verticale »\n'
    + '// (Alassane Ndiaye). Le PDF source vit hors du dépôt.\n'
    + 'window.BOOK_EXCERPT = ' + json + ';\n', 'utf8');

  const car = pages.reduce((a, p) => a + p.b.reduce((x, b) => x + b.t.length, 0), 0);
  console.log(`${pages.length} pages · ${pages.reduce((a, p) => a + p.b.length, 0)} blocs · ${car} caractères`);
  console.log(`→ ${OUT} (${(fs.statSync(OUT).size / 1024).toFixed(0)} Ko)`);
})().catch((e) => { console.error('ÉCHEC :', e.message); process.exit(1); });
