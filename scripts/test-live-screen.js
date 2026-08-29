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
             '_lsTechniqueInstruction', '_lsCoachingCue', '_lsObjectifTxt', '_lsScoreLabel',
             '_lsFindVideo', '_lsVideoKey', '_ahNum', '_ahResolveMethod'];
// Les constantes de l'écran live sont extraites telles quelles : les
// hardcoder ici ferait diverger le test du code qu'il prétend vérifier.
const CONSTS = ['LS_MODES', 'LS_TAG_TECHNIQUES', 'LS_JARGON', 'LS_RPE_STEPS', 'LS_RPE_WORDS',
                '_lsVideoIndex', 'AH_METHODS', 'LS_TEXT_TO_METHOD']
  .map(n => {
    const i = html.indexOf('\nvar ' + n + ' = ');
    if (i < 0) throw new Error('constante introuvable: ' + n);
    // AH_METHODS contient des fonctions, donc des ';' : on équilibre les
    // accolades au lieu de couper au premier point-virgule.
    const eq = html.indexOf('=', i) + 1;
    let k = eq;
    while (html[k] === ' ' || html[k] === '\n') k++;
    const open = html[k];
    if (open === '{' || open === '[') {
      const close = open === '{' ? '}' : ']';
      let d = 0, j = k, str = null;
      for (; j < html.length; j++) {
        const c = html[j];
        if (str) { if (c === '\\') j++; else if (c === str) str = null; continue; }
        if (c === '"' || c === "'") { str = c; continue; }
        if (c === open) d++;
        else if (c === close) { d--; if (!d) { j++; break; } }
      }
      return html.slice(i + 1, j) + ';';
    }
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
    SRC + '\nreturn {' + FNS.map(n => n.slice(1) + ':' + n).join(',') + ', LS_MODES:LS_MODES, AH_METHODS:AH_METHODS, _LS:_LS};')(
      PV, VIDEO_MAP, localStorage, _LS,
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

// La vraie table de vidéos, pour vérifier la résolution.
const VIDEO_MAP = (function () {
  const i = html.indexOf('{', html.indexOf('var _LIB_VIDEO_MAP = {'));
  let d = 0, j = i;
  for (; j < html.length; j++) { if (html[j] === '{') d++; else if (html[j] === '}') { d--; if (!d) { j++; break; } } }
  return new Function('return ' + html.slice(i, j))();
})();
const A = api();
const LS_MODES_LIST = A.LS_MODES;
const allExos = [];
Object.keys(PV).forEach(k => (PV[k].phases || []).forEach((ph, pi) =>
  Object.keys(ph.sessions || {}).forEach(sk =>
    (ph.sessions[sk].exos || []).forEach(e => allExos.push({ prog: k, phase: pi, sess: sk, ex: e })))));

console.log('\n=== COUVERTURE DES 6 PROGRAMMES ===\n');
// 826 après la mise en conformité de SHRED EXPLOSE, TRIPHASIQUE et EXPLOSE+
// (régénérées depuis data/*.js) puis l'ajout des deux challenges manquants
// d'ELITE ATHLETE. 114 exercices prescrits ont été rétablis au total.
ok('les 826 lignes d\'exercices sont chargées', allExos.length === 826, String(allExos.length));
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
  // Le mode complexe n'a plus de données à rendre : les sources décrivent
  // les enchaînements triphasiques comme trois exercices distincts en
  // circuit, ce qui est plus juste qu'une ligne "A → B → C". Le mode reste
  // en place pour le Workout Builder et les séances perso.
  // Le livre fait tourner trois challenges sur les jours 1 / 3 / 5. Sans les
  // trois, deux séances sur trois n'ont aucun score à noter — donc aucune
  // mesure de progression sur ces jours-là.
  ok('la rotation des challenges est complète dans les deux programmes',
     tally.score === 4, String(tally.score));
  {
    const noms = allExos.filter(x => A.lsDetectMetrique(x.ex) === 'score')
                        .map(x => A.lsNormalizeExo(x.ex, 0, [], []).nom).sort();
    ok('  Bring Sally Up, Pompes max 2 mn et Burpees max 3 mn',
       noms.filter(n => /sally/i.test(n)).length === 2
       && noms.some(n => /pompes max/i.test(n)) && noms.some(n => /burpees max/i.test(n)),
       noms.join(' | '));
    ok('  le titre nomme le mouvement, pas "Challenge"',
       noms.every(n => n !== 'Challenge' && n.length > 8), noms.join(' | '));
    ok('  chacun sait quoi compter',
       A.lsScoreLabel('Challenge — Burpees max en 3 mn') === 'Burpees réalisés'
       && A.lsScoreLabel('Challenge — Pompes max en 2 mn') === 'Pompes réalisées');
  }
  ok('les familles intervalle et validation sont détectées',
     tally.intervalle > 0 && tally.validation > 0,
     JSON.stringify({ i: tally.intervalle, v: tally.validation }));
  ok('le mode complexe reste disponible même sans données programme',
     LS_MODES_LIST.indexOf('complexe') > -1);
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
  // Fourchette de repos : on décompte la borne basse, l'athlète rallonge.
  ok('"2-3 mn" → 120, la borne basse', A.lsParseRest('2-3 mn') === 120, String(A.lsParseRest('2-3 mn')));
  ok('"1-3 mn" → 60', A.lsParseRest('1-3 mn') === 60, String(A.lsParseRest('1-3 mn')));
  ok('"2 mn 30" reste correct après le resserrage', A.lsParseRest('2 mn 30') === 150);
  ok('"45 s" → 45', A.lsParseRest('45 s') === 45);
  ok('"30 s" → 30', A.lsParseRest('30 s') === 30);
  const dash = allExos.filter(x => !x.ex.rest || x.ex.rest === '-').length;
  console.log('        ' + dash + ' lignes sur ' + allExos.length + ' portent un repos "-"');
  ok('un tiers du programme n\'impose plus 60 s de récup inventées', dash > 200);
}

console.log('\n=== SHRED EXPLOSE — JOUR 6, CONFORME À LA SOURCE ===\n');
{
  const B = api({ programProgress: { se: { phaseIdx: 0, week: 1 } } }, 'se');
  const exos = PV.se.phases[0].sessions.j6.exos;
  const cm = B.lsCircuitMap(exos);
  const vms = exos.map((e, i) => B.lsNormalizeExo(e, i, exos, cm));
  const attendu = ['bloc_libre', 'duree', 'duree_par_cote', 'duree_par_cote',
                   'reps', 'reps_par_cote', 'reps', 'reps',
                   'reps', 'reps', 'duree', 'bloc_libre',
                   'duree_par_cote', 'reps_par_cote', 'bloc_libre'];
  ok('15 exercices, comme le programme les prescrit', vms.length === 15, String(vms.length));
  vms.forEach((vm, i) => ok('  ' + (i + 1) + '. ' + vm.nom + ' → ' + attendu[i],
    vm.metrique === attendu[i], vm.metrique));

  // Le circuit pliométrique 5→8 n'existait pas du tout dans l'app avant la
  // mise en conformité : les quatre exercices étaient absents.
  ok('le circuit pliométrique est détecté sur 4 exercices',
     cm[4] && cm[4].total === 4 && cm[4].position === 1 && cm[7].position === 4,
     JSON.stringify([cm[4], cm[7]]));
  ok('son repos de fin de tour vaut 2 mn', cm[7] && cm[7].roundRest === 120,
     String(cm[7] && cm[7].roundRest));
  ok('les exercices hors circuit n\'y sont pas avalés', !cm[3] && !cm[8]);
  ok('les préfixes 1) à 4) ne sont plus dans les noms affichés',
     vms.every(v => !/^\d\)/.test(v.nom)), vms.map(v => v.nom).find(n => /^\d\)/.test(n)));

  // Les trois défauts visibles sur la capture d'origine.
  ok('exo 1 : le titre ne répète plus la précision',
     vms[0].nom === 'Échauffement dynamique' && vms[0].precision === 'mobilité complète',
     vms[0].nom + ' / ' + vms[0].precision);
  ok('exo 1 : "10 mn" n\'est plus une prescription de reps', vms[0].metrique === 'bloc_libre');
  ok('exo 1 : repos 0, plus de "1\'" inventé', vms[0].repos === 0, String(vms[0].repos));
  ok('exo 2 : chrono 30 s, horizon 60 s',
     B.lsValeurSeconds(vms[1].valeur, false) === 30 && vms[1].valeur.max === 60,
     JSON.stringify(vms[1].valeur));
  ok('exo 6 : reps par côté, 6 de chaque',
     vms[5].valeur.perSide === 6 && vms[5].metrique === 'reps_par_cote',
     JSON.stringify(vms[5].valeur));
  ok('exo 12 : "10 mn minimum" reste un bloc, pas une série chronométrée',
     vms[11].metrique === 'bloc_libre' && vms[11].valeur.floor === true);
}

console.log('\n=== MOTEUR DE MÉTHODES — LE REGISTRE ===\n');
{
  const M = A.AH_METHODS;
  ok('les 7 méthodes du cahier des charges sont définies',
     ['classic','isometric','eccentric','rest_pause','drop_set','superset','circuit']
       .every(k => M[k] && M[k].id === k), Object.keys(M).join(', '));
  ok('chacune déclare les champs que le Builder doit afficher',
     Object.keys(M).every(k => Array.isArray(M[k].fields)),
     Object.keys(M).filter(k => !Array.isArray(M[k].fields)).join(', '));
  ok('isométrie impose un chrono', M.isometric.forceExecution === 'duree');
  ok('superset et circuit sont des blocs', M.superset.block === true && M.circuit.block === true);

  // expand() est la clé de l'extensibilité : une méthode se réduit à une
  // séquence d'étapes que l'écran sait déjà jouer.
  const rp = M.rest_pause.expand({ reps: 8, microRest: 15, blocks: [3, 2] });
  ok('rest-pause 8 → 15s → 3 → 15s → 2', rp.length === 5
     && rp[0].reps === 8 && rp[1].sec === 15 && rp[2].reps === 3
     && rp[3].sec === 15 && rp[4].reps === 2, JSON.stringify(rp));
  ok('sa micro-récup a une valeur par défaut',
     M.rest_pause.expand({ reps: 8, blocks: [3] })[1].sec === 15);
  ok('une config incomplète ne produit pas de séquence bancale',
     M.rest_pause.expand({ blocks: [3, 2] }) === null
     && M.rest_pause.expand({ reps: 8 }) === null);

  const ds = M.drop_set.expand({ drops: [
    { reps: 12, load: 60 }, { reps: 10, load: 45 }, { reps: 8, load: 30 } ] });
  ok('drop set 12/60 → drop → 10/45 → drop → 8/30', ds.length === 5
     && ds[0].load === 60 && ds[1].kind === 'drop' && ds[4].reps === 8, JSON.stringify(ds));
  ok('un drop set vide ne produit rien', M.drop_set.expand({ drops: [] }) === null);
  ok('classique et isométrie n\'ont pas de séquence',
     !M.classic.expand && !M.isometric.expand);
}

console.log('\n=== LA MÉTHODE PILOTE L\'EXÉCUTION ===\n');
{
  // Une isométrie déclarée impose un chrono, quelle que soit la forme du
  // texte — c'est tout l'objet du moteur : ne plus dépendre du libellé.
  const iso = A.lsNormalizeExo(
    { n: 'Pompe', s: '3', r: '25 s', rest: '1 mn', method: { id: 'isometric' } }, 0, [], []);
  ok('exercice + méthode isométrique → mode chrono', iso.metrique === 'duree', iso.metrique);
  ok('le nom ne porte plus la méthode', iso.nom === 'Pompe');
  ok('la consigne vient du registre', /Tiens la position/.test(iso.consigne), iso.consigne);

  const rp = A.lsNormalizeExo({ n: 'Développé couché', s: '3', r: '8 reps', rest: '2 mn',
    method: { id: 'rest_pause', reps: 8, microRest: 15, blocks: [3, 2] } }, 0, [], []);
  ok('une méthode à séquence impose le mode sequence', rp.metrique === 'sequence', rp.metrique);
  ok('et la séquence est prête à jouer', rp.method.steps.length === 5);

  const ecc = A.lsNormalizeExo({ n: 'Traction', s: '4', r: '5 reps', rest: '2 mn',
    method: { id: 'eccentric', tempoDown: 5 } }, 0, [], []);
  ok('excentrique reste en reps', ecc.metrique === 'reps');
  ok('et porte son tempo', ecc.tempo && ecc.tempo.down === 5, JSON.stringify(ecc.tempo));

  // Le même exercice, quatre méthodes, un seul nom : c'est le §2 du brief.
  const noms = ['classic','isometric','eccentric','rest_pause'].map(id =>
    A.lsNormalizeExo({ n: 'Pompe', s: '3', r: '10 reps', rest: '1 mn',
      method: { id: id, reps: 8, microRest: 15, blocks: [2] } }, 0, [], []).nom);
  ok('un exercice, plusieurs méthodes, un seul nom',
     noms.every(n => n === 'Pompe'), noms.join(' | '));
}

console.log('\n=== RÉTROCOMPATIBILITÉ : RIEN N\'A BOUGÉ ===\n');
{
  ok('sans méthode déclarée, l\'exercice est classique',
     A.ahResolveMethod({ n: 'Squat', s: '3', r: '10 reps' }).id === 'classic');
  ok('et rien n\'est marqué comme déclaré',
     A.ahResolveMethod({ n: 'Squat', s: '3', r: '10 reps' }).declared === false);
  // La détection textuelle d'avant continue de servir de repli.
  ok('une isométrie écrite dans le nom est encore reconnue',
     A.ahResolveMethod({ n: 'Squat isométrique (90°)', s: '4', r: '30 s' }).id === 'isometric');
  ok('un cluster écrit dans la valeur aussi',
     A.ahResolveMethod({ n: 'Pompes diamant', s: '4', r: '2-3 reps cluster' }).id === 'rest_pause');
  ok('mais le repli ne force jamais le mode',
     A.lsNormalizeExo({ n: 'Squat isométrique (90°)', s: '4', r: '30-60 s', rest: '1 mn' },
       0, [], []).metrique === 'duree');
  // Le point qui compte : les 826 exercices actuels ne changent pas de mode.
  const declared = allExos.filter(x => x.ex.method).length;
  ok('aucun exercice des programmes ne déclare encore de méthode', declared === 0,
     String(declared));
  ok('une méthode inconnue retombe sur classique',
     A.ahResolveMethod({ n: 'Squat', method: { id: 'inexistante' } }).id === 'classic');
}

console.log('\n=== HISTORIQUE : LA PROGRESSION N\'EST PAS CASSÉE ===\n');
{
  ok('le détail de méthode part dans un champ distinct',
     /function _lsQuickLog\(nom, essai, method, rpe, training\)/.test(html));
  ok('il ne touche pas au type de mesure lu par _ahTrackValue',
     /trackingMethod: method, method: method/.test(html) && /training: training \|\| null/.test(html));
  ok('un rest-pause s\'enregistre comme une série comparable',
     /reps: tot \}, 'charge', 0, \{/.test(html));
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
     && /\.ls-ex-meta\s*\{[\s\S]{0,200}min-height: 20px/.test(html));
  ok('les tags partagent la ligne du sous-titre, ils ne créent pas de ligne',
     /<div class="ls-ex-meta">[\s\S]{0,220}id="lsExPrecision"[\s\S]{0,120}id="lsTags"/.test(html));
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
  // Une seule affectation : la déclaration. Rien n'écrit dans la table.
  ok('_LIB_VIDEO_MAP est consommée, pas modifiée',
     (html.match(/^\s*var _LIB_VIDEO_MAP = \{/gm) || []).length === 1
     && !/_LIB_VIDEO_MAP\s*\[[^\]]+\]\s*=/.test(html));
  // Un écart de casse ou un suffixe entre parenthèses ratait des vidéos qui
  // existent. Le résolveur tolère les deux, sans toucher à la table.
  ok('la casse ne fait plus rater une vidéo',
     !!A.lsFindVideo('Power clean') && A.lsFindVideo('Power clean') === VIDEO_MAP['Power Clean'],
     String(A.lsFindVideo('Power clean')));
  ok('un suffixe entre parenthèses non plus',
     !!A.lsFindVideo('Saut survitesse'));
  ok('un préfixe de circuit non plus',
     A.lsFindVideo('3) Depth jump') === A.lsFindVideo('Depth Jump'));
  ok('un exercice sans vidéo n\'en invente pas une',
     A.lsFindVideo('Exercice qui n\'existe pas') === null);
}

const failed = R.filter(x => !x).length;
console.log('\n' + '='.repeat(62));
console.log(failed ? 'RÉSULTAT : ' + failed + ' ÉCHEC(S) sur ' + R.length
                   : 'RÉSULTAT : ' + R.length + '/' + R.length + ' tests passés.');
process.exit(failed ? 1 : 0);
