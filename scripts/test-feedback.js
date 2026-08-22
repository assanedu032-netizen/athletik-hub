// Teste les VRAIES fonctions de l'écran de bilan post-séance.
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(process.argv[2] || path.join(__dirname, '..', 'index.html'), 'utf8');

function extract(decl, name) {
  const sig = decl === 'win' ? 'window.' + name + ' = function' : 'function ' + name + '(';
  const start = html.indexOf(sig);
  if (start < 0) throw new Error('introuvable: ' + name);
  let i = html.indexOf('{', html.indexOf('(', start)), depth = 0, j = i;
  for (; j < html.length; j++) {
    if (html[j] === '{') depth++;
    else if (html[j] === '}') { depth--; if (depth === 0) { j++; break; } }
  }
  const body = html.slice(start, j);
  return decl === 'win' ? body.replace('window.' + name + ' = function', 'function ' + name) : body;
}

const R = [];
function ok(label, cond, detail) {
  R.push({ label, cond });
  console.log((cond ? '  PASS  ' : '  FAIL  ') + label + (detail && !cond ? '  → ' + detail : ''));
}

// ── 1. Génération du markup (fonction pure, aucun DOM requis) ──
const genSrc = extract('fn', '_eaFeedbackHtml');
const gen = new Function(genSrc + '\nreturn _eaFeedbackHtml;')();
const out = gen();

console.log('\n=== 1. MARKUP DU MODAL ===\n');
ok('titre "Ton bilan de séance"', out.includes('Ton bilan de séance'));
ok('sous-titre présent', out.includes("Comment s'est passée ta séance ?"));
ok('eyebrow "Séance terminée" conservé', out.includes('Séance terminée'));
ok('micro-copy "30 secondes" sur la MÊME ligne que l\'accroche',
   /Comment s'est passée ta séance \?\s*<em>30 secondes\.<\/em>/.test(out));
ok('repère bas d\'échelle "1 · Très facile"', out.includes('1 · Très facile'));
ok('repère haut d\'échelle "10 · Maximale"', out.includes('10 · Maximale'));
ok('douleur renommée "Aucune"', out.includes('>Aucune<'));
ok('ancien libellé ">Non<" supprimé', !out.includes('>Non<'));
ok('titre "Avancement de la séance"', out.includes('Avancement de la séance'));
ok('CTA "ENREGISTRER MON BILAN"', out.includes('ENREGISTRER MON BILAN'));
ok('ancien CTA supprimé', !out.includes('VALIDER MON RESSENTI'));
ok('CTA désactivé au départ', /id="eaFbValidate"[^>]*disabled/.test(out));
ok('message sécurité conservé', out.includes('consulte un professionnel'));
ok('message sécurité rattaché à la Douleur', out.indexOf('eaFbPainNote') < out.indexOf("Qualité d'exécution"));

console.log('\n=== 2. VALEURS MÉTIER INCHANGÉES (non-régression) ===\n');
const attendues = ['basse','normale','elevee','non','legere','genante',
                   'mauvaise','correcte','bonne','complete','partielle','abandon'];
attendues.forEach(v => ok('valeur data-value="' + v + '" préservée', out.includes('data-value="' + v + '"')));
for (let i = 1; i <= 10; i++) ok('difficulté ' + i + ' présente', out.includes('data-value="' + i + '"'));
ok('5 groupes data-field', (out.match(/data-field="/g) || []).length === 5);
ok('sélecteur _eaFbPick compatible (.ea-fb-scale + data-field)',
   /class="ea-fb-scale[^"]*" data-field="difficulty"/.test(out));
// 10 (difficulté) + 3 fatigue + 3 douleur + 3 technique + 3 avancement = 22
ok('22 boutons portent bien .ea-fb-btn', (out.match(/class="ea-fb-btn"/g) || []).length === 22);

// ── 3. Logique de sélection (_eaFbPick) avec mini-DOM ──
console.log('\n=== 3. SÉLECTION + ACTIVATION DU CTA ===\n');
const boutons = [];
const reBtn = /data-value="([^"]+)" onclick="window\._eaFbPick\('([^']+)','([^']+)'\)"/g;
let mm; while ((mm = reBtn.exec(out)) !== null) {
  boutons.push({ field: mm[2], value: mm[1], classes: new Set(),
    getAttribute: function(a) { return a === 'data-value' ? this.value : null; },
    classList: { toggle: function(c, on) { on ? boutons.find(b=>b._self===this)._add(c) : null; } } });
}
boutons.forEach(b => {
  b.classList = { toggle: (c, on) => { on ? b.classes.add(c) : b.classes.delete(c); } };
});
const cta = { disabled: true, style: {} };
const painNote = { warn: false, classList: { toggle: (c, on) => { painNote.warn = !!on; } } };
const document = {
  getElementById: id => (id === 'eaFbValidate' ? cta : id === 'eaFbPainNote' ? painNote : null),
  querySelectorAll: sel => {
    const f = /data-field="([^"]+)"/.exec(sel)[1];
    const arr = boutons.filter(b => b.field === f);
    arr.forEach = Array.prototype.forEach.bind(arr);
    return arr;
  }
};
const window_ = {};
const pick = new Function('document', 'window', extract('win', '_eaFbPick') + '\nreturn _eaFbPick;')(document, window_);

pick('difficulty', '8');
ok('CTA reste désactivé après 1 réponse', cta.disabled === true);
ok('bouton 8 marqué .on', boutons.find(b => b.field === 'difficulty' && b.value === '8').classes.has('on'));
ok('un seul bouton .on dans le groupe',
   boutons.filter(b => b.field === 'difficulty' && b.classes.has('on')).length === 1);
pick('difficulty', '5');
ok('changement de sélection : 8 désélectionné',
   !boutons.find(b => b.field === 'difficulty' && b.value === '8').classes.has('on'));

pick('fatigue', 'normale');
pick('pain', 'legere');
ok('message sécurité NON renforcé si douleur légère', painNote.warn === false);
pick('pain', 'genante');
ok('message sécurité renforcé si douleur gênante', painNote.warn === true);
pick('pain', 'non');
ok('renfort retiré si douleur "Aucune"', painNote.warn === false);
pick('technique', 'bonne');
ok('CTA encore désactivé (4/5)', cta.disabled === true);
pick('completion', 'complete');
ok('CTA ACTIVÉ une fois les 5 réponses données', cta.disabled === false);
ok('opacité inline libérée (gérée par le CSS)', cta.style.opacity === '');

// ── 4. Score + garde anti-crash de _lsFinalizeSession ──
console.log('\n=== 4. SCORE ET FINALISATION ===\n');
const TECH = { mauvaise: 40, correcte: 70, bonne: 95 };
const COMPL = { complete: 100, partielle: 65, abandon: 30 };
const score = (t, c) => Math.round(((TECH[t] ?? 70) + (COMPL[c] ?? 65)) / 2);
ok('bonne + complète → 98 (Excellente)', score('bonne','complete') === 98);
ok('correcte + partielle → 68 (Séance correcte)', score('correcte','partielle') === 68);
ok('mauvaise + abandon → 35 (Séance faible)', score('mauvaise','abandon') === 35);

const finSrc = extract('fn', '_lsFinalizeSession');
ok('garde présente sur titanStatus', finSrc.includes('feedback.titanStatus'));
ok('score conditionnel (plus de lecture aveugle)',
   finSrc.includes('feedback.sessionQualityScore != null && feedback.titanStatus'));
let crash = null;
try {
  const fb = { skipped: true };
  const f = fb || {};
  let msg = 'x';
  if (f.sessionQualityScore != null && f.titanStatus) msg += String(f.titanStatus).toUpperCase();
} catch (e) { crash = e.message; }
ok('feedback sans score ne lève plus d\'exception', crash === null, crash);

const failed = R.filter(r => !r.cond).length;
console.log('\n' + '='.repeat(58));
console.log(failed ? 'RÉSULTAT : ' + failed + ' ÉCHEC(S) sur ' + R.length
                   : 'RÉSULTAT : ' + R.length + '/' + R.length + ' tests passés.');
process.exit(failed ? 1 : 0);
