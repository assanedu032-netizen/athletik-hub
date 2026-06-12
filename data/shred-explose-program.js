// ════════════════════════════════════════════════════════════════════════════
// SHRED EXPLOSE — SOURCE DE VÉRITÉ DU PROGRAMME (data layer, non intégré UI)
// ────────────────────────────────────────────────────────────────────────────
// Source : PDF "Programme SHRED EXPLOSE" (uploadé 2026-06-12).
// Schéma : identique aux autres programmes (VD/EA).
// CE FICHIER N'EST PAS BRANCHÉ DANS L'UI — étape de validation.
//
// ─── RÉSUMÉ DU PROGRAMME ────────────────────────────────────────────────────
// Nom         : SHRED EXPLOSE
// Objectif    : Perdre du gras ET gagner en explosivité
// Durée       : 16 semaines (2 phases : 8 + 8)
// Fréquence   : Phase 1 = 6 j/sem (max 1h/séance) ; Phase 2 = 4-5 j/sem
// Lieu        : Phase 1 sans matériel ; Phase 2 salle recommandée
// Compteurs   : 2 phases · 16 semaines · 11 séances-types (6 P1 + 5 P2)
//
// ─── RÈGLES SPÉCIALES ───────────────────────────────────────────────────────
//   R1. NUTRITION = 70-80% des résultats sur la Phase 1. L'entraînement seul
//       ne suffit pas. À rappeler explicitement dans l'UI.
//   R2. CHALLENGES en rotation tous les 2 jours (J1/3/5...) :
//       Bring Sally Up → Pompes max 2 mn → Burpees max 3 mn. Noter les scores.
//   R3. Jour 6 Phase 2 (OPTIONNEL) — l'utilisateur peut sauter.
//   R4. Super Explosif Test FINAL en semaine 16 (94 feet → Sprint 60m →
//       Détente verticale → Pesée + photos → Tests de force). Comparer
//       avec sem. 1 et sem. 8.
//
// ─── INCOHÉRENCES DÉTECTÉES ─────────────────────────────────────────────────
//   I1. Phase 2 a 7 jours définis : Lun J1 / Mar J2 / Mer REPOS / Jeu J3 /
//       Ven J4 / Sam J5 OPT / Dim REPOS. Donc 4 obligatoires + 1 optionnel
//       = 4-5 j/sem comme annoncé. OK.
//   I2. Progression Phase 2 ne précise pas le nb de séries (toutes les
//       cellules SÉRIES sont vides) — la progression est gérée par
//       distance/intensité sprints + complexité circuits. À documenter UX.
//   I3. PDF parle de "Super Explosif Test" en Phase 1 sem.7-8 ET en sem.16,
//       sans détailler le protocole pour sem.7-8. Hypothèse : même protocole
//       que sem.16 mais à confirmer.
//   I4. Phase 1 Jour 1 : "Bring Sally Up (pompes)" suit la chanson "Flower"
//       de Moby — pas un nombre de reps fixe. À gérer comme protocole spécial.
//
// ─── VIDÉOS ────────────────────────────────────────────────────────────────
// Toutes en videoStatus="missing" (Excel non lu en binaire). L'app ne doit
// pas bloquer une séance pour vidéo manquante.
// ════════════════════════════════════════════════════════════════════════════

(function (root, factory) {
  var lib = factory();
  if (typeof module === 'object' && module.exports) module.exports = lib;
  if (root) root.SHRED_EXPLOSE_PROGRAM = lib.program;
  if (root) root.SHRED_EXPLOSE_LIB = lib;
})(typeof window !== 'undefined' ? window : null, function () {

  var SE_MASTER_EXERCISES = {
    // — Échauffement / Étirements —
    echauffement_dynamique:           { masterName: 'Échauffement dynamique',                  category: 'Échauffement',  videoUrl: null, generic: true },
    echauffement_haut_corps:          { masterName: 'Échauffement dynamique haut du corps',    category: 'Échauffement',  videoUrl: null, generic: true },
    echauffement_complet:             { masterName: 'Échauffement dynamique complet',          category: 'Échauffement',  videoUrl: null, generic: true },
    echauffement_explosif:            { masterName: 'Échauffement dynamique explosif',         category: 'Échauffement',  videoUrl: null, generic: true },
    echauffement_progressif:          { masterName: 'Échauffement dynamique progressif',       category: 'Échauffement',  videoUrl: null, generic: true },
    echauffement_leger:               { masterName: 'Échauffement dynamique léger',            category: 'Échauffement',  videoUrl: null, generic: true },
    etirements_haut_corps:            { masterName: 'Étirements haut du corps',                category: 'Récupération',  videoUrl: null, generic: true },
    etirements_bas_corps:             { masterName: 'Étirements bas du corps',                 category: 'Récupération',  videoUrl: null, generic: true },
    etirements_complets:              { masterName: 'Étirements complets',                     category: 'Récupération',  videoUrl: null, generic: true },
    etirements_longs:                 { masterName: 'Étirements longs',                        category: 'Récupération',  videoUrl: null, generic: true },
    etirements:                       { masterName: 'Étirements',                              category: 'Récupération',  videoUrl: null, generic: true },
    retour_calme_marche:              { masterName: 'Retour au calme + marche',                category: 'Récupération',  videoUrl: null, generic: true },

    // — Challenges (rotation J1/J3/J5) —
    bring_sally_up:                   { masterName: 'Bring Sally Up (pompes — chanson Flower)',category: 'Challenge',     videoUrl: null, pdfAliases: ["Bring Sally Up (pompes) — Chanson 'Flower' de Moby"] },
    pompes_max_2mn:                   { masterName: 'Pompes max 2 mn',                         category: 'Challenge',     videoUrl: null },
    burpees_max_3mn:                  { masterName: 'Burpees max 3 mn',                        category: 'Challenge',     videoUrl: null },

    // — Pompes & dérivés —
    pompes_diamant:                   { masterName: 'Pompes diamant',                          category: 'Force haut',    videoUrl: null },
    pompes_declinees:                 { masterName: 'Pompes déclinées',                        category: 'Force haut',    videoUrl: null, pdfAliases: ['Pompes déclinées — pieds surélevés'] },
    pompes_larges:                    { masterName: 'Pompes larges',                           category: 'Force haut',    videoUrl: null, pdfAliases: ['Pompes larges — Pectoraux'] },
    pompes_serrees:                   { masterName: 'Pompes serrées',                          category: 'Force haut',    videoUrl: null, pdfAliases: ['Pompes serrées — Triceps'] },
    pompes_archer:                    { masterName: 'Pompes archer',                           category: 'Force haut',    videoUrl: null },
    pompes_hindou:                    { masterName: 'Pompes hindou',                           category: 'Force haut',    videoUrl: null },
    pompes_claquees:                  { masterName: 'Pompes claquées',                         category: 'Pliométrie',    videoUrl: null },
    pompes_explosives:                { masterName: 'Pompes explosives',                       category: 'Pliométrie',    videoUrl: null },
    pseudo_planche_pushups:           { masterName: 'Pseudo planche push-ups',                 category: 'Force haut',    videoUrl: null },
    pike_pushups:                     { masterName: 'Pike push-ups',                           category: 'Force épaules', videoUrl: null },
    pike_pushups_explosifs:           { masterName: 'Pike push-ups explosifs',                 category: 'Force épaules', videoUrl: null },
    pompes_tempo_lent:                { masterName: 'Pompes tempo lent',                       category: 'Force haut',    videoUrl: null },
    pompes_pliometriques:             { masterName: 'Pompes pliométriques',                    category: 'Pliométrie',    videoUrl: null },

    // — Dips —
    dips_chaise_banc:                 { masterName: 'Dips sur chaise / banc',                  category: 'Force haut',    videoUrl: null },
    dips_explosifs:                   { masterName: 'Dips explosifs',                          category: 'Force haut',    videoUrl: null },

    // — Épaules & Rotation —
    rotation_buste_planche:           { masterName: 'Rotation explosive du buste en planche',  category: 'Power rotation',videoUrl: null },
    elevations_laterales:             { masterName: 'Élévations latérales',                    category: 'Force épaules', videoUrl: null, pdfAliases: ['Élévations latérales (bouteilles ou pdc)','Élévations latérales'] },
    elevations_frontales:             { masterName: 'Élévations frontales',                    category: 'Force épaules', videoUrl: null, pdfAliases: ['Élévations frontales (bouteilles)'] },
    power_rotation_debout:            { masterName: 'Power rotation debout',                   category: 'Power rotation',videoUrl: null },
    rotation_buste_unipodal:          { masterName: 'Rotation buste unipodal',                 category: 'Power rotation',videoUrl: null },
    rotation_buste_explosive:         { masterName: 'Rotation buste explosive',                category: 'Power rotation',videoUrl: null },
    rotation_explosive_debout:        { masterName: 'Rotation explosive debout',               category: 'Power rotation',videoUrl: null },
    wood_chops:                       { masterName: 'Wood chops',                              category: 'Power rotation',videoUrl: null, pdfAliases: ['Wood chops (si élastiques)'] },
    handstand_hold:                   { masterName: 'Handstand hold (contre mur)',             category: 'Force épaules', videoUrl: null },
    handstand_progression:            { masterName: 'Handstand progression',                   category: 'Force épaules', videoUrl: null },
    shoulder_taps_planche:            { masterName: 'Shoulder taps en planche',                category: 'Gainage',       videoUrl: null },
    planche_tap_epaules:              { masterName: 'Planche avant-bras avec tap épaules',     category: 'Gainage',       videoUrl: null, pdfAliases: ['Planche avant-bras avec tap épaules','Gainage planche avec tap épaules'] },

    // — Gainage —
    superman_hold:                    { masterName: 'Superman hold',                           category: 'Gainage',       videoUrl: null },
    planche_dynamique:                { masterName: 'Planche dynamique',                       category: 'Gainage',       videoUrl: null, pdfAliases: ['Planche dynamique (tap épaules) — Gainage','Planche dynamique — Core actif'] },
    planche_avant_bras:               { masterName: 'Planche avant-bras',                      category: 'Gainage',       videoUrl: null },
    planche_jacks:                    { masterName: 'Planche jacks',                           category: 'Gainage',       videoUrl: null },
    planche_laterale:                 { masterName: 'Planche latérale',                        category: 'Gainage',       videoUrl: null, pdfAliases: ['Gainage latéral — Obliques','Planche latérale'] },
    planche_simple:                   { masterName: 'Planche',                                 category: 'Gainage',       videoUrl: null },
    l_sit_hold:                       { masterName: 'L-sit hold',                              category: 'Gainage',       videoUrl: null },
    mountain_climbers:                { masterName: 'Mountain climbers',                       category: 'Cardio',        videoUrl: null },
    t_hold:                           { masterName: 'T-hold (équilibre en T)',                 category: 'Proprioception',videoUrl: null },

    // — Isométrique bas —
    squat_isometrique:                { masterName: 'Squat isométrique (90°)',                 category: 'Isométrique',   videoUrl: null, pdfAliases: ['Squat isométrique (90°) — Position parallèle','Squat isométrique (90°) — Progresser le temps chaque semaine'] },
    fente_isometrique:                { masterName: 'Fente isométrique',                       category: 'Isométrique',   videoUrl: null, pdfAliases: ['Fente isométrique — Maintien','Fente isométrique'] },
    wall_sit:                         { masterName: 'Wall sit',                                category: 'Isométrique',   videoUrl: null, pdfAliases: ['Wall sit — Dos au mur'] },
    single_leg_squat_hold:            { masterName: 'Single leg squat hold',                   category: 'Isométrique',   videoUrl: null },

    // — Pliométrie & sauts —
    squat_jump:                       { masterName: 'Squat jump',                              category: 'Pliométrie',    videoUrl: null },
    squat_jump_charge:                { masterName: 'Squat jump avec charge',                  category: 'Pliométrie',    videoUrl: null, pdfAliases: ['Squat jump avec charge (gilet si dispo)'] },
    split_jumps:                      { masterName: 'Split jumps',                             category: 'Pliométrie',    videoUrl: null, pdfAliases: ['Split jumps — Alternance explosive'] },
    fente_alternee:                   { masterName: 'Fente alternée',                          category: 'Force bas',     videoUrl: null },
    fentes_marchees:                  { masterName: 'Fentes marchées',                         category: 'Force bas',     videoUrl: null },
    fentes_sautees:                   { masterName: 'Fentes sautées',                          category: 'Pliométrie',    videoUrl: null, pdfAliases: ['Fentes sautées','Fente sautée alternée'] },
    fente_bulgare_sautee:             { masterName: 'Fente bulgare sautée',                    category: 'Pliométrie',    videoUrl: null, pdfAliases: ['Fente bulgare sautée — Unilatéral explosif'] },
    squat_sumo:                       { masterName: 'Squat sumo',                              category: 'Force bas',     videoUrl: null, pdfAliases: ['Squat sumo — Intérieur cuisses'] },
    squat_pdc:                        { masterName: 'Squat au poids du corps',                 category: 'Force bas',     videoUrl: null },
    squat_tempo_lent:                 { masterName: 'Squat tempo lent',                        category: 'Force bas',     videoUrl: null },
    glute_bridge:                     { masterName: 'Glute bridge',                            category: 'Force bas',     videoUrl: null, pdfAliases: ['Glute bridge — Fessiers'] },
    lateral_bounds:                   { masterName: 'Lateral bounds',                          category: 'Pliométrie',    videoUrl: null },
    box_squat_jumps:                  { masterName: 'Box squat jumps',                         category: 'Pliométrie',    videoUrl: null, pdfAliases: ['Box squat jumps — Assis-debout explosif'] },
    calf_jumps:                       { masterName: 'Calf jumps',                              category: 'Pliométrie',    videoUrl: null, pdfAliases: ['Calf jumps — Mollets explosifs'] },
    depth_jumps:                      { masterName: 'Depth jumps',                             category: 'Pliométrie intensive', videoUrl: null, pdfAliases: ['Depth jumps — Plio intensive'] },
    box_jumps:                        { masterName: 'Box jumps',                               category: 'Pliométrie intensive', videoUrl: null, pdfAliases: ['Box jumps','Box jumps (plio intensive)'] },
    saut_survitesse:                  { masterName: 'Saut survitesse (élastiques)',            category: 'Pliométrie',    videoUrl: null, pdfAliases: ['Saut survitesse (élastiques si possible) — Vitesse maximale'] },
    sauts_unipodaux_stab:             { masterName: 'Sauts unipodaux stabilisés',              category: 'Proprioception',videoUrl: null },
    sauts_unipodaux_multi:            { masterName: 'Sauts unipodaux multidirectionnels',      category: 'Proprioception',videoUrl: null },
    sprint_sur_place:                 { masterName: 'Sprint sur place (high knees)',           category: 'Cardio',        videoUrl: null },
    burpees:                          { masterName: 'Burpees',                                 category: 'Full body',     videoUrl: null },
    burpees_tuck_jump:                { masterName: 'Burpees avec tuck jump',                  category: 'Full body',     videoUrl: null },

    // — Travail du pied —
    elevation_orteils:                { masterName: 'Élévation orteils',                       category: 'Travail du pied', videoUrl: null },
    elevation_orteils_explosive:      { masterName: 'Élévation orteils explosive',             category: 'Travail du pied', videoUrl: null },
    dorsiflexion_tibial:              { masterName: 'Dorsiflexion tibial',                     category: 'Travail du pied', videoUrl: null },
    marche_talons:                    { masterName: 'Marche sur talons',                       category: 'Travail du pied', videoUrl: null, pdfAliases: ['Marche sur talons rapide','Marche sur talons'] },
    marche_arriere:                   { masterName: 'Marche arrière',                          category: 'Travail du pied', videoUrl: null, pdfAliases: ['Marche arrière rapide','Marche arrière'] },
    marche_arriere_colline:           { masterName: 'Marche arrière en colline',               category: 'Travail du pied', videoUrl: null, pdfAliases: ['Marche arrière en colline — Proprioception + cardio','Marche arrière en colline'] },
    marche_arriere_cote:              { masterName: 'Marche arrière en côte',                  category: 'Travail du pied', videoUrl: null, pdfAliases: ['Marche arrière en côte — Proprioception + cardio'] },

    // — Sprints / Cardio —
    sprint_10s_jogging_marche:        { masterName: 'Cycle Sprint 10s + Jogging 30s + Marche 20s', category: 'Cardio',    videoUrl: null, pdfAliases: ['Sprint 10 s + Jogging 30 s + Marche 20 s — ALL OUT'] },
    fractionne_1mn:                   { masterName: 'Fractionné 1mn (80% Vmax) + 1mn marche',  category: 'Cardio',        videoUrl: null, pdfAliases: ['Fractionné : 1 mn (80% Vmax) + 1 mn marche'] },
    fractionne_15s:                   { masterName: 'Fractionné 15s sprint + 15s repos',       category: 'Cardio',        videoUrl: null, pdfAliases: ['Fractionné : 15 s sprint (100%) + 15 s repos — ALL OUT'] },
    course_60_pct:                    { masterName: 'Course à pied 60% Vmax',                  category: 'Cardio',        videoUrl: null, pdfAliases: ['Course à pied — 60% Vmax — allure conversationnelle'] },
    course_2mn_85:                    { masterName: 'Course 2mn (85% Vmax) + 1mn marche',      category: 'Cardio',        videoUrl: null, pdfAliases: ['2 mn course (85% Vmax) + 1 mn marche — Endurance vitesse'] },
    course_20mn_65:                   { masterName: 'Course 20 mn (65% Vmax)',                 category: 'Cardio',        videoUrl: null, pdfAliases: ['Course 20 mn (65% Vmax) — Récupération active'] },
    fartlek_20mn:                     { masterName: 'Fartlek 20 mn',                           category: 'Cardio',        videoUrl: null, pdfAliases: ['Fartlek 20 mn (alternance vitesse) — Jeu de vitesse libre'] },
    sprint_30m_x6:                    { masterName: 'Sprint 30 m × 6',                         category: 'Vitesse',       videoUrl: null, pdfAliases: ['Sprints 30 m x 6 — Vitesse maximale'] },
    sprint_4_cones:                   { masterName: 'Sprint 4 cônes (multidirection)',         category: 'Agilité',       videoUrl: null, pdfAliases: ['Sprint 4 cônes (vitesse multidirection) — Agilité'] },
    sprint_cote_15s:                  { masterName: 'Sprint en côte 15s × 8',                  category: 'Cardio',        videoUrl: null, pdfAliases: ['Sprint en côte 15 s x 8 — Puissance maximale'] },
    sprint_20m_x6:                    { masterName: 'Sprint 20 m × 6',                         category: 'Vitesse',       videoUrl: null, pdfAliases: ['Sprint 20 m x 6 — Vitesse maximale'] },
    sprint_40m_x4:                    { masterName: 'Sprint 40 m × 4',                         category: 'Vitesse',       videoUrl: null, pdfAliases: ['Sprint 40 m x 4 — Maintien vitesse'] },
    sprint_60m_x2:                    { masterName: 'Sprint 60 m × 2',                         category: 'Vitesse',       videoUrl: null, pdfAliases: ['Sprint 60 m x 2 — Endurance vitesse'] },

    // — Proprioception & mobilité —
    equilibre_unipodal:               { masterName: 'Équilibre unipodal',                      category: 'Proprioception', videoUrl: null, pdfAliases: ['Équilibre unipodal','Équilibre unipodal — surface instable'] },
    equilibre_yeux_fermes:            { masterName: 'Équilibre yeux fermés',                   category: 'Proprioception', videoUrl: null, pdfAliases: ['Équilibre yeux fermés','Équilibre unipodal yeux fermés — Stabilité'] },
    mobilite_mouv:                    { masterName: 'Mobilité mouv',                           category: 'Mobilité & Coordination', videoUrl: null, pdfAliases: ['Mobilité mouv (rotations complètes) — Amplitude','Mobilité mouv'] },
    nineteen_nineteen:                { masterName: '90/90',                                   category: 'Mobilité & Coordination', videoUrl: null, pdfAliases: ['90/90 (rotation hanches) — Mobilité hanches'] },
    stretching_dynamique:             { masterName: 'Stretching dynamique',                    category: 'Mobilité & Coordination', videoUrl: null },

    // — Dos —
    traction_explosive:               { masterName: 'Traction explosive',                      category: 'Force haut',    videoUrl: null, pdfAliases: ['Traction explosive (ou excentrique) — Dos puissance'] }
  };

  function ex(opts) {
    var master = SE_MASTER_EXERCISES[opts.id] || {};
    return {
      exerciseId:     opts.id,
      exerciseName:   master.masterName || opts.name || opts.id,
      category:       master.category || null,
      blockType:      opts.block || 'main',
      sets:           opts.sets || null,
      repsOrDuration: opts.reps || null,
      rest:           opts.rest || null,
      executionMode:  opts.mode || 'classique',
      intensity:      opts.intensity || null,
      technique:      opts.technique || null,
      tempo:          opts.tempo || null,
      coachingCue:    opts.cue || null,
      commonMistake:  opts.mistake || null,
      videoTitle:     master.masterName || opts.name || null,
      videoUrl:       master.videoUrl || null,
      videoStatus:    master.videoUrl ? 'available' : 'missing',
      note:           opts.note || null
    };
  }

  // ─── PHASE 1 — DETOX TURBO (8 sem · 6 j/sem) ─────────────────────────────

  var p1_j1 = {
    sessionId:'se_p1_j1', sessionNumber:1, sessionTitle:'Jour 1 — UPPER : Challenge + Circuit Cluster + Épaules',
    sessionGoal:'Démarrer la semaine sur un challenge mental + travail haut du corps dense.',
    sessionType:'upper-circuit', estimatedDuration:'50-60 min', requiredEquipment:['Sans matériel','Chaise/banc','Bouteilles (option)'],
    isOptional:false,
    specialInstructions:'Challenge en rotation (Bring Sally Up / Pompes 2mn / Burpees 3mn) — noter le score à chaque cycle.',
    titanIntroMessage:'Première séance de la semaine. Le challenge mesure ta progression réelle — note tes scores.',
    blocks:[
      {blockId:'challenge',blockType:'warmup',title:'Challenge (rotation)',executionMode:'protocole'},
      {blockId:'cluster1', blockType:'main',  title:'Circuit Cluster — Pompes/Dips/Épaules',executionMode:'enchaînement'},
      {blockId:'rotation', blockType:'main',  title:'Rotation + Élévations',executionMode:'classique'},
      {blockId:'cluster2', blockType:'main',  title:'Circuit Cluster 2 — Pectoraux/Lombaires/Triceps',executionMode:'enchaînement'},
      {blockId:'pied',     blockType:'main',  title:'Travail du pied + Équilibre',executionMode:'classique'},
      {blockId:'cooldown', blockType:'recovery',title:'Étirements'}
    ],
    exercises:[
      ex({id:'bring_sally_up',block:'challenge',sets:'1',reps:'Suivre la chanson',rest:'-',note:'Rotation : Bring Sally Up → Pompes max 2mn → Burpees max 3mn (J1/J3/J5).'}),
      ex({id:'pompes_diamant',     block:'cluster1',sets:'4',reps:'2-3 reps cluster',rest:'2 mn après les 4',mode:'enchaînement',note:'1) Cluster'}),
      ex({id:'dips_chaise_banc',   block:'cluster1',sets:'4',reps:'2-3 reps cluster',rest:'-',mode:'enchaînement',note:'2) Cluster'}),
      ex({id:'pompes_declinees',   block:'cluster1',sets:'4',reps:'2-3 reps cluster',rest:'-',mode:'enchaînement',note:'3) Cluster'}),
      ex({id:'pike_pushups',       block:'cluster1',sets:'4',reps:'2-3 reps cluster',rest:'-',mode:'enchaînement',note:'4) Cluster (pompes en V)'}),
      ex({id:'rotation_buste_planche',block:'rotation',sets:'3',reps:'10 reps',rest:'1 mn',note:'Puissance rotative'}),
      ex({id:'elevations_laterales',  block:'rotation',sets:'3',reps:'12-15 reps',rest:'1 mn',note:'Bouteilles ou pdc'}),
      ex({id:'pompes_larges',      block:'cluster2',sets:'3',reps:'10-12 reps',rest:'-',mode:'enchaînement',note:'1) Pectoraux'}),
      ex({id:'superman_hold',      block:'cluster2',sets:'3',reps:'30 s',     rest:'-',mode:'enchaînement',note:'2) Lombaires'}),
      ex({id:'pompes_serrees',     block:'cluster2',sets:'3',reps:'8-10 reps',rest:'-',mode:'enchaînement',note:'3) Triceps'}),
      ex({id:'planche_dynamique',  block:'cluster2',sets:'3',reps:'20 reps',  rest:'1 mn 30',mode:'enchaînement',note:'4) Gainage (tap épaules)'}),
      ex({id:'elevation_orteils',  block:'pied',sets:'3',reps:'15 reps',rest:'30 s'}),
      ex({id:'dorsiflexion_tibial',block:'pied',sets:'3',reps:'15 reps',rest:'30 s'}),
      ex({id:'equilibre_unipodal', block:'pied',sets:'3',reps:'30 s / jambe',rest:'30 s'}),
      ex({id:'etirements_haut_corps',block:'cooldown',sets:'-',reps:'5 mn',rest:'-'})
    ],
    feedbackQuestions:['difficulty','fatigue','pain','completed','challengeScore','comment'],
    adaptationRules:{titanCan:['rest','reps','variant','challengeChoice'],titanCannot:['removeCluster','skipChallenge']}
  };

  var p1_j2 = {
    sessionId:'se_p1_j2', sessionNumber:2, sessionTitle:'Jour 2 — LOWER : Isométrique + Travail pied + Sprint',
    sessionGoal:'Force statique bas du corps + cardio HIIT.',
    sessionType:'lower-iso-cardio', estimatedDuration:'55-65 min', requiredEquipment:['Sans matériel','Espace sprint'],
    isOptional:false,
    specialInstructions:'Le bloc plio (circuit 4 exos) s\'enchaîne sans repos — repos uniquement après le 4e.',
    titanIntroMessage:'Iso + cardio. Le sprint cardio à 8 cycles est ton brûleur de gras.',
    blocks:[
      {blockId:'warmup',  blockType:'warmup',title:'Échauffement + mobilité'},
      {blockId:'iso',     blockType:'main',  title:'Isométriques',executionMode:'classique'},
      {blockId:'plio',    blockType:'main',  title:'Circuit pliométrique',executionMode:'enchaînement'},
      {blockId:'pied',    blockType:'main',  title:'Travail du pied'},
      {blockId:'cardio',  blockType:'main',  title:'Sprint cardio'},
      {blockId:'cooldown',blockType:'recovery',title:'Étirements'}
    ],
    exercises:[
      ex({id:'echauffement_dynamique',block:'warmup',sets:'-',reps:'10 mn',rest:'-',note:'+ mobilité'}),
      ex({id:'squat_isometrique', block:'iso',sets:'4',reps:'30-45 s',rest:'1 mn'}),
      ex({id:'fente_isometrique', block:'iso',sets:'3',reps:'30 s / jambe',rest:'1 mn'}),
      ex({id:'wall_sit',          block:'iso',sets:'3',reps:'30-60 s',rest:'1 mn'}),
      ex({id:'squat_jump',        block:'plio',sets:'3',reps:'10 reps',rest:'-',mode:'enchaînement',note:'1) Explosivité'}),
      ex({id:'fente_alternee',    block:'plio',sets:'3',reps:'20 reps (10/jambe)',rest:'-',mode:'enchaînement',note:'2)'}),
      ex({id:'squat_sumo',        block:'plio',sets:'3',reps:'15 reps',rest:'-',mode:'enchaînement',note:'3) Intérieur cuisses'}),
      ex({id:'glute_bridge',      block:'plio',sets:'3',reps:'15 reps',rest:'2 mn',mode:'enchaînement',note:'4) Fessiers'}),
      ex({id:'elevation_orteils', block:'pied',sets:'3',reps:'15 reps',rest:'30 s'}),
      ex({id:'dorsiflexion_tibial',block:'pied',sets:'3',reps:'15 reps',rest:'30 s'}),
      ex({id:'marche_talons',     block:'pied',sets:'2',reps:'1 mn',rest:'30 s'}),
      ex({id:'marche_arriere_colline',block:'pied',sets:'1',reps:'10 mn minimum',rest:'-'}),
      ex({id:'sprint_10s_jogging_marche',block:'cardio',sets:'8',reps:'Cycle complet',rest:'-',intensity:'ALL OUT'}),
      ex({id:'etirements_bas_corps',block:'cooldown',sets:'-',reps:'5 mn',rest:'-'})
    ],
    feedbackQuestions:['difficulty','fatigue','pain','completed','comment'],
    adaptationRules:{titanCan:['rest','reps','variant','sprintIntensity'],titanCannot:['skipCardio','removeBlock']}
  };

  var p1_j3 = {
    sessionId:'se_p1_j3', sessionNumber:3, sessionTitle:'Jour 3 — UPPER : Focus épaules + Proprioception + Course',
    sessionGoal:'Densité épaules + proprio + fractionné cardio.',
    sessionType:'upper-shoulders-cardio', estimatedDuration:'55-65 min', requiredEquipment:['Sans matériel','Bouteilles (option)','Espace course'],
    isOptional:false,
    specialInstructions:'Challenge rotation jour 3 (cf. R2). Fractionné fin de séance = 8 cycles obligatoires.',
    titanIntroMessage:'Focus épaules + équilibre + fractionné. C\'est la séance qui structure ta posture athlétique.',
    blocks:[
      {blockId:'warmup',  blockType:'warmup',title:'Échauffement haut du corps'},
      {blockId:'epaules', blockType:'main',  title:'Épaules — Force + handstand'},
      {blockId:'rotation',blockType:'main',  title:'Élévations + Power rotation',executionMode:'enchaînement'},
      {blockId:'gainage', blockType:'main',  title:'Gainage + Proprio'},
      {blockId:'cardio',  blockType:'main',  title:'Fractionné'},
      {blockId:'cooldown',blockType:'recovery',title:'Étirements'}
    ],
    exercises:[
      ex({id:'echauffement_haut_corps',block:'warmup',sets:'-',reps:'8 mn',rest:'-',note:'Rotations épaules'}),
      ex({id:'pike_pushups',          block:'epaules',sets:'4',reps:'8-12 reps',rest:'1 mn'}),
      ex({id:'handstand_hold',        block:'epaules',sets:'4',reps:'20-40 s',rest:'1 mn 30'}),
      ex({id:'pompes_hindou',         block:'epaules',sets:'3',reps:'8-10 reps',rest:'1 mn'}),
      ex({id:'shoulder_taps_planche', block:'epaules',sets:'3',reps:'20 reps (10/côté)',rest:'1 mn'}),
      ex({id:'elevations_frontales',  block:'rotation',sets:'3',reps:'12 reps',rest:'-',mode:'enchaînement',note:'1)'}),
      ex({id:'power_rotation_debout', block:'rotation',sets:'3',reps:'10 reps / côté',rest:'-',mode:'enchaînement',note:'2)'}),
      ex({id:'elevations_laterales',  block:'rotation',sets:'3',reps:'12 reps',rest:'-',mode:'enchaînement',note:'3)'}),
      ex({id:'rotation_buste_unipodal',block:'rotation',sets:'3',reps:'8 reps / côté',rest:'1 mn 30',mode:'enchaînement',note:'4)'}),
      ex({id:'planche_tap_epaules',   block:'gainage',sets:'3',reps:'12 reps (6/côté)',rest:'45 s'}),
      ex({id:'t_hold',                block:'gainage',sets:'3',reps:'20-30 s / jambe',rest:'45 s'}),
      ex({id:'equilibre_yeux_fermes', block:'gainage',sets:'2',reps:'30 s / jambe',rest:'30 s'}),
      ex({id:'fractionne_1mn',        block:'cardio', sets:'8',reps:'Cycle complet',rest:'-'}),
      ex({id:'etirements_haut_corps', block:'cooldown',sets:'-',reps:'5 mn',rest:'-'})
    ],
    feedbackQuestions:['difficulty','fatigue','pain','completed','challengeScore','comment'],
    adaptationRules:{titanCan:['rest','reps','variant','sprintIntensity'],titanCannot:['skipChallenge','removeBlock']}
  };

  var p1_j4 = {
    sessionId:'se_p1_j4', sessionNumber:4, sessionTitle:'Jour 4 — LOWER : Cardio longue durée',
    sessionGoal:'Cardio steady-state pour la base aérobie + circuit léger bas.',
    sessionType:'cardio-steady', estimatedDuration:'60-70 min', requiredEquipment:['Sans matériel','Espace course'],
    isOptional:false,
    specialInstructions:'Course à allure conversationnelle (60% Vmax) pendant 35 mn. C\'est la base aérobie.',
    titanIntroMessage:'Cardio long aujourd\'hui. Tu peux parler en courant — c\'est le bon rythme.',
    blocks:[
      {blockId:'warmup',  blockType:'warmup',title:'Échauffement progressif'},
      {blockId:'cardio',  blockType:'main',  title:'Course 60% Vmax'},
      {blockId:'circuit', blockType:'main',  title:'Circuit léger bas',executionMode:'enchaînement'},
      {blockId:'pied',    blockType:'main',  title:'Travail du pied'},
      {blockId:'cooldown',blockType:'recovery',title:'Retour calme + étirements'}
    ],
    exercises:[
      ex({id:'echauffement_progressif',block:'warmup',sets:'-',reps:'5-10 mn',rest:'-'}),
      ex({id:'course_60_pct',         block:'cardio',sets:'-',reps:'35 mn',rest:'-',intensity:'60% Vmax'}),
      ex({id:'squat_pdc',             block:'circuit',sets:'2',reps:'20 reps',rest:'-',mode:'enchaînement',note:'1)'}),
      ex({id:'fentes_marchees',       block:'circuit',sets:'2',reps:'30 reps (15/jambe)',rest:'-',mode:'enchaînement',note:'2)'}),
      ex({id:'squat_jump',            block:'circuit',sets:'2',reps:'10 reps',rest:'-',mode:'enchaînement',note:'3)'}),
      ex({id:'mountain_climbers',     block:'circuit',sets:'2',reps:'30 s',rest:'2 mn',mode:'enchaînement',note:'4)'}),
      ex({id:'elevation_orteils',     block:'pied',sets:'2',reps:'15 reps',rest:'30 s'}),
      ex({id:'dorsiflexion_tibial',   block:'pied',sets:'2',reps:'15 reps',rest:'30 s'}),
      ex({id:'retour_calme_marche',   block:'cooldown',sets:'-',reps:'5 mn',rest:'-'}),
      ex({id:'etirements_complets',   block:'cooldown',sets:'-',reps:'10 mn',rest:'-'})
    ],
    feedbackQuestions:['difficulty','fatigue','pain','completed','comment'],
    adaptationRules:{titanCan:['cardioDuration','intensity','rest'],titanCannot:['removeBlock']}
  };

  var p1_j5 = {
    sessionId:'se_p1_j5', sessionNumber:5, sessionTitle:'Jour 5 — UPPER : Focus épaules + Sprint haute intensité',
    sessionGoal:'Densité haut du corps explosive + HIIT 15s/15s.',
    sessionType:'upper-explosive-hiit', estimatedDuration:'55-65 min', requiredEquipment:['Sans matériel'],
    isOptional:false,
    specialInstructions:'Challenge rotation jour 5 (cf. R2). HIIT 15s/15s × 8 = brûleur grosse intensité.',
    titanIntroMessage:'On finit la semaine fort. Explosivité + HIIT court. Donne tout.',
    blocks:[
      {blockId:'warmup',  blockType:'warmup',title:'Échauffement haut du corps'},
      {blockId:'epaules', blockType:'main',  title:'Épaules — Explosivité'},
      {blockId:'circuit', blockType:'main',  title:'Circuit explosif',executionMode:'enchaînement'},
      {blockId:'pied',    blockType:'main',  title:'Travail du pied'},
      {blockId:'cardio',  blockType:'main',  title:'Fractionné 15s/15s'},
      {blockId:'cooldown',blockType:'recovery',title:'Étirements'}
    ],
    exercises:[
      ex({id:'echauffement_haut_corps',block:'warmup',sets:'-',reps:'8 mn',rest:'-',note:'Préparation sprint'}),
      ex({id:'pike_pushups_explosifs',  block:'epaules',sets:'4',reps:'8-10 reps',rest:'1 mn'}),
      ex({id:'pseudo_planche_pushups',  block:'epaules',sets:'4',reps:'5-8 reps',rest:'1 mn 30'}),
      ex({id:'pompes_archer',           block:'epaules',sets:'3',reps:'6-8 reps / côté',rest:'1 mn'}),
      ex({id:'handstand_progression',   block:'epaules',sets:'4',reps:'15-30 s',rest:'1 mn 30'}),
      ex({id:'pompes_claquees',  block:'circuit',sets:'4',reps:'6-8 reps',rest:'-',mode:'enchaînement',note:'1) Explosivité max'}),
      ex({id:'burpees',          block:'circuit',sets:'4',reps:'10 reps',rest:'-',mode:'enchaînement',note:'2) Full body'}),
      ex({id:'dips_explosifs',   block:'circuit',sets:'4',reps:'8 reps',rest:'-',mode:'enchaînement',note:'3) Triceps'}),
      ex({id:'planche_jacks',    block:'circuit',sets:'4',reps:'20 reps',rest:'2 mn',mode:'enchaînement',note:'4) Cardio gainage'}),
      ex({id:'elevation_orteils_explosive',block:'pied',sets:'3',reps:'15 reps',rest:'30 s'}),
      ex({id:'sauts_unipodaux_stab',block:'pied',sets:'3',reps:'8 reps / jambe',rest:'30 s'}),
      ex({id:'fractionne_15s',   block:'cardio',sets:'8',reps:'Cycle complet',rest:'-',intensity:'ALL OUT'}),
      ex({id:'etirements',       block:'cooldown',sets:'-',reps:'5 mn',rest:'-'})
    ],
    feedbackQuestions:['difficulty','fatigue','pain','completed','challengeScore','comment'],
    adaptationRules:{titanCan:['rest','reps','variant','sprintIntensity'],titanCannot:['skipChallenge','removeBlock']}
  };

  var p1_j6 = {
    sessionId:'se_p1_j6', sessionNumber:6, sessionTitle:'Jour 6 — LOWER : Isométrique + Pied + Proprioception',
    sessionGoal:'Iso lourde + travail pied complet + proprio avancée.',
    sessionType:'lower-iso-proprio', estimatedDuration:'60-70 min', requiredEquipment:['Sans matériel'],
    isOptional:false,
    specialInstructions:'Le squat iso progresse en durée chaque semaine. La marche arrière en colline = 10 mn min.',
    titanIntroMessage:'Dernier jour de la semaine. Iso + proprio. Sois solide sur tes appuis.',
    blocks:[
      {blockId:'warmup',  blockType:'warmup',title:'Échauffement'},
      {blockId:'iso',     blockType:'main',  title:'Isométriques'},
      {blockId:'plio',    blockType:'main',  title:'Circuit pliométrique',executionMode:'enchaînement'},
      {blockId:'pied',    blockType:'main',  title:'Travail du pied'},
      {blockId:'proprio', blockType:'main',  title:'Proprioception'},
      {blockId:'cooldown',blockType:'recovery',title:'Étirements'}
    ],
    exercises:[
      ex({id:'echauffement_dynamique',block:'warmup',sets:'-',reps:'10 mn',rest:'-',note:'Mobilité complète'}),
      ex({id:'squat_isometrique',  block:'iso',sets:'4',reps:'30-60 s',rest:'1 mn',note:'Progresser chaque semaine'}),
      ex({id:'fente_isometrique',  block:'iso',sets:'3',reps:'30-45 s / jambe',rest:'1 mn'}),
      ex({id:'single_leg_squat_hold',block:'iso',sets:'3',reps:'20-40 s / jambe',rest:'1 mn'}),
      ex({id:'split_jumps',        block:'plio',sets:'3',reps:'12 reps',rest:'-',mode:'enchaînement',note:'1) Alternance'}),
      ex({id:'lateral_bounds',     block:'plio',sets:'3',reps:'12 reps (6/côté)',rest:'-',mode:'enchaînement',note:'2)'}),
      ex({id:'box_squat_jumps',    block:'plio',sets:'3',reps:'10 reps',rest:'-',mode:'enchaînement',note:'3) Assis-debout'}),
      ex({id:'calf_jumps',         block:'plio',sets:'3',reps:'15 reps',rest:'2 mn',mode:'enchaînement',note:'4) Mollets'}),
      ex({id:'elevation_orteils',  block:'pied',sets:'3',reps:'15 reps',rest:'30 s'}),
      ex({id:'dorsiflexion_tibial',block:'pied',sets:'3',reps:'15 reps',rest:'30 s'}),
      ex({id:'marche_talons',      block:'pied',sets:'2',reps:'1 mn',rest:'30 s'}),
      ex({id:'marche_arriere_colline',block:'pied',sets:'1',reps:'10 mn minimum',rest:'-'}),
      ex({id:'equilibre_unipodal', block:'proprio',sets:'3',reps:'30 s / jambe',rest:'30 s',note:'Surface instable'}),
      ex({id:'sauts_unipodaux_multi',block:'proprio',sets:'3',reps:'8 reps / jambe',rest:'1 mn'}),
      ex({id:'etirements_complets',block:'cooldown',sets:'-',reps:'10 mn',rest:'-'})
    ],
    feedbackQuestions:['difficulty','fatigue','pain','completed','comment'],
    adaptationRules:{titanCan:['rest','reps','variant','isoDuration'],titanCannot:['removeBlock']}
  };

  // ─── PHASE 2 — EXPLOSIVE MUSCLE (8 sem · 4-5 j/sem) ──────────────────────

  var p2_j1 = {
    sessionId:'se_p2_j1', sessionNumber:1, sessionTitle:'Jour 1 — Full Body Explosif',
    sessionGoal:'Volume explosif full body + sprints.',
    sessionType:'fullbody-explosive', estimatedDuration:'55-70 min', requiredEquipment:['Sans matériel','Espace sprint'],
    isOptional:false,
    specialInstructions:'Sprints 30m × 6 = base. Évolue à 40m sem.11-12, 50m sem.13-14.',
    titanIntroMessage:'Phase 2 démarre. Full body explosif. La qualité du sprint te suit toute la semaine.',
    blocks:[
      {blockId:'warmup',  blockType:'warmup',title:'Échauffement complet'},
      {blockId:'circuit1',blockType:'main',  title:'Circuit Épaules + Sprint + Mobilité',executionMode:'enchaînement'},
      {blockId:'circuit2',blockType:'main',  title:'Circuit Full body',executionMode:'enchaînement'},
      {blockId:'pied',    blockType:'main',  title:'Travail du pied'},
      {blockId:'sprint',  blockType:'main',  title:'Sprints'},
      {blockId:'cooldown',blockType:'recovery',title:'Étirements'}
    ],
    exercises:[
      ex({id:'echauffement_complet',block:'warmup',sets:'-',reps:'10 mn',rest:'-'}),
      ex({id:'pike_pushups_explosifs',block:'circuit1',sets:'4',reps:'10 reps',rest:'-',mode:'enchaînement',note:'1) Épaules'}),
      ex({id:'sprint_sur_place',  block:'circuit1',sets:'4',reps:'30 s',rest:'-',mode:'enchaînement',note:'2) High knees'}),
      ex({id:'mobilite_mouv',     block:'circuit1',sets:'4',reps:'8 reps',rest:'-',mode:'enchaînement',note:'3) Amplitude'}),
      ex({id:'squat_jump',        block:'circuit1',sets:'4',reps:'10 reps',rest:'2 mn',mode:'enchaînement',note:'4) Explosivité'}),
      ex({id:'pompes_explosives', block:'circuit2',sets:'3',reps:'12 reps',rest:'-',mode:'enchaînement',note:'1)'}),
      ex({id:'fentes_sautees',    block:'circuit2',sets:'3',reps:'20 reps (10/jambe)',rest:'-',mode:'enchaînement',note:'2)'}),
      ex({id:'planche_dynamique', block:'circuit2',sets:'3',reps:'30 s',rest:'-',mode:'enchaînement',note:'3) Core actif'}),
      ex({id:'burpees',           block:'circuit2',sets:'3',reps:'10 reps',rest:'1 mn 30',mode:'enchaînement',note:'4) Full body'}),
      ex({id:'elevation_orteils_explosive',block:'pied',sets:'3',reps:'15 reps',rest:'30 s'}),
      ex({id:'sauts_unipodaux_stab',block:'pied',sets:'3',reps:'8 reps / jambe',rest:'30 s'}),
      ex({id:'sprint_30m_x6',     block:'sprint',sets:'6',reps:'30 m',rest:'1 mn 30',intensity:'Vitesse maximale',note:'Évolue 40m/50m selon semaine.'}),
      ex({id:'etirements_complets',block:'cooldown',sets:'-',reps:'5-8 mn',rest:'-'})
    ],
    feedbackQuestions:['difficulty','fatigue','pain','completed','sprintBest','comment'],
    adaptationRules:{titanCan:['sprintDistance','rest','reps','variant'],titanCannot:['removeSprints']}
  };

  var p2_j2 = {
    sessionId:'se_p2_j2', sessionNumber:2, sessionTitle:'Jour 2 — Lower + Course avancée',
    sessionGoal:'Plio intensive bas + endurance vitesse.',
    sessionType:'lower-plio-endurance', estimatedDuration:'60-75 min', requiredEquipment:['Sans matériel','Box bas (option)'],
    isOptional:false,
    specialInstructions:'Course 2mn (85% Vmax) + 1mn marche × 6 cycles = endurance vitesse.',
    titanIntroMessage:'Bas du corps lourd. Le bloc course en fin de séance teste ta vitesse maintenue.',
    blocks:[
      {blockId:'warmup',  blockType:'warmup',title:'Échauffement focus bas'},
      {blockId:'rotation',blockType:'main',  title:'Mobilité + Power Rotation + Plio',executionMode:'enchaînement'},
      {blockId:'plio',    blockType:'main',  title:'Pliométrie',executionMode:'enchaînement'},
      {blockId:'pied',    blockType:'main',  title:'Travail du pied'},
      {blockId:'cardio',  blockType:'main',  title:'Endurance vitesse'},
      {blockId:'cooldown',blockType:'recovery',title:'Étirements'}
    ],
    exercises:[
      ex({id:'echauffement_dynamique',block:'warmup',sets:'-',reps:'10 mn',rest:'-',note:'Focus bas du corps'}),
      ex({id:'nineteen_nineteen',     block:'rotation',sets:'4',reps:'8 reps / côté',rest:'-',mode:'enchaînement',note:'1) Mobilité hanches'}),
      ex({id:'rotation_buste_explosive',block:'rotation',sets:'4',reps:'12 reps / côté',rest:'-',mode:'enchaînement',note:'2)'}),
      ex({id:'dips_explosifs',        block:'rotation',sets:'4',reps:'10 reps',rest:'-',mode:'enchaînement',note:'3)'}),
      ex({id:'depth_jumps',           block:'rotation',sets:'4',reps:'6 reps',rest:'2 mn',mode:'enchaînement',note:'4) Plio intensive'}),
      ex({id:'squat_jump',            block:'plio',sets:'3',reps:'12 reps',rest:'-',mode:'enchaînement',note:'1) Hauteur max'}),
      ex({id:'fente_bulgare_sautee',  block:'plio',sets:'3',reps:'8 reps / jambe',rest:'-',mode:'enchaînement',note:'2) Unilatéral explosif'}),
      ex({id:'box_jumps',             block:'plio',sets:'3',reps:'10 reps',rest:'-',mode:'enchaînement',note:'3)'}),
      ex({id:'calf_jumps',            block:'plio',sets:'3',reps:'15 reps',rest:'2 mn',mode:'enchaînement',note:'4) Mollets'}),
      ex({id:'marche_talons',         block:'pied',sets:'2',reps:'1 mn',rest:'30 s',note:'Rapide'}),
      ex({id:'marche_arriere_cote',   block:'pied',sets:'1',reps:'10 mn',rest:'-'}),
      ex({id:'course_2mn_85',         block:'cardio',sets:'6',reps:'Cycle',rest:'-'}),
      ex({id:'etirements_bas_corps',  block:'cooldown',sets:'-',reps:'8 mn',rest:'-'})
    ],
    feedbackQuestions:['difficulty','fatigue','pain','completed','comment'],
    adaptationRules:{titanCan:['rest','reps','variant','cardioIntensity'],titanCannot:['removeBlock']}
  };

  var p2_j3 = {
    sessionId:'se_p2_j3', sessionNumber:3, sessionTitle:'Jour 3 — Upper + Plio intensive',
    sessionGoal:'Survitesse + gainage + traction explosive.',
    sessionType:'upper-plio-survitesse', estimatedDuration:'60-75 min', requiredEquipment:['Sans matériel','Élastiques (option)','Côte/colline (sprint)'],
    isOptional:false,
    specialInstructions:'Survitesse avec élastiques si dispo, sinon mode classique. Sprint en côte 15s × 8 en fin.',
    titanIntroMessage:'Survitesse aujourd\'hui. Si t\'as les élastiques, tire le maximum. Sinon, vise la qualité du saut.',
    blocks:[
      {blockId:'warmup',   blockType:'warmup',title:'Échauffement explosif'},
      {blockId:'survitesse',blockType:'main', title:'Circuit Survitesse',executionMode:'enchaînement'},
      {blockId:'gainage',  blockType:'main', title:'Gainage',executionMode:'enchaînement'},
      {blockId:'force',    blockType:'main', title:'Force explosive haut'},
      {blockId:'cardio',   blockType:'main', title:'Sprint en côte'},
      {blockId:'cooldown', blockType:'recovery',title:'Étirements'}
    ],
    exercises:[
      ex({id:'echauffement_explosif',block:'warmup',sets:'-',reps:'10 mn',rest:'-',note:'Activation maximale'}),
      ex({id:'split_jumps',     block:'survitesse',sets:'5',reps:'10 reps',rest:'-',mode:'enchaînement',note:'1)'}),
      ex({id:'lateral_bounds',  block:'survitesse',sets:'5',reps:'12 reps (6/côté)',rest:'-',mode:'enchaînement',note:'2)'}),
      ex({id:'saut_survitesse', block:'survitesse',sets:'5',reps:'8 reps',rest:'2 mn 30',mode:'enchaînement',note:'3) Élastiques si dispo'}),
      ex({id:'planche_tap_epaules',block:'gainage',sets:'4',reps:'20 reps',rest:'-',mode:'enchaînement',note:'1)'}),
      ex({id:'l_sit_hold',      block:'gainage',sets:'4',reps:'20-30 s',rest:'-',mode:'enchaînement',note:'2)'}),
      ex({id:'planche_laterale',block:'gainage',sets:'4',reps:'30 s / côté',rest:'-',mode:'enchaînement',note:'3) Obliques'}),
      ex({id:'mountain_climbers',block:'gainage',sets:'4',reps:'30 s',rest:'1 mn 30',mode:'enchaînement',note:'4) Dynamique'}),
      ex({id:'pompes_claquees', block:'force',sets:'4',reps:'8-10 reps',rest:'1 mn 30',note:'Explosivité max'}),
      ex({id:'traction_explosive',block:'force',sets:'4',reps:'6-8 reps',rest:'1 mn 30',note:'Ou excentrique'}),
      ex({id:'dips_explosifs',  block:'force',sets:'3',reps:'10 reps',rest:'1 mn'}),
      ex({id:'sprint_cote_15s', block:'cardio',sets:'8',reps:'15 s',rest:'2 mn',intensity:'Puissance max'}),
      ex({id:'etirements_complets',block:'cooldown',sets:'-',reps:'8 mn',rest:'-'})
    ],
    feedbackQuestions:['difficulty','fatigue','pain','completed','comment'],
    adaptationRules:{titanCan:['rest','reps','variant','survitesseMode'],titanCannot:['removeBlock']}
  };

  var p2_j4 = {
    sessionId:'se_p2_j4', sessionNumber:4, sessionTitle:'Jour 4 — Full Body Circuit (Vitesse + Force + Plio + Power Rotation)',
    sessionGoal:'Circuit dense full body + fartlek 20mn.',
    sessionType:'fullbody-circuit', estimatedDuration:'65-80 min', requiredEquipment:['Sans matériel','Cônes','Gilet lesté (option)'],
    isOptional:false,
    specialInstructions:'Fartlek = jeu de vitesse libre 20 mn (pas de structure imposée).',
    titanIntroMessage:'Le plus dense de la semaine. Fartlek en fin = ressens ta vitesse.',
    blocks:[
      {blockId:'warmup',  blockType:'warmup',title:'Échauffement complet'},
      {blockId:'circuit1',blockType:'main',  title:'Circuit Vitesse + Force + Plio + Rotation',executionMode:'enchaînement'},
      {blockId:'circuit2',blockType:'main',  title:'Circuit Force/Pompes/Plio',executionMode:'enchaînement'},
      {blockId:'pied',    blockType:'main',  title:'Travail du pied'},
      {blockId:'cardio',  blockType:'main',  title:'Fartlek'},
      {blockId:'cooldown',blockType:'recovery',title:'Étirements'}
    ],
    exercises:[
      ex({id:'echauffement_complet',block:'warmup',sets:'-',reps:'10 mn',rest:'-',note:'Préparation intense'}),
      ex({id:'sprint_4_cones',     block:'circuit1',sets:'4',reps:'1 série',rest:'-',mode:'enchaînement',note:'1) Agilité'}),
      ex({id:'pompes_declinees',   block:'circuit1',sets:'4',reps:'10 reps',rest:'-',mode:'enchaînement',note:'2) Force pure haut'}),
      ex({id:'box_jumps',          block:'circuit1',sets:'4',reps:'8 reps',rest:'-',mode:'enchaînement',note:'3) Plio intensive'}),
      ex({id:'equilibre_yeux_fermes',block:'circuit1',sets:'4',reps:'20 s / jambe',rest:'-',mode:'enchaînement',note:'4) Stabilité'}),
      ex({id:'rotation_explosive_debout',block:'circuit1',sets:'4',reps:'12 reps / côté',rest:'3 mn',mode:'enchaînement',note:'5)'}),
      ex({id:'squat_jump_charge',  block:'circuit2',sets:'3',reps:'10 reps',rest:'-',mode:'enchaînement',note:'1) Gilet si dispo'}),
      ex({id:'pompes_archer',      block:'circuit2',sets:'3',reps:'8 reps / côté',rest:'-',mode:'enchaînement',note:'2)'}),
      ex({id:'fentes_sautees',     block:'circuit2',sets:'3',reps:'20 reps',rest:'-',mode:'enchaînement',note:'3)'}),
      ex({id:'burpees_tuck_jump',  block:'circuit2',sets:'3',reps:'8 reps',rest:'2 mn',mode:'enchaînement',note:'4) Full body intense'}),
      ex({id:'elevation_orteils',  block:'pied',sets:'3',reps:'15 reps',rest:'30 s',note:'+ Dorsiflexion'}),
      ex({id:'marche_arriere',     block:'pied',sets:'2',reps:'2 mn',rest:'30 s',note:'Rapide'}),
      ex({id:'fartlek_20mn',       block:'cardio',sets:'1',reps:'20 mn',rest:'-',intensity:'Vitesse libre'}),
      ex({id:'etirements_complets',block:'cooldown',sets:'-',reps:'10 mn',rest:'-'})
    ],
    feedbackQuestions:['difficulty','fatigue','pain','completed','comment'],
    adaptationRules:{titanCan:['rest','reps','variant','fartlekIntensity'],titanCannot:['removeBlock']}
  };

  var p2_j5 = {
    sessionId:'se_p2_j5', sessionNumber:5, sessionTitle:'Jour 5 — OPTIONNEL : Vitesse + Power Rotation + Récupération active',
    sessionGoal:'Sprints variés + power rotation + retour au calme.',
    sessionType:'optional-speed-recovery', estimatedDuration:'60-75 min', requiredEquipment:['Sans matériel','Élastiques (option)'],
    isOptional:true,
    specialInstructions:'Séance OPTIONNELLE. Peut être sautée si fatigue accumulée.',
    titanIntroMessage:'Séance bonus. Vitesse pure + retour calme. Skippe si tu n\'as pas la fraîcheur.',
    blocks:[
      {blockId:'warmup',  blockType:'warmup',title:'Échauffement léger'},
      {blockId:'sprint',  blockType:'main',  title:'Sprints variés'},
      {blockId:'rotation',blockType:'main',  title:'Power Rotation'},
      {blockId:'controle',blockType:'main',  title:'Tempo lent (contrôle)'},
      {blockId:'cardio',  blockType:'main',  title:'Récupération active'},
      {blockId:'cooldown',blockType:'recovery',title:'Étirements longs'}
    ],
    exercises:[
      ex({id:'echauffement_leger',block:'warmup',sets:'-',reps:'10 mn',rest:'-',note:'Activation douce'}),
      ex({id:'sprint_20m_x6',     block:'sprint',sets:'6',reps:'20 m',rest:'2 mn'}),
      ex({id:'sprint_40m_x4',     block:'sprint',sets:'4',reps:'40 m',rest:'3 mn'}),
      ex({id:'sprint_60m_x2',     block:'sprint',sets:'2',reps:'60 m',rest:'4 mn'}),
      ex({id:'rotation_buste_explosive',block:'rotation',sets:'4',reps:'15 reps / côté',rest:'1 mn'}),
      ex({id:'rotation_buste_unipodal',block:'rotation',sets:'3',reps:'12 reps / côté',rest:'1 mn'}),
      ex({id:'wood_chops',        block:'rotation',sets:'3',reps:'15 reps / côté',rest:'1 mn',note:'Si élastiques'}),
      ex({id:'pompes_tempo_lent', block:'controle',sets:'2',reps:'10 reps',rest:'-'}),
      ex({id:'squat_tempo_lent',  block:'controle',sets:'2',reps:'15 reps',rest:'-'}),
      ex({id:'planche_simple',    block:'controle',sets:'2',reps:'45 s',rest:'-'}),
      ex({id:'stretching_dynamique',block:'controle',sets:'2',reps:'8 reps',rest:'1 mn'}),
      ex({id:'course_20mn_65',    block:'cardio',sets:'1',reps:'20 mn',rest:'-',intensity:'65% Vmax'}),
      ex({id:'etirements_longs',  block:'cooldown',sets:'-',reps:'15 mn',rest:'-'})
    ],
    feedbackQuestions:['difficulty','fatigue','pain','completed','comment'],
    adaptationRules:{titanCan:['skip','rest','reps','variant'],titanCannot:['forceIfFatigued']}
  };

  // ─── ASSEMBLAGE ──────────────────────────────────────────────────────────
  function makeWeek(phaseId, weekNumber, focus, setsLabel, sessions, opts) {
    opts = opts || {};
    return {
      weekId: phaseId+'_w'+weekNumber,
      weekNumber: weekNumber,
      weekFocus: focus,
      setsModifier: setsLabel,
      requiredSessions: sessions.filter(function(s){return s.required;}).map(function(s){return s.id;}),
      optionalSessions: sessions.filter(function(s){return !s.required;}).map(function(s){return s.id;}),
      validationRule: opts.validationRule || 'Toutes les séances requises terminées pour valider la semaine.',
      specialNote: opts.specialNote || null,
      sessions: sessions
    };
  }

  var P1_SESS = [
    {id:'se_p1_j1',required:true},{id:'se_p1_j2',required:true},{id:'se_p1_j3',required:true},
    {id:'se_p1_j4',required:true},{id:'se_p1_j5',required:true},{id:'se_p1_j6',required:true}
  ];
  var P2_SESS = [
    {id:'se_p2_j1',required:true},{id:'se_p2_j2',required:true},{id:'se_p2_j3',required:true},
    {id:'se_p2_j4',required:true},{id:'se_p2_j5',required:false}
  ];

  // Phase 1 : progression par bloc de 2 semaines
  var phase1Weeks = [
    makeWeek('se_p1',1,'Adaptation — maîtriser 6 séances/semaine',6,P1_SESS),
    makeWeek('se_p1',2,'Adaptation (suite)',6,P1_SESS),
    makeWeek('se_p1',3,'Intensification — réduire les temps de repos',6,P1_SESS),
    makeWeek('se_p1',4,'Intensification (suite)',6,P1_SESS),
    makeWeek('se_p1',5,'Surcharge — volume + intensité max',6,P1_SESS),
    makeWeek('se_p1',6,'Surcharge (suite)',6,P1_SESS),
    makeWeek('se_p1',7,'Affûtage — réduction volume',6,P1_SESS,{specialNote:'Super Explosif Test intermédiaire (cf. I3 — protocole à confirmer)'}),
    makeWeek('se_p1',8,'Affûtage + Super Explosif Test',6,P1_SESS,{specialNote:'Test intermédiaire fin Phase 1.'})
  ];

  var phase2Weeks = [
    makeWeek('se_p2',9, 'Introduction course avancée — Sprints 30 m × 6','-',P2_SESS),
    makeWeek('se_p2',10,'Introduction course avancée (suite)',           '-',P2_SESS),
    makeWeek('se_p2',11,'Intensification — Sprints 40 m × 6 + intervalles longs','-',P2_SESS),
    makeWeek('se_p2',12,'Intensification (suite)',                       '-',P2_SESS),
    makeWeek('se_p2',13,'Surcharge — Sprints 50 m × 6 + fartlek 25 mn',  '-',P2_SESS),
    makeWeek('se_p2',14,'Surcharge (suite)',                             '-',P2_SESS),
    makeWeek('se_p2',15,'Affûtage',                                      '-',P2_SESS),
    makeWeek('se_p2',16,'Super Explosif Test FINAL',                     '-',P2_SESS,{
      specialNote:'Test final semaine 16 : 94 feet → Sprint 60m → Détente verticale → Pesée + photos → Tests de force. Comparer avec semaine 1 et semaine 8.',
      validationRule:'Test final obligatoire pour clore le programme.'
    })
  ];

  var program = {
    programId:'se',
    programName:'Shred Explose',
    programGoal:'Perdre du gras ET gagner en explosivité',
    totalWeeks:16,
    programFrequency:'Phase 1 : 6 j/sem (max 1h) — Phase 2 : 4-5 j/sem',
    programLocation:'Phase 1 : sans matériel — Phase 2 : salle recommandée (max 1h)',
    requiredTests:['Super Explosif Test FINAL semaine 16 (94 feet + Sprint 60m + Détente + Pesée + Force)'],
    optionalTests:['Pesée + photos (avant/sem.8/sem.16)','Tests de force (1RM Squat/SDT/HT/DC à inclure dans le test final)'],
    specialRules:[
      'NUTRITION = 70-80% des résultats sur Phase 1. À rappeler dans l\'UI.',
      'Challenges en rotation tous les 2 jours (J1/J3/J5) : Bring Sally Up → Pompes max 2 mn → Burpees max 3 mn. Noter les scores.',
      'Jour 5 Phase 2 OPTIONNEL — peut être sauté si fatigue.',
      'Super Explosif Test FINAL sem.16 : comparer avec sem.1 et sem.8.'
    ],
    phases:[
      {
        phaseId:'se_p1', phaseName:'PHASE 1 — DETOX TURBO', phaseNumber:1,
        phaseGoal:'Perdre de la masse grasse de manière significative tout en construisant une base d\'explosivité.',
        durationWeeks:8, frequency:'6 j/sem (max 1h)', location:'Sans matériel',
        progressionRules:[
          {weeks:'1-2',sets:6,focus:'Adaptation — maîtriser 6 séances/sem'},
          {weeks:'3-4',sets:6,focus:'Intensification — réduire les repos'},
          {weeks:'5-6',sets:6,focus:'Surcharge — volume + intensité max'},
          {weeks:'7-8',sets:6,focus:'Affûtage + Super Explosif Test intermédiaire'}
        ],
        weeks:phase1Weeks,
        sessions:{se_p1_j1:p1_j1,se_p1_j2:p1_j2,se_p1_j3:p1_j3,se_p1_j4:p1_j4,se_p1_j5:p1_j5,se_p1_j6:p1_j6}
      },
      {
        phaseId:'se_p2', phaseName:'PHASE 2 — EXPLOSIVE MUSCLE', phaseNumber:2,
        phaseGoal:'Développer l\'explosivité athlétique au maximum tout en maintenant la perte de poids.',
        durationWeeks:8, frequency:'4-5 j/sem (max 1h)', location:'Salle recommandée',
        progressionRules:[
          {weeks:'9-10', focus:'Introduction course avancée — Sprints 30m × 6'},
          {weeks:'11-12',focus:'Intensification — Sprints 40m × 6 + intervalles longs'},
          {weeks:'13-14',focus:'Surcharge — Sprints 50m × 6 + fartlek 25mn'},
          {weeks:'15-16',focus:'Affûtage + Super Explosif Test Final sem.16'}
        ],
        weeks:phase2Weeks,
        sessions:{se_p2_j1:p2_j1,se_p2_j2:p2_j2,se_p2_j3:p2_j3,se_p2_j4:p2_j4,se_p2_j5:p2_j5}
      }
    ],
    finalNote:'16 semaines terminées : Perte 6-12 kg | Détente +5-10 cm | Physique athlétique | Mental d\'acier.'
  };

  var verificationTable = [];
  for (var w=1; w<=8; w++) verificationTable.push({program:'se',phase:1,week:w,sessions:['j1','j2','j3','j4','j5','j6'],status: w===7||w===8 ? 'TEST INTERMÉDIAIRE — voir I3' : 'OK'});
  for (var w2=9; w2<=16; w2++) verificationTable.push({program:'se',phase:2,week:w2,sessions:['j1','j2','j3','j4','j5(opt)'],status: w2===16 ? 'TEST FINAL' : 'OK'});

  var allExoIds = Object.keys(SE_MASTER_EXERCISES);
  var stats = {
    totalPhases:2,
    totalWeeks:16,
    totalSessionTemplates:11,
    uniqueExercises:allExoIds.length,
    exercisesWithVideo:0,
    exercisesWithoutVideo:allExoIds.map(function(id){return{exerciseId:id,masterName:SE_MASTER_EXERCISES[id].masterName,category:SE_MASTER_EXERCISES[id].category};})
  };

  return {program:program,masterExercises:SE_MASTER_EXERCISES,verificationTable:verificationTable,stats:stats};
});
