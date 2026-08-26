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
             '_lsParseRest', '_lsDetectTechnique', '_lsTechniqueLabel',
             '_lsTechniqueInstruction', '_lsCoachingCue', '_lsObjectifTxt', '_lsScoreLabel'];
// Les constantes de l'écran live sont extraites telles quelles : les
// hardcoder ici ferait diverger le test du code qu'il prétend vérifier.
const CONSTS = ['LS_MODES', 'LS_TAG_TECHNIQUES', 'LS_JARGON', 'LS_RPE_STEPS', 'LS_RPE_WORDS']
  .map(n => {
    const i = html.indexOf('\nvar ' + n + ' = ');
    if (i < 0) throw new Error('constante introuvable: ' + n);
    const j = html.indexOf(';\n', i);
    return html.slice(i + 1, j + 1);
  }).join('\n');
const SRC = CONSTS + '\n' + FNS.map(n => grab(html, 'function ' + n + '(')).join('\n');

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
// 712 depuis la mise en conformité du Jour 1 de SHRED : quatre exercices
// prescrits qui manquaient ont été rétablis, deux lignes hors programme
// retirées.
ok('les 712 lignes d\'exercices sont chargées', allExos.length === 712, String(allExos.length));
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
  ok('"2 mn 30" → 150', A.lsParseRest('2 mn 30') === 150, String(A.lsParseRest('2 mn 30')));
  // Le nombre doit suivre immédiatement les minutes : "2 mn après les 4"
  // veut dire 2 minutes, pas 2 mn 04.
  ok('"2 mn après les 4" → 120, pas 124',
     A.lsParseRest('2 mn après les 4') === 120, String(A.lsParseRest('2 mn après les 4')));
  ok('"1 mn 30" → 90', A.lsParseRest('1 mn 30') === 90, String(A.lsParseRest('1 mn 30')));
  ok('"2 mn 30" reste correct après le resserrage', A.lsParseRest('2 mn 30') === 150);
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
  // Un tag ne s'affiche que s'il change la MANIÈRE d'exécuter la série.
  // "Classique" ne dit rien, et "Isométrie" sur 1 exercice sur 5 créait une
  // hiérarchie fantôme : soit un tag informe, soit il n'existe pas.
  ok('le tag "Classique" n\'est jamais rendu',
     /LS_TAG_TECHNIQUES\.indexOf\(vm\.technique\) > -1/.test(js)
     && !/LS_TAG_TECHNIQUES = \[[^\]]*classique/.test(html));
  // §3 · aucune technique ne porte de tag : seule la STRUCTURE en porte un.
  ok('aucun tag de technique n\'est rendu',
     /var LS_TAG_TECHNIQUES = \[\];/.test(html));
  ok('le jargon de programmation ne sort jamais à l\'écran',
     A.lsNormalizeExo({ n: 'Pompes diamant — cluster', s: '4', r: '2-3 reps cluster', rest: '-' },
                      0, [], []).precision === ''
     && !/cluster/i.test(A.lsNormalizeExo({ n: 'Pompes diamant — cluster', s: '4', r: '2-3 reps cluster', rest: '-' },
                      0, [], []).nom));
  ok('les préfixes "1)" disparaissent du nom affiché',
     A.lsNormalizeExo({ n: '2) Superman hold — lombaires', s: '3', r: '30 s', rest: '-' },
                      0, [], []).nom === 'Superman hold');
  ok('un challenge se saisit en score, pas en chrono',
     A.lsDetectMetrique({ n: 'Bring Sally Up — Chanson « Flower » de Moby', s: '1', r: 'Suivre la chanson' }) === 'score');
  ok('le libellé du score nomme le mouvement',
     A.lsScoreLabel('Bring Sally Up') === 'Pompes réalisées'
     && A.lsScoreLabel('Burpees max 3 mn') === 'Burpees réalisés');
  ok('la consigne vient de la note du programme, jamais du jargon',
     A.lsCoachingCue({ note: '2) Lombaires' }, 'classique', '') === ''
     && A.lsCoachingCue({ note: 'Puissance rotative sur chaque répétition' }, 'classique', '')
        === 'Puissance rotative sur chaque répétition');
  ok('une technique classique ne produit aucune consigne',
     A.lsCoachingCue({ note: '' }, 'classique', '') === '');
  ok('la consigne ne répète jamais le sous-titre',
     A.lsCoachingCue({ note: 'Bouteilles ou poids léger' }, 'classique', 'Bouteilles ou poids léger') === '');
  {
    // Le sous-titre vient du nom quand il y en a un, la note longue passe
    // en consigne : les deux ne peuvent plus porter le même texte.
    var bsu = A.lsNormalizeExo({ n: 'Bring Sally Up — Chanson « Flower » de Moby', s: '1',
      r: 'Suivre la chanson', rest: '-',
      note: 'Rotation des challenges : Bring Sally Up → Pompes max 2 mn → Burpees max 3 mn (J1/J3/J5).' },
      0, [], []);
    ok('Bring Sally Up : titre, sous-titre et consigne sont trois textes distincts',
       bsu.nom === 'Bring Sally Up'
       && bsu.precision === 'Chanson « Flower » de Moby'
       && bsu.consigne.indexOf('Rotation des challenges') === 0
       && bsu.precision !== bsu.consigne,
       JSON.stringify({ n: bsu.nom, p: bsu.precision, c: bsu.consigne.slice(0, 30) }));
    ok('et son mode est le score, pas une consigne géante', bsu.metrique === 'score');
  }
  ok('une seule barre de progression : les tirets',
     html.indexOf('ls-topbar') < 0 && /id="lsDashes"/.test(html));
  ok('plus de lien "Noter ma charge"', html.indexOf('Noter ma charge') < 0);
  ok('le champ kg n\'existe que si l\'exercice se charge',
     /vm\.charge \? _lsStepperHtml\('load'/.test(html));
  ok('plus d\'objectif contradictoire sous le chrono',
     html.indexOf('objectif de la phase') < 0 && /minimum · pousse jusqu/.test(html));
  ok('le score de fin de séance est explicité',
     /function _seFbScoreDetail\(/.test(html) && /exercices sur/.test(html));
  ok('le message de fin n\'est plus présenté comme une citation de Titan',
     !/font-style:italic">"' \+ titanMsg/.test(html));
  ok('l\'écart titre → donnée est plafonné',
     /\.ls-mode::before\s*\{[^}]*max-height:\s*80px/.test(html));
  ok('le bloc vidéo ne disparaît jamais',
     /\.ls-video-wrap\.ls-video-empty \.ls-video-soon\s*\{\s*display: block/.test(html)
     && !/vw\.style\.display = 'none'/.test(html));
  ok('la place du titre est réservée pour que le layout ne saute pas',
     /\.ls-ex-name\s*\{[\s\S]{0,400}min-height: 60px/.test(html)
     && /\.ls-ex-precision\s*\{[\s\S]{0,240}min-height: 17px/.test(html));
  ok('le nom de l\'exercice se lit à bout de bras',
     /\.ls-ex-name\s*\{[\s\S]{0,200}font-size: 25px/.test(html)
     && /\.ls-ex-name\s*\{[\s\S]{0,120}font-weight: 700/.test(html));
  ok('l\'écran de fin lit les tokens de l\'écran live, pas le thème global',
     /\.ls-celebrate-msg\{[^}]*color:#FFFFFF/.test(html)
     && /\.ls-nextstep-txt\{[^}]*color:#FFFFFF/.test(html)
     && !/\.ls-complete-sub \{[^}]*var\(--text2\)/.test(html));
  // Critère mécanique : canal B − canal R ≥ 35 sur le fond.
  ok('le fond est visiblement bleu (B − R ≥ 35)', (function () {
    var m = html.match(/--lv-bg:#([0-9A-Fa-f]{6})/);
    if (!m) return false;
    var r = parseInt(m[1].slice(0, 2), 16), b = parseInt(m[1].slice(4, 6), 16);
    return b - r >= 35;
  })());
  ok('trois niveaux de surface distincts',
     /--lv-surface:#1E2E52/.test(html) && /--lv-elevated:#27395F/.test(html));
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
  ok('la saisie de perf écrit toujours au format du tracker',
     /trackingMethod: method/.test(html) && /source: 'live_session'/.test(html));
  // Un seul chemin d'écriture depuis la refonte : _lsQuickLog.
  ok('borne à 1000 entrées conservée', (html.match(/hist\.length > 1000/g) || []).length === 1);
  ok('un seul chemin d\'écriture des performances',
     (html.match(/function _lsQuickLog\(/g) || []).length === 1
     && html.indexOf('_lsSaveLog') < 0);
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
