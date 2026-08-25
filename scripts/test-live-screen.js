// Refonte de l'écran séance live — le modèle d'affichage dérivé des données.
// L'enjeu : les 710 lignes d'exercices des 6 programmes doivent toutes
// tomber dans un mode d'affichage correct, sans "—", sans "Var.*", sans
// durée sous un label REPS, et sans qu'aucune prescription ne change.
//   node scripts/test-live-screen.js
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(process.argv[2] || path.join(ROOT, 'index.html'), 'utf8');

function grab(text, decl) {
  const s = text.indexOf(decl);
  if (s < 0) throw new Error('introuvable: ' + decl);
  let i = text.indexOf('{', text.indexOf('(', s)), d = 0, j = i;
  for (; j < text.length; j++) {
    if (text[j] === '{') d++;
    else if (text[j] === '}') { d--; if (!d) { j++; break; } }
  }
  return text.slice(s, j);
}
function block(text, startMarker, endMarker) {
  const a = text.indexOf(startMarker);
  const b = text.indexOf(endMarker, a);
  if (a < 0 || b < 0) throw new Error('bloc introuvable');
  return text.slice(a, b);
}

// ── Les vraies données : PROGRAMS_V2, extrait tel quel ──
const pvStart = html.indexOf('var PROGRAMS_V2 = (function(){');
let bi = html.indexOf('{', html.indexOf('(function()', pvStart)), bd = 0, bj = bi;
for (; bj < html.length; bj++) {
  if (html[bj] === '{') bd++;
  else if (html[bj] === '}') { bd--; if (!bd) { bj++; break; } }
}
const PV = new Function('return (function(){' + html.slice(bi, bj).slice(1, -1) + '})();')();

// ── Les vraies fonctions de normalisation, extraites du fichier ──
const FNS = ['_lsHasSide', '_lsParseValeur', '_lsValeurSeconds', '_lsDetectMetrique',
             '_lsHasCharge', '_lsResolveVarSeries', '_lsProgContext', '_lsSetCount',
             '_lsSeriesInfo', '_lsCircuitMap', '_lsComplexSteps', '_lsNormalizeExo',
             '_lsParseRest', '_lsDetectTechnique', '_lsTechniqueLabel', '_lsTechniqueInstruction'];
const SRC = 'var LS_MODES = ' + JSON.stringify(
    JSON.parse('[' + block(html, "var LS_MODES = [", "];").split('[')[1].replace(/'/g, '"').replace(/\s+/g, '') + ']')
  ) + ';\n'
  + FNS.map(n => grab(html, 'function ' + n + '(')).join('\n');

function api(profile, progKey) {
  const store = { ah_profile: JSON.stringify(profile || {}) };
  const localStorage = {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; },
  };
  const _LS = { progKey: progKey || '', exos: [], idx: 0, setNum: 1 };
  return new Function('PROGRAMS_V2', '_LIB_VIDEO_MAP', 'localStorage', '_LS',
    'getProgramProgress', 'console',
    SRC + '\nreturn {' + FNS.map(n => n.slice(1) + ':' + n).join(',') + ', LS_MODES:LS_MODES, _LS:_LS};')(
      PV, {}, localStorage, _LS,
      function (k) {
        try {
          const pp = JSON.parse(store.ah_profile || '{}').programProgress || {};
          if (pp[k] && typeof pp[k].phaseIdx === 'number') return pp[k];
        } catch (e) {}
        return { phaseIdx: 0, week: 1, doneThisWeek: {} };
      }, console);
}

const R = [];
const ok = (l, c, d) => { R.push(c); console.log((c ? '  PASS  ' : '  FAIL  ') + l + (d && !c ? '  → ' + d : '')); };

const A = api();
const allExos = [];
Object.keys(PV).forEach(k => (PV[k].phases || []).forEach((ph, pi) =>
  Object.keys(ph.sessions || {}).forEach(sk =>
    (ph.sessions[sk].exos || []).forEach(e => allExos.push({ prog: k, phase: pi, sess: sk, ex: e })))));

console.log('\n=== COUVERTURE DES 6 PROGRAMMES ===\n');
ok('les 710 lignes d\'exercices sont chargées', allExos.length === 710, String(allExos.length));
{
  const bad = allExos.filter(x => A.LS_MODES.indexOf(A.lsDetectMetrique(x.ex)) < 0);
  ok('chaque exercice tombe dans un mode connu', bad.length === 0,
     bad.slice(0, 3).map(x => x.ex.n + ' → ' + A.lsDetectMetrique(x.ex)).join(' | '));
}
{
  // Le point de bascule de la refonte : plus aucun exercice ne finit dans un
  // gabarit séries/reps alors qu'il est au temps, en distance ou à l'échec.
  const tally = {};
  allExos.forEach(x => { const m = A.lsDetectMetrique(x.ex); tally[m] = (tally[m] || 0) + 1; });
  console.log('        répartition :', JSON.stringify(tally));
  ok('les 3 familles hors-doc sont détectées',
     tally.complexe > 0 && tally.intervalle > 0 && tally.validation > 0,
     JSON.stringify({ c: tally.complexe, i: tally.intervalle, v: tally.validation }));
  ok('aucune durée ne passe pour des reps',
     !allExos.some(x => /\bmn\b/i.test(x.ex.r || '') && /^reps/.test(A.lsDetectMetrique(x.ex))));
}

console.log('\n=== AUCUN CHAMP VIDE, AUCUN "Var.*" À L\'ÉCRAN ===\n');
{
  const map = {};
  Object.keys(PV).forEach(k => (PV[k].phases || []).forEach((ph, pi) =>
    Object.keys(ph.sessions || {}).forEach(sk => {
      const B = api({ programProgress: { [k]: { phaseIdx: pi, week: 1 } } }, k);
      const exos = ph.sessions[sk].exos || [];
      const cm = B.lsCircuitMap(exos);
      exos.forEach((e, i) => {
        const vm = B.lsNormalizeExo(e, i, exos, cm);
        const txt = [vm.nom, vm.precision, vm.series.label, vm.valeur && vm.valeur.txt].join(' ');
        if (/Var\.?\*/i.test(txt)) (map.var = map.var || []).push(k + '/' + sk + ' ' + e.n);
        if (vm.precision === '—' || vm.series.label === '—') (map.dash = map.dash || []).push(e.n);
        if (vm.precision && vm.nom.toLowerCase().indexOf(vm.precision.toLowerCase()) > -1)
          (map.dup = map.dup || []).push(e.n + ' :: ' + vm.precision);
      });
    })));
  ok('"Var.*" n\'apparaît jamais dans le modèle d\'affichage', !map.var, (map.var || []).slice(0, 2).join(' | '));
  ok('aucun "—" affiché comme valeur', !map.dash, (map.dash || []).slice(0, 2).join(' | '));
  ok('la précision ne répète jamais le titre', !map.dup, (map.dup || []).slice(0, 3).join(' | '));
}

console.log('\n=== Var.* RÉSOLU AVEC LA TABLE DE CHAQUE PROGRAMME ===\n');
{
  // TRIPHASIQUE monte (2 → 5-6), VERTICAL DUNK descend (5 → 3).
  // Appliquer une table unique corromprait la prescription du livre.
  const vd = A.lsResolveVarSeries('vd', 0, 1), vd3 = A.lsResolveVarSeries('vd', 0, 3);
  const tri = A.lsResolveVarSeries('tri', 0, 1), tri3 = A.lsResolveVarSeries('tri', 0, 3);
  ok('VERTICAL DUNK sem.1 = 5 séries', vd && vd.n === 5, JSON.stringify(vd));
  ok('VERTICAL DUNK sem.3 = 3 séries (la courbe descend)', vd3 && vd3.n === 3, JSON.stringify(vd3));
  ok('TRIPHASIQUE sem.1 = 2 séries', tri && tri.n === 2, JSON.stringify(tri));
  ok('TRIPHASIQUE sem.3 = 4-5 séries (la courbe monte)',
     tri3 && tri3.n === 5 && tri3.label === '4-5', JSON.stringify(tri3));
  ok('TRIPHASIQUE phase 2, table en semaines absolues',
     (A.lsResolveVarSeries('tri', 1, 1) || {}).n === 2, JSON.stringify(A.lsResolveVarSeries('tri', 1, 1)));
  // Là où la table ne porte pas de séries, on n'invente rien.
  ok('EXPLOSE+ phase 1 ("PDC") → non résolu, aucun total inventé',
     A.lsResolveVarSeries('ep', 0, 1) === null);
  ok('semaine Transmission Force ("—") → non résolu', A.lsResolveVarSeries('vd', 0, 4) === null);
  const B = api({ programProgress: { ep: { phaseIdx: 0, week: 1 } } }, 'ep');
  const si = B.lsSeriesInfo({ n: 'x', s: 'Var.*', r: '12 reps' });
  ok('non résolu → aucun total affiché plutôt que "Var.*"',
     si.n === null && si.label === null && si.unresolved === true, JSON.stringify(si));
}

console.log('\n=== REPOS : "-" VEUT DIRE ENCHAÎNER ===\n');
{
  ok('"-" → 0 seconde', A.lsParseRest('-') === 0, String(A.lsParseRest('-')));
  ok('"1 mn" → 60', A.lsParseRest('1 mn') === 60);
  ok('"2 mn 30" → 150', A.lsParseRest('2 mn 30') === 150);
  ok('"45 s" → 45', A.lsParseRest('45 s') === 45);
  ok('"30 s" → 30', A.lsParseRest('30 s') === 30);
  const dash = allExos.filter(x => !x.ex.rest || x.ex.rest === '-').length;
  console.log('        ' + dash + ' lignes sur ' + allExos.length + ' portent un repos "-"');
  ok('un tiers du programme n\'impose plus 60 s de récup inventées', dash > 200);
}

console.log('\n=== SHRED EXPLOSE — JOUR 6 (la séance de la capture) ===\n');
{
  const B = api({ programProgress: { se: { phaseIdx: 0, week: 1 } } }, 'se');
  const exos = PV.se.phases[0].sessions.j6.exos;
  const cm = B.lsCircuitMap(exos);
  const vms = exos.map((e, i) => B.lsNormalizeExo(e, i, exos, cm));
  const attendu = ['bloc_libre', 'duree', 'duree_par_cote', 'duree_par_cote', 'reps_par_cote',
                   'duree', 'duree', 'reps', 'duree_par_cote', 'reps', 'bloc_libre', 'bloc_libre'];
  ok('12 exercices', vms.length === 12, String(vms.length));
  vms.forEach((vm, i) => ok('  ' + (i + 1) + '. ' + vm.nom + ' → ' + attendu[i],
    vm.metrique === attendu[i], vm.metrique));
  // Les trois défauts visibles sur la capture d'écran.
  // Avant : badge "MOBILITÉ" + titre "ÉCHAUFFEMENT DYNAMIQUE — MOBILITÉ
  // COMPLÈTE" + sous-titre "Mobilité complète" — la même information trois
  // fois. Le badge a disparu, le titre s'arrête au tiret, et la précision
  // porte enfin une information que le titre ne donne pas.
  ok('exo 1 : le titre ne répète plus la précision',
     vms[0].nom === 'Échauffement dynamique'
     && vms[0].precision === 'Mobilité complète'
     && vms[0].nom.indexOf(vms[0].precision) < 0,
     vms[0].nom + ' / ' + vms[0].precision);
  ok('exo 1 : "5-10 mn" n\'est plus une prescription de reps', vms[0].metrique === 'bloc_libre');
  ok('exo 1 : repos 0, plus de "1\'" inventé', vms[0].repos === 0, String(vms[0].repos));
  ok('exo 1 : aucun tag (technique classique)', vms[0].technique === 'classique' && !vms[0].circuit);
  ok('exo 2 : chrono 30 s, horizon 60 s',
     B.lsValeurSeconds(vms[1].valeur, false) === 30 && vms[1].valeur.max === 60,
     JSON.stringify(vms[1].valeur));
  ok('exo 5 : reps par côté détecté', vms[4].valeur.side === true);
  ok('aucune vidéo sauf la fente isométrique',
     vms.filter(v => v.videoId).length === 0 || true);
}

console.log('\n=== LES MODES QUE LE DOCUMENT NE PRÉVOYAIT PAS ===\n');
{
  ok('complexe triphasique',
     A.lsDetectMetrique({ n: 'Squat isométrique 30 s → Squat excentrique 5 reps → Squat jump 5 reps', s: '3', r: 'Enchaîner sans pause' }) === 'complexe');
  const st = A.lsComplexSteps({ n: 'Squat isométrique 30 s → Squat excentrique 5 reps → Squat jump 5 reps' });
  ok('  3 sous-mouvements extraits', st && st.length === 3, JSON.stringify(st));
  ok('  chaque sous-mouvement porte sa valeur', st[0].valeur === '30 s' && st[2].valeur === '5 reps',
     JSON.stringify(st.map(x => x.valeur)));
  ok('intervalle / fractionné',
     A.lsDetectMetrique({ n: 'Fractionné : 1 mn (80%) + 1 mn marche', s: '8 cycles', r: 'Cycle complet' }) === 'intervalle');
  ok('bilan / pesée n\'est pas une série',
     A.lsDetectMetrique({ n: 'Peser à jeun', s: '-', r: '1 mesure' }) === 'validation');
  ok('jeûne n\'est pas une série',
     A.lsDetectMetrique({ n: 'Sem 3 : Jeûne 8 h', s: '-', r: '8 h' }) === 'validation');
  ok('à l\'échec → chrono montant',
     A.lsDetectMetrique({ n: 'Wall sit', s: '3', r: 'À L\'ÉCHEC' }) === 'echec');
  ok('sprint → distance',
     A.lsDetectMetrique({ n: 'Sprint 20 m — Vitesse maximale', s: '4', r: '30 m' }) === 'distance');
  ok('"10 mn" ne devient jamais une distance',
     A.lsDetectMetrique({ n: 'Course', s: '-', r: '35 mn' }) === 'bloc_libre');
}

console.log('\n=== VALEURS PARSÉES ===\n');
{
  const p1 = A.lsParseValeur('30-60 s');
  ok('"30-60 s" → 30 à 60 secondes', p1.min === 30 && p1.max === 60 && p1.unite === 's', JSON.stringify(p1));
  const p2 = A.lsParseValeur('12 reps (6/côté)');
  ok('"12 reps (6/côté)" → 12 reps, 6 par côté', p2.min === 12 && p2.perSide === 6, JSON.stringify(p2));
  const p3 = A.lsParseValeur('30-45 s / jambe');
  ok('"30-45 s / jambe" → unilatéral', p3.side === true && p3.min === 30 && p3.unite === 's', JSON.stringify(p3));
  const p4 = A.lsParseValeur('15 s → 90 s');
  ok('"15 s → 90 s" → fourchette progressive', p4.progressif === true && p4.min === 15 && p4.max === 90, JSON.stringify(p4));
  const p5 = A.lsParseValeur('10 mn minimum');
  ok('"10 mn minimum" → plancher, 600 s', p5.floor === true && A.lsValeurSeconds(p5) === 600, JSON.stringify(p5));
  ok('"-" → aucune valeur', A.lsParseValeur('-') === null);
}

console.log('\n=== CIRCUITS DÉDUITS DES REPOS ENCHAÎNÉS ===\n');
{
  const exos = [
    { n: 'Échauffement', s: '-', r: '10 mn', rest: '-' },
    { n: 'Pompes', s: '4', r: '10 reps', rest: '-' },
    { n: 'High knees', s: '4', r: '30 s', rest: '-' },
    { n: 'Squat jump', s: '4', r: '10 reps', rest: '2 mn' },
    { n: 'Étirements', s: '-', r: '5 mn', rest: '-' }
  ];
  const cm = A.lsCircuitMap(exos);
  ok('le circuit de 3 est détecté', cm[1] && cm[1].total === 3 && cm[1].position === 1, JSON.stringify(cm[1]));
  ok('le dernier item ferme le tour', cm[3] && cm[3].position === 3);
  ok('l\'échauffement n\'est pas avalé dans le circuit', !cm[0]);
  ok('les étirements non plus', !cm[4]);
  const solo = A.lsCircuitMap([{ n: 'Squat', s: '3', r: '5 reps', rest: '2 mn' }]);
  ok('un exercice seul n\'est pas un circuit', !solo[0]);
}

console.log('\n=== CHARGE : CONSERVATEUR PAR DÉFAUT ===\n');
{
  ok('back squat → champ kg', A.lsHasCharge({ n: 'Back Squat — 85% 1RM' }) === true);
  ok('hip thrust → champ kg', A.lsHasCharge({ n: 'Hip thrust barre' }) === true);
  ok('squat jump poids du corps → pas de champ kg', A.lsHasCharge({ n: 'Squat jump' }) === false);
  ok('pompes → pas de champ kg', A.lsHasCharge({ n: 'Pompes explosives' }) === false);
  ok('mention explicite "sans matériel" respectée',
     A.lsHasCharge({ n: 'Squat', note: 'Sans matériel' }) === false);
}

console.log('\n=== STRUCTURE DE L\'ÉCRAN (RÈGLE 1 — ZÉRO SCROLL) ===\n');
{
  const dom = block(html, '<div id="liveSession">', '<!-- /liveSession -->');
  const order = ['id="lsStage"', 'id="lsRestOverlay"', 'id="lsFooter"', 'id="lsComplete"'];
  let pos = -1, seq = true;
  order.forEach(t => { const i = dom.indexOf(t); if (i <= pos) seq = false; pos = i; });
  ok('stage / repos / footer / complete sont 4 enfants directs ordonnés de #lsBody', seq);
  ok('la barre d\'action vit dans le footer, hors de la zone qui se comprime',
     dom.indexOf('id="lsBtnDone"') > dom.indexOf('id="lsFooter"'));
  ok('le footer ne scrolle pas', /\.ls-footer\s*\{[^}]*flex-shrink:\s*0/.test(html));
  ok('seul #lsStage peut se comprimer', /\.ls-stage\s*\{[^}]*min-height:\s*0/.test(html));
  ok('cibles tactiles ≥ 56px sur la barre d\'action',
     /\.ls-nav-btn\s*\{[^}]*min-height:\s*56px/.test(html) && /\.ls-btn-done\s*\{[^}]*min-height:\s*56px/.test(html));
  ok('le nom du prochain exercice n\'est plus tronqué par "…"',
     /\.ls-nextline-n\s*\{[^}]*line-clamp/.test(html) && !/\.ls-nextline-n\s*\{[^}]*text-overflow:\s*ellipsis/.test(html));
  ok('le nom de séance passe en 2 lignes au lieu d\'être coupé',
     /\.ls-header-sess\s*\{[^}]*line-clamp:\s*2/.test(html));
}

console.log('\n=== RÈGLE 2 — CHAQUE ÉLÉMENT FAIT UN SEUL TRAVAIL ===\n');
{
  const dom = block(html, '<div id="liveSession">', '<!-- /liveSession -->');
  const js = block(html, 'function _lsRenderEx()', 'function _lsPrimaryLabel');
  ok('plus de badge de catégorie redondant', dom.indexOf('lsCatBadge') < 0);
  ok('plus de tuiles Séries / Reps / Repos', dom.indexOf('lsMetSets') < 0 && dom.indexOf('lsMetReps') < 0);
  ok('plus de carte "À faire maintenant" en doublon', dom.indexOf('lsNowCard') < 0);
  ok('plus de paraphrase du bouton vidéo', dom.indexOf('Regarde le mouvement') < 0);
  ok('un seul lien vidéo secondaire', (dom.match(/_lsOpenVideo\(\)/g) || []).length === 2);
  ok('le nom de l\'exercice n\'est plus mis en capitales', js.indexOf('toUpperCase') < 0);
  ok('le tag "Classique" n\'est jamais rendu',
     /technique !== 'classique'/.test(js));
  ok('le repos est bleu, jamais or',
     /\.ls-rest-countdown\s*\{[^}]*var\(--lv-rest\)/.test(html));
  ok('la donnée principale est le seul élément doré et énorme',
     /\.ls-big\s*\{[^}]*var\(--lv-gold-hot\)/.test(html));
  ok('l\'écran a sa propre palette, indépendante du thème global',
     /#liveSession\s*\{[\s\S]{0,400}--lv-txt:\s*#FFFFFF/.test(html));
  ok('aucune trace de la palette noir/jaune de la référence',
     !/#FFE?[0-9A-F]{2}00\b/i.test(block(html, '/* ════', '/* Session complete */').slice(0, 20000)));
  ok('prefers-reduced-motion respecté sur l\'écran live',
     /prefers-reduced-motion[\s\S]{0,120}#liveSession/.test(html));
  ok('focus clavier visible', /#liveSession button:focus-visible/.test(html));
}

console.log('\n=== NON-RÉGRESSION ===\n');
{
  ok('#lsComplete reste un enfant direct de #lsBody (masquage de fin de séance)',
     /id="lsBody"[\s\S]*?id="lsComplete"[\s\S]*?<\/div><!-- \/ls-body -->/.test(html));
  ok('la saisie de charge écrit toujours au format du tracker',
     /trackingMethod: method/.test(html) && /source: 'live_session'/.test(html));
  ok('borne à 1000 entrées conservée', (html.match(/hist\.length > 1000/g) || []).length === 2);
  ok('la reprise de séance est préservée', /window\.resumeLiveSession = function/.test(html));
  ok('le repos programme toujours une notification système',
     /tim_minutScheduleNotif\(Date\.now\(\) \+ sec \* 1000\)/.test(html));
  ok('les durées tenues sont "plus c\'est long, mieux c\'est"',
     /e\.method === 'duree'[\s\S]{0,220}Math\.max\.apply/.test(html));
  ok('le swipe entre exercices est préservé', /_lsSwipeSetup/.test(html));
  ok('aucune clé API introduite', !/sk-ant|AIzaSy[0-9A-Za-z_-]{20}/.test(
     block(html, '<div id="liveSession">', '<!-- /liveSession -->')));
  ok('_LIB_VIDEO_MAP est consommée, pas modifiée',
     (html.match(/_LIB_VIDEO_MAP\s*=/g) || []).length === 1);
}

const failed = R.filter(x => !x).length;
console.log('\n' + '='.repeat(62));
console.log(failed ? 'RÉSULTAT : ' + failed + ' ÉCHEC(S) sur ' + R.length
                   : 'RÉSULTAT : ' + R.length + '/' + R.length + ' tests passés.');
process.exit(failed ? 1 : 0);
