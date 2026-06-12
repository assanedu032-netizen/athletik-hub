// ════════════════════════════════════════════════════════════════════════════
// VERTICAL DUNK — SOURCE DE VÉRITÉ DU PROGRAMME (data layer, non intégré UI)
// ────────────────────────────────────────────────────────────────────────────
// Construit à partir de (ordre de priorité en cas de conflit) :
//   1. Livre "Les Secrets de la Détente Verticale" (data/livre.md) — ton Titan
//   2. PDF "Programme Vertical Dunk" (uploadé 2026-06-12) — séances détaillées
//   3. Liste_maitre_exercices_BESOIN_v1.xlsx — noms canoniques + futurs slots vidéo
//   4. Intégration in-app actuelle (PROGRAMS_V2.vd dans index.html) — référence
//      de structure UX, NON source de vérité (le PDF prime).
//
// CE FICHIER N'EST PAS ENCORE BRANCHÉ DANS L'UI — étape de validation.
//
// ─── RÉSUMÉ DU PROGRAMME ────────────────────────────────────────────────────
// Nom         : VERTICAL DUNK
// Objectif    : Apprendre à dunker + augmenter la détente verticale
// Durée       : 10 semaines (2 phases : 4 + 6)
// Fréquence   : 4 jours / semaine
// Lieu        : Phase 1 = extérieur / sans matériel ; Phase 2 = salle recommandée
// Tests       : Squat 1RM + SDT 1RM obligatoires AVANT Phase 2.
//               Test de détente verticale en fin de Phase 1 (sem. 4) et Phase 2 (sem. 6).
// Compteurs   : 2 phases · 10 semaines · 8 séances-types (4 + 4) · 88 exercices uniques mappés
//
// ─── RÈGLES SPÉCIALES DOCUMENTÉES DANS LE PDF ───────────────────────────────
//   R1. Transmission Force = 9 mn OBLIGATOIRE en fin de chaque séance Phase 1 :
//       mouvements spécifiques à l'objectif à 100% (sauts, dunks, sprints, frappes).
//       En Phase 2 elle apparaît explicitement Jour 4 (6-12 mn de sauts libres).
//   R2. Semaine 4 de Phase 1 = Jours 1 & 3 = Transmission Force exclusive
//       (6-12 mn de sauts libres 100%), Jour 5 = Test de détente verticale (filmer).
//       Les autres jours suivent la structure normale mais volume réduit.
//   R3. Avant Phase 2 : Tests 1RM Squat + SDT obligatoires — déterminent les charges
//       de travail à 85% / 60% sur tout le bloc.
//   R4. 48h de repos minimum entre Jour 2 (force) et Jour 3 (force) en Phase 2.
//   R5. Test final fin Phase 2 : repos 2 jours avant, échauffement 15-20 mn,
//       3-5 essais, filmer + comparer avec test initial.
//
// ─── INCOHÉRENCES DÉTECTÉES (à confirmer avec le propriétaire) ──────────────
//   I1. Phase 2 — Organisation hebdo PDF page 7 met Jour 2 LUNDI…NON : Mercredi
//       et Jour 3 JEUDI (consécutifs). Mais la note bas page 8 dit "Respecter
//       48h de repos entre Jour 2 et Jour 3". Mer→Jeu = 24h, pas 48h.
//       → INCOHÉRENCE PDF interne. Solution probable : l'organisation devrait
//         être Mer Jour 2 + Ven Jour 3 (avec Jeu repos), pas Mer + Jeu.
//   I2. Phase 1 Semaine 4 : le PDF dit "Jour 1 & 3 = Transmission Force, Jour 5
//       = Test de détente" — mais l'organisation hebdo normale n'a pas de Jour 5
//       (séances = Lun J1 / Mer J2 / Ven J3 / Sam J4). Le "Jour 5" est sans doute
//       un jour supplémentaire dédié au test, à clarifier UX (insérer le test
//       en remplacement du Jour 4 normal ? Ou ajouter un Jour test après ?).
//   I3. Phase 2 SEM. 1-2 et SEM. 4-5 ont la même intensité (85% 1RM, 5 puis 4
//       séries). Le PDF présente ça comme "nouveau cycle de force" en sem. 4.
//       Pas une vraie incohérence, juste une re-application du même bloc.
//   I4. PROGRAMS_V2.vd actuel dans index.html : la structure est globalement
//       fidèle au PDF mais les compteurs sont approximatifs (pas de gestion
//       semaine 4 spéciale, pas de note 48h sur la phase 2). À aligner lors
//       de l'intégration.
//
// ─── VIDÉOS ────────────────────────────────────────────────────────────────
// Toutes les vidéos sont laissées en videoStatus="missing" pour l'instant.
// Quand l'Excel librairie maître sera dépouillé (binaire xlsx non lisible
// directement ici), il suffira de remplir videoUrl + passer le status à
// "available". Le code app NE DOIT PAS bloquer une séance pour vidéo manquante.
// ════════════════════════════════════════════════════════════════════════════

(function (root, factory) {
  var lib = factory();
  if (typeof module === 'object' && module.exports) module.exports = lib;
  if (root) root.VERTICAL_DUNK_PROGRAM = lib.program;
  if (root) root.VERTICAL_DUNK_LIB = lib;
})(typeof window !== 'undefined' ? window : null, function () {

  // ──────────────────────────────────────────────────────────────────────────
  // 1. LIBRAIRIE MAÎTRE — exercices utilisés par Vertical Dunk
  //    masterName = nom canonique (Excel "Liste_maitre_exercices_BESOIN_v1")
  //    category   = catégorie d'exercice
  //    videoUrl   = URL YouTube si disponible, sinon null → videoStatus auto
  //    pdfAliases = noms tels qu'ils apparaissent dans le PDF s'ils diffèrent
  // ──────────────────────────────────────────────────────────────────────────
  var VD_MASTER_EXERCISES = {
    // — Échauffement & étirements (génériques, partagés avec EA) —
    echauffement_dynamique_general:   { masterName: 'Échauffement dynamique général',           category: 'Échauffement',              videoUrl: null, generic: true },
    echauffement_general_mobilite:    { masterName: 'Échauffement général + mobilité',          category: 'Échauffement',              videoUrl: null, generic: true },
    echauffement_dynamique_activation:{ masterName: 'Échauffement dynamique + activation',      category: 'Échauffement',              videoUrl: null, generic: true },
    etirements_legers:                { masterName: 'Étirements légers',                        category: 'Récupération',              videoUrl: null, generic: true },
    etirements_hanches_quadriceps:    { masterName: 'Étirements — Focus hanches et quadriceps', category: 'Récupération',              videoUrl: null, generic: true },

    // — Pliométrie extensive —
    broad_jumps:                      { masterName: 'Broad jumps',                              category: 'Pliométrie',                videoUrl: null, pdfAliases: ['Broad jumps — bonds en avant'] },
    lateral_bounds:                   { masterName: 'Lateral bounds',                           category: 'Pliométrie',                videoUrl: null, pdfAliases: ['Lateral bounds — bonds latéraux'] },
    split_jumps:                      { masterName: 'Split jumps',                              category: 'Pliométrie',                videoUrl: null },

    // — Pliométrie intensive —
    depth_jumps:                      { masterName: 'Depth jumps',                              category: 'Pliométrie intensive',      videoUrl: null, pdfAliases: ['Depth jumps — Hauteur adaptée'] },
    box_squat_jumps:                  { masterName: 'Box squat jumps',                          category: 'Pliométrie intensive',      videoUrl: null, pdfAliases: ['Box squat jumps — assis-debout — Explosion max'] },

    // — Force excentrique (poids du corps) —
    nordic_hamstring:                 { masterName: 'Nordic hamstring',                         category: 'Force excentrique',         videoUrl: null, pdfAliases: ['Nordic hamstring — Contrôle excentrique'] },
    reverse_nordic:                   { masterName: 'Reverse nordic',                           category: 'Force excentrique',         videoUrl: null, pdfAliases: ['Reverse nordic — Renforcement quadriceps'] },

    // — Stato-dynamique —
    squat_stato_dynamique:            { masterName: 'Squat stato-dynamique',                    category: 'Stato-dynamique',           videoUrl: null, pdfAliases: ['Squat stato-dynamique — Iso profonde puis explosion'] },
    split_stance:                     { masterName: 'Split stance',                             category: 'Stato-dynamique',           videoUrl: null, pdfAliases: ['Split stance — Maintien fente profonde'] },
    fente_bulgare_stato_dyn:          { masterName: 'Fente bulgare stato-dynamique',            category: 'Stato-dynamique',           videoUrl: null, pdfAliases: ['Fente bulgare stato-dynamique — Iso profonde puis explosion'] },

    // — Mobilité & Coordination —
    carioca:                          { masterName: 'Carioca',                                  category: 'Mobilité & Coordination',   videoUrl: null },
    mobilite_mouv:                    { masterName: 'Mobilité mouv',                            category: 'Mobilité & Coordination',   videoUrl: null },
    quatre_vingt_dix_90:              { masterName: '90/90',                                    category: 'Mobilité & Coordination',   videoUrl: null },

    // — Travail du pied & cheville —
    elevation_orteils:                { masterName: 'Élévation orteils',                        category: 'Travail du pied',           videoUrl: null },
    travail_tibial_anterieur:         { masterName: 'Travail tibial antérieur',                 category: 'Travail du pied',           videoUrl: null },

    // — Sprint —
    sprint_20m:                       { masterName: 'Sprint 20 m',                              category: 'Vitesse',                   videoUrl: null, pdfAliases: ['Sprint 20 m — Vitesse maximale'] },

    // — Force avec barre (Phase 2) —
    montee_charge_progressive:        { masterName: 'Montée en charge progressive',             category: 'Force barre',               videoUrl: null, generic: true },
    squat_barre_explosive:            { masterName: 'Squat à la barre explosive',               category: 'Force barre',               videoUrl: null, pdfAliases: ['Squat à la barre explosive — Sem.1-2: 85% 1RM | Sem.3-6: 60% 1RM'] },
    power_clean:                      { masterName: 'Power clean',                              category: 'Force barre',               videoUrl: null, pdfAliases: ['Power clean — Charge légère, explosivité max'] },
    fente_bulgare:                    { masterName: 'Fente bulgare',                            category: 'Force barre',               videoUrl: null, pdfAliases: ['Fente bulgare — Poids du corps ou haltères'] },

    // — Gainage —
    l_sit:                            { masterName: 'L-sit',                                    category: 'Gainage',                   videoUrl: null, pdfAliases: ['L-sit (ou progression) — Maintien max', 'L-sit (ou progression)'] },
    barre_leve_genoux:                { masterName: 'Barre levé genoux',                        category: 'Gainage',                   videoUrl: null },

    // — Power rotation (Phase 2 Jour 4) —
    rotation_buste_extension_bras:    { masterName: 'Rotation buste et extension bras',         category: 'Power rotation',            videoUrl: null, pdfAliases: ['Rotation buste et extension bras — Explosivité rotative'] },
    rotation_buste_unipodal:          { masterName: 'Rotation buste unipodal',                  category: 'Power rotation',            videoUrl: null, pdfAliases: ['Rotation buste unipodal — Équilibre + rotation'] },

    // — Transmission Force —
    transmission_force_sauts_libres:  { masterName: 'Transmission Force — sauts libres 100%',   category: 'Transmission Force',        videoUrl: null, generic: true, pdfAliases: ['Sauts libres à 100% — EXPLOSIVITÉ MAXIMALE', 'Mouvements spécifiques à ton objectif — Intensité 100%'] }
  };

  // Helper de construction d'un exercice — applique la convention de schéma
  // demandée (exerciseId/exerciseName/category/blockType/sets/repsOrDuration/
  // rest/executionMode/intensity/technique/tempo/coachingCue/commonMistake/
  // videoTitle/videoUrl/videoStatus).
  //
  // Les champs technique / coachingCue / commonMistake / tempo viennent du
  // LIVRE et seront remplis au moment de l'intégration (non dispo dans le PDF
  // séances). Pour l'instant : null (transparent), pas inventé.
  function ex(opts) {
    var master = VD_MASTER_EXERCISES[opts.id] || {};
    return {
      exerciseId:      opts.id,
      exerciseName:    master.masterName || opts.name || opts.id,
      category:        master.category || opts.category || null,
      blockType:       opts.block || 'main',           // warmup / circuit / main / recovery / breathing / fasting / free-choice
      sets:            opts.sets || null,              // ex: 3, "3-4", "Var.*"
      repsOrDuration:  opts.reps || null,              // ex: "12-15 reps", "30 s", "8-10 mn"
      rest:            opts.rest || null,              // ex: "1 mn", "2 mn 30", null
      executionMode:   opts.mode || 'classique',       // enchaînement / repos-fin-tour / classique / continu / protocole
      intensity:       opts.intensity || null,         // ex: "85% 1RM", "100%", "Var.*"
      technique:       opts.technique || null,         // du LIVRE — null pour l'instant
      tempo:           opts.tempo || null,             // ex: "5-1-3", "1-0-X"
      coachingCue:     opts.cue || null,               // du LIVRE — null pour l'instant
      commonMistake:   opts.mistake || null,           // du LIVRE — null pour l'instant
      videoTitle:      master.masterName || opts.name || null,
      videoUrl:        master.videoUrl || null,
      videoStatus:     master.videoUrl ? 'available' : 'missing',
      // Note libre depuis le PDF (sub-titre exo) — utile UX
      note:            opts.note || null
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 2. SÉANCES — fidèles au PDF Vertical Dunk, page par page.
  //    Chaque session = { sessionId, sessionNumber, sessionTitle, sessionGoal,
  //    sessionType, estimatedDuration, requiredEquipment, isOptional,
  //    specialInstructions, titanIntroMessage, blocks[], exercises[],
  //    feedbackQuestions, adaptationRules }
  // ──────────────────────────────────────────────────────────────────────────

  // ─── PHASE 1 — VERTICAL TEST (4 semaines) ────────────────────────────────

  var p1_j1 = {
    sessionId:           'vd_p1_j1',
    sessionNumber:       1,
    sessionTitle:        'Jour 1 — Pliométrie extensive + Mobilité',
    sessionGoal:         'Poser les bases neuromusculaires : coordination, qualité d\'atterrissage, mobilité.',
    sessionType:         'pliometrie-extensive',
    estimatedDuration:   '45-60 min',
    requiredEquipment:   ['Sans matériel'],
    isOptional:          false,
    specialInstructions: 'Qualité de mouvement avant tout. À chaque saut, atterrir SOUPLE et silencieux. Si la fatigue dégrade la forme, arrête la série.',
    titanIntroMessage:   'On démarre. Première séance — tu apprends à bouger. Pas de records aujourd\'hui, juste de la qualité.',
    blocks: [
      { blockId: 'warmup',  blockType: 'warmup',  title: 'Échauffement' },
      { blockId: 'plio',    blockType: 'main',    title: 'Pliométrie extensive', executionMode: 'classique' },
      { blockId: 'mob',     blockType: 'main',    title: 'Mobilité & Coordination', executionMode: 'classique' },
      { blockId: 'pied',    blockType: 'main',    title: 'Travail du pied', executionMode: 'classique' },
      { blockId: 'cooldown',blockType: 'recovery',title: 'Étirements' }
    ],
    exercises: [
      ex({id:'echauffement_dynamique_general', block:'warmup',  sets:'-',     reps:'8-10 mn', rest:'-'}),
      ex({id:'broad_jumps',                    block:'plio',    sets:'Var.*', reps:'12-15 reps', rest:'1 mn', note:'Enchaîner sans pause'}),
      ex({id:'lateral_bounds',                 block:'plio',    sets:'Var.*', reps:'12-15 reps', rest:'1 mn', note:'Alternance gauche-droite'}),
      ex({id:'split_jumps',                    block:'plio',    sets:'Var.*', reps:'12-15 reps', rest:'1 mn', note:'Alterner les jambes'}),
      ex({id:'carioca',                        block:'mob',     sets:'3',     reps:'20 m aller-retour', rest:'45 s'}),
      ex({id:'mobilite_mouv',                  block:'mob',     sets:'3',     reps:'8 reps', rest:'45 s'}),
      ex({id:'quatre_vingt_dix_90',            block:'mob',     sets:'3',     reps:'8 reps / côté', rest:'45 s'}),
      ex({id:'elevation_orteils',              block:'pied',    sets:'3',     reps:'15 reps', rest:'30 s'}),
      ex({id:'travail_tibial_anterieur',       block:'pied',    sets:'3',     reps:'15 reps', rest:'30 s'}),
      ex({id:'etirements_legers',              block:'cooldown',sets:'-',     reps:'5-10 mn', rest:'-'})
    ],
    feedbackQuestions: ['difficulty', 'fatigue', 'pain', 'completed', 'comment'],
    adaptationRules: {
      titanCan: ['intensity', 'rest', 'variant', 'reps'],
      titanCannot: ['removeBlock', 'skipWarmup']
    }
  };

  var p1_j2 = {
    sessionId:           'vd_p1_j2',
    sessionNumber:       2,
    sessionTitle:        'Jour 2 — Pliométrie extensive & intensive + Mobilité',
    sessionGoal:         'Introduire la pliométrie intensive (depth/box jumps) + excentrique ischio/quadri.',
    sessionType:         'pliometrie-mixte',
    estimatedDuration:   '60-75 min',
    requiredEquipment:   ['Sans matériel', 'Box ou banc bas (optionnel)'],
    isOptional:          false,
    specialInstructions: 'Depth jumps : hauteur ADAPTÉE au niveau. Si tu ne peux pas rebondir aussitôt, baisse la hauteur. Nordic / Reverse nordic = contrôle excentrique, descente lente.',
    titanIntroMessage:   'Pliométrie intensive. La hauteur du depth jump = ton choix selon ta forme du jour. Mieux 30 cm propre que 60 cm bâclé.',
    blocks: [
      { blockId: 'warmup',     blockType: 'warmup', title: 'Échauffement' },
      { blockId: 'plio_ext',   blockType: 'main',   title: 'Pliométrie extensive', executionMode: 'classique' },
      { blockId: 'plio_int',   blockType: 'main',   title: 'Pliométrie intensive', executionMode: 'classique' },
      { blockId: 'excentrique',blockType: 'main',   title: 'Travail excentrique', executionMode: 'classique' },
      { blockId: 'mob',        blockType: 'main',   title: 'Mobilité & Coordination', executionMode: 'classique' },
      { blockId: 'pied',       blockType: 'main',   title: 'Travail du pied', executionMode: 'classique' },
      { blockId: 'cooldown',   blockType: 'recovery',title:'Étirements' }
    ],
    exercises: [
      ex({id:'echauffement_dynamique_general', block:'warmup',     sets:'-',     reps:'8-10 mn', rest:'-'}),
      ex({id:'broad_jumps',                    block:'plio_ext',   sets:'Var.*', reps:'12-15 reps', rest:'1 mn'}),
      ex({id:'split_jumps',                    block:'plio_ext',   sets:'Var.*', reps:'12-15 reps', rest:'1 mn'}),
      ex({id:'depth_jumps',                    block:'plio_int',   sets:'Var.*', reps:'6-8 reps', rest:'2 mn 30', note:'Hauteur adaptée'}),
      ex({id:'box_squat_jumps',                block:'plio_int',   sets:'Var.*', reps:'6-8 reps', rest:'2 mn 30', note:'Assis-debout — explosion max'}),
      ex({id:'nordic_hamstring',               block:'excentrique',sets:'Var.*', reps:'30 s → 1 mn 30', rest:'2 mn 30', note:'Contrôle excentrique'}),
      ex({id:'reverse_nordic',                 block:'excentrique',sets:'Var.*', reps:'30 s → 1 mn 30', rest:'2 mn 30', note:'Renforcement quadriceps'}),
      ex({id:'carioca',                        block:'mob',        sets:'3',     reps:'20 m aller-retour', rest:'45 s'}),
      ex({id:'mobilite_mouv',                  block:'mob',        sets:'3',     reps:'8 reps', rest:'45 s'}),
      ex({id:'quatre_vingt_dix_90',            block:'mob',        sets:'3',     reps:'8 reps / côté', rest:'45 s'}),
      ex({id:'elevation_orteils',              block:'pied',       sets:'3',     reps:'15 reps', rest:'30 s'}),
      ex({id:'travail_tibial_anterieur',       block:'pied',       sets:'3',     reps:'15 reps', rest:'30 s'}),
      ex({id:'etirements_legers',              block:'cooldown',   sets:'-',     reps:'5-10 mn', rest:'-'})
    ],
    feedbackQuestions: ['difficulty', 'fatigue', 'pain', 'completed', 'comment'],
    adaptationRules: { titanCan: ['intensity','rest','variant','reps','heightDepthJump'], titanCannot: ['removeBlock','skipWarmup'] }
  };

  // Jour 3 = idem Jour 1 structurellement (PDF page 5)
  var p1_j3 = Object.assign({}, p1_j1, {
    sessionId:     'vd_p1_j3',
    sessionNumber: 3,
    sessionTitle:  'Jour 3 — Pliométrie extensive + Mobilité (même structure que Jour 1)',
    sessionGoal:   'Répétition pédagogique : réancrer les patterns du Jour 1.',
    titanIntroMessage: 'Même structure que lundi. La répétition fait la maîtrise. Sois plus propre qu\'il y a 2 jours.'
  });

  var p1_j4 = {
    sessionId:           'vd_p1_j4',
    sessionNumber:       4,
    sessionTitle:        'Jour 4 — Pliométrie intensive + Stato-dynamique + Sprint 20 m',
    sessionGoal:         'Combinaison plio intensive + iso/explosion + travail de vitesse pure.',
    sessionType:         'plio-stato-sprint',
    estimatedDuration:   '60-75 min',
    requiredEquipment:   ['Sans matériel', 'Espace pour sprint 20 m'],
    isOptional:          false,
    specialInstructions: 'Stato-dynamique : tenir l\'isométrie au moins 6s en bas avant l\'explosion. Sprint 20m : 100% sur chaque essai, repos complet entre.',
    titanIntroMessage:   'Plus dense aujourd\'hui : plio + iso + sprint. Mets l\'intensité au max sur les sprints — c\'est ton transfert vers le terrain.',
    blocks: [
      { blockId: 'warmup',   blockType: 'warmup', title: 'Échauffement' },
      { blockId: 'plio_ext', blockType: 'main',   title: 'Pliométrie extensive' },
      { blockId: 'plio_int', blockType: 'main',   title: 'Pliométrie intensive' },
      { blockId: 'stato',    blockType: 'main',   title: 'Stato-dynamique' },
      { blockId: 'sprint',   blockType: 'main',   title: 'Sprint 20 m' },
      { blockId: 'pied',     blockType: 'main',   title: 'Travail du pied' },
      { blockId: 'cooldown', blockType: 'recovery',title:'Étirements' }
    ],
    exercises: [
      ex({id:'echauffement_dynamique_general', block:'warmup',   sets:'-',     reps:'8-10 mn', rest:'-'}),
      ex({id:'broad_jumps',                    block:'plio_ext', sets:'Var.*', reps:'12-15 reps', rest:'1 mn'}),
      ex({id:'split_jumps',                    block:'plio_ext', sets:'Var.*', reps:'12-15 reps', rest:'1 mn'}),
      ex({id:'depth_jumps',                    block:'plio_int', sets:'Var.*', reps:'6-8 reps',   rest:'2 mn 30'}),
      ex({id:'box_squat_jumps',                block:'plio_int', sets:'Var.*', reps:'6-8 reps',   rest:'2 mn 30'}),
      ex({id:'squat_stato_dynamique',          block:'stato',    sets:'Var.*', reps:'6 s min → explosion', rest:'2 mn 30'}),
      ex({id:'split_stance',                   block:'stato',    sets:'Var.*', reps:'30 s → 1 mn 30', rest:'2 mn 30'}),
      ex({id:'sprint_20m',                     block:'sprint',   sets:'4',     reps:'1 rep',     rest:'2 mn 30', intensity:'100%'}),
      ex({id:'elevation_orteils',              block:'pied',     sets:'3',     reps:'15 reps',   rest:'30 s'}),
      ex({id:'travail_tibial_anterieur',       block:'pied',     sets:'3',     reps:'15 reps',   rest:'30 s'}),
      ex({id:'etirements_legers',              block:'cooldown', sets:'-',     reps:'5-10 mn',   rest:'-'})
    ],
    feedbackQuestions: ['difficulty', 'fatigue', 'pain', 'completed', 'comment'],
    adaptationRules: { titanCan: ['intensity','rest','variant','reps'], titanCannot: ['removeBlock','skipWarmup'] }
  };

  // ─── PHASE 2 — VERTICAL DUNK (6 semaines) ────────────────────────────────

  var p2_j1 = {
    sessionId:           'vd_p2_j1',
    sessionNumber:       1,
    sessionTitle:        'Jour 1 — Pliométrie extensive et intensive + Mobilité',
    sessionGoal:         'Maintenir la qualité plio en parallèle du travail de force qui démarre cette semaine.',
    sessionType:         'pliometrie-mixte',
    estimatedDuration:   '60-75 min',
    requiredEquipment:   ['Sans matériel', 'Box ou banc bas (optionnel)'],
    isOptional:          false,
    specialInstructions: 'Cette séance assure le maintien neuromusculaire pendant que le bas du corps encaisse la force barre des jours 2 et 3.',
    titanIntroMessage:   'Plio aujourd\'hui. Garde la qualité élevée — c\'est ce qui maintient ton transfert vers le saut.',
    blocks: [
      { blockId: 'warmup',   blockType: 'warmup', title: 'Échauffement' },
      { blockId: 'plio_ext', blockType: 'main',   title: 'Pliométrie extensive' },
      { blockId: 'plio_int', blockType: 'main',   title: 'Pliométrie intensive' },
      { blockId: 'mob',      blockType: 'main',   title: 'Mobilité & Coordination' },
      { blockId: 'pied',     blockType: 'main',   title: 'Travail du pied' },
      { blockId: 'cooldown', blockType: 'recovery',title:'Étirements' }
    ],
    exercises: [
      ex({id:'echauffement_dynamique_general', block:'warmup',   sets:'-',     reps:'8-10 mn', rest:'-'}),
      ex({id:'broad_jumps',                    block:'plio_ext', sets:'Var.*', reps:'12-15 reps', rest:'1 mn'}),
      ex({id:'lateral_bounds',                 block:'plio_ext', sets:'Var.*', reps:'12-15 reps', rest:'1 mn'}),
      ex({id:'split_jumps',                    block:'plio_ext', sets:'Var.*', reps:'12-15 reps', rest:'1 mn'}),
      ex({id:'depth_jumps',                    block:'plio_int', sets:'Var.*', reps:'6-8 reps', rest:'2 mn 30'}),
      ex({id:'box_squat_jumps',                block:'plio_int', sets:'Var.*', reps:'6-8 reps', rest:'2 mn 30'}),
      ex({id:'carioca',                        block:'mob',      sets:'3',     reps:'20 m aller-retour', rest:'45 s'}),
      ex({id:'mobilite_mouv',                  block:'mob',      sets:'3',     reps:'8 reps', rest:'45 s'}),
      ex({id:'quatre_vingt_dix_90',            block:'mob',      sets:'3',     reps:'8 reps / côté', rest:'45 s'}),
      ex({id:'elevation_orteils',              block:'pied',     sets:'3',     reps:'15 reps', rest:'30 s'}),
      ex({id:'travail_tibial_anterieur',       block:'pied',     sets:'3',     reps:'15 reps', rest:'30 s'}),
      ex({id:'etirements_legers',              block:'cooldown', sets:'-',     reps:'5-10 mn', rest:'-'})
    ],
    feedbackQuestions: ['difficulty', 'fatigue', 'pain', 'completed', 'comment'],
    adaptationRules: { titanCan: ['intensity','rest','reps','variant'], titanCannot: ['removeBlock','skipWarmup'] }
  };

  var p2_j2 = {
    sessionId:           'vd_p2_j2',
    sessionNumber:       2,
    sessionTitle:        'Jour 2 — Force explosive (Squat + Power Clean + Fente bulgare)',
    sessionGoal:         'Construire la force explosive lourde — squat + clean — sur la fente bulgare en assistance.',
    sessionType:         'force-explosive',
    estimatedDuration:   '75-90 min',
    requiredEquipment:   ['Barre', 'Disques', 'Rack squat', 'Haltères (option)'],
    isOptional:          false,
    specialInstructions: 'Tests 1RM Squat + SDT DOIVENT être faits AVANT de démarrer la Phase 2. Charge = % du 1RM selon la semaine (85% sem 1-2, 60% sem 3, 85% sem 4-5, 60% sem 6). Respecter 48h avant la séance Jour 3.',
    titanIntroMessage:   'Force explosive. La charge te sert à exploser, pas à grinder. Si la barre ralentit, arrête la série.',
    blocks: [
      { blockId: 'warmup',  blockType: 'warmup', title: 'Échauffement + mobilité' },
      { blockId: 'rampup',  blockType: 'main',   title: 'Montée en charge' },
      { blockId: 'force',   blockType: 'main',   title: 'Force explosive (barre)' },
      { blockId: 'access',  blockType: 'main',   title: 'Accessoires + gainage' },
      { blockId: 'pied',    blockType: 'main',   title: 'Travail du pied' },
      { blockId: 'cooldown',blockType: 'recovery',title:'Étirements' }
    ],
    exercises: [
      ex({id:'echauffement_general_mobilite', block:'warmup', sets:'-',    reps:'10 mn',          rest:'-',   note:'Focus bas du corps'}),
      ex({id:'montee_charge_progressive',     block:'rampup', sets:'3-4',  reps:'5-3 reps',       rest:'1-2 mn'}),
      ex({id:'squat_barre_explosive',         block:'force',  sets:'Var.*',reps:'3 reps',         rest:'2 mn 30', intensity:'Sem.1-2: 85% 1RM | Sem.3: 60% 1RM | Sem.4-5: 85% 1RM | Sem.6: 60% 1RM'}),
      ex({id:'power_clean',                   block:'force',  sets:'Var.*',reps:'3 reps',         rest:'2 mn 30', intensity:'Charge légère — explosivité max'}),
      ex({id:'fente_bulgare',                 block:'force',  sets:'Var.*',reps:'8-12 reps / jambe', rest:'2 mn 30', note:'Poids du corps ou haltères'}),
      ex({id:'l_sit',                         block:'access', sets:'3',    reps:'À l\'échec',      rest:'1 mn', note:'Ou progression L-sit'}),
      ex({id:'barre_leve_genoux',             block:'access', sets:'3',    reps:'À l\'échec',      rest:'1 mn'}),
      ex({id:'elevation_orteils',             block:'pied',   sets:'3',    reps:'15 reps',         rest:'30 s'}),
      ex({id:'travail_tibial_anterieur',      block:'pied',   sets:'3',    reps:'15 reps',         rest:'30 s'}),
      ex({id:'etirements_hanches_quadriceps', block:'cooldown',sets:'-',   reps:'8 mn',            rest:'-'})
    ],
    feedbackQuestions: ['difficulty', 'fatigue', 'pain', 'completed', 'load', 'comment'],
    adaptationRules: { titanCan: ['load','rest','reps'], titanCannot: ['removeBlock','skipWarmup','changeIntensityRule'] }
  };

  var p2_j3 = {
    sessionId:           'vd_p2_j3',
    sessionNumber:       3,
    sessionTitle:        'Jour 3 — Force explosive (Squat + Power Clean + Fente stato-dynamique)',
    sessionGoal:         'Variante du Jour 2 : remplacer la fente bulgare classique par une fente bulgare stato-dynamique.',
    sessionType:         'force-explosive',
    estimatedDuration:   '75-90 min',
    requiredEquipment:   ['Barre', 'Disques', 'Rack squat'],
    isOptional:          false,
    specialInstructions: '48h MINIMUM après le Jour 2 (cf. R4). La fente bulgare devient stato-dynamique : tenir 6s minimum en bas avant l\'explosion.',
    titanIntroMessage:   '2e séance force de la semaine. Stato-dyn sur la fente : la lenteur du maintien révèle l\'explosivité après.',
    blocks: [
      { blockId: 'warmup',  blockType: 'warmup', title: 'Échauffement + mobilité' },
      { blockId: 'rampup',  blockType: 'main',   title: 'Montée en charge' },
      { blockId: 'force',   blockType: 'main',   title: 'Force explosive' },
      { blockId: 'access',  blockType: 'main',   title: 'Accessoires + gainage' },
      { blockId: 'pied',    blockType: 'main',   title: 'Travail du pied' },
      { blockId: 'cooldown',blockType: 'recovery',title:'Étirements' }
    ],
    exercises: [
      ex({id:'echauffement_general_mobilite', block:'warmup', sets:'-',    reps:'10 mn', rest:'-'}),
      ex({id:'montee_charge_progressive',     block:'rampup', sets:'3-4',  reps:'5-3 reps', rest:'1-2 mn'}),
      ex({id:'squat_barre_explosive',         block:'force',  sets:'Var.*',reps:'3 reps', rest:'2 mn 30', intensity:'Sem.1-2: 85% 1RM | Sem.3: 60% | Sem.4-5: 85% | Sem.6: 60%'}),
      ex({id:'power_clean',                   block:'force',  sets:'Var.*',reps:'3 reps', rest:'2 mn 30', intensity:'Charge légère, explosivité max'}),
      ex({id:'fente_bulgare_stato_dyn',       block:'force',  sets:'Var.*',reps:'Maintien 6 s min puis explosion', rest:'2 mn 30'}),
      ex({id:'l_sit',                         block:'access', sets:'3',    reps:'À l\'échec', rest:'1 mn'}),
      ex({id:'barre_leve_genoux',             block:'access', sets:'3',    reps:'À l\'échec', rest:'1 mn'}),
      ex({id:'elevation_orteils',             block:'pied',   sets:'3',    reps:'15 reps', rest:'30 s'}),
      ex({id:'travail_tibial_anterieur',      block:'pied',   sets:'3',    reps:'15 reps', rest:'30 s'}),
      ex({id:'etirements_hanches_quadriceps', block:'cooldown',sets:'-',   reps:'8 mn', rest:'-'})
    ],
    feedbackQuestions: ['difficulty', 'fatigue', 'pain', 'completed', 'load', 'comment'],
    adaptationRules: { titanCan: ['load','rest','reps'], titanCannot: ['removeBlock','skipWarmup','reducePauseRule'] }
  };

  var p2_j4 = {
    sessionId:           'vd_p2_j4',
    sessionNumber:       4,
    sessionTitle:        'Jour 4 — Power Rotation + Mobilité + Transmission Force',
    sessionGoal:         'Rotation + mobilité + Transmission Force (sauts libres 100%) : convertir tout le travail en performance terrain.',
    sessionType:         'rotation-mobilite-transmission',
    estimatedDuration:   '60-75 min',
    requiredEquipment:   ['Sans matériel', 'Espace saut'],
    isOptional:          false,
    specialInstructions: 'Sauts libres = tu choisis le type (squat jump, broad jump, dunk approach, etc.). 100% à chaque saut. 6-12 mn cumulés.',
    titanIntroMessage:   'Dernier jour de la semaine. Sauts libres : choisis ton mouvement et envoie. C\'est là que ta force se convertit en hauteur.',
    blocks: [
      { blockId: 'warmup',   blockType: 'warmup', title: 'Échauffement rotation' },
      { blockId: 'rotation', blockType: 'main',   title: 'Power rotation' },
      { blockId: 'mob',      blockType: 'main',   title: 'Mobilité & Coordination' },
      { blockId: 'transmission',blockType:'main', title: 'Transmission Force (sauts libres 100%)' },
      { blockId: 'pied',     blockType: 'main',   title: 'Travail du pied' },
      { blockId: 'cooldown', blockType: 'recovery',title:'Étirements' }
    ],
    exercises: [
      ex({id:'echauffement_dynamique_general', block:'warmup',   sets:'-',  reps:'8-10 mn', rest:'-', note:'Focus rotation et mobilité'}),
      ex({id:'rotation_buste_extension_bras',  block:'rotation', sets:'4',  reps:'8-12 reps', rest:'1 mn', note:'Explosivité rotative'}),
      ex({id:'rotation_buste_unipodal',        block:'rotation', sets:'3',  reps:'8-12 reps / côté', rest:'1 mn', note:'Équilibre + rotation'}),
      ex({id:'carioca',                        block:'mob',      sets:'3',  reps:'20 m aller-retour', rest:'45 s'}),
      ex({id:'mobilite_mouv',                  block:'mob',      sets:'3',  reps:'8 reps', rest:'45 s'}),
      ex({id:'quatre_vingt_dix_90',            block:'mob',      sets:'3',  reps:'8 reps / côté', rest:'45 s'}),
      ex({id:'transmission_force_sauts_libres',block:'transmission',sets:'-',reps:'6-12 mn', rest:'-', intensity:'100%', note:'Tu choisis le type de saut — visualise le dunk à chaque pause.'}),
      ex({id:'elevation_orteils',              block:'pied',     sets:'3',  reps:'15 reps', rest:'30 s'}),
      ex({id:'travail_tibial_anterieur',       block:'pied',     sets:'3',  reps:'15 reps', rest:'30 s'}),
      ex({id:'etirements_legers',              block:'cooldown', sets:'-',  reps:'5-10 mn', rest:'-'})
    ],
    feedbackQuestions: ['difficulty', 'fatigue', 'pain', 'completed', 'comment'],
    adaptationRules: { titanCan: ['rest','reps','intensity'], titanCannot: ['skipTransmissionForce','removeBlock'] }
  };

  // ──────────────────────────────────────────────────────────────────────────
  // 3. SEMAINES — règles de progression par phase
  //    Le PDF décrit l'évolution série par semaine (P1: 5→4→3→spéciale ;
  //    P2: 5→4→3→5→4→3 avec rotation 85%/60% sur le squat barre).
  // ──────────────────────────────────────────────────────────────────────────

  function makeWeek(phaseId, weekNumber, focus, sets, sessionIds, opts) {
    opts = opts || {};
    return {
      weekId:           phaseId + '_w' + weekNumber,
      weekNumber:       weekNumber,
      weekFocus:        focus,
      setsModifier:     sets,                // ex: 5, 4, 3, "Special"
      requiredSessions: sessionIds.filter(function(s){ return s.required; }).map(function(s){ return s.id; }),
      optionalSessions: sessionIds.filter(function(s){ return !s.required; }).map(function(s){ return s.id; }),
      validationRule:   opts.validationRule || 'Toutes les séances "requiredSessions" doivent être terminées pour valider la semaine.',
      specialNote:      opts.specialNote || null,
      sessions:         sessionIds  // [{id, required:bool}]
    };
  }

  // ─── PHASE 1 ─────────────────────────────────────────────────────────────
  var P1_SESS = [
    { id: 'vd_p1_j1', required: true },
    { id: 'vd_p1_j2', required: true },
    { id: 'vd_p1_j3', required: true },
    { id: 'vd_p1_j4', required: true }
  ];

  var phase1Weeks = [
    makeWeek('vd_p1', 1, 'Apprentissage — qualité de mouvement avant tout', 5, P1_SESS),
    makeWeek('vd_p1', 2, 'Consolidation — légère réduction du volume',      4, P1_SESS),
    makeWeek('vd_p1', 3, 'Affûtage — intensité maximale',                   3, P1_SESS),
    makeWeek('vd_p1', 4, 'Transmission Force + Test de détente verticale', 'Special', P1_SESS, {
      specialNote: 'Jour 1 et Jour 3 = Transmission Force uniquement (6-12 mn de sauts libres 100%). Jour 5 (insérer après J4) = Test de détente verticale. Filmer et comparer avec le test initial.',
      validationRule: 'Test de détente verticale obligatoire pour clore la phase.'
    })
  ];

  // ─── PHASE 2 ─────────────────────────────────────────────────────────────
  var P2_SESS = [
    { id: 'vd_p2_j1', required: true },
    { id: 'vd_p2_j2', required: true },
    { id: 'vd_p2_j3', required: true },
    { id: 'vd_p2_j4', required: true }
  ];

  var phase2Weeks = [
    makeWeek('vd_p2', 1, '85% 1RM — Adaptation à la charge lourde',                5, P2_SESS),
    makeWeek('vd_p2', 2, '85% 1RM — Consolidation force',                          4, P2_SESS),
    makeWeek('vd_p2', 3, '60% 1RM — Vitesse d\'exécution maximale',                3, P2_SESS),
    makeWeek('vd_p2', 4, '85% 1RM — Nouveau cycle de force',                       5, P2_SESS),
    makeWeek('vd_p2', 5, '85% 1RM — Consolidation',                                4, P2_SESS),
    makeWeek('vd_p2', 6, '60% 1RM — Pic d\'explosivité + Test final',              3, P2_SESS, {
      specialNote: 'Test final fin de phase : repos 2 jours avant, échauffement 15-20 mn, 3-5 essais, filmer et comparer avec test initial.',
      validationRule: 'Test final obligatoire pour clore le programme.'
    })
  ];

  // ──────────────────────────────────────────────────────────────────────────
  // 4. PROGRAMME — assemblage final
  // ──────────────────────────────────────────────────────────────────────────
  var program = {
    programId:        'vd',
    programName:      'Vertical Dunk',
    programGoal:      'Apprendre à dunker et augmenter ta détente verticale',
    totalWeeks:       10,
    programFrequency: '4 jours / semaine',
    programLocation:  'Phase 1 : extérieur / sans matériel — Phase 2 : salle recommandée (variantes sans salle possibles)',
    requiredTests:    ['Squat 1RM (avant Phase 2)', 'Soulevé de terre 1RM (avant Phase 2)'],
    optionalTests:    ['Détente verticale (référence à chaque test final)', 'Filmer pour comparaison'],
    specialRules: [
      'Transmission Force = 9 mn / 100% à la fin de chaque séance Phase 1.',
      'Semaine 4 Phase 1 = Transmission Force exclusive J1 & J3, Test détente verticale J5.',
      'Tests 1RM obligatoires AVANT Phase 2.',
      '48h de repos minimum entre Jour 2 et Jour 3 en Phase 2 (séances de force).',
      'Test final fin Phase 2 : 2 jours de repos avant, 3-5 essais, filmer.'
    ],
    phases: [
      {
        phaseId:           'vd_p1',
        phaseName:         'PHASE 1 — VERTICAL TEST',
        phaseNumber:       1,
        phaseGoal:         'Poser les bases neuromusculaires indispensables avant d\'attaquer le travail de force. Cette phase développe ta coordination, ta mobilité et tes premières qualités explosives.',
        durationWeeks:     4,
        frequency:         '4 jours / semaine',
        location:          'Extérieur / Sans salle',
        progressionRules: [
          { week: 1, sets: 5, focus: 'Apprentissage — qualité de mouvement avant tout' },
          { week: 2, sets: 4, focus: 'Consolidation — légère réduction du volume' },
          { week: 3, sets: 3, focus: 'Affûtage — intensité maximale' },
          { week: 4, sets: 'Special', focus: 'Transmission Force (J1+J3) + Test détente verticale (J5)' }
        ],
        weeks:    phase1Weeks,
        sessions: { vd_p1_j1: p1_j1, vd_p1_j2: p1_j2, vd_p1_j3: p1_j3, vd_p1_j4: p1_j4 }
      },
      {
        phaseId:           'vd_p2',
        phaseName:         'PHASE 2 — VERTICAL DUNK',
        phaseNumber:       2,
        phaseGoal:         'Développer la force explosive au maximum pour augmenter ta détente verticale et atteindre l\'objectif dunk. Le travail de force avec barre est la clé de cette phase.',
        durationWeeks:     6,
        frequency:         '4 jours / semaine',
        location:          'Salle recommandée (variantes sans salle possibles)',
        progressionRules: [
          { week: 1, sets: 5, focus: '85% 1RM — Adaptation à la charge lourde' },
          { week: 2, sets: 4, focus: '85% 1RM — Consolidation force' },
          { week: 3, sets: 3, focus: '60% 1RM — Vitesse d\'exécution maximale' },
          { week: 4, sets: 5, focus: '85% 1RM — Nouveau cycle de force' },
          { week: 5, sets: 4, focus: '85% 1RM — Consolidation' },
          { week: 6, sets: 3, focus: '60% 1RM — Pic d\'explosivité + Test final' }
        ],
        weeks:    phase2Weeks,
        sessions: { vd_p2_j1: p2_j1, vd_p2_j2: p2_j2, vd_p2_j3: p2_j3, vd_p2_j4: p2_j4 }
      }
    ],
    finalNote: 'Phase 2 terminée : +5-10 cm | Force explosive maximale | Objectif DUNK accessible.'
  };

  // ──────────────────────────────────────────────────────────────────────────
  // 5. TABLE DE VÉRIFICATION (programme → phase → semaine → séance → statut)
  //    Sert au script de validation côté Node (à venir) et aux humains pour
  //    relire visuellement.
  // ──────────────────────────────────────────────────────────────────────────
  var verificationTable = [
    { program:'vd', phase:1, week:1, sessions:['j1','j2','j3','j4'], status:'OK' },
    { program:'vd', phase:1, week:2, sessions:['j1','j2','j3','j4'], status:'OK' },
    { program:'vd', phase:1, week:3, sessions:['j1','j2','j3','j4'], status:'OK' },
    { program:'vd', phase:1, week:4, sessions:['j1','j2','j3','j4'], status:'SPÉCIAL — voir I2', notes:'PDF mentionne Jour 5 (test) hors organisation hebdo normale → clarifier UX.' },
    { program:'vd', phase:2, week:1, sessions:['j1','j2','j3','j4'], status:'OK — voir I1', notes:'48h entre J2 et J3 incohérent avec organisation Mer+Jeu.' },
    { program:'vd', phase:2, week:2, sessions:['j1','j2','j3','j4'], status:'OK — voir I1' },
    { program:'vd', phase:2, week:3, sessions:['j1','j2','j3','j4'], status:'OK — voir I1' },
    { program:'vd', phase:2, week:4, sessions:['j1','j2','j3','j4'], status:'OK — voir I1' },
    { program:'vd', phase:2, week:5, sessions:['j1','j2','j3','j4'], status:'OK — voir I1' },
    { program:'vd', phase:2, week:6, sessions:['j1','j2','j3','j4'], status:'TEST FINAL', notes:'Sem. 6 J4 = test détente verticale.' }
  ];

  // ──────────────────────────────────────────────────────────────────────────
  // 6. STATS UTILES (calculées à partir des données)
  // ──────────────────────────────────────────────────────────────────────────
  var allExoIds = Object.keys(VD_MASTER_EXERCISES);
  // ─── Compteur séances — DEUX valeurs distinctes ───────────────────────────
  // totalSessionTemplates  = nb de jours-types distincts (J1/J2/J3/J4 × phases) = 8
  // totalSessionsExecuted  = nb réel de séances sur tout le programme
  //                          (4 j × 4 sem P1) + (4 j × 6 sem P2) = 16 + 24 = 40
  // C'est totalSessionsExecuted qu'il faut afficher dans l'UI utilisateur.
  var stats = {
    totalPhases:           program.phases.length,
    totalWeeks:            program.phases.reduce(function(a,p){return a+p.durationWeeks;}, 0),
    totalSessionTemplates: program.phases.reduce(function(a,p){return a+Object.keys(p.sessions).length;}, 0),
    totalSessionsExecuted: program.phases.reduce(function(a,p){return a + Object.keys(p.sessions).length * p.durationWeeks;}, 0),
    uniqueExercises:       allExoIds.length,
    exercisesWithVideo:    allExoIds.filter(function(id){ return !!VD_MASTER_EXERCISES[id].videoUrl; }).length,
    exercisesWithoutVideo: allExoIds.filter(function(id){ return !VD_MASTER_EXERCISES[id].videoUrl; }).map(function(id){
      return { exerciseId: id, masterName: VD_MASTER_EXERCISES[id].masterName, category: VD_MASTER_EXERCISES[id].category };
    })
  };

  return {
    program:            program,
    masterExercises:    VD_MASTER_EXERCISES,
    verificationTable:  verificationTable,
    stats:              stats
  };
});
