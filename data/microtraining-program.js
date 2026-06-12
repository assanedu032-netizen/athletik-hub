// ════════════════════════════════════════════════════════════════════════════
// MICROTRAINING — SOURCE DE VÉRITÉ DU PROGRAMME (data layer, non intégré UI)
// ────────────────────────────────────────────────────────────────────────────
// Sources (ordre de priorité en cas de conflit) :
//   1. Livre "Les Secrets de la Détente Verticale" — ton Titan, philosophie
//   2. "Microtraining_Presentation.docx" (uploadé 2026-06-12) — description
//      complète : 3 piliers / 9 micros détaillés / paliers jeûne / niveaux
//      sprint / règles d'or / bilan hebdomadaire / bonus
//   3. Liste_maitre_exercices_BESOIN_v1.xlsx (non lu en binaire ici)
//   4. Intégration Elite Athlete + Triphasique = référence de structure
//
// CE FICHIER N'EST PAS BRANCHÉ DANS L'UI — étape de validation.
//
// ─── RÉSUMÉ ────────────────────────────────────────────────────────────────
// Nom         : MICROTRAINING
// Objectif    : Discipline + régularité + performance physique en 15 min/jour
// Durée       : 6 semaines MINIMUM
// Fréquence   : 9 micro-séances par semaine — libre répartition
// Structure   : 6 semaines × 9 micros = 54 séances obligatoires
// Lieu        : Sans matériel
// Compteurs   : 1 phase · 6 semaines · 9 micros distincts (dont Micro 1 =
//               protocole jeûne, Micro 3 = respiration, Micro 9 = free-choice)
//
// ─── RÈGLES SPÉCIALES (extraites du DOCX, source de vérité) ─────────────────
//   R1. 9/9 OBLIGATOIRE pour valider la semaine. 8/9 = échec = recommencer
//       la MÊME semaine. Pas de dérogation.
//   R2. MAXIMUM 2 micro-séances par jour. De préférence de natures
//       différentes (ex. Jeûne + Circuit, Breathing + Pliométrie).
//   R3. PAS DE CUMUL d'une semaine sur l'autre. Chaque semaine est une
//       entité complète.
//   R4. Bilan hebdomadaire à JOUR FIXE (dimanche soir recommandé) :
//       "Est-ce que j'ai fait mes 9 micro-séances cette semaine ?"
//   R5. Engagement total : si tu commences, tu finis les 6 semaines minimum.
//   R6. La structure (exos / reps / circuits) NE BOUGE PAS sur 6 semaines.
//       Ce qui évolue, c'est l'athlète à l'intérieur (intensité, qualité,
//       contrôle, vitesse). Pas de progression de volume programmée.
//   R7. Tests SAT / SET = OPTIONNELS au début et à la fin (cf. prompt
//       utilisateur — non mentionné dans le docx, mais explicité par le
//       propriétaire au prompt 1).
//   R8. Micro 1 (Jeûne) compte dans les 9 micros obligatoires bien que ce
//       NE soit PAS une séance active.
//   R9. Sécurité jeûne : eau uniquement, pas de café sucré/jus/grignotage.
//       Si vertiges/nausées → arrêter immédiatement.
//
// ─── INCOHÉRENCES / POINTS À CONFIRMER ──────────────────────────────────────
//   I1. Le docx dit "10 à 15 minutes" pour les séances ; le prompt 1
//       utilisateur disait "10 à 18 mn" et "Micro 6 : 15-18 mn". Pas
//       d'incohérence majeure, j'aligne sur les durées du docx (10-12,
//       12-15, 15-18 selon micro).
//   I2. Le docx dit "Micro 2 : 12-15 mn" et explicite 2 circuits × 3 tours
//       chacun avec 1 mn de repos entre les tours du C1 (silence sur C2).
//       J'applique "1 mn entre tours" sur C1 et C2 par cohérence — à confirmer.
//   I3. Micro 5 et Micro 6 : repos entre tours = "49 s" (chiffre étrange).
//       Confirmé par le docx — gardé tel quel.
//   I4. Micro 7 : Circuit 3 dit "sans repos" entre les 2 exos mais ne
//       précise pas le repos entre tours. Hypothèse : pas de repos entre
//       tours non plus (puisque exos courts). À confirmer.
//   I5. Micro 8 : le sprint cardio inclut 3 niveaux mais ne dit pas comment
//       choisir / quand monter de niveau. Hypothèse Titan : choix initial =
//       Niveau 1, montée selon réussite 9/9 sur 2 semaines.
//   I6. "Transmission de force" mentionnée Micro 6 Circuit 2 ("inclus dans
//       les 6 mn") — pas la même règle que Triphasique (9 mn). Spécifique
//       à ce micro. Bien noter dans l'UI.
//   I7. Le docx mentionne 2 bonus (Salle + Métabolique, 4 sem chacun) post-
//       programme. Pas intégrés dans ce fichier — programmes séparés à
//       documenter si validation propriétaire.
//
// ─── VIDÉOS ────────────────────────────────────────────────────────────────
// Toutes en videoStatus="missing". Le docx mentionne explicitement que la
// vidéo Micro 3 (protocole respiration) est "disponible en vidéo dans
// l'application" — placeholder en attendant l'URL.
// ════════════════════════════════════════════════════════════════════════════

(function (root, factory) {
  var lib = factory();
  if (typeof module === 'object' && module.exports) module.exports = lib;
  if (root) root.MICROTRAINING_PROGRAM = lib.program;
  if (root) root.MICROTRAINING_LIB = lib;
})(typeof window !== 'undefined' ? window : null, function () {

  var MT_MASTER_EXERCISES = {
    // — Échauffement / récup —
    echauffement_dynamique:   { masterName: 'Échauffement dynamique',                  category: 'Échauffement', videoUrl: null, generic: true, pdfAliases: ['Échauffement : dynamique + rouleau ou pistolet de massage si disponible'] },

    // — Circuit Athlétique (Micro 2) —
    vitesse_4_cones:          { masterName: 'Vitesse 4 cônes',                         category: 'Vitesse',        videoUrl: null },
    sprint_triangle:          { masterName: 'Sprint triangle',                         category: 'Vitesse',        videoUrl: null },
    puissance_rotation:       { masterName: 'Puissance de rotation',                   category: 'Power rotation', videoUrl: null },
    double_squat_dynamique:   { masterName: 'Double squat dynamique',                  category: 'Pliométrie',     videoUrl: null },
    fente_surelevee_proprio:  { masterName: 'Fente surélevée et proprio 1',            category: 'Proprioception', videoUrl: null },
    fente_3d:                 { masterName: 'Fente 3D (proprioception)',               category: 'Proprioception', videoUrl: null, pdfAliases: ['Fente 3D'] },

    // — Mobilité (Micro 4 Circuit 1) —
    nineteen_nineteen:        { masterName: '90/90',                                   category: 'Mobilité',       videoUrl: null },
    cat_cow:                  { masterName: 'Cat Cow',                                 category: 'Mobilité',       videoUrl: null },

    // — Renforcement excentrique (Micro 4 Circuit 2) —
    reverse_nordic:           { masterName: 'Reverse Nordic',                          category: 'Force excentrique', videoUrl: null },
    nordic_hamstring:         { masterName: 'Nordic Hamstring',                        category: 'Force excentrique', videoUrl: null },
    sissy_squat:              { masterName: 'Sissy Squat',                             category: 'Force excentrique', videoUrl: null },

    // — Force Haut du Corps (Micro 5) —
    pompe_excentrique:        { masterName: 'Pompe excentrique',                       category: 'Force haut',     videoUrl: null },
    dips:                     { masterName: 'Dips',                                    category: 'Force haut',     videoUrl: null },
    traction_supination:      { masterName: 'Traction supination (4 positions jambes / Knee elevation)', category: 'Force haut', videoUrl: null },
    superman:                 { masterName: 'Superman',                                category: 'Gainage',        videoUrl: null },
    rocking_deadbug:          { masterName: 'Rocking Deadbug',                         category: 'Gainage',        videoUrl: null },

    // — Pliométrie Intensive (Micro 6) —
    sprint_20m:               { masterName: 'Sprint 20 m',                             category: 'Vitesse',        videoUrl: null },
    tap_boum:                 { masterName: 'Tap Boum',                                category: 'Pliométrie',     videoUrl: null },
    tuck_jump:                { masterName: 'Tuck Jump',                               category: 'Pliométrie',     videoUrl: null },
    lateral_bound:            { masterName: 'Lateral Bound',                           category: 'Pliométrie',     videoUrl: null },
    depth_jump:               { masterName: 'Depth Jump',                              category: 'Pliométrie intensive', videoUrl: null },
    proprio_1:                { masterName: 'Proprio 1',                               category: 'Proprioception', videoUrl: null },
    proprio_2:                { masterName: 'Proprio 2',                               category: 'Proprioception', videoUrl: null },
    transmission_force_inclus:{ masterName: 'Transmission de force (inclus dans Proprio 6 mn)', category: 'Transmission Force', videoUrl: null, generic: true },

    // — Isométrie & Stabilité (Micro 7) —
    fente_avant_iso:          { masterName: 'Fente avant iso',                         category: 'Isométrique',    videoUrl: null },
    iso_ischio:               { masterName: 'Iso ischio',                              category: 'Isométrique',    videoUrl: null },
    split_stance:             { masterName: 'Split stance',                            category: 'Isométrique',    videoUrl: null },
    sumo_squat_iso:           { masterName: 'Sumo squat iso',                          category: 'Isométrique',    videoUrl: null },
    elevation_tibial_anterieur:{ masterName: 'Élévation tibial antérieur',             category: 'Travail du pied', videoUrl: null },
    elevation_talon:          { masterName: 'Élévation talon',                         category: 'Travail du pied', videoUrl: null },

    // — Sprint Cardio (Micro 8) —
    sprint_cardio_cycle:      { masterName: 'Cycle Sprint 10s + Jogging 30s + Marche 20s', category: 'Cardio',     videoUrl: null, pdfAliases: ['Sprint 10 s + Jogging 30 s + Marche 20 s'] },

    // — Respiration (Micro 3) — protocole en vidéo dédiée
    respiration_protocole:    { masterName: 'Protocole respiration contrôlée',         category: 'Récupération active', videoUrl: null, generic: true, pdfAliases: ['Le protocole exact est disponible en vidéo dans l\'application'] },

    // — Jeûne (Micro 1) — pas un exo physique
    jeune_progressif:         { masterName: 'Jeûne progressif (eau uniquement)',       category: 'Mental & Discipline', videoUrl: null, generic: true, nonExecutable: true }
  };

  function ex(opts) {
    var master = MT_MASTER_EXERCISES[opts.id] || {};
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

  // ─── PALIERS JEÛNE (Micro 1) — extraits du docx ──────────────────────────
  var FASTING_LEVELS = {
    debutant: {
      label: 'Débutant',
      paliers: [
        { weekRange: '1-2', durationHours: 4 },
        { weekRange: '3',   durationHours: 8 },
        { weekRange: '4',   durationHours: 12 },
        { weekRange: '5',   durationHours: 16 },
        { weekRange: '6',   durationHours: 18 }
      ]
    },
    avance: {
      label: 'Avancé',
      paliers: [
        { weekRange: '1-2', durationHours: 8 },
        { weekRange: '3',   durationHours: 18 },
        { weekRange: '4',   durationHours: 24 },
        { weekRange: '5',   durationHours: 30 },
        { weekRange: '6',   durationHours: 36 }
      ]
    },
    note: 'Ne passe au palier suivant que lorsque tu maîtrises vraiment le précédent. N\'hésite pas à refaire plusieurs fois le même palier.'
  };

  // ─── NIVEAUX SPRINT CARDIO (Micro 8) ─────────────────────────────────────
  var SPRINT_CARDIO_LEVELS = [
    { id: 1, label: 'Niveau 1 — Débutant',     cycles: 7,  totalDuration: '~ 7 mn' },
    { id: 2, label: 'Niveau 2 — Intermédiaire',cycles: 12, totalDuration: '~ 12 mn' },
    { id: 3, label: 'Niveau 3 — Avancé',       cycles: 15, totalDuration: '~ 15 mn' }
  ];

  // ─── LES 9 MICRO-SÉANCES ─────────────────────────────────────────────────

  // MICRO 1 — JEÛNE PROGRESSIF (non-active session)
  var micro1 = {
    sessionId:'mt_m1',
    sessionNumber:1,
    sessionTitle:'Micro 1 — Jeûne Progressif',
    sessionGoal:'Développer le mental et la discipline.',
    sessionType:'fasting',                     // pas une séance d'exos
    isActiveSession:false,
    isOptionalChoice:false,
    estimatedDuration:'Variable (selon palier — 4h à 36h)',
    requiredEquipment:['Eau'],
    isOptional:false,
    structureType:'fasting',                   // schéma utilisateur
    specialInstructions:'EAU UNIQUEMENT. Pas de café sucré, pas de jus, pas de grignotage. Si vertiges, nausées ou sensation anormale → ARRÊTER immédiatement et demander un avis médical si nécessaire.',
    titanIntroMessage:'Le jeûne, c\'est ta première confrontation avec toi-même. Pas une compétition. Tu apprivoises, tu n\'imposes pas.',
    blocks:[
      { blockId:'fasting_window', blockType:'fasting', title:'Fenêtre de jeûne', executionMode:'protocole' }
    ],
    exercises:[
      ex({id:'jeune_progressif', block:'fasting_window', sets:'1', reps:'Durée selon palier', rest:'-', note:'Voir FASTING_LEVELS pour le palier correspondant au niveau + semaine.'})
    ],
    fastingProtocol: FASTING_LEVELS,
    feedbackQuestions:['startTime','endTime','targetHours','reached','hydrationOk','feeling','comment'],
    validationCriteria:'Durée cible atteinte sans symptôme (vertige/nausée/malaise).',
    adaptationRules:{
      titanCan:['suggestLevel','suggestPalier','remindHydration'],
      titanCannot:['pushBeyondSafety','recommendDryFast']
    }
  };

  // MICRO 2 — CIRCUIT ATHLÉTIQUE (2 circuits × 3 tours)
  var micro2 = {
    sessionId:'mt_m2',
    sessionNumber:2,
    sessionTitle:'Micro 2 — Circuit Athlétique',
    sessionGoal:'Vitesse, puissance et coordination.',
    sessionType:'circuit',
    isActiveSession:true,
    isOptionalChoice:false,
    estimatedDuration:'12-15 min',
    requiredEquipment:['Sans matériel','Cônes (option)'],
    isOptional:false,
    structureType:'circuit',
    specialInstructions:'Deux circuits enchaînés, 3 tours chacun. Tu fais TOUS les exos du tour à la suite (pas de repos entre exos), repos UNIQUEMENT à la fin du tour : 1 mn entre les tours.',
    titanIntroMessage:'Circuit. Enchaîne tous les exos d\'un tour, puis repose-toi. Pas de pause au milieu.',
    blocks:[
      { blockId:'c1', blockType:'circuit', title:'Circuit 1 — 3 tours', executionMode:'repos-fin-tour', rounds:3, restBetweenRounds:'1 mn' },
      { blockId:'c2', blockType:'circuit', title:'Circuit 2 — 3 tours', executionMode:'repos-fin-tour', rounds:3, restBetweenRounds:'1 mn' }
    ],
    exercises:[
      // Circuit 1
      ex({id:'vitesse_4_cones',     block:'c1', sets:'3 tours', reps:'4 reps', rest:'Enchaînement', mode:'enchaînement'}),
      ex({id:'sprint_triangle',     block:'c1', sets:'3 tours', reps:'4 reps', rest:'Enchaînement', mode:'enchaînement'}),
      ex({id:'puissance_rotation',  block:'c1', sets:'3 tours', reps:'4 reps / côté', rest:'Enchaînement', mode:'enchaînement'}),
      ex({id:'double_squat_dynamique',block:'c1', sets:'3 tours', reps:'4 reps', rest:'1 mn fin de tour', mode:'enchaînement'}),
      // Circuit 2
      ex({id:'fente_surelevee_proprio',block:'c2', sets:'3 tours', reps:'4 reps / jambe', rest:'Enchaînement', mode:'enchaînement'}),
      ex({id:'fente_3d',             block:'c2', sets:'3 tours', reps:'4 reps / jambe', rest:'1 mn fin de tour', mode:'enchaînement'})
    ],
    feedbackQuestions:['difficulty','fatigue','pain','completed','comment'],
    validationCriteria:'2 circuits × 3 tours complétés.',
    adaptationRules:{
      titanCan:['rest','reps','variant'],
      titanCannot:['breakCircuit','removeRound']
    }
  };

  // MICRO 3 — RESPIRATION CONTRÔLÉE (8-10 mn, vidéo dédiée)
  var micro3 = {
    sessionId:'mt_m3',
    sessionNumber:3,
    sessionTitle:'Micro 3 — Respiration Contrôlée',
    sessionGoal:'Récupération active et système nerveux (réduire le stress, activer le parasympathique).',
    sessionType:'breathing',
    isActiveSession:true,
    isOptionalChoice:false,
    estimatedDuration:'8-10 min',
    requiredEquipment:['Lieu calme'],
    isOptional:false,
    structureType:'breathing',
    specialInstructions:'Lieu calme. Suivre le protocole vidéo. Le protocole exact est disponible en vidéo dans l\'application.',
    titanIntroMessage:'Ta récupération mentale et physique. Lieu calme. Suis la vidéo, laisse le système nerveux faire.',
    blocks:[
      { blockId:'breathing', blockType:'breathing', title:'Protocole respiration', executionMode:'protocole' }
    ],
    exercises:[
      ex({id:'respiration_protocole', block:'breathing', sets:'1', reps:'8-10 mn', rest:'-', note:'Vidéo dans l\'app (placeholder en attendant l\'URL).'})
    ],
    feedbackQuestions:['feeling','stressLevelBefore','stressLevelAfter','completed','comment'],
    validationCriteria:'Durée complétée (8-10 min sans interruption majeure).',
    adaptationRules:{
      titanCan:['extendDuration','suggestPosture'],
      titanCannot:['skipProtocol']
    }
  };

  // MICRO 4 — MOBILITÉ & RENFORT (2 circuits × 3 tours)
  var micro4 = {
    sessionId:'mt_m4',
    sessionNumber:4,
    sessionTitle:'Micro 4 — Mobilité & Renfort',
    sessionGoal:'Prévention et qualité de mouvement.',
    sessionType:'circuit',
    isActiveSession:true,
    isOptionalChoice:false,
    estimatedDuration:'12-15 min',
    requiredEquipment:['Sans matériel'],
    isOptional:false,
    structureType:'circuit',
    specialInstructions:'2 circuits × 3 tours, enchaînement (pas de repos entre exos d\'un tour). Focus excentrique : descente lente 3-4 secondes sur le Circuit 2.',
    titanIntroMessage:'Mobilité d\'abord, excentrique ensuite. La descente lente sur le C2 — c\'est là que tu construis la prévention.',
    blocks:[
      { blockId:'c1', blockType:'circuit', title:'Circuit 1 — Mobilité (3 tours)', executionMode:'repos-fin-tour', rounds:3 },
      { blockId:'c2', blockType:'circuit', title:'Circuit 2 — Renforcement excentrique (3 tours)', executionMode:'repos-fin-tour', rounds:3 }
    ],
    exercises:[
      ex({id:'nineteen_nineteen', block:'c1', sets:'3 tours', reps:'4 reps', rest:'Enchaînement', mode:'enchaînement'}),
      ex({id:'cat_cow',           block:'c1', sets:'3 tours', reps:'4 reps', rest:'Enchaînement', mode:'enchaînement'}),
      ex({id:'fente_3d',          block:'c1', sets:'3 tours', reps:'4 reps / jambe', rest:'Repos fin de tour', mode:'enchaînement'}),
      ex({id:'reverse_nordic',    block:'c2', sets:'3 tours', reps:'4 reps', rest:'Enchaînement', mode:'enchaînement', tempo:'3-4s descente'}),
      ex({id:'nordic_hamstring',  block:'c2', sets:'3 tours', reps:'4 reps', rest:'Enchaînement', mode:'enchaînement', tempo:'3-4s descente'}),
      ex({id:'sissy_squat',       block:'c2', sets:'3 tours', reps:'4 reps', rest:'Repos fin de tour', mode:'enchaînement', tempo:'3-4s descente'})
    ],
    feedbackQuestions:['difficulty','fatigue','pain','completed','comment'],
    validationCriteria:'2 circuits × 3 tours complétés avec contrôle excentrique.',
    adaptationRules:{
      titanCan:['rest','reps','variant'],
      titanCannot:['breakTempo','removeExc']
    }
  };

  // MICRO 5 — FORCE HAUT DU CORPS (2 circuits × 3 tours, 49s repos entre tours)
  var micro5 = {
    sessionId:'mt_m5',
    sessionNumber:5,
    sessionTitle:'Micro 5 — Force Haut du Corps',
    sessionGoal:'Push, Pull et gainage.',
    sessionType:'circuit',
    isActiveSession:true,
    isOptionalChoice:false,
    estimatedDuration:'10-12 min',
    requiredEquipment:['Sans matériel','Barre traction','Chaise/banc'],
    isOptional:false,
    structureType:'circuit',
    specialInstructions:'2 circuits × 3 tours. 49 SECONDES de repos entre chaque tour. Tempo contrôlé, amplitude complète.',
    titanIntroMessage:'Push + Pull + gainage. Tempo contrôlé, amplitude max. La qualité prime sur la vitesse.',
    blocks:[
      { blockId:'c1', blockType:'circuit', title:'Circuit 1 — 3 tours', executionMode:'repos-fin-tour', rounds:3, restBetweenRounds:'49 s' },
      { blockId:'c2', blockType:'circuit', title:'Circuit 2 — 3 tours', executionMode:'repos-fin-tour', rounds:3, restBetweenRounds:'49 s' }
    ],
    exercises:[
      ex({id:'pompe_excentrique', block:'c1', sets:'3 tours', reps:'7 reps', rest:'Enchaînement', mode:'enchaînement'}),
      ex({id:'dips',              block:'c1', sets:'3 tours', reps:'7 reps', rest:'Enchaînement', mode:'enchaînement'}),
      ex({id:'traction_supination',block:'c1', sets:'3 tours', reps:'7 reps', rest:'49 s fin de tour', mode:'enchaînement'}),
      ex({id:'superman',          block:'c2', sets:'3 tours', reps:'7 reps', rest:'Enchaînement', mode:'enchaînement'}),
      ex({id:'rocking_deadbug',   block:'c2', sets:'3 tours', reps:'7 reps', rest:'49 s fin de tour', mode:'enchaînement'})
    ],
    feedbackQuestions:['difficulty','fatigue','pain','completed','comment'],
    validationCriteria:'2 circuits × 3 tours complétés.',
    adaptationRules:{
      titanCan:['rest','reps','variant'],
      titanCannot:['breakCircuit']
    }
  };

  // MICRO 6 — PLIOMÉTRIE INTENSIVE (échauffement + 2 circuits)
  var micro6 = {
    sessionId:'mt_m6',
    sessionNumber:6,
    sessionTitle:'Micro 6 — Pliométrie Intensive',
    sessionGoal:'Explosivité et réactivité.',
    sessionType:'plio-intensive',
    isActiveSession:true,
    isOptionalChoice:false,
    estimatedDuration:'15-18 min',
    requiredEquipment:['Sans matériel','Espace sprint 20m','Box/marche (option)','Rouleau ou pistolet massage (option)'],
    isOptional:false,
    structureType:'circuit',
    specialInstructions:'ÉCHAUFFEMENT obligatoire avant ce micro (cf. consigne propriétaire). Circuit 1 : 5 exos enchaînés, 49s repos entre tours. Circuit 2 : 6 mn continues de proprio + Transmission Force incluse. Intention MAX à chaque rep — si la vitesse baisse, tu arrêtes.',
    titanIntroMessage:'Échauffement d\'abord. Puis 5 exos plio à 100%. Si la vitesse baisse, tu arrêtes — c\'est la règle.',
    blocks:[
      { blockId:'warmup', blockType:'warmup',  title:'Échauffement dynamique + automassage' },
      { blockId:'c1',     blockType:'circuit', title:'Circuit 1 — 3 tours (49s repos)', executionMode:'repos-fin-tour', rounds:3, restBetweenRounds:'49 s' },
      { blockId:'c2',     blockType:'continu', title:'Circuit 2 — Proprio + Transmission Force (6 mn continues)', executionMode:'continu' }
    ],
    exercises:[
      ex({id:'echauffement_dynamique', block:'warmup', sets:'-', reps:'5-8 mn', rest:'-', note:'Échauffement + rouleau/pistolet si dispo'}),
      ex({id:'sprint_20m',   block:'c1', sets:'3 tours', reps:'7 reps', rest:'Enchaînement', mode:'enchaînement'}),
      ex({id:'tap_boum',     block:'c1', sets:'3 tours', reps:'7 reps', rest:'Enchaînement', mode:'enchaînement'}),
      ex({id:'tuck_jump',    block:'c1', sets:'3 tours', reps:'7 reps', rest:'Enchaînement', mode:'enchaînement'}),
      ex({id:'lateral_bound',block:'c1', sets:'3 tours', reps:'7 reps / côté', rest:'Enchaînement', mode:'enchaînement'}),
      ex({id:'depth_jump',   block:'c1', sets:'3 tours', reps:'7 reps', rest:'49 s fin de tour', mode:'enchaînement'}),
      ex({id:'proprio_1',    block:'c2', sets:'-', reps:'~ 3 mn (inclus dans 6 mn continues)', rest:'-', mode:'continu'}),
      ex({id:'proprio_2',    block:'c2', sets:'-', reps:'~ 3 mn (inclus dans 6 mn continues)', rest:'-', mode:'continu'}),
      ex({id:'transmission_force_inclus', block:'c2', sets:'-', reps:'Inclus dans 6 mn proprio', rest:'-', note:'Mouvements spécifiques à ton objectif — inclus dans le bloc de 6 mn.'})
    ],
    feedbackQuestions:['difficulty','fatigue','pain','completed','speedKept','comment'],
    validationCriteria:'Échauffement + Circuit 1 × 3 tours + 6 mn Circuit 2 complétés sans perte de vitesse majeure.',
    adaptationRules:{
      titanCan:['rest','reps','variant'],
      titanCannot:['continueIfSlow','skipWarmup']
    }
  };

  // MICRO 7 — ISOMÉTRIE & STABILITÉ (3 circuits)
  var micro7 = {
    sessionId:'mt_m7',
    sessionNumber:7,
    sessionTitle:'Micro 7 — Isométrie & Stabilité',
    sessionGoal:'Force statique et endurance musculaire.',
    sessionType:'iso',
    isActiveSession:true,
    isOptionalChoice:false,
    estimatedDuration:'12-15 min',
    requiredEquipment:['Sans matériel'],
    isOptional:false,
    structureType:'iso',
    specialInstructions:'3 circuits × 3 tours. Maintien position parfaite. Trembler = normal, c\'est que ça travaille. Circuit 3 : sans repos entre les 2 exos.',
    titanIntroMessage:'Iso. Tu tiens, tu trembles, tu restes. La position parfaite avant la durée.',
    blocks:[
      { blockId:'c1', blockType:'circuit', title:'Circuit 1 — 3 tours', executionMode:'repos-fin-tour', rounds:3 },
      { blockId:'c2', blockType:'circuit', title:'Circuit 2 — 3 tours', executionMode:'repos-fin-tour', rounds:3 },
      { blockId:'c3', blockType:'circuit', title:'Circuit 3 — 3 tours (sans repos)', executionMode:'enchaînement', rounds:3 }
    ],
    exercises:[
      ex({id:'fente_avant_iso',     block:'c1', sets:'3 tours', reps:'39 s / jambe', rest:'Enchaînement', mode:'enchaînement'}),
      ex({id:'iso_ischio',          block:'c1', sets:'3 tours', reps:'39 s', rest:'Repos fin de tour', mode:'enchaînement'}),
      ex({id:'split_stance',        block:'c2', sets:'3 tours', reps:'39 s / jambe', rest:'Enchaînement', mode:'enchaînement'}),
      ex({id:'sumo_squat_iso',      block:'c2', sets:'3 tours', reps:'39 s', rest:'Repos fin de tour', mode:'enchaînement'}),
      ex({id:'elevation_tibial_anterieur',block:'c3', sets:'3 tours', reps:'25 reps', rest:'Enchaînement', mode:'enchaînement'}),
      ex({id:'elevation_talon',     block:'c3', sets:'3 tours', reps:'25 reps', rest:'Enchaînement', mode:'enchaînement'})
    ],
    feedbackQuestions:['difficulty','fatigue','pain','completed','positionQuality','comment'],
    validationCriteria:'3 circuits × 3 tours complétés.',
    adaptationRules:{
      titanCan:['rest','isoDuration','variant'],
      titanCannot:['breakPositionToCheat']
    }
  };

  // MICRO 8 — SPRINT CARDIO (niveau 1/2/3)
  var micro8 = {
    sessionId:'mt_m8',
    sessionNumber:8,
    sessionTitle:'Micro 8 — Sprint Cardio',
    sessionGoal:'Capacité aérobie et vitesse.',
    sessionType:'cardio-hiit',
    isActiveSession:true,
    isOptionalChoice:false,
    estimatedDuration:'10-20 min (selon niveau)',
    requiredEquipment:['Sans matériel','Espace course'],
    isOptional:false,
    structureType:'sprint',
    specialInstructions:'ÉCHAUFFEMENT obligatoire avant (cf. consigne propriétaire). Protocole : Sprint 10s + Jogging 30s + Marche 20s. 100% sur chaque sprint. Si tu ne tiens pas l\'intensité, baisse d\'un niveau — ne baisse pas l\'effort sur le sprint.',
    titanIntroMessage:'Sprint cardio. 100% sur chaque sprint. Si tu ne tiens pas l\'intensité, baisse de niveau — pas l\'effort.',
    blocks:[
      { blockId:'warmup', blockType:'warmup', title:'Échauffement dynamique' },
      { blockId:'cycles', blockType:'cardio', title:'Cycles Sprint/Jog/Marche', executionMode:'protocole' }
    ],
    exercises:[
      ex({id:'echauffement_dynamique', block:'warmup', sets:'-', reps:'5 mn', rest:'-'}),
      ex({id:'sprint_cardio_cycle',    block:'cycles', sets:'7-15 (selon niveau)', reps:'1 cycle (10s sprint + 30s jog + 20s marche)', rest:'-', intensity:'100% sur le sprint', note:'Niveau 1 = 7 cycles · Niveau 2 = 12 · Niveau 3 = 15.'})
    ],
    sprintLevels: SPRINT_CARDIO_LEVELS,
    feedbackQuestions:['difficulty','fatigue','pain','completed','levelDone','intensityKept','comment'],
    validationCriteria:'Tous les cycles du niveau choisi complétés à 100% sur le sprint.',
    adaptationRules:{
      titanCan:['levelDown','levelUp','rest'],
      titanCannot:['reduceSprintEffort']
    }
  };

  // MICRO 9 — LIBRE (free-choice parmi Micro 1-8)
  var micro9 = {
    sessionId:'mt_m9',
    sessionNumber:9,
    sessionTitle:'Micro 9 — Libre',
    sessionGoal:'Ta séance préférée — refaire celle que tu veux améliorer ou que tu préfères.',
    sessionType:'free-choice',
    isActiveSession:true,
    isOptionalChoice:true,                    // === LE seul micro qui est un "choix"
    estimatedDuration:'Variable (selon micro choisi)',
    requiredEquipment:['Selon micro choisi'],
    isOptional:false,                          // pas optionnel dans le compte 9/9 — mais EST UN CHOIX
    structureType:'free-choice',
    specialInstructions:'Choisis parmi Micros 1-8 — celle que tu veux améliorer OU celle que tu préfères. Liberté DANS la structure.',
    titanIntroMessage:'Ton moment. Choisis. Refais la dure. Ou celle que tu adores. La liberté dans une structure solide, c\'est puissant.',
    blocks:[
      { blockId:'choice', blockType:'free-choice', title:'Choisis une micro-séance parmi 1-8', executionMode:'protocole' }
    ],
    exercises:[
      // Pas d'exos fixes — l'utilisateur choisit la micro à exécuter
    ],
    availableChoices: ['mt_m1','mt_m2','mt_m3','mt_m4','mt_m5','mt_m6','mt_m7','mt_m8'],
    feedbackQuestions:['chosenMicro','reasonForChoice','completed','comment'],
    validationCriteria:'Une micro parmi 1-8 choisie ET complétée selon ses critères.',
    adaptationRules:{
      titanCan:['suggestChoice'],
      titanCannot:['forceSpecificChoice']
    }
  };

  // ─── SEMAINES (1 à 6, structure identique sur les 6) ─────────────────────
  // R6 : "Les exercices, les répétitions et les circuits restent exactement
  // les mêmes pendant les 6 semaines. Il n'y a pas de progression de volume
  // programmée. Ce qui change, c'est toi."
  var ALL_MICROS = [
    { id:'mt_m1', required:true },
    { id:'mt_m2', required:true },
    { id:'mt_m3', required:true },
    { id:'mt_m4', required:true },
    { id:'mt_m5', required:true },
    { id:'mt_m6', required:true },
    { id:'mt_m7', required:true },
    { id:'mt_m8', required:true },
    { id:'mt_m9', required:true }
  ];

  function makeWeek(weekNumber) {
    return {
      weekId:           'mt_w' + weekNumber,
      weekNumber:       weekNumber,
      weekFocus:        'Discipline + régularité — structure inchangée, intensité personnelle qui évolue (R6).',
      weeklyGoal:       9,
      requiredMicros:   9,                  // 9/9 OBLIGATOIRE (R1)
      maxMicrosPerDay:  2,                  // R2
      validationRule:   '9/9 = semaine validée → semaine suivante. 8/9 ou moins = échec → recommencer cette même semaine. Pas de cumul d\'une semaine sur l\'autre (R3).',
      micros:           ALL_MICROS.slice()
    };
  }

  var weeks = [];
  for (var w = 1; w <= 6; w++) weeks.push(makeWeek(w));

  // ─── PROGRAMME ──────────────────────────────────────────────────────────
  var program = {
    programId:        'mt',
    programName:      'Microtraining',
    programGoal:      'Construire une discipline d\'entraînement inébranlable + développer la performance physique en parallèle.',
    totalWeeks:       6,                    // minimum
    weeklyTarget:     9,
    maxMicrosPerDay:  2,
    validationRule:   '9/9 required',
    programFrequency: '9 micro-séances par semaine — libre répartition (5, 6 ou 7 jours, max 2/jour).',
    programLocation:  'Sans matériel',
    testsOptional:    true,                 // R7 (SAT/SET début/fin optionnels)
    requiredTests:    [],
    optionalTests:    ['SAT au début','SAT à la fin','SET au début','SET à la fin'],
    specialRules: [
      '9/9 OBLIGATOIRE — 8/9 ou moins = recommencer la même semaine. Pas de dérogation (R1).',
      'Maximum 2 micro-séances par jour, idéalement de natures différentes (R2).',
      'Pas de cumul d\'une semaine sur l\'autre — chaque semaine est une entité complète (R3).',
      'Bilan hebdomadaire à jour fixe (dimanche soir recommandé) (R4).',
      'Engagement 6 semaines minimum — si tu commences, tu finis (R5).',
      'Structure identique sur les 6 semaines — c\'est l\'athlète qui évolue, pas le programme (R6).',
      'Tests SAT/SET optionnels (avant/après) (R7).',
      'Micro 1 (Jeûne) compte dans les 9 micros bien que non-active (R8).',
      'Sécurité jeûne : eau uniquement, arrêt immédiat si symptôme (R9).'
    ],
    phases: [
      {
        phaseId:         'mt_unique',
        phaseName:       'PHASE UNIQUE — Microtraining',
        phaseNumber:     1,
        phaseGoal:       'Discipline absolue + performance physique cumulée — 6 semaines, structure invariante.',
        durationWeeks:   6,
        frequency:       '9 micro-séances / semaine',
        location:        'Sans matériel',
        progressionRules:[
          { week:1, focus:'Démarrage — apprendre les 9 micros et la règle 9/9' },
          { week:2, focus:'Consolidation — répétition à intensité égale' },
          { week:3, focus:'Approfondissement — qualité d\'exécution accrue' },
          { week:4, focus:'Engagement — la routine doit être installée' },
          { week:5, focus:'Intensité interne — tu pousses dans la même structure' },
          { week:6, focus:'Maîtrise — 6 semaines × 9 micros = discipline ancrée' }
        ],
        weeks:    weeks,
        sessions: {
          mt_m1:micro1, mt_m2:micro2, mt_m3:micro3, mt_m4:micro4, mt_m5:micro5,
          mt_m6:micro6, mt_m7:micro7, mt_m8:micro8, mt_m9:micro9
        }
      }
    ],
    titanTone: {
      style: 'direct, clair, exigeant, concret',
      doExamples: [
        '"Ce programme ne teste pas seulement ton corps. Il teste ta discipline. 8/9 ce n\'est pas presque réussi. C\'est échoué. Tu recommences, et tu deviens plus solide."',
        '"Trembler sur l\'iso ? C\'est que ça travaille. Tiens la position."',
        '"Tu n\'as pas le temps de 15 mn ? Tu n\'as pas le temps de progresser non plus."'
      ],
      avoid: ['motivation vide','phrases IA génériques','exception complaisante']
    },
    bonusPrograms: [
      { id:'mt_bonus_salle',       name:'Microtraining Salle (4 semaines)',     description:'Même structure, exos avec charges (Power Clean + Box Jump + KB Swing, etc.)' },
      { id:'mt_bonus_metabolique', name:'Microtraining Métabolique (4 semaines)', description:'Même structure, focus cardio/HIIT (HIIT, Tabata, Challenge Push-up)' }
    ],
    finalNote:'Après 6 semaines : une discipline inébranlable. C\'est une construction, pas un don.'
  };

  // ─── TABLE DE VÉRIFICATION (programme → phase → semaine → micros → statut)
  var verificationTable = [];
  for (var ww = 1; ww <= 6; ww++) {
    verificationTable.push({
      program: 'mt',
      phase:   1,
      week:    ww,
      micros:  ['m1','m2','m3','m4','m5','m6','m7','m8','m9'],
      status:  ww === 6 ? 'FIN PROGRAMME' : 'OK',
      notes:   ww === 1 ? 'Démarrage' : null
    });
  }

  // ─── STATS ──────────────────────────────────────────────────────────────
  var allExoIds = Object.keys(MT_MASTER_EXERCISES);
  // Compteur séances :
  //   totalSessionTemplates = 9 (les 9 micros distincts, structure invariante)
  //   totalSessionsExecuted = 54 (6 sem × 9 micros) — si zéro échec.
  //                           En cas d'échec une semaine, l'utilisateur la
  //                           recommence → le total peut dépasser 54.
  var stats = {
    totalPhases:           1,
    totalWeeks:            6,
    totalSessionTemplates: 9,
    totalSessionsExecuted: 54,           // 6 sem × 9 micros (si 9/9 partout)
    expectedTotalSessions: 54,           // alias rétro-compat
    uniqueExercises:       allExoIds.length,
    exercisesWithVideo:    0,
    exercisesWithoutVideo: allExoIds.map(function(id){
      return { exerciseId:id, masterName:MT_MASTER_EXERCISES[id].masterName, category:MT_MASTER_EXERCISES[id].category };
    }),
    nonExecutableExercises: ['jeune_progressif']  // pas un exo physique
  };

  return {
    program:            program,
    masterExercises:    MT_MASTER_EXERCISES,
    fastingLevels:      FASTING_LEVELS,
    sprintCardioLevels: SPRINT_CARDIO_LEVELS,
    verificationTable:  verificationTable,
    stats:              stats
  };
});
