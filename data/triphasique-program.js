// ════════════════════════════════════════════════════════════════════════════
// TRIPHASIQUE — SOURCE DE VÉRITÉ DU PROGRAMME (data layer, non intégré UI)
// ────────────────────────────────────────────────────────────────────────────
// Source : PDF "Programme Triphasique" (uploadé 2026-06-12).
// Schéma : identique aux autres programmes.
// CE FICHIER N'EST PAS BRANCHÉ DANS L'UI — étape de validation.
//
// ─── RÉSUMÉ ────────────────────────────────────────────────────────────────
// Nom         : TRIPHASIQUE
// Objectif    : Force complète sans salle — Isométrique → Excentrique → Explosif
// Durée       : 12 semaines (3 phases × 4 sem)
// Fréquence   : 3 séances obligatoires + 1 optionnelle / semaine (P1+P2)
//               4 jours / semaine (P3, J4 = circuit triphasique)
// Lieu        : Sans salle (poids du corps)
// Compteurs   : 3 phases · 12 semaines · 11 séances-types (P1×4 + P2×3 + P3×4)
//
// ─── RÈGLES SPÉCIALES ───────────────────────────────────────────────────────
//   R1. TRANSMISSION FORCE = 9 mn OBLIGATOIRE à chaque séance des 3 phases :
//       mouvements spécifiques à ton objectif à 100% (sauts, dunks, sprints,
//       frappes...). C'est ce qui transfère la force vers ton sport.
//   R2. PHASE 2 — TEMPO STRICT : 5 secondes pour descendre (compter 1-2-3-4-5),
//       3 secondes pour monter. Ne jamais lâcher la descente. Respiration :
//       inspirer en descente, expirer en montée.
//   R3. PHASE 3 — PRINCIPE CLÉ : Descente 1-2 s contrôlée → Montée EXPLOSION
//       MAXIMALE. Arrêter la série si la vitesse diminue. Qualité > Quantité.
//   R4. P1 J3 et P2 J3 = "allégé / récupération active" — VOLONTAIREMENT
//       réduit. Ne PAS sauter, le signal nerveux est maintenu.
//   R5. P3 J4 = Circuit triphasique ISO + EXCENTRIQUE + EXPLOSIF (séance qui
//       combine les 3 méthodes — méta-séance signature du programme).
//
// ─── INCOHÉRENCES DÉTECTÉES ─────────────────────────────────────────────────
//   I1. Phase 2 OPTIONNEL (J4) : PDF mentionne "Optionnel : excentrique
//       variantes" dans l'organisation hebdo (Samedi) mais NE DÉTAILLE PAS
//       les exos du J4 dans les pages suivantes (saute directement à P2 J3).
//       → Hypothèse : J4 P2 = même structure que J4 P1 mais avec exos
//       excentriques. À CONFIRMER avec le propriétaire avant intégration.
//       Pour l'instant marqué `__P2_J4_PLACEHOLDER__` (non utilisable tel quel).
//   I2. P1 Jour 1 mentionne "Équilibre yeux fermés" en exo #13 ; P2 et P3
//       reprennent souvent les mêmes blocs équilibre / travail pied. Cohérent.
//   I3. Phases 1 & 2 : 3 obligatoires + 1 optionnel = même fréquence que VD.
//       Phase 3 : 4 jours obligatoires (pas d'opt). À noter dans l'UI.
//   I4. Phase 1 progression sem.1 = "2 séries" mais Jour 1 a beaucoup d'exos
//       à "Var.*" → "Var.*" = la progression série/semaine s'applique uniquement
//       aux exos isométriques principaux, pas aux "élévation orteils 3×15"
//       (qui restent fixes). Documenté dans progressionRules.
//   I5. Phase 3 SEM. 9-12 : pas de % 1RM (sans salle), progression = nb séries
//       2 → 6 + ajout de charge légère sem.11 (élastiques survitesse) puis
//       toutes méthodes combinées sem.12.
//
// ─── VIDÉOS ────────────────────────────────────────────────────────────────
// Toutes en videoStatus="missing". L'app ne doit pas bloquer une séance.
// ════════════════════════════════════════════════════════════════════════════

(function (root, factory) {
  var lib = factory();
  if (typeof module === 'object' && module.exports) module.exports = lib;
  if (root) root.TRIPHASIQUE_PROGRAM = lib.program;
  if (root) root.TRIPHASIQUE_LIB = lib;
})(typeof window !== 'undefined' ? window : null, function () {

  var TRI_MASTER_EXERCISES = {
    // — Échauffement / récup —
    echauffement_dynamique:   { masterName: 'Échauffement dynamique général',         category: 'Échauffement', videoUrl: null, generic: true, pdfAliases: ['Échauffement dynamique général — Mobilité articulaire'] },
    echauffement_activation:  { masterName: 'Échauffement dynamique + activation',    category: 'Échauffement', videoUrl: null, generic: true, pdfAliases: ['Échauffement dynamique + activation — Préparer l\'explosivité'] },
    echauffement_complet:     { masterName: 'Échauffement dynamique complet',         category: 'Échauffement', videoUrl: null, generic: true, pdfAliases: ['Échauffement dynamique complet — Mobilité complète'] },
    etirements_legers:        { masterName: 'Étirements légers',                      category: 'Récupération', videoUrl: null, generic: true },
    etirements_complets:      { masterName: 'Étirements complets',                    category: 'Récupération', videoUrl: null, generic: true, pdfAliases: ['Étirements complets — Récupération optimale'] },

    // — Isométrique (Phase 1) —
    squat_iso_90:             { masterName: 'Squat isométrique (90°)',                category: 'Isométrique', videoUrl: null, pdfAliases: ['Squat isométrique (90°) — Position parallèle au sol','Squat isométrique (90°) — Volontairement réduit','Squat isométrique (différentes hauteurs) — Varier les angles','Squat isométrique (90°) — ISOMÉTRIQUE — maintien'] },
    fente_iso_avant:          { masterName: 'Fente isométrique (avant)',              category: 'Isométrique', videoUrl: null, pdfAliases: ['Fente isométrique (avant) — Genou à 90°','Fente isométrique — Récupération active'] },
    fente_iso_arriere:        { masterName: 'Fente isométrique (arrière)',            category: 'Isométrique', videoUrl: null, pdfAliases: ['Fente isométrique (arrière) — Tenir le maximum'] },
    single_leg_squat_hold:    { masterName: 'Single leg squat hold',                  category: 'Isométrique', videoUrl: null, pdfAliases: ['Single leg squat hold — Équilibre + force','Single leg squat hold — Unilatéral'] },
    planche_coudes:           { masterName: 'Planche sur coudes',                     category: 'Gainage', videoUrl: null, pdfAliases: ['Planche sur coudes — Gainage actif','Planche sur coudes — Volontairement réduit','Planche — ISOMÉTRIQUE — gainage actif'] },
    planche_mains:            { masterName: 'Planche sur mains',                      category: 'Gainage', videoUrl: null, pdfAliases: ['Planche sur mains — Tenir le maximum'] },
    planche_laterale:         { masterName: 'Planche latérale',                       category: 'Gainage', videoUrl: null, pdfAliases: ['Planche latérale — Récupération active'] },
    planche_variations:       { masterName: 'Planche avec variations',                category: 'Gainage', videoUrl: null, pdfAliases: ['Planche avec variations — Bras levé, jambe levée'] },
    pompe_iso_basse:          { masterName: 'Pompe isométrique (position basse)',     category: 'Isométrique', videoUrl: null, pdfAliases: ['Pompe isométrique (position basse) — Pectoraux contractés'] },
    dips_iso:                 { masterName: 'Dips isométrique (position basse)',      category: 'Isométrique', videoUrl: null, pdfAliases: ['Dips isométrique (position basse) — Triceps contractés'] },
    hollow_body_hold:         { masterName: 'Hollow body hold',                       category: 'Gainage', videoUrl: null, pdfAliases: ['Hollow body hold — Abdos + lombaires'] },
    wall_sit:                 { masterName: 'Wall sit (dos au mur)',                  category: 'Isométrique', videoUrl: null, pdfAliases: ['Wall sit (dos au mur) — Tenir le maximum possible'] },
    calf_raise_hold:          { masterName: 'Calf raise hold (pointes)',              category: 'Isométrique', videoUrl: null, pdfAliases: ['Calf raise hold (pointes) — Maintien sur pointes'] },
    l_sit:                    { masterName: 'L-sit',                                  category: 'Gainage', videoUrl: null, pdfAliases: ['L-sit (ou progression) — Abdos + fléchisseurs'] },
    traction_iso:             { masterName: 'Traction isométrique (menton au-dessus)',category: 'Isométrique', videoUrl: null, pdfAliases: ['Traction isométrique (menton au-dessus) — Tenir position haute'] },

    // — Excentrique (Phase 2) —
    squat_excentrique:        { masterName: 'Squat excentrique',                      category: 'Force excentrique', videoUrl: null, pdfAliases: ['Squat excentrique — 5 s desc + 3 s mont — contrôle total','Squat excentrique — 3 s desc + 2 s mont — volontairement réduit','Squat excentrique — 5 s desc + 3 s mont — contrôle'] },
    fente_excentrique_avant:  { masterName: 'Fente excentrique (avant)',              category: 'Force excentrique', videoUrl: null, pdfAliases: ['Fente excentrique (avant) — 5 s desc + 3 s mont','Fente excentrique — 3 s desc + 2 s mont'] },
    nordic_hamstring_exc:     { masterName: 'Nordic hamstring excentrique',           category: 'Force excentrique', videoUrl: null, pdfAliases: ['Nordic hamstring excentrique — 5 s desc + 3 s mont — freinage maximal'] },
    reverse_nordic_exc:       { masterName: 'Reverse nordic excentrique',             category: 'Force excentrique', videoUrl: null, pdfAliases: ['Reverse nordic excentrique — 5 s desc + 3 s mont — quadriceps'] },
    pompe_excentrique:        { masterName: 'Pompe excentrique',                      category: 'Force excentrique', videoUrl: null, pdfAliases: ['Pompe excentrique — 5 s desc + 3 s mont','Pompe excentrique — 3 s desc + 2 s mont','Pompe excentrique (variante large) — 5 s desc + 3 s mont — pectoraux étirés','Pompe excentrique — 5 s desc + 3 s mont — contrôle'] },
    traction_excentrique:     { masterName: 'Traction excentrique',                   category: 'Force excentrique', videoUrl: null, pdfAliases: ['Traction excentrique — 5 s desc + 3 s mont — contrôle descente'] },
    dips_excentrique:         { masterName: 'Dips excentrique',                       category: 'Force excentrique', videoUrl: null, pdfAliases: ['Dips excentrique — 5 s desc + 3 s mont','Dips excentrique — 3 s desc + 2 s mont'] },
    single_leg_squat_exc:     { masterName: 'Single leg squat excentrique (pistol)',  category: 'Force excentrique', videoUrl: null, pdfAliases: ['Single leg squat excentrique (pistol) — 5 s desc + 3 s mont — unilatéral'] },
    step_down_exc:            { masterName: 'Step-down excentrique',                  category: 'Force excentrique', videoUrl: null, pdfAliases: ['Step-down excentrique — 5 s desc + 3 s mont — contrôle genou'] },
    calf_raise_exc:           { masterName: 'Calf raise excentrique',                 category: 'Force excentrique', videoUrl: null, pdfAliases: ['Calf raise excentrique — 5 s desc + 3 s mont — mollets'] },
    pike_pushup_exc:          { masterName: 'Pike push-up excentrique',               category: 'Force excentrique', videoUrl: null, pdfAliases: ['Pike push-up excentrique — 5 s desc + 3 s mont — épaules'] },

    // — Explosif (Phase 3) —
    squat_jump:               { masterName: 'Squat jump',                             category: 'Pliométrie', videoUrl: null, pdfAliases: ['Squat jump — EXPLOSION MAX — saut le plus haut possible','Squat jump — Hauteur maximale','Squat jump — EXPLOSION MAX — explosivité'] },
    fente_sautee_alternee:    { masterName: 'Fente sautée alternée',                  category: 'Pliométrie', videoUrl: null, pdfAliases: ['Fente sautée alternée — EXPLOSION MAX — changement en l\'air'] },
    broad_jumps:              { masterName: 'Broad jumps',                            category: 'Pliométrie', videoUrl: null, pdfAliases: ['Broad jumps (bonds avant) — EXPLOSION MAX — distance maximale'] },
    pompe_claquee:            { masterName: 'Pompe claquée',                          category: 'Pliométrie', videoUrl: null, pdfAliases: ['Pompe claquée — EXPLOSION MAX — mains décollent du sol','Pompe claquée (variantes) — Mains + pieds décollent','Pompe claquée — EXPLOSION MAX — explosivité'] },
    dips_explosif:            { masterName: 'Dips explosif',                          category: 'Pliométrie', videoUrl: null, pdfAliases: ['Dips explosif — EXPLOSION MAX — accélération max','Dips explosif — Accélération max'] },
    traction_explosive:       { masterName: 'Traction explosive',                     category: 'Pliométrie', videoUrl: null, pdfAliases: ['Traction explosive — EXPLOSION MAX — vitesse maximale','Traction explosive — Tirer le plus vite possible'] },
    speed_squat_elastiques:   { masterName: 'Speed squat (élastiques assistance)',    category: 'Pliométrie', videoUrl: null, pdfAliases: ['Speed squat (avec élastiques assistance) — SURVITESSE — élastiques tirent vers le haut'] },
    single_leg_jump:          { masterName: 'Single leg jump',                        category: 'Pliométrie', videoUrl: null, pdfAliases: ['Single leg jump — EXPLOSION MAX — unilatéral explosif'] },
    box_jumps_progression:    { masterName: 'Box jumps (hauteur progressive)',        category: 'Pliométrie', videoUrl: null, pdfAliases: ['Box jumps (hauteur progressive) — EXPLOSION MAX — monter la hauteur'] },
    pompe_explosive_bandes:   { masterName: 'Pompe explosive (bandes)',               category: 'Pliométrie', videoUrl: null, pdfAliases: ['Pompe explosive (bandes si possible) — SURVITESSE si possible'] },
    pike_pushup_explosif:     { masterName: 'Pike push-up explosif',                  category: 'Pliométrie', videoUrl: null, pdfAliases: ['Pike push-up explosif — EXPLOSION MAX'] },
    calf_jump:                { masterName: 'Calf jump (mollets)',                    category: 'Pliométrie', videoUrl: null, pdfAliases: ['Calf jump (mollets) — Rebonds explosifs'] },

    // — Travail pied —
    elevation_orteils:        { masterName: 'Élévation orteils',                      category: 'Travail du pied', videoUrl: null, pdfAliases: ['Élévation orteils','Élévation orteils — Allégé','Élévation orteils explosive','Élévation orteils isométrique — Maintien'] },
    dorsiflexion_tibial:      { masterName: 'Dorsiflexion tibial',                    category: 'Travail du pied', videoUrl: null, pdfAliases: ['Dorsiflexion tibial','Dorsiflexion tibial — Allégé','Dorsiflexion explosive','Dorsiflexion excentrique — 5 s + 3 s'] },
    marche_talons:            { masterName: 'Marche sur talons',                      category: 'Travail du pied', videoUrl: null },
    marche_arriere:           { masterName: 'Marche arrière',                         category: 'Travail du pied', videoUrl: null, pdfAliases: ['Marche arrière — Coordination','Marche arrière — Récupération active'] },

    // — Proprioception —
    equilibre_unipodal:       { masterName: 'Équilibre unipodal',                     category: 'Proprioception', videoUrl: null, pdfAliases: ['Équilibre unipodal — Yeux ouverts','Équilibre unipodal','Équilibre unipodal — Allégé','Équilibre unipodal + perturbations'] },
    equilibre_yeux_fermes:    { masterName: 'Équilibre yeux fermés',                  category: 'Proprioception', videoUrl: null, pdfAliases: ['Équilibre yeux fermés — Stabilité avancée','Équilibre yeux fermés'] },

    // — Transmission Force —
    transmission_force_specifique: { masterName: 'Mouvements spécifiques à ton objectif (Transmission Force)', category: 'Transmission Force', videoUrl: null, generic: true, pdfAliases: ['Mouvements spécifiques à ton objectif — Intensité 100%'] }
  };

  function ex(opts) {
    var master = TRI_MASTER_EXERCISES[opts.id] || {};
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

  // Bloc Transmission Force standard, présent à la fin de CHAQUE séance
  // d'entraînement (R1). Réutilisé via spread.
  function transmissionForceExo() {
    return ex({id:'transmission_force_specifique',block:'transmission',sets:'-',reps:'9 mn',rest:'-',intensity:'100%',note:'OBLIGATOIRE — mouvements spécifiques à ton sport (sauts, dunks, sprints, frappes...)'});
  }

  // ─── PHASE 1 — ISOMÉTRIQUE (4 sem · 3 obl + 1 opt) ───────────────────────

  var p1_j1 = {
    sessionId:'tri_p1_j1', sessionNumber:1, sessionTitle:'Jour 1 — Isométrique bas + haut du corps',
    sessionGoal:'Iso complète bas + haut + travail pied + équilibre + Transmission Force.',
    sessionType:'iso-fullbody', estimatedDuration:'60-80 min', requiredEquipment:['Sans matériel','Barre traction (option pour pompe iso au sol)'],
    isOptional:false,
    specialInstructions:'Iso : maintenir la position propre, contraction active partout. Durée selon semaine (15s→90s sur les exos principaux).',
    titanIntroMessage:'Phase 1 démarre. Iso = tu renforces tes tendons. Tiens-toi solide. Pas de mouvement, juste de la tenue propre.',
    blocks:[
      {blockId:'warmup',  blockType:'warmup',title:'Échauffement'},
      {blockId:'iso_bas', blockType:'main',  title:'Isométrique bas du corps'},
      {blockId:'iso_haut',blockType:'main',  title:'Isométrique haut du corps'},
      {blockId:'pied',    blockType:'main',  title:'Travail du pied'},
      {blockId:'equilibre',blockType:'main', title:'Équilibre'},
      {blockId:'transmission',blockType:'main',title:'Transmission Force (R1)'},
      {blockId:'cooldown',blockType:'recovery',title:'Étirements'}
    ],
    exercises:[
      ex({id:'echauffement_dynamique',block:'warmup',sets:'-',reps:'8-10 mn',rest:'-'}),
      ex({id:'squat_iso_90',       block:'iso_bas',sets:'Var.*',reps:'15 s → 90 s',rest:'1-3 mn',note:'Position parallèle au sol'}),
      ex({id:'fente_iso_avant',    block:'iso_bas',sets:'Var.*',reps:'15 s → 90 s / jambe',rest:'1-3 mn',note:'Genou à 90°'}),
      ex({id:'single_leg_squat_hold',block:'iso_bas',sets:'Var.*',reps:'15 s → 60 s / jambe',rest:'1-3 mn'}),
      ex({id:'planche_coudes',     block:'iso_haut',sets:'Var.*',reps:'15 s → 90 s',rest:'1-3 mn',note:'Gainage actif'}),
      ex({id:'pompe_iso_basse',    block:'iso_haut',sets:'Var.*',reps:'15 s → 60 s',rest:'1-3 mn',note:'Pectoraux contractés'}),
      ex({id:'hollow_body_hold',   block:'iso_haut',sets:'Var.*',reps:'15 s → 60 s',rest:'1-3 mn',note:'Abdos + lombaires'}),
      ex({id:'elevation_orteils',  block:'pied',sets:'3',reps:'15 reps',rest:'30 s'}),
      ex({id:'dorsiflexion_tibial',block:'pied',sets:'3',reps:'15 reps',rest:'30 s'}),
      ex({id:'marche_talons',      block:'pied',sets:'2',reps:'1 mn',rest:'30 s'}),
      ex({id:'marche_arriere',     block:'pied',sets:'2',reps:'1 mn',rest:'30 s',note:'Coordination'}),
      ex({id:'equilibre_unipodal', block:'equilibre',sets:'3',reps:'30 s / jambe',rest:'30 s',note:'Yeux ouverts'}),
      ex({id:'equilibre_yeux_fermes',block:'equilibre',sets:'2',reps:'20 s / jambe',rest:'30 s',note:'Stabilité avancée'}),
      transmissionForceExo(),
      ex({id:'etirements_legers',  block:'cooldown',sets:'-',reps:'5-10 mn',rest:'-'})
    ],
    feedbackQuestions:['difficulty','fatigue','pain','completed','isoHoldQuality','comment'],
    adaptationRules:{titanCan:['isoDuration','rest','variant'],titanCannot:['skipTransmissionForce']}
  };

  var p1_j2 = {
    sessionId:'tri_p1_j2', sessionNumber:2, sessionTitle:'Jour 2 — Isométrique à l\'échec (séance limite)',
    sessionGoal:'Tenir chaque iso jusqu\'à l\'échec total — séance limite.',
    sessionType:'iso-failure', estimatedDuration:'65-90 min', requiredEquipment:['Sans matériel','Barre traction'],
    isOptional:false,
    specialInstructions:'Chaque iso = À L\'ÉCHEC. Repos longs entre (2-3 mn). Au moins 48h avant J3.',
    titanIntroMessage:'Séance limite. Chaque iso = à l\'échec. Tu cherches le moment où ça lâche.',
    blocks:[
      {blockId:'warmup',  blockType:'warmup',title:'Échauffement'},
      {blockId:'iso_max', blockType:'main',  title:'Iso à l\'échec'},
      {blockId:'pied',    blockType:'main',  title:'Travail du pied'},
      {blockId:'equilibre',blockType:'main', title:'Équilibre'},
      {blockId:'transmission',blockType:'main',title:'Transmission Force (R1)'},
      {blockId:'cooldown',blockType:'recovery',title:'Étirements'}
    ],
    exercises:[
      ex({id:'echauffement_dynamique',block:'warmup',sets:'-',reps:'8-10 mn',rest:'-'}),
      ex({id:'wall_sit',           block:'iso_max',sets:'Var.*',reps:'À L\'ÉCHEC',rest:'2-3 mn',note:'Tenir le maximum possible'}),
      ex({id:'fente_iso_arriere',  block:'iso_max',sets:'Var.*',reps:'À L\'ÉCHEC / jambe',rest:'2-3 mn'}),
      ex({id:'calf_raise_hold',    block:'iso_max',sets:'Var.*',reps:'À L\'ÉCHEC',rest:'1-2 mn',note:'Maintien sur pointes'}),
      ex({id:'planche_mains',      block:'iso_max',sets:'Var.*',reps:'À L\'ÉCHEC',rest:'2-3 mn'}),
      ex({id:'l_sit',              block:'iso_max',sets:'Var.*',reps:'À L\'ÉCHEC',rest:'2-3 mn',note:'Ou progression'}),
      ex({id:'traction_iso',       block:'iso_max',sets:'Var.*',reps:'À L\'ÉCHEC',rest:'2-3 mn',note:'Menton au-dessus'}),
      ex({id:'elevation_orteils',  block:'pied',sets:'3',reps:'15 reps',rest:'30 s'}),
      ex({id:'dorsiflexion_tibial',block:'pied',sets:'3',reps:'15 reps',rest:'30 s'}),
      ex({id:'marche_talons',      block:'pied',sets:'2',reps:'1 mn',rest:'30 s'}),
      ex({id:'equilibre_unipodal', block:'equilibre',sets:'3',reps:'30 s / jambe',rest:'30 s'}),
      transmissionForceExo(),
      ex({id:'etirements_legers',  block:'cooldown',sets:'-',reps:'5-10 mn',rest:'-'})
    ],
    feedbackQuestions:['difficulty','fatigue','pain','completed','failureReached','comment'],
    adaptationRules:{titanCan:['rest','variant'],titanCannot:['removeFailure']}
  };

  var p1_j3 = {
    sessionId:'tri_p1_j3', sessionNumber:3, sessionTitle:'Jour 3 — Isométrique allégé (récupération active)',
    sessionGoal:'Volume RÉDUIT volontairement — récupération + maintien du signal nerveux.',
    sessionType:'iso-recovery', estimatedDuration:'45-60 min', requiredEquipment:['Sans matériel'],
    isOptional:false,
    specialInstructions:'SÉANCE RÉDUITE — NE PAS LA SAUTER (R4). Permet la récupération tout en maintenant le signal nerveux.',
    titanIntroMessage:'Allégé aujourd\'hui. Pas une journée off — c\'est de la récup active. Le signal reste vivant.',
    blocks:[
      {blockId:'warmup',  blockType:'warmup',title:'Échauffement'},
      {blockId:'iso_red', blockType:'main',  title:'Iso allégée'},
      {blockId:'pied',    blockType:'main',  title:'Travail du pied (allégé)'},
      {blockId:'transmission',blockType:'main',title:'Transmission Force (R1)'},
      {blockId:'cooldown',blockType:'recovery',title:'Étirements complets'}
    ],
    exercises:[
      ex({id:'echauffement_dynamique',block:'warmup',sets:'-',reps:'8-10 mn',rest:'-'}),
      ex({id:'squat_iso_90',       block:'iso_red',sets:'2',reps:'10 s',rest:'1 mn',note:'Volontairement réduit'}),
      ex({id:'fente_iso_avant',    block:'iso_red',sets:'2',reps:'10 s / jambe',rest:'1 mn',note:'Récupération active'}),
      ex({id:'planche_coudes',     block:'iso_red',sets:'2',reps:'10 s',rest:'1 mn'}),
      ex({id:'planche_laterale',   block:'iso_red',sets:'2',reps:'10 s / côté',rest:'1 mn',note:'Récupération active'}),
      ex({id:'elevation_orteils',  block:'pied',sets:'2',reps:'10 reps',rest:'30 s',note:'Allégé'}),
      ex({id:'dorsiflexion_tibial',block:'pied',sets:'2',reps:'10 reps',rest:'30 s'}),
      ex({id:'marche_arriere',     block:'pied',sets:'1',reps:'1 mn',rest:'-'}),
      ex({id:'equilibre_unipodal', block:'pied',sets:'2',reps:'20 s / jambe',rest:'30 s',note:'Allégé'}),
      transmissionForceExo(),
      ex({id:'etirements_complets',block:'cooldown',sets:'-',reps:'10 mn',rest:'-'})
    ],
    feedbackQuestions:['difficulty','fatigue','pain','completed','comment'],
    adaptationRules:{titanCan:['rest'],titanCannot:['increaseVolume','skipBlock']}
  };

  var p1_j4 = {
    sessionId:'tri_p1_j4', sessionNumber:4, sessionTitle:'Jour 4 — OPTIONNEL : Isométrique variantes',
    sessionGoal:'Varier les angles isométriques.',
    sessionType:'iso-variants-opt', estimatedDuration:'60-75 min', requiredEquipment:['Sans matériel','Chaise/banc'],
    isOptional:true,
    specialInstructions:'Séance OPTIONNELLE. Si tu la fais, garde la qualité.',
    titanIntroMessage:'Séance bonus. Varie les angles. Skippe si fatigue accumulée.',
    blocks:[
      {blockId:'warmup',  blockType:'warmup',title:'Échauffement'},
      {blockId:'iso_var', blockType:'main',  title:'Iso variantes'},
      {blockId:'pied',    blockType:'main',  title:'Travail du pied'},
      {blockId:'equilibre',blockType:'main', title:'Équilibre'},
      {blockId:'transmission',blockType:'main',title:'Transmission Force (R1)'},
      {blockId:'cooldown',blockType:'recovery',title:'Étirements'}
    ],
    exercises:[
      ex({id:'echauffement_dynamique',block:'warmup',sets:'-',reps:'8-10 mn',rest:'-'}),
      ex({id:'squat_iso_90',       block:'iso_var',sets:'Var.*',reps:'15 s → 90 s',rest:'1-3 mn',note:'Différentes hauteurs — varier les angles'}),
      ex({id:'single_leg_squat_hold',block:'iso_var',sets:'Var.*',reps:'15 s → 60 s / jambe',rest:'1-3 mn'}),
      ex({id:'planche_variations', block:'iso_var',sets:'Var.*',reps:'15 s → 90 s',rest:'1-3 mn',note:'Bras levé, jambe levée'}),
      ex({id:'dips_iso',           block:'iso_var',sets:'Var.*',reps:'15 s → 60 s',rest:'1-3 mn'}),
      ex({id:'elevation_orteils',  block:'pied',sets:'3',reps:'15 reps',rest:'30 s'}),
      ex({id:'dorsiflexion_tibial',block:'pied',sets:'3',reps:'15 reps',rest:'30 s'}),
      ex({id:'marche_talons',      block:'pied',sets:'2',reps:'1 mn',rest:'30 s'}),
      ex({id:'equilibre_unipodal', block:'equilibre',sets:'3',reps:'30 s / jambe',rest:'30 s'}),
      ex({id:'equilibre_yeux_fermes',block:'equilibre',sets:'2',reps:'20 s / jambe',rest:'30 s'}),
      transmissionForceExo(),
      ex({id:'etirements_legers',  block:'cooldown',sets:'-',reps:'5-10 mn',rest:'-'})
    ],
    feedbackQuestions:['difficulty','fatigue','pain','completed','comment'],
    adaptationRules:{titanCan:['skip','rest','variant'],titanCannot:['forceIfFatigued']}
  };

  // ─── PHASE 2 — EXCENTRIQUE (4 sem · 3 obl + 1 opt) ───────────────────────

  var p2_j1 = {
    sessionId:'tri_p2_j1', sessionNumber:1, sessionTitle:'Jour 1 — Excentrique bas + haut du corps',
    sessionGoal:'Excentrique complète bas + haut — tempo 5+3 strict.',
    sessionType:'exc-fullbody', estimatedDuration:'65-90 min', requiredEquipment:['Sans matériel','Barre traction (option)','Banc/chaise'],
    isOptional:false,
    specialInstructions:'TEMPO STRICT (R2) : 5s descente (compter 1-2-3-4-5), 3s montée. Inspire en descente, expire en montée.',
    titanIntroMessage:'Phase 2. Tempo strict. La descente lente construit la vraie force. Ne lâche jamais le bas.',
    blocks:[
      {blockId:'warmup',  blockType:'warmup',title:'Échauffement'},
      {blockId:'exc_bas', blockType:'main',  title:'Excentrique bas du corps'},
      {blockId:'exc_haut',blockType:'main',  title:'Excentrique haut du corps'},
      {blockId:'pied',    blockType:'main',  title:'Travail du pied'},
      {blockId:'equilibre',blockType:'main', title:'Équilibre'},
      {blockId:'transmission',blockType:'main',title:'Transmission Force (R1)'},
      {blockId:'cooldown',blockType:'recovery',title:'Étirements'}
    ],
    exercises:[
      ex({id:'echauffement_dynamique',block:'warmup',sets:'-',reps:'8-10 mn',rest:'-'}),
      ex({id:'squat_excentrique',  block:'exc_bas',sets:'Var.*',reps:'8-12 reps',rest:'2-3 mn',tempo:'5-0-3',note:'Contrôle total'}),
      ex({id:'fente_excentrique_avant',block:'exc_bas',sets:'Var.*',reps:'8-12 reps / jambe',rest:'2-3 mn',tempo:'5-0-3'}),
      ex({id:'nordic_hamstring_exc',block:'exc_bas',sets:'Var.*',reps:'8-12 reps',rest:'2-3 mn',tempo:'5-0-3',note:'Freinage maximal'}),
      ex({id:'pompe_excentrique',  block:'exc_haut',sets:'Var.*',reps:'8-12 reps',rest:'2-3 mn',tempo:'5-0-3'}),
      ex({id:'traction_excentrique',block:'exc_haut',sets:'Var.*',reps:'8-12 reps',rest:'2-3 mn',tempo:'5-0-3',note:'Contrôle descente'}),
      ex({id:'dips_excentrique',   block:'exc_haut',sets:'Var.*',reps:'8-12 reps',rest:'2-3 mn',tempo:'5-0-3'}),
      ex({id:'elevation_orteils',  block:'pied',sets:'3',reps:'15 reps',rest:'30 s'}),
      ex({id:'dorsiflexion_tibial',block:'pied',sets:'3',reps:'15 reps',rest:'30 s'}),
      ex({id:'marche_talons',      block:'pied',sets:'2',reps:'1 mn',rest:'30 s'}),
      ex({id:'equilibre_unipodal', block:'equilibre',sets:'3',reps:'30 s / jambe',rest:'30 s'}),
      transmissionForceExo(),
      ex({id:'etirements_legers',  block:'cooldown',sets:'-',reps:'5-10 mn',rest:'-'})
    ],
    feedbackQuestions:['difficulty','fatigue','pain','completed','tempoQuality','comment'],
    adaptationRules:{titanCan:['rest','reps'],titanCannot:['breakTempo','skipTransmissionForce']}
  };

  var p2_j2 = {
    sessionId:'tri_p2_j2', sessionNumber:2, sessionTitle:'Jour 2 — Excentrique focus contrôle unilatéral',
    sessionGoal:'Unilatéral excentrique — pistol + step-down + nordic + pike.',
    sessionType:'exc-unilateral', estimatedDuration:'65-90 min', requiredEquipment:['Sans matériel','Box/marche'],
    isOptional:false,
    specialInstructions:'Unilatéral STRICT — chaque jambe travaillée séparément. Tempo 5+3 maintenu.',
    titanIntroMessage:'Unilatéral excentrique. Tu travailles chaque jambe seule. Tu vois où sont tes asymétries.',
    blocks:[
      {blockId:'warmup',  blockType:'warmup',title:'Échauffement'},
      {blockId:'exc_uni', blockType:'main',  title:'Excentrique unilatéral'},
      {blockId:'pied',    blockType:'main',  title:'Travail du pied'},
      {blockId:'equilibre',blockType:'main', title:'Équilibre'},
      {blockId:'transmission',blockType:'main',title:'Transmission Force (R1)'},
      {blockId:'cooldown',blockType:'recovery',title:'Étirements'}
    ],
    exercises:[
      ex({id:'echauffement_dynamique',block:'warmup',sets:'-',reps:'8-10 mn',rest:'-'}),
      ex({id:'single_leg_squat_exc',block:'exc_uni',sets:'Var.*',reps:'8-12 reps / jambe',rest:'2-3 mn',tempo:'5-0-3',note:'Pistol'}),
      ex({id:'step_down_exc',      block:'exc_uni',sets:'Var.*',reps:'8-12 reps / jambe',rest:'2-3 mn',tempo:'5-0-3',note:'Contrôle genou'}),
      ex({id:'calf_raise_exc',     block:'exc_uni',sets:'Var.*',reps:'8-12 reps',rest:'2 mn',tempo:'5-0-3',note:'Mollets'}),
      ex({id:'pompe_excentrique',  block:'exc_uni',sets:'Var.*',reps:'8-12 reps',rest:'2-3 mn',tempo:'5-0-3',note:'Variante large — pectoraux étirés'}),
      ex({id:'pike_pushup_exc',    block:'exc_uni',sets:'Var.*',reps:'8-12 reps',rest:'2-3 mn',tempo:'5-0-3',note:'Épaules'}),
      ex({id:'reverse_nordic_exc', block:'exc_uni',sets:'Var.*',reps:'8-12 reps',rest:'2-3 mn',tempo:'5-0-3',note:'Quadriceps'}),
      ex({id:'elevation_orteils',  block:'pied',sets:'3',reps:'15 reps',rest:'30 s'}),
      ex({id:'dorsiflexion_tibial',block:'pied',sets:'3',reps:'15 reps',rest:'30 s'}),
      ex({id:'equilibre_unipodal', block:'equilibre',sets:'3',reps:'30 s / jambe',rest:'30 s'}),
      ex({id:'equilibre_yeux_fermes',block:'equilibre',sets:'2',reps:'20 s / jambe',rest:'30 s'}),
      transmissionForceExo(),
      ex({id:'etirements_legers',  block:'cooldown',sets:'-',reps:'5-10 mn',rest:'-'})
    ],
    feedbackQuestions:['difficulty','fatigue','pain','completed','asymmetryFelt','comment'],
    adaptationRules:{titanCan:['rest','reps'],titanCannot:['breakTempo']}
  };

  var p2_j3 = {
    sessionId:'tri_p2_j3', sessionNumber:3, sessionTitle:'Jour 3 — Excentrique allégé (récupération active)',
    sessionGoal:'Volume réduit avec tempo allégé (3+2).',
    sessionType:'exc-recovery', estimatedDuration:'50-65 min', requiredEquipment:['Sans matériel'],
    isOptional:false,
    specialInstructions:'Tempo allégé (3+2). NE PAS LA SAUTER (R4) — essentielle pour la récupération.',
    titanIntroMessage:'Récup excentrique. Tempo réduit (3+2). Pas une journée off — entretiens le signal.',
    blocks:[
      {blockId:'warmup',  blockType:'warmup',title:'Échauffement'},
      {blockId:'exc_red', blockType:'main',  title:'Excentrique allégé (tempo 3+2)'},
      {blockId:'pied',    blockType:'main',  title:'Travail du pied (allégé)'},
      {blockId:'equilibre',blockType:'main', title:'Équilibre'},
      {blockId:'transmission',blockType:'main',title:'Transmission Force (R1)'},
      {blockId:'cooldown',blockType:'recovery',title:'Étirements complets'}
    ],
    exercises:[
      ex({id:'echauffement_dynamique',block:'warmup',sets:'-',reps:'8-10 mn',rest:'-'}),
      ex({id:'squat_excentrique',  block:'exc_red',sets:'2',reps:'5 reps',rest:'1 mn',tempo:'3-0-2',note:'Volontairement réduit'}),
      ex({id:'fente_excentrique_avant',block:'exc_red',sets:'2',reps:'5 reps / jambe',rest:'1 mn',tempo:'3-0-2'}),
      ex({id:'pompe_excentrique',  block:'exc_red',sets:'2',reps:'5 reps',rest:'1 mn',tempo:'3-0-2'}),
      ex({id:'dips_excentrique',   block:'exc_red',sets:'2',reps:'5 reps',rest:'1 mn',tempo:'3-0-2'}),
      ex({id:'elevation_orteils',  block:'pied',sets:'2',reps:'10 reps',rest:'30 s',note:'Allégé'}),
      ex({id:'dorsiflexion_tibial',block:'pied',sets:'2',reps:'10 reps',rest:'30 s'}),
      ex({id:'equilibre_unipodal', block:'equilibre',sets:'2',reps:'20 s / jambe',rest:'30 s',note:'Allégé'}),
      transmissionForceExo(),
      ex({id:'etirements_complets',block:'cooldown',sets:'-',reps:'10 mn',rest:'-'})
    ],
    feedbackQuestions:['difficulty','fatigue','pain','completed','comment'],
    adaptationRules:{titanCan:['rest'],titanCannot:['increaseVolume','breakTempo']}
  };

  // PLACEHOLDER P2 J4 — Le PDF saute le détail. Voir I1.
  var p2_j4_placeholder = {
    sessionId:'tri_p2_j4', sessionNumber:4, sessionTitle:'Jour 4 — OPTIONNEL : Excentrique variantes (PLACEHOLDER — à clarifier)',
    sessionGoal:'PLACEHOLDER — le PDF ne détaille pas les exos. Hypothèse : variantes excentriques du J1.',
    sessionType:'exc-variants-opt-placeholder', estimatedDuration:'60-75 min', requiredEquipment:['Sans matériel'],
    isOptional:true,
    specialInstructions:'⚠ INCOHÉRENCE I1 : PDF ne détaille pas cette séance. À CONFIRMER avec le propriétaire avant intégration. Marquée comme placeholder, exos = miroir de J1 P2.',
    titanIntroMessage:'Séance bonus. Variantes excentriques. (Définition exacte à confirmer côté contenu.)',
    blocks:[
      {blockId:'warmup',     blockType:'warmup',title:'Échauffement'},
      {blockId:'exc_var',    blockType:'main',  title:'Excentrique variantes (placeholder)'},
      {blockId:'transmission',blockType:'main',title:'Transmission Force (R1)'},
      {blockId:'cooldown',   blockType:'recovery',title:'Étirements'}
    ],
    exercises:[
      ex({id:'echauffement_dynamique',block:'warmup',sets:'-',reps:'8-10 mn',rest:'-'}),
      // Exos miroir J1 P2, à valider
      ex({id:'squat_excentrique',  block:'exc_var',sets:'Var.*',reps:'8-12 reps',rest:'2-3 mn',tempo:'5-0-3',note:'Variante — à confirmer'}),
      ex({id:'fente_excentrique_avant',block:'exc_var',sets:'Var.*',reps:'8-12 reps / jambe',rest:'2-3 mn',tempo:'5-0-3'}),
      ex({id:'pompe_excentrique',  block:'exc_var',sets:'Var.*',reps:'8-12 reps',rest:'2-3 mn',tempo:'5-0-3'}),
      ex({id:'traction_excentrique',block:'exc_var',sets:'Var.*',reps:'8-12 reps',rest:'2-3 mn',tempo:'5-0-3'}),
      transmissionForceExo(),
      ex({id:'etirements_legers',  block:'cooldown',sets:'-',reps:'5-10 mn',rest:'-'})
    ],
    feedbackQuestions:['difficulty','fatigue','pain','completed','comment'],
    adaptationRules:{titanCan:['skip','rest','variant'],titanCannot:['forceIfFatigued']},
    _PLACEHOLDER:true
  };

  // ─── PHASE 3 — EXPLOSIVE (4 sem · 4 jours obligatoires) ──────────────────

  var p3_j1 = {
    sessionId:'tri_p3_j1', sessionNumber:1, sessionTitle:'Jour 1 — Bas du corps explosif + Haut du corps',
    sessionGoal:'Plio bas + haut + Transmission Force.',
    sessionType:'explosif-fullbody', estimatedDuration:'60-80 min', requiredEquipment:['Sans matériel','Barre traction (option)'],
    isOptional:false,
    specialInstructions:'PRINCIPE CLÉ (R3) : Descente 1-2s contrôlée → Montée EXPLOSION MAXIMALE. Arrête la série si la vitesse diminue.',
    titanIntroMessage:'Phase 3. Tu convertis tout. Explosion maximale. Si tu ralentis, tu arrêtes.',
    blocks:[
      {blockId:'warmup',  blockType:'warmup',title:'Échauffement + activation'},
      {blockId:'plio_bas',blockType:'main',  title:'Pliométrie bas du corps'},
      {blockId:'plio_haut',blockType:'main', title:'Pliométrie haut du corps'},
      {blockId:'pied',    blockType:'main',  title:'Travail du pied explosif'},
      {blockId:'equilibre',blockType:'main', title:'Équilibre + perturbations'},
      {blockId:'transmission',blockType:'main',title:'Transmission Force (R1)'},
      {blockId:'cooldown',blockType:'recovery',title:'Étirements'}
    ],
    exercises:[
      ex({id:'echauffement_activation',block:'warmup',sets:'-',reps:'10 mn',rest:'-'}),
      ex({id:'squat_jump',         block:'plio_bas',sets:'Var.*',reps:'8-12 reps',rest:'2-3 mn',intensity:'EXPLOSION MAX'}),
      ex({id:'fente_sautee_alternee',block:'plio_bas',sets:'Var.*',reps:'8-12 reps tot',rest:'2-3 mn',note:'Changement en l\'air'}),
      ex({id:'broad_jumps',        block:'plio_bas',sets:'Var.*',reps:'8-12 reps',rest:'2-3 mn',note:'Distance maximale'}),
      ex({id:'pompe_claquee',      block:'plio_haut',sets:'Var.*',reps:'8-12 reps',rest:'2-3 mn',note:'Mains décollent du sol'}),
      ex({id:'dips_explosif',      block:'plio_haut',sets:'Var.*',reps:'8-12 reps',rest:'2-3 mn',note:'Accélération max'}),
      ex({id:'traction_explosive', block:'plio_haut',sets:'Var.*',reps:'8-12 reps',rest:'2-3 mn',note:'Vitesse maximale'}),
      ex({id:'elevation_orteils',  block:'pied',sets:'3',reps:'15 reps',rest:'30 s',note:'Explosive'}),
      ex({id:'dorsiflexion_tibial',block:'pied',sets:'3',reps:'15 reps',rest:'30 s',note:'Explosive'}),
      ex({id:'equilibre_unipodal', block:'equilibre',sets:'3',reps:'30 s / jambe',rest:'30 s',note:'+ perturbations'}),
      transmissionForceExo(),
      ex({id:'etirements_legers',  block:'cooldown',sets:'-',reps:'5-10 mn',rest:'-'})
    ],
    feedbackQuestions:['difficulty','fatigue','pain','completed','explosivenessFelt','comment'],
    adaptationRules:{titanCan:['rest','reps'],titanCannot:['continueIfSlow']}
  };

  var p3_j2 = {
    sessionId:'tri_p3_j2', sessionNumber:2, sessionTitle:'Jour 2 — Bas du corps explosif + Survitesse',
    sessionGoal:'Survitesse (élastiques) + box jumps + sauts unilatéraux.',
    sessionType:'explosif-survitesse', estimatedDuration:'60-80 min', requiredEquipment:['Sans matériel','Élastiques (option)','Box'],
    isOptional:false,
    specialInstructions:'Speed squat avec élastiques d\'assistance — si dispo. Sinon, version sans élastiques.',
    titanIntroMessage:'Survitesse. Les élastiques tirent vers le haut — tu accélères au-delà de tes limites.',
    blocks:[
      {blockId:'warmup',  blockType:'warmup',title:'Échauffement + activation'},
      {blockId:'survitesse',blockType:'main',title:'Survitesse + plio max'},
      {blockId:'plio_haut',blockType:'main', title:'Pliométrie haut'},
      {blockId:'pied',    blockType:'main',  title:'Travail du pied explosif'},
      {blockId:'transmission',blockType:'main',title:'Transmission Force (R1)'},
      {blockId:'cooldown',blockType:'recovery',title:'Étirements'}
    ],
    exercises:[
      ex({id:'echauffement_activation',block:'warmup',sets:'-',reps:'10 mn',rest:'-'}),
      ex({id:'speed_squat_elastiques',block:'survitesse',sets:'Var.*',reps:'8-12 reps',rest:'2-3 mn',note:'SURVITESSE'}),
      ex({id:'single_leg_jump',    block:'survitesse',sets:'Var.*',reps:'8-12 reps / jambe',rest:'2-3 mn',note:'Unilatéral explosif'}),
      ex({id:'box_jumps_progression',block:'survitesse',sets:'Var.*',reps:'8-12 reps',rest:'2-3 mn',note:'Hauteur progressive'}),
      ex({id:'pompe_explosive_bandes',block:'plio_haut',sets:'Var.*',reps:'8-12 reps',rest:'2-3 mn',note:'Bandes si possible'}),
      ex({id:'pike_pushup_explosif',block:'plio_haut',sets:'Var.*',reps:'8-12 reps',rest:'2-3 mn'}),
      ex({id:'elevation_orteils',  block:'pied',sets:'3',reps:'15 reps',rest:'30 s',note:'Explosive'}),
      ex({id:'dorsiflexion_tibial',block:'pied',sets:'3',reps:'15 reps',rest:'30 s',note:'Explosive'}),
      transmissionForceExo(),
      ex({id:'etirements_legers',  block:'cooldown',sets:'-',reps:'5-10 mn',rest:'-'})
    ],
    feedbackQuestions:['difficulty','fatigue','pain','completed','comment'],
    adaptationRules:{titanCan:['rest','reps','survitesseMode'],titanCannot:['skipTransmissionForce']}
  };

  var p3_j3 = {
    sessionId:'tri_p3_j3', sessionNumber:3, sessionTitle:'Jour 3 — Haut du corps explosif + Bas du corps',
    sessionGoal:'Plio haut + squat jump + calf jump.',
    sessionType:'explosif-haut-bas', estimatedDuration:'55-75 min', requiredEquipment:['Sans matériel','Barre traction'],
    isOptional:false,
    specialInstructions:'Focus inversé : haut explosif d\'abord, bas en second.',
    titanIntroMessage:'Haut explosif. Tractions, dips, pompes claquées — accélération max.',
    blocks:[
      {blockId:'warmup',  blockType:'warmup',title:'Échauffement + activation'},
      {blockId:'plio_haut',blockType:'main', title:'Pliométrie haut'},
      {blockId:'plio_bas',blockType:'main',  title:'Pliométrie bas'},
      {blockId:'transmission',blockType:'main',title:'Transmission Force (R1)'},
      {blockId:'cooldown',blockType:'recovery',title:'Étirements'}
    ],
    exercises:[
      ex({id:'echauffement_activation',block:'warmup',sets:'-',reps:'10 mn',rest:'-'}),
      ex({id:'pompe_claquee',      block:'plio_haut',sets:'Var.*',reps:'8-12 reps',rest:'2-3 mn',note:'Variantes — mains + pieds décollent'}),
      ex({id:'traction_explosive', block:'plio_haut',sets:'Var.*',reps:'8-12 reps',rest:'2-3 mn',note:'Tirer le plus vite possible'}),
      ex({id:'dips_explosif',      block:'plio_haut',sets:'Var.*',reps:'8-12 reps',rest:'2-3 mn',note:'Accélération max'}),
      ex({id:'squat_jump',         block:'plio_bas',sets:'Var.*',reps:'8-12 reps',rest:'2-3 mn',note:'Hauteur maximale'}),
      ex({id:'calf_jump',          block:'plio_bas',sets:'Var.*',reps:'8-12 reps',rest:'2 mn',note:'Rebonds explosifs'}),
      transmissionForceExo(),
      ex({id:'etirements_legers',  block:'cooldown',sets:'-',reps:'5-10 mn',rest:'-'})
    ],
    feedbackQuestions:['difficulty','fatigue','pain','completed','comment'],
    adaptationRules:{titanCan:['rest','reps'],titanCannot:['continueIfSlow']}
  };

  var p3_j4 = {
    sessionId:'tri_p3_j4', sessionNumber:4, sessionTitle:'Jour 4 — Circuit triphasique ISO + EXCENTRIQUE + EXPLOSIF',
    sessionGoal:'Méta-séance signature — combine les 3 méthodes sur les mêmes mouvements.',
    sessionType:'circuit-triphasique', estimatedDuration:'75-95 min', requiredEquipment:['Sans matériel'],
    isOptional:false,
    specialInstructions:'R5 — séance signature : chaque mouvement est travaillé en ISO → EXCENTRIQUE → EXPLOSIF (3 séries de chaque). Squat puis Pompe puis Dorsiflexion.',
    titanIntroMessage:'Circuit triphasique. Iso → Excentrique → Explosif sur le même mouvement. C\'est tout ton programme condensé.',
    blocks:[
      {blockId:'warmup',  blockType:'warmup',title:'Échauffement complet'},
      {blockId:'triphasique_squat',blockType:'main',title:'Triphasique Squat (Iso→Exc→Explosif)',executionMode:'enchaînement'},
      {blockId:'triphasique_pompe',blockType:'main',title:'Triphasique Pompe (Iso→Exc→Explosif)',executionMode:'enchaînement'},
      {blockId:'triphasique_pied', blockType:'main',title:'Triphasique Pied (Iso→Exc→Explosif)',executionMode:'enchaînement'},
      {blockId:'transmission',blockType:'main',title:'Transmission Force (R1)'},
      {blockId:'cooldown',blockType:'recovery',title:'Étirements complets'}
    ],
    exercises:[
      ex({id:'echauffement_complet',block:'warmup',sets:'-',reps:'10 mn',rest:'-'}),
      // Triphasique Squat
      ex({id:'squat_iso_90',       block:'triphasique_squat',sets:'3',reps:'30-45 s',rest:'1 mn',note:'1) ISOMÉTRIQUE — maintien'}),
      ex({id:'squat_excentrique',  block:'triphasique_squat',sets:'3',reps:'8 reps',rest:'1 mn',tempo:'5-0-3',note:'2) EXCENTRIQUE — contrôle'}),
      ex({id:'squat_jump',         block:'triphasique_squat',sets:'3',reps:'8 reps',rest:'2 mn',intensity:'EXPLOSION MAX',note:'3) EXPLOSIVITÉ'}),
      // Triphasique Pompe
      ex({id:'planche_coudes',     block:'triphasique_pompe',sets:'3',reps:'30-45 s',rest:'1 mn',note:'1) ISOMÉTRIQUE — gainage actif'}),
      ex({id:'pompe_excentrique',  block:'triphasique_pompe',sets:'3',reps:'8 reps',rest:'1 mn',tempo:'5-0-3',note:'2) EXCENTRIQUE — contrôle'}),
      ex({id:'pompe_claquee',      block:'triphasique_pompe',sets:'3',reps:'8 reps',rest:'2 mn',intensity:'EXPLOSION MAX',note:'3) EXPLOSIVITÉ'}),
      // Triphasique Pied
      ex({id:'elevation_orteils',  block:'triphasique_pied',sets:'2',reps:'30 s',rest:'30 s',note:'1) Isométrique — Maintien'}),
      ex({id:'dorsiflexion_tibial',block:'triphasique_pied',sets:'2',reps:'8 reps',rest:'30 s',tempo:'5-0-3',note:'2) Excentrique — 5s + 3s'}),
      ex({id:'dorsiflexion_tibial',block:'triphasique_pied',sets:'2',reps:'12 reps',rest:'30 s',note:'3) Explosive'}),
      transmissionForceExo(),
      ex({id:'etirements_complets',block:'cooldown',sets:'-',reps:'8-10 mn',rest:'-'})
    ],
    feedbackQuestions:['difficulty','fatigue','pain','completed','triphasicQuality','comment'],
    adaptationRules:{titanCan:['rest','reps'],titanCannot:['breakCircuit','skipTransmissionForce']}
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
      validationRule: opts.validationRule || 'Toutes les séances requises terminées + Transmission Force respectée.',
      specialNote: opts.specialNote || null,
      sessions: sessions
    };
  }

  var P1_SESS = [
    {id:'tri_p1_j1',required:true},{id:'tri_p1_j2',required:true},
    {id:'tri_p1_j3',required:true},{id:'tri_p1_j4',required:false}
  ];
  var P2_SESS = [
    {id:'tri_p2_j1',required:true},{id:'tri_p2_j2',required:true},
    {id:'tri_p2_j3',required:true},{id:'tri_p2_j4',required:false}
  ];
  var P3_SESS = [
    {id:'tri_p3_j1',required:true},{id:'tri_p3_j2',required:true},
    {id:'tri_p3_j3',required:true},{id:'tri_p3_j4',required:true}
  ];

  var phase1Weeks = [
    makeWeek('tri_p1',1,'15-30 s de maintien — apprentissage des positions',2,P1_SESS),
    makeWeek('tri_p1',2,'30-45 s de maintien — consolidation','3-4',P1_SESS),
    makeWeek('tri_p1',3,'45-60 s de maintien — progression','4-5',P1_SESS),
    makeWeek('tri_p1',4,'60-90 s de maintien — force maximale','5-6',P1_SESS,{specialNote:'Phase 1 terminée : tendons renforcés, stabilité articulaire.'})
  ];
  var phase2Weeks = [
    makeWeek('tri_p2',5,'8-10 reps — apprentissage du tempo 5+3',2,P2_SESS),
    makeWeek('tri_p2',6,'8-10 reps — consolidation du contrôle','3-4',P2_SESS),
    makeWeek('tri_p2',7,'10-12 reps — progression du volume','4-5',P2_SESS),
    makeWeek('tri_p2',8,'10-12 reps — force maximale + ajout de charge possible','5-6',P2_SESS,{specialNote:'Phase 2 terminée : force maximale construite, contrôle musculaire optimal.'})
  ];
  var phase3Weeks = [
    makeWeek('tri_p3',9, 'Focus technique explosive — maîtriser la vitesse',2,P3_SESS),
    makeWeek('tri_p3',10,'Augmentation de la vitesse d\'exécution','3-4',P3_SESS),
    makeWeek('tri_p3',11,'Ajout de charge légère + survitesse élastiques','4-5',P3_SESS),
    makeWeek('tri_p3',12,'EXPLOSIVITÉ MAXIMALE — toutes les méthodes combinées','5-6',P3_SESS,{specialNote:'12 semaines terminées : force explosive maximale, puissance athlétique optimale.'})
  ];

  var program = {
    programId:'tri',
    programName:'Triphasique',
    programGoal:'Force complète sans salle — Isométrique → Excentrique → Explosif',
    totalWeeks:12,
    programFrequency:'P1+P2 : 3 obligatoires + 1 opt / sem · P3 : 4 jours / sem',
    programLocation:'Sans salle (poids du corps)',
    requiredTests:[],
    optionalTests:['Test détente verticale (recommandé avant + après)','Filmer pour comparer'],
    specialRules:[
      'Transmission Force = 9 mn / 100% à la fin de CHAQUE séance des 3 phases (R1).',
      'Phase 2 — Tempo STRICT 5+3 (descente 5s, montée 3s). Inspirer en descente, expirer en montée (R2).',
      'Phase 3 — Descente 1-2s contrôlée → Explosion maximale. Arrêter la série si la vitesse diminue (R3).',
      'Séances "allégé" P1.J3 et P2.J3 : NE PAS LES SAUTER. Récupération active maintient le signal nerveux (R4).',
      'Phase 3 Jour 4 = Circuit triphasique signature (Iso+Exc+Explosif combinés) (R5).'
    ],
    phases:[
      {
        phaseId:'tri_p1', phaseName:'PHASE 1 — ISOMÉTRIQUE', phaseNumber:1,
        phaseGoal:'Renforcer les tendons et les structures profondes. Fondation de tout le programme.',
        durationWeeks:4, frequency:'3 obligatoires + 1 opt / sem', location:'Sans salle',
        progressionRules:[
          {week:1,sets:2,    focus:'15-30 s de maintien — apprentissage'},
          {week:2,sets:'3-4',focus:'30-45 s — consolidation'},
          {week:3,sets:'4-5',focus:'45-60 s — progression'},
          {week:4,sets:'5-6',focus:'60-90 s — force maximale'}
        ],
        weeks:phase1Weeks,
        sessions:{tri_p1_j1:p1_j1,tri_p1_j2:p1_j2,tri_p1_j3:p1_j3,tri_p1_j4:p1_j4}
      },
      {
        phaseId:'tri_p2', phaseName:'PHASE 2 — EXCENTRIQUE', phaseNumber:2,
        phaseGoal:'Développer la force maximale en contrôlant la phase de descente. Les gains se révèlent en Phase 3.',
        durationWeeks:4, frequency:'3 obligatoires + 1 opt / sem', location:'Sans salle',
        progressionRules:[
          {week:5,sets:2,    focus:'8-10 reps — apprentissage tempo 5+3'},
          {week:6,sets:'3-4',focus:'8-10 reps — consolidation contrôle'},
          {week:7,sets:'4-5',focus:'10-12 reps — progression volume'},
          {week:8,sets:'5-6',focus:'10-12 reps — force maximale + ajout charge possible'}
        ],
        weeks:phase2Weeks,
        sessions:{tri_p2_j1:p2_j1,tri_p2_j2:p2_j2,tri_p2_j3:p2_j3,tri_p2_j4:p2_j4_placeholder}
      },
      {
        phaseId:'tri_p3', phaseName:'PHASE 3 — EXPLOSIVE', phaseNumber:3,
        phaseGoal:'Convertir la force des phases 1 et 2 en puissance explosive pure.',
        durationWeeks:4, frequency:'4 jours / sem', location:'Sans salle',
        progressionRules:[
          {week:9, sets:2,    focus:'Focus technique explosive'},
          {week:10,sets:'3-4',focus:'Augmentation vitesse d\'exécution'},
          {week:11,sets:'4-5',focus:'Charge légère + survitesse élastiques'},
          {week:12,sets:'5-6',focus:'EXPLOSIVITÉ MAXIMALE — toutes méthodes combinées'}
        ],
        weeks:phase3Weeks,
        sessions:{tri_p3_j1:p3_j1,tri_p3_j2:p3_j2,tri_p3_j3:p3_j3,tri_p3_j4:p3_j4}
      }
    ],
    finalNote:'12 semaines terminées : Force explosive maximale | Puissance athlétique optimale | Transformation complète sans salle.'
  };

  var verificationTable = [];
  [phase1Weeks,phase2Weeks,phase3Weeks].forEach(function(weeks,pi){
    weeks.forEach(function(w){
      var status = 'OK';
      if (pi===1 && w.weekNumber!==undefined) status = 'OK — voir I1 sur J4 (placeholder)';
      if (w.specialNote) status = w.specialNote.indexOf('terminée') > -1 ? 'FIN DE PHASE' : status;
      verificationTable.push({program:'tri',phase:pi+1,week:w.weekNumber,sessions:Object.keys(program.phases[pi].sessions),status:status,notes:w.specialNote||null});
    });
  });

  var allExoIds = Object.keys(TRI_MASTER_EXERCISES);
  // ─── Compteur séances ─────────────────────────────────────────────────────
  // totalSessionTemplates  = 11 (P1×4 + P2×4 dont 1 placeholder + P3×4)
  // totalSessionsExecuted  = P1: 3 obl × 4 sem = 12   (J4 OPT non compté)
  //                          P2: 3 obl × 4 sem = 12   (J4 OPT non compté)
  //                          P3: 4 × 4 sem = 16
  //                          TOTAL = 40 séances
  // Avec J4 P1+P2 OPT fait : +4+4 = 48.
  var stats = {
    totalPhases:3,
    totalWeeks:12,
    totalSessionTemplates:11,
    totalSessionsExecuted:        40,    // obligatoires
    totalSessionsExecutedWithOpt: 48,    // +8 si J4 P1+P2 opt fait
    placeholderSessions:          1,     // P2 J4 — exos non détaillés dans PDF
    uniqueExercises:allExoIds.length,
    exercisesWithVideo:0,
    exercisesWithoutVideo:allExoIds.map(function(id){return{exerciseId:id,masterName:TRI_MASTER_EXERCISES[id].masterName,category:TRI_MASTER_EXERCISES[id].category};})
  };

  return {program:program,masterExercises:TRI_MASTER_EXERCISES,verificationTable:verificationTable,stats:stats};
});
