// ════════════════════════════════════════════════════════════════════════════
// EXPLOSE+ — SOURCE DE VÉRITÉ DU PROGRAMME (data layer, non intégré UI)
// ────────────────────────────────────────────────────────────────────────────
// Source : PDF "Programme EXPLOSE+" (uploadé 2026-06-12, 24 pages).
// Schéma : identique aux autres programmes.
// CE FICHIER N'EST PAS BRANCHÉ DANS L'UI — étape de validation.
//
// ─── RÉSUMÉ ────────────────────────────────────────────────────────────────
// Nom         : EXPLOSE+
// Méthode     : MENER (partenaire de résultats OBLIGATOIRE)
// Objectif    : Transformation physique complète sur 18 sem (Super Explosif Test)
// Durée       : 18 semaines (4 phases : 4 + 5 + 5 + 4)
// Fréquence   : Phase 1 = 3-4 j/sem · Phase 2 = 4 · Phase 3-4 = 4-5
// Lieu        : Phase 1 sans salle possible · Phase 2 salle reco · Phase 3-4 salle obligatoire
// Compteurs   : 4 phases · 18 semaines · 14 séances-types (P1×4 + P2×4 + P3×4 + P4×4 - 2 vides)
//
// ─── RÈGLES SPÉCIALES ───────────────────────────────────────────────────────
//   R1. NON-NÉGOCIABLE : Partenaire de résultats OBLIGATOIRE avant de
//       commencer. Sans partenaire, pas de programme (page 1 PDF).
//   R2. AVANT DE COMMENCER : 1) Trouver partenaire / 2) Signer contrat /
//       3) Questionnaire MENER / 4) Choisir engagements / 5) Super Explosif
//       Test INITIAL (baseline).
//   R3. SUPER EXPLOSIF TEST = protocole de 11 mesures : 94 feet, sprint 60m,
//       détente verticale, pesée, photos, mesures, 1RM (Squat/SDT/HT/DC).
//       Réalisé en BASELINE + fin de chaque phase (sem.4 / sem.9 / sem.14 / sem.18).
//   R4. PILIER MENER refait en début de chaque phase pour identifier le
//       pilier faible du cycle.
//   R5. RDV partenaire 1x/sem (15-30 mn) : rendre compte des engagements,
//       valider ou recommencer. Engagements 1-3 max par semaine.
//   R6. Tests 1RM obligatoires début Phase 2 (Squat/SDT/HT/DC) — déterminent
//       toutes les charges (%1RM) de Phase 2/3/4.
//   R7. SEMAINE D'AFFÛTAGE en fin de chaque phase : volume -20% (P1, P2),
//       -20 à -30% (P3), -30 à -40% (P4), + test.
//
// ─── INCOHÉRENCES DÉTECTÉES ─────────────────────────────────────────────────
//   I1. Phase 1 = "3-4 j/sem" mais l'organisation hebdo a 4 séances (J1/J2/J3/J4).
//       J4 (cardio + proprio) est marqué OPTIONNEL → 3 obligatoires + 1 opt.
//   I2. Phase 3 organisation hebdo : Dimanche mentionne "Jour 5 optionnel"
//       mais aucun Jour 5 n'est détaillé dans le PDF. À clarifier UX.
//   I3. Phase 2 : organisation Lun J1 / Mar repos / Mer J2 / Jeu repos / Ven J3 /
//       Sam J4 / Dim MENER — 4 séances confirmées. OK.
//   I4. Phase 3 jours consécutifs Mer J2 + Jeu J3 — pas de règle 48h
//       explicite contrairement à Vertical Dunk. Acceptable pour Plio + Vitesse
//       (pas la même charge sur les mêmes groupes).
//   I5. Tests 1RM listés début Phase 2 incluent Hip Thrust et Développé couché
//       (en plus de Squat + SDT habituels). Cohérent avec les exos du programme.
//
// ─── VIDÉOS ────────────────────────────────────────────────────────────────
// Toutes en videoStatus="missing". L'app ne doit pas bloquer une séance.
// ════════════════════════════════════════════════════════════════════════════

(function (root, factory) {
  var lib = factory();
  if (typeof module === 'object' && module.exports) module.exports = lib;
  if (root) root.EXPLOSE_PLUS_PROGRAM = lib.program;
  if (root) root.EXPLOSE_PLUS_LIB = lib;
})(typeof window !== 'undefined' ? window : null, function () {

  // ─── LIBRAIRIE MAÎTRE — exos uniques utilisés par Explose+ ───────────────
  var EP_MASTER_EXERCISES = {
    // — Échauffement & étirements —
    echauffement_dynamique:    { masterName: 'Échauffement dynamique général',           category: 'Échauffement', videoUrl: null, generic: true },
    echauffement_general_mob:  { masterName: 'Échauffement général + mobilité',          category: 'Échauffement', videoUrl: null, generic: true },
    echauffement_haut_corps:   { masterName: 'Échauffement dynamique haut du corps',     category: 'Échauffement', videoUrl: null, generic: true },
    echauffement_complet:      { masterName: 'Échauffement dynamique complet',           category: 'Échauffement', videoUrl: null, generic: true },
    echauffement_explosif:     { masterName: 'Échauffement dynamique explosif',          category: 'Échauffement', videoUrl: null, generic: true },
    echauffement_corps_complet:{ masterName: 'Échauffement dynamique corps complet',     category: 'Échauffement', videoUrl: null, generic: true },
    montee_charge:             { masterName: 'Montée en charge progressive',             category: 'Échauffement', videoUrl: null, generic: true },
    etirements_foam_rolling:   { masterName: 'Étirements + foam rolling',                category: 'Récupération', videoUrl: null, generic: true },
    etirements_longs:          { masterName: 'Étirements longs',                         category: 'Récupération', videoUrl: null, generic: true },
    etirements_statiques:      { masterName: 'Étirements statiques',                     category: 'Récupération', videoUrl: null, generic: true },
    foam_rolling:              { masterName: 'Foam rolling corps complet',               category: 'Récupération', videoUrl: null, generic: true },
    marche_dynamique:          { masterName: 'Marche dynamique progressive',             category: 'Récupération', videoUrl: null, generic: true },

    // — Pliométrie & sauts —
    squat_jump:                { masterName: 'Squat jump',                               category: 'Pliométrie', videoUrl: null, pdfAliases: ['Squat jump — Explosivité','Squat jump — Qualité > Quantité'] },
    squats_sautes_legers:      { masterName: 'Squats sautés légers',                     category: 'Pliométrie', videoUrl: null, pdfAliases: ['Squats sautés légers — Activation neuromusculaire','Squats sautés légers — Activation'] },
    broad_jumps:               { masterName: 'Broad jumps',                              category: 'Pliométrie', videoUrl: null, pdfAliases: ['Broad jumps — Distance maximale','Broad jumps — bonds en avant — Atterrissage souple','Broad jumps — Distance record'] },
    lateral_bounds:            { masterName: 'Lateral bounds',                           category: 'Pliométrie', videoUrl: null, pdfAliases: ['Lateral bounds — Latéral explosif','Lateral bounds — Réactivité latérale','Lateral bounds — Explosivité latérale'] },
    split_jumps:               { masterName: 'Split jumps',                              category: 'Pliométrie', videoUrl: null, pdfAliases: ['Split jumps — Alternance explosive'] },
    tuck_jumps:                { masterName: 'Tuck jumps',                               category: 'Pliométrie', videoUrl: null, pdfAliases: ['Tuck jumps — Genoux à la poitrine'] },
    box_jumps:                 { masterName: 'Box jumps',                                category: 'Pliométrie intensive', videoUrl: null, pdfAliases: ['Box jumps — Système nerveux frais — explosivité max','Box jumps record de hauteur — Hauteur maximale jamais atteinte','Box jumps — Record de hauteur — explosivité absolue','Box jumps — Qualité maximale','Box jumps hauteur maximale — Système nerveux frais'] },
    box_squat_jumps:           { masterName: 'Box squat jumps',                          category: 'Pliométrie', videoUrl: null, pdfAliases: ['Box squat jumps — assis-debout — Explosion du bas'] },
    depth_jumps:               { masterName: 'Depth jumps',                              category: 'Pliométrie intensive', videoUrl: null, pdfAliases: ['Depth jump (hauteur basse) — Réactivité sol','Depth jumps — Réactivité au sol — réduire le temps de contact','Depth jumps — Réactivité maximale','Depth jumps — rebond immédiat — Réactivité maximale','Depth jumps — Réactivité au sol maximale'] },
    hurdle_hops:               { masterName: 'Hurdle hops',                              category: 'Pliométrie intensive', videoUrl: null, pdfAliases: ['Hurdle hops — sauts de haies — Hauteur progressive','Hurdle hops — hauteur maximale — Vitesse + hauteur','Hurdle hops — Vitesse + hauteur max'] },
    single_leg_box_jumps:      { masterName: 'Single leg box jumps',                     category: 'Pliométrie intensive', videoUrl: null, pdfAliases: ['Single leg box jumps — Unilatéral — atterrissage','Single leg box jumps — Unilatéral avancé','Single leg box jumps — Unilatéral peak'] },
    squat_jump_charge:         { masterName: 'Squat jump avec charge',                   category: 'Pliométrie', videoUrl: null, pdfAliases: ['Squat jump avec charge (20-30% 1RM)','Squat jump avec charge (30% 1RM)'] },
    sauts_corde:               { masterName: 'Sauts à la corde',                         category: 'Pliométrie', videoUrl: null },
    sauts_unipodaux_stab:      { masterName: 'Sauts unipodaux stabilisés',               category: 'Proprioception', videoUrl: null, pdfAliases: ['Sauts unipodaux stabilisés — Atterrissage contrôlé'] },
    sauts_unipodaux_multi:     { masterName: 'Sauts unipodaux multidirectionnels',       category: 'Proprioception', videoUrl: null, pdfAliases: ['Sauts unipodaux multidirectionnels — Coordination'] },

    // — Force au poids du corps —
    squat_pdc:                 { masterName: 'Squat poids du corps',                     category: 'Force PDC', videoUrl: null, pdfAliases: ['Squat poids du corps — tempo 3-1-1 — 3 s descente, 1 s bas, 1 s montée'] },
    fente_avant_alternee:      { masterName: 'Fente avant alternée',                     category: 'Force PDC', videoUrl: null, pdfAliases: ['Fente avant alternée — Genou avant à 90°'] },
    hip_hinge_rdl_pdc:         { masterName: 'Hip hinge — RDL poids du corps',           category: 'Force PDC', videoUrl: null, pdfAliases: ['Hip hinge — RDL poids du corps — Focus ischio — dos droit'] },
    glute_bridge_unilat_pdc:   { masterName: 'Glute bridge unilatéral',                  category: 'Force PDC', videoUrl: null, pdfAliases: ['Glute bridge unilatéral — Contraction glute en haut'] },
    pompes_tempo:              { masterName: 'Pompes tempo 3-1-1',                       category: 'Force PDC', videoUrl: null, pdfAliases: ['Pompes — tempo 3-1-1 — 3 s descente — amplitude complète'] },
    pompes_claquees:           { masterName: 'Pompes claquées',                          category: 'Pliométrie', videoUrl: null, pdfAliases: ['Pompes claquées — Mains décollent du sol'] },
    pompes_pliometriques:      { masterName: 'Pompes pliométriques',                     category: 'Pliométrie', videoUrl: null },
    traction_australienne:     { masterName: 'Traction australienne',                    category: 'Force PDC', videoUrl: null, pdfAliases: ['Traction australienne ou traction (si barre) — Full rom'] },
    dips_chaise_barre:         { masterName: 'Dips sur chaise ou barre',                 category: 'Force PDC', videoUrl: null },
    superman_hold:             { masterName: 'Superman hold',                            category: 'Gainage', videoUrl: null, pdfAliases: ['Superman hold — Contraction max en haut'] },

    // — Iso & stato-dynamique —
    squat_isometrique:         { masterName: 'Squat isométrique (90°)',                  category: 'Isométrique', videoUrl: null, pdfAliases: ['Squat isométrique 90° — Contraction active — progresser le temps'] },
    fente_isometrique:         { masterName: 'Fente isométrique avant',                  category: 'Isométrique', videoUrl: null, pdfAliases: ['Fente isométrique avant — Genou à 90°'] },
    squat_stato_dyn:           { masterName: 'Squat stato-dynamique',                    category: 'Stato-dynamique', videoUrl: null, pdfAliases: ['Squat stato-dynamique — Isométrie profonde puis explosion'] },
    split_stance_stato_dyn:    { masterName: 'Split stance stato-dynamique',             category: 'Stato-dynamique', videoUrl: null },

    // — Force barre / haltères —
    squat_barre:               { masterName: 'Squat à la barre',                         category: 'Force barre', videoUrl: null, pdfAliases: ['Squat à la barre — Technique parfaite — dernière série à l\'échec','Squat à la barre — Dernière série → à l\'échec total','Squat à la barre — Dernière série → records 1RM si possible','Squat à la barre — Volume réduit sem.17-18 — maintien intensité'] },
    squat_barre_explosif:      { masterName: 'Squat à la barre explosif',                category: 'Force barre', videoUrl: null, pdfAliases: ['Squat à la barre explosif (50-60% 1RM)'] },
    sdt:                       { masterName: 'Soulevé de terre',                         category: 'Force barre', videoUrl: null, pdfAliases: ['Soulevé de terre — Explosif à la montée','Soulevé de terre — Dernière série → à l\'échec','Soulevé de terre — Charge maximale'] },
    hip_thrust:                { masterName: 'Hip Thrust',                               category: 'Force barre', videoUrl: null, pdfAliases: ['Hip Thrust — Charge lourde — glutes max en haut','Hip Thrust — Charge maximale','Hip Thrust — Charge maximale'] },
    hip_thrust_explosif:       { masterName: 'Hip Thrust explosif',                      category: 'Force barre', videoUrl: null, pdfAliases: ['Hip Thrust explosif — Contraction glutes max'] },
    fente_bulgare_halteres:    { masterName: 'Fente bulgare haltères',                   category: 'Force barre', videoUrl: null, pdfAliases: ['Fente bulgare haltères — Enchaîner avec B'] },
    fente_bulgare_pdc:         { masterName: 'Fente bulgare poids du corps',             category: 'Force PDC', videoUrl: null, pdfAliases: ['Fente bulgare poids du corps — Focus quadriceps'] },
    fentes_bulgares_lestees:   { masterName: 'Fentes bulgares lestées',                  category: 'Force barre', videoUrl: null, pdfAliases: ['Fentes bulgares lestées — Enchaîner avec B'] },
    leg_curl:                  { masterName: 'Leg curl',                                 category: 'Force barre', videoUrl: null, pdfAliases: ['Leg curl machine ou nordique — Repos 2 mn après B','B) Leg curl'] },
    nordic_hamstring:          { masterName: 'Nordic hamstring',                         category: 'Force excentrique', videoUrl: null, pdfAliases: ['Nordic hamstring — Excentrique — 3 s descente','Nordic hamstring — Excentrique contrôlé'] },
    reverse_nordic:            { masterName: 'Reverse nordic',                           category: 'Force excentrique', videoUrl: null, pdfAliases: ['Reverse nordic — Quadriceps excentrique'] },
    single_leg_squat_pistol:   { masterName: 'Single leg squat (pistol)',                category: 'Force PDC', videoUrl: null, pdfAliases: ['Single leg squat (pistol progression) — Progresser chaque semaine'] },
    hip_thrust_unilat_pdc:     { masterName: 'Hip thrust unilatéral PDC',                category: 'Force PDC', videoUrl: null, pdfAliases: ['Hip thrust unilatéral pdc — Glutes'] },
    leg_press:                 { masterName: 'Leg press',                                category: 'Force barre', videoUrl: null, pdfAliases: ['Leg press — Enchaîner avec B','A) Leg press — Enchaîner avec B'] },
    leg_extension:             { masterName: 'Leg extension',                            category: 'Force barre', videoUrl: null, pdfAliases: ['B) Leg extension'] },
    front_squat:               { masterName: 'Front squat',                              category: 'Force barre', videoUrl: null, pdfAliases: ['Front squat ou goblet squat'] },
    romanian_dl:               { masterName: 'Romanian deadlift',                        category: 'Force barre', videoUrl: null, pdfAliases: ['Romanian deadlift — Focus ischio-jambiers','Romanian deadlift — Focus ischio'] },
    power_clean:               { masterName: 'Power clean',                              category: 'Force barre', videoUrl: null, pdfAliases: ['Power clean ou hang clean — Technique + puissance','Power clean — Technique + puissance maximale','Power clean'] },
    step_ups_lestes:           { masterName: 'Step-ups explosifs lestés',                category: 'Force barre', videoUrl: null, pdfAliases: ['Step-ups explosifs lestés — Enchaîner avec B','A) Step-ups explosifs lestés — Enchaîner avec B'] },
    goblet_squat_tempo:        { masterName: 'Goblet squat tempo 3-1-1',                 category: 'Force barre', videoUrl: null, pdfAliases: ['B) Goblet squat tempo — Tempo 3-1-1'] },

    // — Haut du corps barre/haltères —
    developpe_couche:          { masterName: 'Développé couché',                         category: 'Force haut', videoUrl: null },
    developpe_incline:         { masterName: 'Développé incliné haltères',               category: 'Force haut', videoUrl: null },
    tractions:                 { masterName: 'Tractions',                                category: 'Force haut', videoUrl: null, pdfAliases: ['Tractions ou lat pulldown — Enchaîner avec B','Tractions lestées ou assistées','Tractions lestées'] },
    rowing_barre:              { masterName: 'Rowing barre',                             category: 'Force haut', videoUrl: null, pdfAliases: ['B) Rowing barre ou haltères','Rowing barre'] },
    rowing_halteres:           { masterName: 'Rowing haltères',                          category: 'Force haut', videoUrl: null },
    developpe_militaire:       { masterName: 'Développé militaire',                      category: 'Force haut', videoUrl: null, pdfAliases: ['A) Développé militaire — Enchaîner avec B','Développé militaire'] },
    elevations_laterales:      { masterName: 'Élévations latérales',                     category: 'Force haut', videoUrl: null, pdfAliases: ['B) Élévations latérales','A) Élévations latérales — Enchaîner avec B'] },
    face_pulls:                { masterName: 'Face pulls',                               category: 'Force haut', videoUrl: null },
    medicine_ball_slams:       { masterName: 'Medicine ball slams',                      category: 'Power haut', videoUrl: null, pdfAliases: ['Medicine ball slams — Puissance','Medicine ball slams — Puissance maximale'] },

    // — Gainage & core —
    planche_avant_bras:        { masterName: 'Planche avant-bras',                       category: 'Gainage', videoUrl: null, pdfAliases: ['Planche avant-bras — Gainage actif — pas de relâchement'] },
    planche_tap_epaules:       { masterName: 'Planche avec tap épaules',                 category: 'Gainage', videoUrl: null, pdfAliases: ['Planche avec tap épaules — Hanches stables','Planche avec tap épaules'] },
    planche_laterale:          { masterName: 'Planche latérale',                         category: 'Gainage', videoUrl: null },
    dead_bug:                  { masterName: 'Dead bug',                                 category: 'Gainage', videoUrl: null, pdfAliases: ['Dead bug — Bas du dos au sol en permanence'] },
    rocking_deadbug:           { masterName: 'Rocking deadbug',                          category: 'Gainage', videoUrl: null, pdfAliases: ['Rocking deadbug — Bas du dos au sol'] },
    pallof_press:              { masterName: 'Pallof press',                             category: 'Gainage', videoUrl: null, pdfAliases: ['Pallof press — Anti-rotation'] },
    russian_twists:            { masterName: 'Russian twists lestés',                    category: 'Gainage', videoUrl: null },
    burpees_explosifs:         { masterName: 'Burpees explosifs',                        category: 'Conditionnement', videoUrl: null },
    battle_ropes:              { masterName: 'Battle ropes ou sprint place',             category: 'Conditionnement', videoUrl: null, pdfAliases: ['Battle ropes ou sprint place — Intensité maximale'] },

    // — Mobilité —
    nineteen_nineteen:         { masterName: '90/90',                                    category: 'Mobilité', videoUrl: null, pdfAliases: ['90/90 hanches — Rotation interne/externe'] },
    cat_cow:                   { masterName: 'Cat Cow',                                  category: 'Mobilité', videoUrl: null, pdfAliases: ['Cat Cow — Mobilité vertébrale'] },
    fente_3d:                  { masterName: 'Fente 3D',                                 category: 'Mobilité', videoUrl: null, pdfAliases: ['Fente 3D — 3 directions'] },
    carioca:                   { masterName: 'Carioca',                                  category: 'Mobilité', videoUrl: null },

    // — Travail du pied —
    elevation_orteils:         { masterName: 'Élévation orteils',                        category: 'Travail du pied', videoUrl: null },
    dorsiflexion:              { masterName: 'Dorsiflexion',                             category: 'Travail du pied', videoUrl: null, pdfAliases: ['Dorsiflexion — tibial antérieur','Dorsiflexion tibial antérieur'] },
    tibialis_raise:            { masterName: 'Tibialis raise',                           category: 'Travail du pied', videoUrl: null, pdfAliases: ['Tibial antérieur — Tibialis raise — Dorsiflexion contrôlée'] },
    releve_pointe_unipodal:    { masterName: 'Relevé de pointe unipodal',                category: 'Travail du pied', videoUrl: null, pdfAliases: ['Relevé de pointe unipodal — Amplitude complète'] },
    calf_raises_debout:        { masterName: 'Calf raises debout',                       category: 'Travail du pied', videoUrl: null, pdfAliases: ['Calf raises debout — Amplitude complète'] },
    calf_raises_unilat:        { masterName: 'Calf raises unilatéral',                   category: 'Travail du pied', videoUrl: null },
    marche_talons:             { masterName: 'Marche sur talons',                        category: 'Travail du pied', videoUrl: null },
    marche_arriere_colline:    { masterName: 'Marche arrière en colline',                category: 'Travail du pied', videoUrl: null, pdfAliases: ['Marche arrière en colline — Dehors de préférence'] },

    // — Proprioception —
    equilibre_unipodal:        { masterName: 'Équilibre unipodal',                       category: 'Proprioception', videoUrl: null, pdfAliases: ['Équilibre unipodal — Yeux ouverts','Équilibre unipodal surface instable','Équilibre unipodal surface instable — Yeux ouverts puis fermés','Équilibre unipodal avancé — Surface instable yeux fermés'] },
    equilibre_yeux_fermes:     { masterName: 'Équilibre yeux fermés',                    category: 'Proprioception', videoUrl: null, pdfAliases: ['Équilibre unipodal yeux fermés — Stabilité avancée','Équilibre yeux fermés — surface instable'] },
    t_hold:                    { masterName: 'T-hold — équilibre en T',                  category: 'Proprioception', videoUrl: null },
    proprioception_avancee:    { masterName: 'Proprioception avancée',                   category: 'Proprioception', videoUrl: null },

    // — Cardio / Sprint —
    sprint_10s_jogging_marche: { masterName: 'Cycle Sprint 10s + Jogging 30s + Marche 20s', category: 'Cardio', videoUrl: null, pdfAliases: ['Sprint 10 s + Jogging 30 s + Marche 20 s — ALL OUT sur les sprints'] },
    course_60_65:              { masterName: 'Course à pied ou vélo 60-65% FCmax',       category: 'Cardio', videoUrl: null, pdfAliases: ['Course à pied ou vélo — 60-65% FCmax — allure conversationnelle'] },
    sprint_10m:                { masterName: 'Sprint 10 m',                              category: 'Vitesse', videoUrl: null, pdfAliases: ['Sprint 10 m × 8 — Départ arrêté — accélération maximale','Sprint 10 m × 8 — ALL OUT à chaque sprint','Sprint 10 m × 6 — Accélération pure'] },
    sprint_20m:                { masterName: 'Sprint 20 m',                              category: 'Vitesse', videoUrl: null, pdfAliases: ['Sprint 20 m — Vitesse maximale — qualité > quantité','Sprint 20 m — Vitesse maximale'] },
    sprint_30m:                { masterName: 'Sprint 30 m',                              category: 'Vitesse', videoUrl: null, pdfAliases: ['Sprint 30 m × 6 — Maintien vitesse','Sprint 30 m × 6'] },
    sprint_40m:                { masterName: 'Sprint 40 m',                              category: 'Vitesse', videoUrl: null, pdfAliases: ['Sprint 40 m — Maintien vitesse sur toute la distance'] },
    sprint_60m:                { masterName: 'Sprint 60 m',                              category: 'Vitesse', videoUrl: null, pdfAliases: ['Sprint 60 m × 3 — Simulation Super Explosif Test'] },
    sprint_triangle:           { masterName: 'Sprint triangle',                          category: 'Agilité', videoUrl: null, pdfAliases: ['Sprint triangle × 4 — Changements de direction'] },
    feet_94_test:              { masterName: '94 Feet Test (simulation)',                category: 'Agilité', videoUrl: null, pdfAliases: ['94 Feet Test — simulation — Préparation Super Explosif Test'] },

    // — MENER & engagements (méta-séance) —
    rdv_partenaire:            { masterName: 'RDV avec ton partenaire de résultats',     category: 'MENER', videoUrl: null, generic: true, pdfAliases: ['RDV avec ton partenaire de résultats — Rendre compte de tes engagements — valider ou recommencer'] },
    engagements_semaine:       { masterName: 'Engagements de la semaine (pilier en cours)', category: 'MENER', videoUrl: null, generic: true, pdfAliases: ['Tes engagements de la semaine (pilier en cours) — 1 à 3 engagements max — noter dans ton suivi hebdomadaire'] }
  };

  function ex(opts) {
    var master = EP_MASTER_EXERCISES[opts.id] || {};
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

  // ─── SUPER EXPLOSIF TEST — protocole 11 mesures (baseline + fin de phase)
  var SUPER_EXPLOSIF_TEST = {
    sessionId:'ep_super_test',
    sessionTitle:'SUPER EXPLOSIF TEST — Protocole complet',
    sessionType:'test',
    isOptional:false,
    estimatedDuration:'90-120 min',
    requiredEquipment:['Chrono','Cônes','Balance','Caméra','Barre/Disques (1RM)'],
    specialInstructions:'Ce test n\'est PAS un entraînement. Mêmes conditions à chaque répétition : même heure, même lieu, même protocole. Se filmer.',
    titanIntroMessage:'C\'est ton point de mesure. Pas un entraînement. Reproduis le protocole identique à chaque fois.',
    exercises:[
      ex({id:'echauffement_complet',sets:'-',reps:'15-20 mn',rest:'-',note:'Ne jamais débuter le test sans échauffement'}),
      ex({id:'feet_94_test',sets:'2-3 essais',reps:'Temps total',rest:'3 mn',note:'Parcours 94 feet (28,65 m) avec changements de direction — départ arrêté'}),
      ex({id:'sprint_60m',  sets:'3 essais',reps:'Temps total',rest:'3 mn',intensity:'100%',note:'Sprint 60 m en ligne droite'}),
      ex({id:'box_jumps',   sets:'3-5 essais',reps:'Hauteur (cm)',rest:'Suffisant',note:'Saut vertical : Hauteur touchée - Taille bras levés = détente. Filmer.'}),
      // Pesée + photos + mesures = data UX, pas exos exécutables
      ex({id:'squat_barre',     sets:'1RM',reps:'Charge max (kg)',rest:'3-5 mn',note:'Montée progressive — ne pas brûler les étapes'}),
      ex({id:'sdt',             sets:'1RM',reps:'Charge max (kg)',rest:'3-5 mn'}),
      ex({id:'hip_thrust',      sets:'1RM',reps:'Charge max (kg)',rest:'3-5 mn'}),
      ex({id:'developpe_couche',sets:'1RM',reps:'Charge max (kg)',rest:'3-5 mn'})
    ],
    metaCaptures:[
      { metric:'weight',       unit:'kg',  protocol:'Pesée à jeun, même balance, même moment' },
      { metric:'photos',       unit:'3',   protocol:'Face + profil + dos. Même éclairage, même tenue, même distance.' },
      { metric:'measurements', unit:'cm',  protocol:'Tour de taille / hanches / cuisses (optionnel)' }
    ],
    feedbackQuestions:['comment','perceivedProgress'],
    adaptationRules:{ titanCan:[], titanCannot:['changeProtocol','reduceTests'] }
  };

  // ─── PHASE 1 — POIDS DU CORPS (4 sem · 3-4 j/sem) ────────────────────────

  var p1_j1 = {
    sessionId:'ep_p1_j1', sessionNumber:1, sessionTitle:'Jour 1 — Force corps complet (poids du corps)',
    sessionGoal:'Apprendre à bouger correctement — squats, fentes, hinges, poussées, tractions, gainage.',
    sessionType:'force-pdc-fullbody', estimatedDuration:'70-90 min', requiredEquipment:['Sans matériel','Barre traction (optionnel)','Chaise/banc'],
    isOptional:false,
    specialInstructions:'Tempo 3-1-1 STRICT sur squat et pompes (3s descente, 1s bas, 1s montée). Inclut RDV partenaire + engagements (méta).',
    titanIntroMessage:'On apprend à bouger avant de bouger lourd. Qualité de mouvement absolue cette semaine.',
    blocks:[
      {blockId:'warmup',  blockType:'warmup',title:'Échauffement + activation'},
      {blockId:'plio',    blockType:'main',  title:'Pliométrie d\'activation'},
      {blockId:'force_bas',blockType:'main', title:'Force bas (PDC)'},
      {blockId:'force_haut',blockType:'main',title:'Force haut (PDC)'},
      {blockId:'gainage', blockType:'main',  title:'Gainage'},
      {blockId:'mener',   blockType:'main',  title:'MENER — Partenaire + engagements'},
      {blockId:'cooldown',blockType:'recovery',title:'Étirements + foam rolling'}
    ],
    exercises:[
      ex({id:'echauffement_dynamique',block:'warmup',sets:'-',reps:'10 mn',rest:'-',note:'Cardio léger + articulations + activation neuromusculaire'}),
      ex({id:'squat_jump',         block:'plio',sets:'3',reps:'8 reps',rest:'1 mn 30',note:'Explosivité — pose les bases neuromusculaires'}),
      ex({id:'broad_jumps',        block:'plio',sets:'3',reps:'6 reps',rest:'1 mn 30',note:'Distance maximale'}),
      ex({id:'lateral_bounds',     block:'plio',sets:'3',reps:'6 reps/côté',rest:'1 mn 30'}),
      ex({id:'squat_pdc',          block:'force_bas',sets:'4',reps:'10-12 reps',rest:'1 mn 30',tempo:'3-1-1'}),
      ex({id:'fente_avant_alternee',block:'force_bas',sets:'4',reps:'10 reps/jambe',rest:'1 mn 30'}),
      ex({id:'hip_hinge_rdl_pdc',  block:'force_bas',sets:'3',reps:'12 reps',rest:'1 mn',note:'Dos droit'}),
      ex({id:'glute_bridge_unilat_pdc',block:'force_bas',sets:'3',reps:'12 reps/jambe',rest:'1 mn'}),
      ex({id:'pompes_tempo',       block:'force_haut',sets:'4',reps:'8-12 reps',rest:'1 mn 30',tempo:'3-1-1'}),
      ex({id:'traction_australienne',block:'force_haut',sets:'3',reps:'6-10 reps',rest:'1 mn 30',note:'Full rom'}),
      ex({id:'dips_chaise_barre',  block:'force_haut',sets:'3',reps:'8-12 reps',rest:'1 mn'}),
      ex({id:'superman_hold',      block:'force_haut',sets:'3',reps:'10 reps — 3 s hold',rest:'1 mn'}),
      ex({id:'planche_avant_bras', block:'gainage',sets:'3',reps:'30-45 s',rest:'45 s'}),
      ex({id:'dead_bug',           block:'gainage',sets:'3',reps:'10 reps/côté',rest:'45 s'}),
      ex({id:'planche_laterale',   block:'gainage',sets:'2',reps:'20-30 s/côté',rest:'45 s'}),
      ex({id:'rdv_partenaire',     block:'mener',sets:'1x/sem',reps:'15-30 mn',rest:'-',note:'Rendre compte des engagements — valider ou recommencer'}),
      ex({id:'engagements_semaine',block:'mener',sets:'Quotidien',reps:'Variable',rest:'-',note:'1 à 3 engagements max — pilier en cours'}),
      ex({id:'etirements_foam_rolling',block:'cooldown',sets:'-',reps:'10 mn',rest:'-'})
    ],
    feedbackQuestions:['difficulty','fatigue','pain','completed','engagementsKept','comment'],
    adaptationRules:{titanCan:['rest','reps','variant'],titanCannot:['removeMENER','breakTempo']}
  };

  var p1_j2 = {
    sessionId:'ep_p1_j2', sessionNumber:2, sessionTitle:'Jour 2 — Pliométrie de base + Mobilité',
    sessionGoal:'Pliométrie qualitative + mobilité hanches/colonne + travail pied.',
    sessionType:'plio-mobilite', estimatedDuration:'50-65 min', requiredEquipment:['Sans matériel'],
    isOptional:false,
    specialInstructions:'Qualité > quantité sur tous les sauts. Atterrissage SOUPLE.',
    titanIntroMessage:'Plio aujourd\'hui. Chaque saut doit être propre. Si tu cognes au sol, ralentis.',
    blocks:[
      {blockId:'warmup',  blockType:'warmup',title:'Échauffement + activation'},
      {blockId:'plio',    blockType:'main',  title:'Pliométrie de base'},
      {blockId:'mobilite',blockType:'main',  title:'Mobilité hanches + colonne'},
      {blockId:'pied',    blockType:'main',  title:'Travail du pied + Proprio'},
      {blockId:'cooldown',blockType:'recovery',title:'Étirements + foam rolling'}
    ],
    exercises:[
      ex({id:'echauffement_dynamique',block:'warmup',sets:'-',reps:'10 mn',rest:'-'}),
      ex({id:'squat_jump',     block:'plio',sets:'4',reps:'10 reps',rest:'1 mn 30',note:'Qualité > Quantité'}),
      ex({id:'broad_jumps',    block:'plio',sets:'4',reps:'8 reps',rest:'1 mn 30',note:'Atterrissage souple'}),
      ex({id:'split_jumps',    block:'plio',sets:'4',reps:'8 reps',rest:'1 mn 30',note:'Alternance explosive'}),
      ex({id:'lateral_bounds', block:'plio',sets:'3',reps:'8 reps/côté',rest:'1 mn 30',note:'Réactivité latérale'}),
      ex({id:'tuck_jumps',     block:'plio',sets:'3',reps:'8 reps',rest:'1 mn 30',note:'Genoux à la poitrine'}),
      ex({id:'nineteen_nineteen',block:'mobilite',sets:'3',reps:'8 reps/côté',rest:'45 s'}),
      ex({id:'cat_cow',        block:'mobilite',sets:'3',reps:'10 reps',rest:'45 s'}),
      ex({id:'fente_3d',       block:'mobilite',sets:'3',reps:'6 reps/jambe',rest:'45 s'}),
      ex({id:'carioca',        block:'mobilite',sets:'3',reps:'20 m aller-retour',rest:'45 s'}),
      ex({id:'elevation_orteils',block:'pied',sets:'3',reps:'20 reps',rest:'30 s'}),
      ex({id:'releve_pointe_unipodal',block:'pied',sets:'3',reps:'15 reps/jambe',rest:'30 s'}),
      ex({id:'equilibre_unipodal',block:'pied',sets:'3',reps:'30 s/jambe',rest:'30 s'}),
      ex({id:'etirements_foam_rolling',block:'cooldown',sets:'-',reps:'10 mn',rest:'-'})
    ],
    feedbackQuestions:['difficulty','fatigue','pain','completed','comment'],
    adaptationRules:{titanCan:['rest','reps','variant'],titanCannot:['removeBlock']}
  };

  var p1_j3 = {
    sessionId:'ep_p1_j3', sessionNumber:3, sessionTitle:'Jour 3 — Force bas du corps + Travail du pied',
    sessionGoal:'Force unilatérale + excentrique + iso + travail pied dense.',
    sessionType:'force-bas-pied', estimatedDuration:'70-85 min', requiredEquipment:['Sans matériel','Box/banc (optionnel)','Colline (option)'],
    isOptional:false,
    specialInstructions:'Pistol = progresser chaque semaine. Iso = progresser le temps de maintien.',
    titanIntroMessage:'Bas du corps. Unilatéral + iso. Tu construis ce qui te tient debout.',
    blocks:[
      {blockId:'warmup',  blockType:'warmup',title:'Échauffement'},
      {blockId:'plio',    blockType:'main',  title:'Pliométrie courte'},
      {blockId:'unilat',  blockType:'main',  title:'Force unilatérale + excentrique'},
      {blockId:'iso',     blockType:'main',  title:'Isométriques'},
      {blockId:'pied',    blockType:'main',  title:'Travail du pied'},
      {blockId:'cooldown',blockType:'recovery',title:'Étirements + foam rolling'}
    ],
    exercises:[
      ex({id:'echauffement_dynamique',block:'warmup',sets:'-',reps:'10 mn',rest:'-'}),
      ex({id:'box_squat_jumps',    block:'plio',sets:'3',reps:'8 reps',rest:'1 mn 30',note:'Explosion du bas'}),
      ex({id:'depth_jumps',        block:'plio',sets:'3',reps:'6 reps',rest:'2 mn',note:'Hauteur basse — réactivité sol'}),
      ex({id:'fente_bulgare_pdc',  block:'unilat',sets:'4',reps:'10 reps/jambe',rest:'2 mn',note:'Focus quadriceps'}),
      ex({id:'single_leg_squat_pistol',block:'unilat',sets:'3',reps:'6-8 reps/jambe',rest:'2 mn',note:'Progresser chaque semaine'}),
      ex({id:'nordic_hamstring',   block:'unilat',sets:'3',reps:'8 reps',rest:'2 mn',tempo:'3s descente',note:'Excentrique'}),
      ex({id:'reverse_nordic',     block:'unilat',sets:'3',reps:'8 reps',rest:'2 mn',note:'Quadriceps excentrique'}),
      ex({id:'hip_thrust_unilat_pdc',block:'unilat',sets:'3',reps:'12 reps/jambe',rest:'1 mn',note:'Glutes'}),
      ex({id:'squat_isometrique',  block:'iso',sets:'3',reps:'30-45 s',rest:'1 mn',note:'Progresser le temps'}),
      ex({id:'fente_isometrique',  block:'iso',sets:'3',reps:'20-30 s/jambe',rest:'1 mn'}),
      ex({id:'dorsiflexion',       block:'pied',sets:'3',reps:'20 reps',rest:'30 s'}),
      ex({id:'marche_talons',      block:'pied',sets:'2',reps:'1 mn',rest:'30 s'}),
      ex({id:'equilibre_yeux_fermes',block:'pied',sets:'3',reps:'20 s/jambe',rest:'30 s'}),
      ex({id:'marche_arriere_colline',block:'pied',sets:'1',reps:'10 mn minimum',rest:'-'}),
      ex({id:'etirements_foam_rolling',block:'cooldown',sets:'-',reps:'10 mn',rest:'-'})
    ],
    feedbackQuestions:['difficulty','fatigue','pain','completed','comment'],
    adaptationRules:{titanCan:['rest','reps','variant','isoDuration'],titanCannot:['removeBlock']}
  };

  var p1_j4 = {
    sessionId:'ep_p1_j4', sessionNumber:4, sessionTitle:'Jour 4 — Cardio + Proprioception (OPTIONNEL)',
    sessionGoal:'Cardio steady-state + proprio + récupération active.',
    sessionType:'cardio-proprio-opt', estimatedDuration:'60-75 min', requiredEquipment:['Sans matériel','Espace course/vélo'],
    isOptional:true,
    specialInstructions:'Séance OPTIONNELLE. Allure conversationnelle (60-65% FCmax) sur la course.',
    titanIntroMessage:'Séance bonus. Cardio long pour la base aérobie. Skippe si récup pas optimale.',
    blocks:[
      {blockId:'warmup',  blockType:'warmup',title:'Marche dynamique'},
      {blockId:'cardio',  blockType:'main',  title:'Cardio steady-state'},
      {blockId:'proprio', blockType:'main',  title:'Proprio + Sauts contrôlés'},
      {blockId:'sprint',  blockType:'main',  title:'Sprint cardio (HIIT court)'},
      {blockId:'cooldown',blockType:'recovery',title:'Étirements longs'}
    ],
    exercises:[
      ex({id:'marche_dynamique',  block:'warmup',sets:'-',reps:'10 mn',rest:'-'}),
      ex({id:'course_60_65',      block:'cardio',sets:'-',reps:'30-35 mn',rest:'-',intensity:'60-65% FCmax — conversationnel'}),
      ex({id:'t_hold',            block:'proprio',sets:'3',reps:'20-30 s/jambe',rest:'45 s'}),
      ex({id:'sauts_unipodaux_stab',block:'proprio',sets:'3',reps:'6 reps/jambe',rest:'1 mn',note:'Atterrissage contrôlé'}),
      ex({id:'sprint_10s_jogging_marche',block:'sprint',sets:'6',reps:'Cycle complet',rest:'-',intensity:'ALL OUT sur les sprints'}),
      ex({id:'etirements_longs',  block:'cooldown',sets:'-',reps:'10-15 mn',rest:'-'})
    ],
    feedbackQuestions:['difficulty','fatigue','pain','completed','comment'],
    adaptationRules:{titanCan:['skip','rest','intensity'],titanCannot:['forceIfFatigued']}
  };

  // ─── PHASE 2 — CHARGES LÉGÈRES + PLIO DÉBUTANT (5 sem · 4 j/sem) ─────────

  var p2_j1 = {
    sessionId:'ep_p2_j1', sessionNumber:1, sessionTitle:'Jour 1 — Force bas du corps + Pliométrie',
    sessionGoal:'Premières charges sur squat/SDT/HT + plio intensive.',
    sessionType:'force-bas-plio', estimatedDuration:'80-100 min', requiredEquipment:['Barre','Disques','Rack','Box','Haltères'],
    isOptional:false,
    specialInstructions:'Tests 1RM Squat/SDT/HT/DC OBLIGATOIRES début Phase 2 (cf. R6) — charges = %1RM par semaine.',
    titanIntroMessage:'Charges légères, technique parfaite. La barre arrive — apprends-la avant de la pousser.',
    blocks:[
      {blockId:'warmup',  blockType:'warmup',title:'Échauffement'},
      {blockId:'rampup',  blockType:'main',  title:'Montée en charge'},
      {blockId:'plio',    blockType:'main',  title:'Pliométrie'},
      {blockId:'force',   blockType:'main',  title:'Force barre'},
      {blockId:'access',  blockType:'main',  title:'Accessoires'},
      {blockId:'pied',    blockType:'main',  title:'Travail du pied'},
      {blockId:'mener',   blockType:'main',  title:'MENER'},
      {blockId:'cooldown',blockType:'recovery',title:'Étirements'}
    ],
    exercises:[
      ex({id:'echauffement_dynamique',block:'warmup',sets:'-',reps:'10 mn',rest:'-'}),
      ex({id:'montee_charge',        block:'rampup',sets:'3',reps:'10-5-3 reps',rest:'-'}),
      ex({id:'box_jumps',            block:'plio',sets:'4',reps:'5 reps',rest:'2 mn',note:'Système nerveux frais — explosivité max'}),
      ex({id:'depth_jumps',          block:'plio',sets:'3',reps:'4 reps',rest:'2 mn 30',note:'Réduire le temps de contact'}),
      ex({id:'broad_jumps',          block:'plio',sets:'3',reps:'5 reps',rest:'2 mn',note:'Distance maximale'}),
      ex({id:'squat_barre',          block:'force',sets:'4',reps:'6-8 reps',rest:'3 mn',intensity:'50-80% 1RM (selon sem.)',note:'Dernière série à l\'échec'}),
      ex({id:'sdt',                  block:'force',sets:'4',reps:'5 reps',rest:'3 mn',note:'Explosif à la montée'}),
      ex({id:'hip_thrust',           block:'force',sets:'3',reps:'10 reps',rest:'2 mn',note:'Glutes max en haut'}),
      ex({id:'fente_bulgare_halteres',block:'access',sets:'3',reps:'8 reps/jambe',rest:'-',mode:'enchaînement',note:'A) Enchaîner avec B'}),
      ex({id:'leg_curl',             block:'access',sets:'3',reps:'10 reps',rest:'2 mn',mode:'enchaînement',note:'B) Machine ou nordique'}),
      ex({id:'calf_raises_debout',   block:'pied',sets:'4',reps:'15-20 reps',rest:'1 mn',note:'Amplitude complète'}),
      ex({id:'calf_raises_unilat',   block:'pied',sets:'3',reps:'12 reps/jambe',rest:'1 mn'}),
      ex({id:'rdv_partenaire',       block:'mener',sets:'1x/sem',reps:'15-30 mn',rest:'-'}),
      ex({id:'engagements_semaine',  block:'mener',sets:'Quotidien',reps:'Variable',rest:'-'}),
      ex({id:'etirements_foam_rolling',block:'cooldown',sets:'-',reps:'10 mn',rest:'-'})
    ],
    feedbackQuestions:['difficulty','fatigue','pain','completed','load','engagementsKept','comment'],
    adaptationRules:{titanCan:['load','rest','reps'],titanCannot:['removeMENER','skipForce']}
  };

  var p2_j2 = {
    sessionId:'ep_p2_j2', sessionNumber:2, sessionTitle:'Jour 2 — Force haut du corps + Gainage',
    sessionGoal:'Pousser/tirer haut du corps + power + gainage anti-rotation.',
    sessionType:'force-haut-gainage', estimatedDuration:'75-90 min', requiredEquipment:['Barre','Haltères','Bandes','Med ball (option)'],
    isOptional:false,
    specialInstructions:'Bilatéral lourd (couché + tractions) + power (pompes claquées + slams).',
    titanIntroMessage:'Haut du corps lourd. Tractions et couché = ta force pure.',
    blocks:[
      {blockId:'warmup',  blockType:'warmup',title:'Échauffement haut'},
      {blockId:'power',   blockType:'main',  title:'Power haut'},
      {blockId:'force_h', blockType:'main',  title:'Force haut barre/haltères'},
      {blockId:'gainage', blockType:'main',  title:'Gainage anti-rotation'},
      {blockId:'cooldown',blockType:'recovery',title:'Étirements'}
    ],
    exercises:[
      ex({id:'echauffement_haut_corps',block:'warmup',sets:'-',reps:'10 mn',rest:'-',note:'Rotations épaules + bandes'}),
      ex({id:'pompes_claquees',  block:'power',sets:'3',reps:'8 reps',rest:'2 mn',note:'Mains décollent du sol'}),
      ex({id:'medicine_ball_slams',block:'power',sets:'3',reps:'8 reps',rest:'1 mn 30',note:'Puissance'}),
      ex({id:'developpe_couche', block:'force_h',sets:'4',reps:'6-8 reps',rest:'3 mn'}),
      ex({id:'developpe_incline',block:'force_h',sets:'3',reps:'8-10 reps',rest:'2 mn 30'}),
      ex({id:'tractions',        block:'force_h',sets:'4',reps:'6-8 reps',rest:'-',mode:'enchaînement',note:'A) Enchaîner avec B'}),
      ex({id:'rowing_barre',     block:'force_h',sets:'4',reps:'8-10 reps',rest:'2 mn',mode:'enchaînement',note:'B)'}),
      ex({id:'developpe_militaire',block:'force_h',sets:'3',reps:'8-10 reps',rest:'-',mode:'enchaînement',note:'A)'}),
      ex({id:'elevations_laterales',block:'force_h',sets:'3',reps:'12 reps',rest:'1 mn 30',mode:'enchaînement',note:'B)'}),
      ex({id:'planche_tap_epaules',block:'gainage',sets:'3',reps:'20 reps',rest:'1 mn',note:'Hanches stables'}),
      ex({id:'rocking_deadbug',  block:'gainage',sets:'3',reps:'10 reps/côté',rest:'1 mn'}),
      ex({id:'pallof_press',     block:'gainage',sets:'3',reps:'10 reps/côté',rest:'1 mn',note:'Anti-rotation'}),
      ex({id:'etirements_foam_rolling',block:'cooldown',sets:'-',reps:'10 mn',rest:'-'})
    ],
    feedbackQuestions:['difficulty','fatigue','pain','completed','load','comment'],
    adaptationRules:{titanCan:['load','rest','reps'],titanCannot:['removeGainage']}
  };

  var p2_j3 = {
    sessionId:'ep_p2_j3', sessionNumber:3, sessionTitle:'Jour 3 — Pliométrie intensive + Vitesse',
    sessionGoal:'Plio + sprints maximaux.',
    sessionType:'plio-vitesse', estimatedDuration:'70-90 min', requiredEquipment:['Haies','Box','Espace sprint'],
    isOptional:false,
    specialInstructions:'Sprints 20m × 6 + 40m × 4. Qualité avant quantité.',
    titanIntroMessage:'Plio + vitesse. La qualité du sprint compte plus que la chronologie.',
    blocks:[
      {blockId:'warmup',  blockType:'warmup',title:'Échauffement + activation'},
      {blockId:'plio',    blockType:'main',  title:'Pliométrie intensive'},
      {blockId:'sprint',  blockType:'main',  title:'Sprints'},
      {blockId:'proprio', blockType:'main',  title:'Proprio + pied'},
      {blockId:'cooldown',blockType:'recovery',title:'Étirements'}
    ],
    exercises:[
      ex({id:'echauffement_dynamique',block:'warmup',sets:'-',reps:'10 mn',rest:'-',note:'Skipping, talons-fesses, rotations'}),
      ex({id:'squats_sautes_legers',block:'warmup',sets:'2',reps:'8 reps',rest:'1 mn',note:'Activation neuromusculaire'}),
      ex({id:'hurdle_hops',       block:'plio',sets:'4',reps:'6 reps',rest:'2 mn 30',note:'Hauteur progressive'}),
      ex({id:'single_leg_box_jumps',block:'plio',sets:'3',reps:'4 reps/jambe',rest:'2 mn',note:'Atterrissage'}),
      ex({id:'tuck_jumps',        block:'plio',sets:'3',reps:'8 reps',rest:'2 mn'}),
      ex({id:'lateral_bounds',    block:'plio',sets:'4',reps:'8 reps/côté',rest:'2 mn'}),
      ex({id:'sprint_20m',        block:'sprint',sets:'6',reps:'1 rep',rest:'2 mn',intensity:'Vitesse maximale'}),
      ex({id:'sprint_40m',        block:'sprint',sets:'4',reps:'1 rep',rest:'3 mn',note:'Maintien vitesse'}),
      ex({id:'equilibre_unipodal',block:'proprio',sets:'3',reps:'30 s/jambe',rest:'45 s',note:'Surface instable'}),
      ex({id:'sauts_unipodaux_multi',block:'proprio',sets:'3',reps:'6 reps/jambe',rest:'1 mn'}),
      ex({id:'dorsiflexion',      block:'proprio',sets:'3',reps:'20 reps',rest:'30 s'}),
      ex({id:'etirements_foam_rolling',block:'cooldown',sets:'-',reps:'10 mn',rest:'-'})
    ],
    feedbackQuestions:['difficulty','fatigue','pain','completed','sprintBest','comment'],
    adaptationRules:{titanCan:['rest','reps','variant'],titanCannot:['skipSprints']}
  };

  var p2_j4 = {
    sessionId:'ep_p2_j4', sessionNumber:4, sessionTitle:'Jour 4 — Force complète + Travail du pied',
    sessionGoal:'Front squat, RDL, Power clean + stato-dyn.',
    sessionType:'force-complete-pied', estimatedDuration:'80-95 min', requiredEquipment:['Barre','Disques','Rack','Leg press/extension (option)'],
    isOptional:false,
    specialInstructions:'Power clean : technique + puissance. Stato-dyn : 6s maintien minimum puis explosion.',
    titanIntroMessage:'Front squat + clean. Mouvements complexes — technique d\'abord.',
    blocks:[
      {blockId:'warmup',  blockType:'warmup',title:'Échauffement corps complet'},
      {blockId:'force',   blockType:'main',  title:'Force complète'},
      {blockId:'access',  blockType:'main',  title:'Accessoires'},
      {blockId:'stato',   blockType:'main',  title:'Stato-dynamique'},
      {blockId:'pied',    blockType:'main',  title:'Travail du pied'},
      {blockId:'mener',   blockType:'main',  title:'MENER'},
      {blockId:'cooldown',blockType:'recovery',title:'Étirements'}
    ],
    exercises:[
      ex({id:'echauffement_corps_complet',block:'warmup',sets:'-',reps:'10 mn',rest:'-'}),
      ex({id:'front_squat',       block:'force',sets:'4',reps:'6-8 reps',rest:'3 mn',note:'Ou goblet squat'}),
      ex({id:'romanian_dl',       block:'force',sets:'4',reps:'8 reps',rest:'2 mn 30',note:'Focus ischio'}),
      ex({id:'power_clean',       block:'force',sets:'3',reps:'5 reps',rest:'3 mn',note:'Ou hang clean'}),
      ex({id:'leg_press',         block:'access',sets:'3',reps:'10-12 reps',rest:'-',mode:'enchaînement',note:'A)'}),
      ex({id:'leg_extension',     block:'access',sets:'3',reps:'12-15 reps',rest:'2 mn',mode:'enchaînement',note:'B)'}),
      ex({id:'squat_stato_dyn',   block:'stato',sets:'3',reps:'6 s maintien → explosion',rest:'2 mn 30'}),
      ex({id:'split_stance_stato_dyn',block:'stato',sets:'3',reps:'30 s/jambe',rest:'2 mn 30'}),
      ex({id:'releve_pointe_unipodal',block:'pied',sets:'3',reps:'15 reps/jambe',rest:'30 s'}),
      ex({id:'marche_talons',     block:'pied',sets:'2',reps:'1 mn',rest:'30 s'}),
      ex({id:'equilibre_yeux_fermes',block:'pied',sets:'3',reps:'25 s/jambe',rest:'30 s',note:'Surface instable'}),
      ex({id:'marche_arriere_colline',block:'pied',sets:'1',reps:'10 mn minimum',rest:'-'}),
      ex({id:'rdv_partenaire',    block:'mener',sets:'1x/sem',reps:'15-30 mn',rest:'-'}),
      ex({id:'engagements_semaine',block:'mener',sets:'Quotidien',reps:'Variable',rest:'-'}),
      ex({id:'etirements_foam_rolling',block:'cooldown',sets:'-',reps:'10 mn',rest:'-'})
    ],
    feedbackQuestions:['difficulty','fatigue','pain','completed','load','engagementsKept','comment'],
    adaptationRules:{titanCan:['load','rest','reps'],titanCannot:['removeMENER']}
  };

  // ─── PHASE 3 — CHARGES PROGRESSIVES + PLO AVANCÉE + VITESSE (5 sem · 4-5 j/sem) ──

  var p3_j1 = {
    sessionId:'ep_p3_j1', sessionNumber:1, sessionTitle:'Jour 1 — Force pure + Pliométrie (dernière série à l\'échec)',
    sessionGoal:'80-90% 1RM sur squat/SDT + plio max.',
    sessionType:'force-pure-plio', estimatedDuration:'90-110 min', requiredEquipment:['Barre','Disques','Rack','Box'],
    isOptional:false,
    specialInstructions:'Dernière série de squat ET SDT → à l\'échec total. Reposer 3 mn entre.',
    titanIntroMessage:'Phase pivot. Force maximale. Dernière série à l\'échec — la cassure construit la force.',
    blocks:[
      {blockId:'warmup',  blockType:'warmup',title:'Échauffement'},
      {blockId:'rampup',  blockType:'main',  title:'Montée en charge'},
      {blockId:'plio',    blockType:'main',  title:'Pliométrie'},
      {blockId:'force',   blockType:'main',  title:'Force pure'},
      {blockId:'access',  blockType:'main',  title:'Accessoires'},
      {blockId:'pied',    blockType:'main',  title:'Travail du pied'},
      {blockId:'mener',   blockType:'main',  title:'MENER'},
      {blockId:'cooldown',blockType:'recovery',title:'Étirements'}
    ],
    exercises:[
      ex({id:'echauffement_general_mob',block:'warmup',sets:'-',reps:'10 mn',rest:'-'}),
      ex({id:'montee_charge',     block:'rampup',sets:'3-4',reps:'5-3-2 reps',rest:'-'}),
      ex({id:'box_jumps',         block:'plio',sets:'4',reps:'5 reps',rest:'2 mn',note:'Hauteur maximale'}),
      ex({id:'depth_jumps',       block:'plio',sets:'3',reps:'4 reps',rest:'2 mn 30'}),
      ex({id:'broad_jumps',       block:'plio',sets:'3',reps:'5 reps',rest:'2 mn',note:'Distance record'}),
      ex({id:'squat_barre',       block:'force',sets:'5',reps:'5 reps',rest:'3 mn',intensity:'70-90% 1RM (selon sem.)',note:'Dernière série → échec'}),
      ex({id:'sdt',               block:'force',sets:'4',reps:'4 reps',rest:'3 mn',note:'Dernière série → échec'}),
      ex({id:'hip_thrust',        block:'force',sets:'4',reps:'8 reps',rest:'2 mn 30',note:'Charge maximale'}),
      ex({id:'fentes_bulgares_lestees',block:'access',sets:'3',reps:'8 reps/jambe',rest:'-',mode:'enchaînement',note:'A)'}),
      ex({id:'leg_curl',          block:'access',sets:'3',reps:'10-12 reps',rest:'2 mn',mode:'enchaînement',note:'B)'}),
      ex({id:'calf_raises_unilat',block:'pied',sets:'4',reps:'15 reps/jambe',rest:'1 mn'}),
      ex({id:'tibialis_raise',    block:'pied',sets:'3',reps:'15 reps',rest:'30 s'}),
      ex({id:'rdv_partenaire',    block:'mener',sets:'1x/sem',reps:'15-30 mn',rest:'-'}),
      ex({id:'engagements_semaine',block:'mener',sets:'Quotidien',reps:'Variable',rest:'-'}),
      ex({id:'etirements_foam_rolling',block:'cooldown',sets:'-',reps:'10 mn',rest:'-'})
    ],
    feedbackQuestions:['difficulty','fatigue','pain','completed','load','reachedFailure','comment'],
    adaptationRules:{titanCan:['load','rest'],titanCannot:['skipFailure','removeMENER']}
  };

  var p3_j2 = {
    sessionId:'ep_p3_j2', sessionNumber:2, sessionTitle:'Jour 2 — Explosivité bas du corps + Pliométrie avancée',
    sessionGoal:'Plio avancée + squat jump lesté + power clean.',
    sessionType:'explo-plio-avancee', estimatedDuration:'80-100 min', requiredEquipment:['Box','Barre','Haltères','Gilet (option)'],
    isOptional:false,
    specialInstructions:'Squat jump 20-30% 1RM. Step-ups lestés.',
    titanIntroMessage:'Plio avancée + charge légère. La vitesse d\'exécution maintenant.',
    blocks:[
      {blockId:'warmup',  blockType:'warmup',title:'Échauffement + activation'},
      {blockId:'plio_av', blockType:'main',  title:'Pliométrie avancée'},
      {blockId:'force_exp',blockType:'main', title:'Force explosive'},
      {blockId:'access',  blockType:'main',  title:'Accessoires'},
      {blockId:'proprio', blockType:'main',  title:'Proprio + corde'},
      {blockId:'cooldown',blockType:'recovery',title:'Étirements'}
    ],
    exercises:[
      ex({id:'echauffement_dynamique',block:'warmup',sets:'-',reps:'10 mn',rest:'-',note:'+ skipping + talons-fesses'}),
      ex({id:'squats_sautes_legers',block:'warmup',sets:'2',reps:'8 reps',rest:'1 mn',note:'Activation'}),
      ex({id:'hurdle_hops',       block:'plio_av',sets:'5',reps:'6 reps',rest:'2 mn 30',note:'Hauteur maximale'}),
      ex({id:'single_leg_box_jumps',block:'plio_av',sets:'4',reps:'4 reps/jambe',rest:'2 mn',note:'Unilatéral avancé'}),
      ex({id:'tuck_jumps',        block:'plio_av',sets:'4',reps:'8 reps',rest:'2 mn'}),
      ex({id:'depth_jumps',       block:'plio_av',sets:'4',reps:'5 reps',rest:'2 mn 30',note:'Rebond immédiat'}),
      ex({id:'squat_jump_charge', block:'force_exp',sets:'4',reps:'5 reps',rest:'2 mn 30',intensity:'20-30% 1RM'}),
      ex({id:'power_clean',       block:'force_exp',sets:'3',reps:'5 reps',rest:'3 mn',note:'Technique + puissance max'}),
      ex({id:'hip_thrust_explosif',block:'force_exp',sets:'3',reps:'8 reps',rest:'2 mn',note:'Glutes max'}),
      ex({id:'step_ups_lestes',   block:'access',sets:'3',reps:'8 reps/jambe',rest:'-',mode:'enchaînement',note:'A)'}),
      ex({id:'goblet_squat_tempo',block:'access',sets:'3',reps:'12 reps',rest:'2 mn',mode:'enchaînement',note:'B) Tempo 3-1-1'}),
      ex({id:'sauts_corde',       block:'proprio',sets:'3',reps:'1 mn',rest:'1 mn'}),
      ex({id:'equilibre_unipodal',block:'proprio',sets:'3',reps:'30 s/jambe',rest:'45 s',note:'Yeux ouverts puis fermés — surface instable'}),
      ex({id:'etirements_foam_rolling',block:'cooldown',sets:'-',reps:'10 mn',rest:'-'})
    ],
    feedbackQuestions:['difficulty','fatigue','pain','completed','comment'],
    adaptationRules:{titanCan:['load','rest','reps'],titanCannot:['removeBlock']}
  };

  var p3_j3 = {
    sessionId:'ep_p3_j3', sessionNumber:3, sessionTitle:'Jour 3 — Puissance haut du corps + Vitesse',
    sessionGoal:'Power haut + sprints 10/30/triangle.',
    sessionType:'puissance-haut-vitesse', estimatedDuration:'80-95 min', requiredEquipment:['Barre','Haltères','Med ball'],
    isOptional:false,
    specialInstructions:'Sprint 10m × 8 = accélération pure. Triangle × 4 = changements de direction.',
    titanIntroMessage:'Haut explosif + vitesse. Les sprints courts construisent ton accélération.',
    blocks:[
      {blockId:'warmup',  blockType:'warmup',title:'Échauffement + mobilité épaules'},
      {blockId:'power_h', blockType:'main',  title:'Power haut'},
      {blockId:'force_h', blockType:'main',  title:'Force haut barre'},
      {blockId:'sprint',  blockType:'main',  title:'Sprints'},
      {blockId:'gainage', blockType:'main',  title:'Gainage'},
      {blockId:'mener',   blockType:'main',  title:'MENER'},
      {blockId:'cooldown',blockType:'recovery',title:'Étirements'}
    ],
    exercises:[
      ex({id:'echauffement_general_mob',block:'warmup',sets:'-',reps:'10 mn',rest:'-'}),
      ex({id:'pompes_claquees',  block:'power_h',sets:'4',reps:'8 reps',rest:'2 mn'}),
      ex({id:'medicine_ball_slams',block:'power_h',sets:'3',reps:'10 reps',rest:'1 mn 30',note:'Puissance maximale'}),
      ex({id:'pompes_pliometriques',block:'power_h',sets:'3',reps:'6 reps',rest:'2 mn'}),
      ex({id:'developpe_couche', block:'force_h',sets:'4',reps:'5-6 reps',rest:'3 mn'}),
      ex({id:'developpe_incline',block:'force_h',sets:'3',reps:'8 reps',rest:'2 mn 30'}),
      ex({id:'tractions',        block:'force_h',sets:'4',reps:'6-8 reps',rest:'2 mn 30',note:'Lestées ou assistées'}),
      ex({id:'rowing_barre',     block:'force_h',sets:'4',reps:'8-10 reps',rest:'2 mn'}),
      ex({id:'sprint_10m',       block:'sprint',sets:'8',reps:'1 rep',rest:'2 mn',note:'Départ arrêté — accélération max'}),
      ex({id:'sprint_30m',       block:'sprint',sets:'6',reps:'1 rep',rest:'3 mn',note:'Maintien vitesse'}),
      ex({id:'sprint_triangle',  block:'sprint',sets:'4',reps:'Parcours complet',rest:'3 mn',note:'Changements de direction'}),
      ex({id:'planche_tap_epaules',block:'gainage',sets:'3',reps:'20 reps',rest:'1 mn'}),
      ex({id:'pallof_press',     block:'gainage',sets:'3',reps:'10 reps/côté',rest:'1 mn'}),
      ex({id:'rdv_partenaire',   block:'mener',sets:'1x/sem',reps:'15-30 mn',rest:'-'}),
      ex({id:'engagements_semaine',block:'mener',sets:'Quotidien',reps:'Variable',rest:'-'}),
      ex({id:'etirements_foam_rolling',block:'cooldown',sets:'-',reps:'10 mn',rest:'-'})
    ],
    feedbackQuestions:['difficulty','fatigue','pain','completed','sprintBest','engagementsKept','comment'],
    adaptationRules:{titanCan:['rest','reps','load'],titanCannot:['removeMENER','skipSprints']}
  };

  var p3_j4 = {
    sessionId:'ep_p3_j4', sessionNumber:4, sessionTitle:'Jour 4 — Force complète + Conditionnement',
    sessionGoal:'Front squat + RDL + Développé militaire + cond.',
    sessionType:'force-complete-cond', estimatedDuration:'80-95 min', requiredEquipment:['Barre','Haltères','Battle ropes (option)'],
    isOptional:false,
    specialInstructions:'Burpees explosifs + battle ropes ou sprint place = conditionnement.',
    titanIntroMessage:'Force + cond. Le cond en fin = densité métabolique.',
    blocks:[
      {blockId:'warmup',  blockType:'warmup',title:'Échauffement'},
      {blockId:'force',   blockType:'main',  title:'Force barre'},
      {blockId:'access',  blockType:'main',  title:'Accessoires'},
      {blockId:'gainage', blockType:'main',  title:'Gainage'},
      {blockId:'cond',    blockType:'main',  title:'Conditionnement'},
      {blockId:'cooldown',blockType:'recovery',title:'Étirements'}
    ],
    exercises:[
      ex({id:'echauffement_corps_complet',block:'warmup',sets:'-',reps:'10 mn',rest:'-'}),
      ex({id:'front_squat',       block:'force',sets:'4',reps:'5-6 reps',rest:'3 mn'}),
      ex({id:'romanian_dl',       block:'force',sets:'4',reps:'8 reps',rest:'2 mn 30'}),
      ex({id:'developpe_militaire',block:'force',sets:'4',reps:'6-8 reps',rest:'2 mn 30'}),
      ex({id:'rowing_halteres',   block:'force',sets:'4',reps:'8-10 reps',rest:'2 mn'}),
      ex({id:'leg_press',         block:'access',sets:'3',reps:'10-12 reps',rest:'-',mode:'enchaînement',note:'A)'}),
      ex({id:'leg_extension',     block:'access',sets:'3',reps:'12-15 reps',rest:'2 mn',mode:'enchaînement',note:'B)'}),
      ex({id:'elevations_laterales',block:'access',sets:'3',reps:'12 reps',rest:'-',mode:'enchaînement',note:'A)'}),
      ex({id:'face_pulls',        block:'access',sets:'3',reps:'15 reps',rest:'1 mn 30',mode:'enchaînement',note:'B)'}),
      ex({id:'russian_twists',    block:'gainage',sets:'3',reps:'20 reps',rest:'1 mn'}),
      ex({id:'planche_laterale',  block:'gainage',sets:'2',reps:'40 s/côté',rest:'1 mn'}),
      ex({id:'burpees_explosifs', block:'cond',sets:'3',reps:'10 reps',rest:'1 mn 30'}),
      ex({id:'battle_ropes',      block:'cond',sets:'3',reps:'30 s',rest:'1 mn',intensity:'Maximale'}),
      ex({id:'etirements_foam_rolling',block:'cooldown',sets:'-',reps:'10 mn',rest:'-'})
    ],
    feedbackQuestions:['difficulty','fatigue','pain','completed','comment'],
    adaptationRules:{titanCan:['load','rest','reps'],titanCannot:['removeBlock']}
  };

  // ─── PHASE 4 — PEAK PERFORMANCE (4 sem · 4-5 j/sem) ──────────────────────

  var p4_j1 = {
    sessionId:'ep_p4_j1', sessionNumber:1, sessionTitle:'Jour 1 — Force maximale + Plio intensive',
    sessionGoal:'85-90% 1RM, records 1RM possibles + box jumps record.',
    sessionType:'force-max-plio', estimatedDuration:'90-110 min', requiredEquipment:['Barre','Disques','Rack','Box'],
    isOptional:false,
    specialInstructions:'Tentative de records 1RM si fraîcheur OK. Repos 3-4 mn entre sets.',
    titanIntroMessage:'Peak force. Si t\'es frais, tente le record 1RM. Sinon, charge sub-max propre.',
    blocks:[
      {blockId:'warmup',  blockType:'warmup',title:'Échauffement'},
      {blockId:'rampup',  blockType:'main',  title:'Montée en charge'},
      {blockId:'plio_int',blockType:'main',  title:'Pliométrie intensive'},
      {blockId:'force_max',blockType:'main', title:'Force maximale'},
      {blockId:'access',  blockType:'main',  title:'Accessoires'},
      {blockId:'pied',    blockType:'main',  title:'Travail du pied'},
      {blockId:'mener',   blockType:'main',  title:'MENER'},
      {blockId:'cooldown',blockType:'recovery',title:'Étirements'}
    ],
    exercises:[
      ex({id:'echauffement_general_mob',block:'warmup',sets:'-',reps:'12 mn',rest:'-'}),
      ex({id:'montee_charge',     block:'rampup',sets:'4',reps:'5-3-2-1 reps',rest:'-',note:'Activation neuromusculaire'}),
      ex({id:'box_jumps',         block:'plio_int',sets:'4',reps:'5 reps',rest:'2 mn 30',note:'Record de hauteur jamais atteinte'}),
      ex({id:'depth_jumps',       block:'plio_int',sets:'4',reps:'4 reps',rest:'2 mn 30',note:'Réactivité maximale'}),
      ex({id:'single_leg_box_jumps',block:'plio_int',sets:'3',reps:'4 reps/jambe',rest:'2 mn',note:'Unilatéral peak'}),
      ex({id:'squat_barre',       block:'force_max',sets:'5',reps:'3-5 reps',rest:'3-4 mn',intensity:'85-90% 1RM',note:'Dernière série → records 1RM si possible'}),
      ex({id:'sdt',               block:'force_max',sets:'4',reps:'3-4 reps',rest:'4 mn',note:'Charge maximale'}),
      ex({id:'hip_thrust',        block:'force_max',sets:'4',reps:'6-8 reps',rest:'3 mn'}),
      ex({id:'fentes_bulgares_lestees',block:'access',sets:'3',reps:'8 reps/jambe',rest:'-',mode:'enchaînement',note:'A)'}),
      ex({id:'nordic_hamstring',  block:'access',sets:'3',reps:'8 reps',rest:'2 mn',mode:'enchaînement',note:'B) Excentrique contrôlé'}),
      ex({id:'calf_raises_unilat',block:'pied',sets:'4',reps:'15 reps/jambe',rest:'1 mn'}),
      ex({id:'tibialis_raise',    block:'pied',sets:'3',reps:'20 reps',rest:'30 s'}),
      ex({id:'equilibre_unipodal',block:'pied',sets:'3',reps:'30 s/jambe',rest:'30 s',note:'Avancé — yeux fermés'}),
      ex({id:'rdv_partenaire',    block:'mener',sets:'1x/sem',reps:'15-30 mn',rest:'-'}),
      ex({id:'engagements_semaine',block:'mener',sets:'Quotidien',reps:'Variable',rest:'-'}),
      ex({id:'etirements_foam_rolling',block:'cooldown',sets:'-',reps:'10 mn',rest:'-'})
    ],
    feedbackQuestions:['difficulty','fatigue','pain','completed','load','pr1RM','comment'],
    adaptationRules:{titanCan:['load','rest','attemptPR'],titanCannot:['skipRampup','removeMENER']}
  };

  var p4_j2 = {
    sessionId:'ep_p4_j2', sessionNumber:2, sessionTitle:'Jour 2 — Circuit Peak Performance',
    sessionGoal:'Circuit dense plio + force barre + sprint enchaîné.',
    sessionType:'circuit-peak', estimatedDuration:'85-100 min', requiredEquipment:['Barre','Disques','Box','Espace sprint'],
    isOptional:false,
    specialInstructions:'Circuit 1 = 5 exos enchaînés, 3 mn repos après les 5. Circuit 2 = 4 exos enchaînés.',
    titanIntroMessage:'Circuit explosif. Pas de récup entre les exos d\'un circuit — récup uniquement à la fin.',
    blocks:[
      {blockId:'warmup',   blockType:'warmup',title:'Échauffement complet'},
      {blockId:'circuit1', blockType:'main',  title:'Circuit 1 — Plio + Force + Sprint',executionMode:'enchaînement'},
      {blockId:'circuit2', blockType:'main',  title:'Circuit 2 — Force pure',executionMode:'enchaînement'},
      {blockId:'sprint',   blockType:'main',  title:'Sprints'},
      {blockId:'cooldown', blockType:'recovery',title:'Étirements'}
    ],
    exercises:[
      ex({id:'echauffement_complet',block:'warmup',sets:'-',reps:'12 mn',rest:'-',note:'Activation maximale'}),
      ex({id:'depth_jumps',       block:'circuit1',sets:'4',reps:'5 reps',rest:'-',mode:'enchaînement',note:'1) Enchaîner les 5 sans repos'}),
      ex({id:'squat_barre_explosif',block:'circuit1',sets:'4',reps:'3 reps',rest:'-',mode:'enchaînement',note:'2) 50-60% 1RM'}),
      ex({id:'sprint_20m',        block:'circuit1',sets:'4',reps:'1 rep',rest:'-',mode:'enchaînement',note:'3)'}),
      ex({id:'pompes_claquees',   block:'circuit1',sets:'4',reps:'8 reps',rest:'-',mode:'enchaînement',note:'4)'}),
      ex({id:'tuck_jumps',        block:'circuit1',sets:'4',reps:'6 reps',rest:'3 mn',mode:'enchaînement',note:'5) Repos après les 5'}),
      ex({id:'power_clean',       block:'circuit2',sets:'3',reps:'4 reps',rest:'-',mode:'enchaînement',note:'1)'}),
      ex({id:'developpe_couche',  block:'circuit2',sets:'3',reps:'6 reps',rest:'-',mode:'enchaînement',note:'2)'}),
      ex({id:'tractions',         block:'circuit2',sets:'3',reps:'6 reps',rest:'-',mode:'enchaînement',note:'3) Lestées'}),
      ex({id:'pallof_press',      block:'circuit2',sets:'3',reps:'8 reps/côté',rest:'2 mn',mode:'enchaînement',note:'4)'}),
      ex({id:'sprint_10m',        block:'sprint',sets:'6',reps:'1 rep',rest:'2 mn',note:'Accélération pure'}),
      ex({id:'sprint_60m',        block:'sprint',sets:'3',reps:'1 rep',rest:'4 mn',note:'Simulation Super Explosif Test'}),
      ex({id:'etirements_foam_rolling',block:'cooldown',sets:'-',reps:'10 mn',rest:'-'})
    ],
    feedbackQuestions:['difficulty','fatigue','pain','completed','comment'],
    adaptationRules:{titanCan:['rest','reps','load'],titanCannot:['breakCircuit']}
  };

  var p4_j3 = {
    sessionId:'ep_p4_j3', sessionNumber:3, sessionTitle:'Jour 3 — Explosivité pure + Vitesse maximale',
    sessionGoal:'Records plio + sprints + simulation 94 feet.',
    sessionType:'explo-vitesse-peak', estimatedDuration:'85-100 min', requiredEquipment:['Box','Haies','Espace sprint','Cônes'],
    isOptional:false,
    specialInstructions:'Tentatives de records sur box jumps et broad jumps. 94 Feet Test = simulation Super Explosif Test.',
    titanIntroMessage:'Records et simulation du test final. Donne tout — la sem 18 arrive.',
    blocks:[
      {blockId:'warmup',  blockType:'warmup',title:'Échauffement explosif'},
      {blockId:'plio_max',blockType:'main',  title:'Pliométrie peak'},
      {blockId:'sprint',  blockType:'main',  title:'Sprints maximaux'},
      {blockId:'simul',   blockType:'main',  title:'Simulation 94 Feet'},
      {blockId:'pied',    blockType:'main',  title:'Travail du pied'},
      {blockId:'mener',   blockType:'main',  title:'MENER'},
      {blockId:'cooldown',blockType:'recovery',title:'Étirements'}
    ],
    exercises:[
      ex({id:'echauffement_explosif',block:'warmup',sets:'-',reps:'12 mn',rest:'-'}),
      ex({id:'box_jumps',         block:'plio_max',sets:'5',reps:'5 reps',rest:'2 mn 30',note:'Record de hauteur'}),
      ex({id:'broad_jumps',       block:'plio_max',sets:'5',reps:'5 reps',rest:'2 mn',note:'Record de distance'}),
      ex({id:'hurdle_hops',       block:'plio_max',sets:'4',reps:'6 reps',rest:'2 mn 30',note:'Vitesse + hauteur max'}),
      ex({id:'lateral_bounds',    block:'plio_max',sets:'4',reps:'8 reps/côté',rest:'2 mn'}),
      ex({id:'squat_jump_charge', block:'plio_max',sets:'4',reps:'5 reps',rest:'2 mn 30',intensity:'30% 1RM'}),
      ex({id:'sprint_10m',        block:'sprint',sets:'8',reps:'1 rep',rest:'2 mn',note:'ALL OUT à chaque sprint'}),
      ex({id:'sprint_30m',        block:'sprint',sets:'6',reps:'1 rep',rest:'3 mn'}),
      ex({id:'feet_94_test',      block:'simul',sets:'3',reps:'Parcours complet',rest:'3 mn',note:'Préparation Super Explosif Test'}),
      ex({id:'tibialis_raise',    block:'pied',sets:'3',reps:'20 reps',rest:'30 s'}),
      ex({id:'calf_raises_unilat',block:'pied',sets:'3',reps:'15 reps/jambe',rest:'45 s'}),
      ex({id:'proprioception_avancee',block:'pied',sets:'3',reps:'30 s/jambe',rest:'30 s'}),
      ex({id:'rdv_partenaire',    block:'mener',sets:'1x/sem',reps:'15-30 mn',rest:'-'}),
      ex({id:'engagements_semaine',block:'mener',sets:'Quotidien',reps:'Variable',rest:'-'}),
      ex({id:'etirements_foam_rolling',block:'cooldown',sets:'-',reps:'10 mn',rest:'-'})
    ],
    feedbackQuestions:['difficulty','fatigue','pain','completed','prJump','prSprint','comment'],
    adaptationRules:{titanCan:['rest','reps','attemptPR'],titanCannot:['removeMENER']}
  };

  var p4_j4 = {
    sessionId:'ep_p4_j4', sessionNumber:4, sessionTitle:'Jour 4 — Force complète + Affûtage',
    sessionGoal:'Volume réduit sem.17-18, intensité maintenue. Prépare le test final.',
    sessionType:'force-affutage', estimatedDuration:'70-85 min', requiredEquipment:['Barre','Disques','Box'],
    isOptional:false,
    specialInstructions:'Volume RÉDUIT en sem.17-18 (-30% à -40%). Intensité MAINTENUE. Pas d\'échec.',
    titanIntroMessage:'Affûtage. Tu enlèves le volume, tu gardes la qualité. La fraîcheur arrive.',
    blocks:[
      {blockId:'warmup',  blockType:'warmup',title:'Échauffement'},
      {blockId:'force',   blockType:'main',  title:'Force barre (volume réduit)'},
      {blockId:'stato',   blockType:'main',  title:'Stato-dynamique'},
      {blockId:'plio',    blockType:'main',  title:'Box jumps qualité'},
      {blockId:'sprint',  blockType:'main',  title:'Sprint vitesse max'},
      {blockId:'cooldown',blockType:'recovery',title:'Foam rolling + étirements'}
    ],
    exercises:[
      ex({id:'echauffement_corps_complet',block:'warmup',sets:'-',reps:'12 mn',rest:'-'}),
      ex({id:'squat_barre',       block:'force',sets:'3',reps:'5 reps',rest:'3 mn',intensity:'60-70% 1RM',note:'Volume réduit'}),
      ex({id:'sdt',               block:'force',sets:'3',reps:'4 reps',rest:'3 mn'}),
      ex({id:'hip_thrust',        block:'force',sets:'3',reps:'8 reps',rest:'2 mn 30'}),
      ex({id:'developpe_couche',  block:'force',sets:'3',reps:'5 reps',rest:'3 mn'}),
      ex({id:'tractions',         block:'force',sets:'3',reps:'6 reps',rest:'2 mn 30',note:'Lestées'}),
      ex({id:'squat_stato_dyn',   block:'stato',sets:'3',reps:'6 s maintien → explosion',rest:'2 mn 30'}),
      ex({id:'box_jumps',         block:'plio',sets:'3',reps:'5 reps',rest:'2 mn',note:'Qualité maximale'}),
      ex({id:'sprint_20m',        block:'sprint',sets:'4',reps:'1 rep',rest:'2 mn',intensity:'Vitesse maximale'}),
      ex({id:'foam_rolling',      block:'cooldown',sets:'-',reps:'15 mn',rest:'-'}),
      ex({id:'etirements_statiques',block:'cooldown',sets:'-',reps:'15 mn',rest:'-',note:'Préparer le corps pour le test final'})
    ],
    feedbackQuestions:['difficulty','fatigue','pain','completed','readinessForTest','comment'],
    adaptationRules:{titanCan:['load','rest','volume'],titanCannot:['breakTaper','goToFailure']}
  };

  // ─── ASSEMBLAGE ──────────────────────────────────────────────────────────
  function makeWeek(phaseId, weekNumber, focus, chargeLabel, sessions, opts) {
    opts = opts || {};
    return {
      weekId: phaseId+'_w'+weekNumber,
      weekNumber: weekNumber,
      weekFocus: focus,
      chargeModifier: chargeLabel,
      requiredSessions: sessions.filter(function(s){return s.required;}).map(function(s){return s.id;}),
      optionalSessions: sessions.filter(function(s){return !s.required;}).map(function(s){return s.id;}),
      validationRule: opts.validationRule || 'Toutes les séances requises terminées + RDV partenaire 1x.',
      specialNote: opts.specialNote || null,
      sessions: sessions
    };
  }

  var P1_SESS = [
    {id:'ep_p1_j1',required:true},{id:'ep_p1_j2',required:true},
    {id:'ep_p1_j3',required:true},{id:'ep_p1_j4',required:false}
  ];
  var P2_SESS = [
    {id:'ep_p2_j1',required:true},{id:'ep_p2_j2',required:true},
    {id:'ep_p2_j3',required:true},{id:'ep_p2_j4',required:true}
  ];
  var P3_SESS = [
    {id:'ep_p3_j1',required:true},{id:'ep_p3_j2',required:true},
    {id:'ep_p3_j3',required:true},{id:'ep_p3_j4',required:true}
  ];
  var P4_SESS = [
    {id:'ep_p4_j1',required:true},{id:'ep_p4_j2',required:true},
    {id:'ep_p4_j3',required:true},{id:'ep_p4_j4',required:true}
  ];

  var phase1Weeks = [
    makeWeek('ep_p1',1,'Apprentissage — qualité de mouvement absolue','PDC',P1_SESS),
    makeWeek('ep_p1',2,'Consolidation — réduire les temps de repos','PDC',P1_SESS),
    makeWeek('ep_p1',3,'Intensification — dernière série à l\'échec sur exos clés','PDC',P1_SESS),
    makeWeek('ep_p1',4,'Affûtage + Super Explosif Test fin de phase','PDC',P1_SESS,{
      specialNote:'Volume -20%. Test fin de phase = Super Explosif Test complet, comparer avec baseline.',
      validationRule:'Test fin de phase obligatoire pour clore Phase 1.'
    })
  ];
  var phase2Weeks = [
    makeWeek('ep_p2',5,'Adaptation — apprendre les mouvements avec charge','50-60% 1RM',P2_SESS,{specialNote:'Tests 1RM Squat/SDT/HT/DC obligatoires début Phase 2.'}),
    makeWeek('ep_p2',6,'Consolidation — augmenter la maîtrise technique','60-70% 1RM',P2_SESS),
    makeWeek('ep_p2',7,'Intensification — dernier set à l\'échec','70-75% 1RM',P2_SESS),
    makeWeek('ep_p2',8,'Surcharge — nouveaux records de charge','75-80% 1RM',P2_SESS),
    makeWeek('ep_p2',9,'Affûtage -20% volume + Super Explosif Test fin de phase','-',P2_SESS,{
      specialNote:'Test fin de phase 2. Compare avec sem.4 (test phase 1).',
      validationRule:'Test fin de phase obligatoire.'
    })
  ];
  var phase3Weeks = [
    makeWeek('ep_p3',10,'Adaptation à la nouvelle phase','70-75% 1RM',P3_SESS),
    makeWeek('ep_p3',11,'Intensification — force maximale','75-85% 1RM',P3_SESS),
    makeWeek('ep_p3',12,'Surcharge maximale — records','80-90% 1RM',P3_SESS),
    makeWeek('ep_p3',13,'Maintien intensité — ajout vitesse avancée','80-90% 1RM',P3_SESS),
    makeWeek('ep_p3',14,'Affûtage -20 à -30% volume + Super Explosif Test fin de phase','-',P3_SESS,{
      specialNote:'Test fin de phase 3. Phase pivot — comparer attentivement.',
      validationRule:'Test fin de phase obligatoire.'
    })
  ];
  var phase4Weeks = [
    makeWeek('ep_p4',15,'Peak force — records de charge','85-90% 1RM',P4_SESS),
    makeWeek('ep_p4',16,'Peak explosivité — records de détente','85-90% 1RM',P4_SESS),
    makeWeek('ep_p4',17,'Affûtage — réduction volume, maintien intensité','60-70% 1RM',P4_SESS),
    makeWeek('ep_p4',18,'Affûtage final + SUPER EXPLOSIF TEST FINAL','-',P4_SESS,{
      specialNote:'Repos 2 jours avant le test. Échauffement 20 mn. Donne tout. Compare avec baseline initiale.',
      validationRule:'Test final = clôture du programme.'
    })
  ];

  var program = {
    programId:'ep',
    programName:'EXPLOSE+',
    programGoal:'Transformation physique complète via la méthode MENER + Partenaire de résultats',
    totalWeeks:18,
    programFrequency:'P1: 3-4 j/sem · P2: 4 · P3-4: 4-5',
    programLocation:'P1: sans salle possible · P2: salle recommandée · P3-P4: salle obligatoire',
    requiredTests:[
      'Super Explosif Test INITIAL (baseline) — 11 mesures',
      'Super Explosif Test fin Phase 1 (sem.4)',
      'Super Explosif Test fin Phase 2 (sem.9)',
      'Super Explosif Test fin Phase 3 (sem.14)',
      'Super Explosif Test FINAL (sem.18)',
      'Tests 1RM Squat/SDT/HT/DC (début Phase 2)'
    ],
    optionalTests:['Mesures (taille/hanches/cuisses)','Photos (face/profil/dos)'],
    specialRules:[
      'NON-NÉGOCIABLE : Partenaire de résultats OBLIGATOIRE avant de commencer.',
      'AVANT DE COMMENCER : Trouver partenaire / Signer contrat / Questionnaire MENER / Choisir engagements / Super Explosif Test initial.',
      'Pilier MENER refait en début de chaque phase.',
      'RDV partenaire 1x/sem (15-30 mn) — engagements 1-3 max.',
      'Tests 1RM obligatoires début Phase 2 (Squat/SDT/HT/DC).',
      'Semaine d\'affûtage en fin de chaque phase (volume -20% P1/P2, -20 à -30% P3, -30 à -40% P4).'
    ],
    superExplosifTestProtocol: SUPER_EXPLOSIF_TEST,
    phases:[
      {
        phaseId:'ep_p1', phaseName:'PHASE 1 — POIDS DU CORPS', phaseNumber:1,
        phaseGoal:'Apprendre à bouger correctement avant de bouger lourd. Squats, fentes, hinges, poussées, tractions — maîtrise totale.',
        durationWeeks:4, frequency:'3-4 j/sem', location:'Sans salle possible',
        progressionRules:[
          {week:1,charge:'PDC',focus:'Apprentissage — qualité absolue'},
          {week:2,charge:'PDC',focus:'Consolidation'},
          {week:3,charge:'PDC',focus:'Intensification — échec exos clés'},
          {week:4,charge:'PDC',focus:'Affûtage + Test'}
        ],
        weeks:phase1Weeks,
        sessions:{ep_p1_j1:p1_j1,ep_p1_j2:p1_j2,ep_p1_j3:p1_j3,ep_p1_j4:p1_j4}
      },
      {
        phaseId:'ep_p2', phaseName:'PHASE 2 — CHARGES LÉGÈRES + PLIOMÉTRIE DÉBUTANT', phaseNumber:2,
        phaseGoal:'Introduire les charges à la barre et la pliométrie intensive sur les mouvements maîtrisés.',
        durationWeeks:5, frequency:'4 j/sem', location:'Salle recommandée',
        progressionRules:[
          {week:5,charge:'50-60% 1RM',focus:'Adaptation'},
          {week:6,charge:'60-70% 1RM',focus:'Consolidation'},
          {week:7,charge:'70-75% 1RM',focus:'Intensification (échec)'},
          {week:8,charge:'75-80% 1RM',focus:'Surcharge'},
          {week:9,charge:'-',focus:'Affûtage + Test'}
        ],
        weeks:phase2Weeks,
        sessions:{ep_p2_j1:p2_j1,ep_p2_j2:p2_j2,ep_p2_j3:p2_j3,ep_p2_j4:p2_j4}
      },
      {
        phaseId:'ep_p3', phaseName:'PHASE 3 — CHARGES PROGRESSIVES + PLO AVANCÉE + VITESSE', phaseNumber:3,
        phaseGoal:'Les charges atteignent leur niveau optimal (80-90% 1RM). La pliométrie devient avancée. La vitesse s\'intègre pleinement.',
        durationWeeks:5, frequency:'4-5 j/sem', location:'Salle obligatoire',
        progressionRules:[
          {week:10,charge:'70-75% 1RM',focus:'Adaptation'},
          {week:11,charge:'75-85% 1RM',focus:'Intensification'},
          {week:12,charge:'80-90% 1RM',focus:'Surcharge maximale — records'},
          {week:13,charge:'80-90% 1RM',focus:'Maintien + vitesse avancée'},
          {week:14,charge:'-',focus:'Affûtage + Test'}
        ],
        weeks:phase3Weeks,
        sessions:{ep_p3_j1:p3_j1,ep_p3_j2:p3_j2,ep_p3_j3:p3_j3,ep_p3_j4:p3_j4}
      },
      {
        phaseId:'ep_p4', phaseName:'PHASE 4 — PEAK PERFORMANCE', phaseNumber:4,
        phaseGoal:'Phase finale. Volume légèrement réduit en sem 17-18, intensité au maximum. Super Explosif Test FINAL sem.18.',
        durationWeeks:4, frequency:'4-5 j/sem', location:'Salle obligatoire',
        progressionRules:[
          {week:15,charge:'85-90% 1RM',focus:'Peak force — records'},
          {week:16,charge:'85-90% 1RM',focus:'Peak explosivité — records détente'},
          {week:17,charge:'60-70% 1RM',focus:'Affûtage'},
          {week:18,charge:'-',focus:'Affûtage final + SUPER EXPLOSIF TEST FINAL'}
        ],
        weeks:phase4Weeks,
        sessions:{ep_p4_j1:p4_j1,ep_p4_j2:p4_j2,ep_p4_j3:p4_j3,ep_p4_j4:p4_j4}
      }
    ],
    finalNote:'18 semaines terminées. Tu n\'es plus la même personne — physiquement, mentalement, structurellement.'
  };

  var verificationTable = [];
  [phase1Weeks,phase2Weeks,phase3Weeks,phase4Weeks].forEach(function(weeks,pi){
    weeks.forEach(function(w){
      var status = (w.specialNote && /Test/.test(w.specialNote)) ? 'TEST FIN DE PHASE' : 'OK';
      if (w.weekNumber === 9 || w.weekNumber === 18) status = 'TEST';
      verificationTable.push({program:'ep',phase:pi+1,week:w.weekNumber,sessions:Object.keys(program.phases[pi].sessions),status:status,notes:w.specialNote || null});
    });
  });

  var allExoIds = Object.keys(EP_MASTER_EXERCISES);
  var stats = {
    totalPhases:4,
    totalWeeks:18,
    totalSessionTemplates:16, // 4 phases × 4 séances = 16
    uniqueExercises:allExoIds.length,
    exercisesWithVideo:0,
    exercisesWithoutVideo:allExoIds.map(function(id){return{exerciseId:id,masterName:EP_MASTER_EXERCISES[id].masterName,category:EP_MASTER_EXERCISES[id].category};})
  };

  return {
    program:program,
    masterExercises:EP_MASTER_EXERCISES,
    superExplosifTestProtocol:SUPER_EXPLOSIF_TEST,
    verificationTable:verificationTable,
    stats:stats
  };
});
