// ════════════════════════════════════════════════════════════════════════════
// ELITE ATHLÈTE — SOURCE DE VÉRITÉ DU PROGRAMME (data layer, non intégré UI)
// ────────────────────────────────────────────────────────────────────────────
// Construit à partir de (ordre de priorité en cas de conflit) :
//   1. Livre "Les Secrets de la Détente Verticale" (data/livre.md)
//   2. "Programme Élite Athlète — Conception, Planification et Structure
//      Globale" (ligne directrice 1.15) — noms de phases officiels,
//      6 variables, méthodo Upper/Lower
//   3. PDF "elite athlete.pdf" — séances détaillées (exos, séries, reps,
//      repos). NOTE : le PDF nomme la Phase 1 "Vertical Test" ; le nom
//      OFFICIEL pour l'app est "Fondation Athlétique".
//   4. Liste_maitre_exercices_BESOIN_v1.xlsx — noms canoniques + catégories
//      + futurs slots vidéo
//
// ARCHITECTURE DU FICHIER
//   - EA_MASTER_EXERCISES : dictionnaire des exercices utilisés par le
//     programme. exerciseId = slug stable lié au nom canonique de la
//     librairie maître Excel. videoUrl = YouTube id si déjà disponible
//     dans la librairie du code (_LIB_VIDEO_MAP), sinon null.
//   - EA_DAY_TEMPLATES : les journées-types écrites UNE fois, fidèles au
//     PDF séances (page par page). C'est la partie à relire/valider.
//   - buildEliteAthleteProgram() : expanse les templates en 18 semaines /
//     86 sessions selon les règles de progression documentées (séries P1
//     par semaine, rotation challenges P2, %1RM P3 par bloc, semaines
//     spéciales). Déterministe, zéro aléatoire, zéro IA.
//   - Export : window.ELITE_ATHLETE_PROGRAM (browser) + module.exports
//     (Node, pour le script de vérification scripts/verify-ea-program.js).
//
// CE FICHIER N'EST PAS ENCORE BRANCHÉ DANS L'UI — étape de validation.
// ════════════════════════════════════════════════════════════════════════════

(function (root, factory) {
  var lib = factory();
  if (typeof module === 'object' && module.exports) module.exports = lib;
  if (root) root.ELITE_ATHLETE_PROGRAM = lib.program;
  if (root) root.ELITE_ATHLETE_LIB = lib;
})(typeof window !== 'undefined' ? window : null, function () {

  // ──────────────────────────────────────────────────────────────────────────
  // 1. LIBRAIRIE MAÎTRE — exercices du programme Elite Athlète
  //    masterName = nom canonique de l'Excel (colonne "Exercice (canonique)")
  //    category   = catégorie Excel
  //    videoUrl   = id YouTube si présent dans la librairie du code, sinon null
  //    pdfAliases = noms utilisés par le PDF séances quand ils diffèrent
  // ──────────────────────────────────────────────────────────────────────────
  var YT = function (id) { return 'https://www.youtube.com/watch?v=' + id; };

  var EA_MASTER_EXERCISES = {
    // — Échauffement —
    echauffement_dynamique:      { masterName: 'Échauffement dynamique',            category: 'Échauffement',             videoUrl: null, generic: true },
    echauffement_haut_du_corps:  { masterName: 'Échauffement haut du corps',        category: 'Échauffement',             videoUrl: null, generic: true },
    squats_sautes_legers:        { masterName: 'Squats sautés légers',              category: 'Échauffement',             videoUrl: null, generic: true },
    activation_neuromusculaire:  { masterName: 'Échauffement dynamique',            category: 'Échauffement',             videoUrl: null, generic: true, pdfAliases: ['Activation neuromusculaire — Squats poids du corps'] },

    // — Mobilité & Coordination —
    quatre_vingt_dix_90:         { masterName: '90/90',                              category: 'Mobilité & Coordination',  videoUrl: null },
    carioca:                     { masterName: 'Carioca',                            category: 'Mobilité & Coordination',  videoUrl: null },
    mobilite_mouv:               { masterName: 'Mobilité mouv',                      category: 'Mobilité & Coordination',  videoUrl: null },

    // — Proprioception & Équilibre —
    marche_arriere_colline:      { masterName: 'Marche arrière en colline',          category: 'Proprioception & Équilibre', videoUrl: null },
    t_hold:                      { masterName: 'T-hold',                             category: 'Proprioception & Équilibre', videoUrl: null },
    equilibre_unipodal_instable: { masterName: 'Équilibre unipodal surface instable', category: 'Proprioception & Équilibre', videoUrl: null },
    equilibre_yeux_fermes:       { masterName: 'Équilibre unipodal yeux fermés',     category: 'Proprioception & Équilibre', videoUrl: null, pdfAliases: ['Équilibre sur une jambe yeux fermés'] },

    // — Pliométrie —
    broad_jumps:                 { masterName: 'Broad jumps',                        category: 'Pliométrie',               videoUrl: null },
    lateral_bounds:              { masterName: 'Lateral bounds',                     category: 'Pliométrie',               videoUrl: null },
    split_jumps:                 { masterName: 'Split jumps',                        category: 'Pliométrie',               videoUrl: null },
    depth_jumps:                 { masterName: 'Depth jumps',                        category: 'Pliométrie',               videoUrl: YT('oPWZatCRCKY') },
    box_squat_jumps:             { masterName: 'Box squat jumps',                    category: 'Pliométrie',               videoUrl: null },
    box_jumps:                   { masterName: 'Box jumps',                          category: 'Pliométrie',               videoUrl: YT('WBuKfR9lc0o') },
    hurdle_hops:                 { masterName: 'Hurdle hops',                        category: 'Pliométrie',               videoUrl: null },
    single_leg_box_jumps:        { masterName: 'Single leg box jumps',               category: 'Pliométrie',               videoUrl: null },
    tuck_jumps:                  { masterName: 'Tuck jumps',                         category: 'Pliométrie',               videoUrl: null },
    sauts_a_la_corde:            { masterName: 'Sauts à la corde',                   category: 'Pliométrie',               videoUrl: null },
    transmission_de_force:       { masterName: 'Transmission de force (sauts libres 100%)', category: 'Pliométrie',        videoUrl: null },

    // — Force — Poids du corps —
    nordic_hamstring:            { masterName: 'Nordic hamstring',                   category: 'Force — Poids du corps',   videoUrl: null },
    reverse_nordic:              { masterName: 'Reverse nordic',                     category: 'Force — Poids du corps',   videoUrl: null },
    squat_stato_dynamique:       { masterName: 'Squat stato-dynamique',              category: 'Force — Poids du corps',   videoUrl: null },
    split_stance_isometrique:    { masterName: 'Split stance isométrique',           category: 'Force — Poids du corps',   videoUrl: null, pdfAliases: ['Split stance'] },
    bring_sally_up:              { masterName: 'Bring Sally Up',                     category: 'Force — Poids du corps',   videoUrl: null },
    pompes_diamant:              { masterName: 'Pompes diamant',                     category: 'Force — Poids du corps',   videoUrl: null },
    dips_chaise:                 { masterName: 'Dips (sur chaise/banc)',             category: 'Force — Poids du corps',   videoUrl: null, pdfAliases: ['Dips sur chaise / banc'] },
    pompes_declinees:            { masterName: 'Pompes déclinées',                   category: 'Force — Poids du corps',   videoUrl: null },
    pike_push_ups:               { masterName: 'Pike push-ups',                      category: 'Force — Poids du corps',   videoUrl: null },
    squat_isometrique:           { masterName: 'Squat isométrique (90°)',            category: 'Force — Poids du corps',   videoUrl: null, pdfAliases: ['Squat isométrique — mur ou air'] },
    fente_isometrique:           { masterName: 'Fente isométrique',                  category: 'Force — Poids du corps',   videoUrl: null },
    single_leg_squat_hold:       { masterName: 'Single leg squat hold',              category: 'Force — Poids du corps',   videoUrl: null },
    handstand_hold:              { masterName: 'Handstand hold',                     category: 'Force — Poids du corps',   videoUrl: null, pdfAliases: ['Handstand hold — poirier contre mur'] },
    handstand_progression:       { masterName: 'Handstand progression',              category: 'Force — Poids du corps',   videoUrl: null },
    pompes_hindou:               { masterName: 'Pompes hindou',                      category: 'Force — Poids du corps',   videoUrl: null },
    pseudo_planche_push_ups:     { masterName: 'Pseudo planche push-ups',            category: 'Force — Poids du corps',   videoUrl: null },
    pompes_archer:               { masterName: 'Pompes archer',                      category: 'Force — Poids du corps',   videoUrl: null },
    pompes_pliometriques:        { masterName: 'Pompes pliométriques (claquées)',    category: 'Force — Poids du corps',   videoUrl: null, pdfAliases: ['Pompes claquées', 'Pompes pliométriques'] },
    burpees:                     { masterName: 'Burpees',                            category: 'Force — Poids du corps',   videoUrl: null },
    fente_bulgare_pdc:           { masterName: 'Fente bulgare PDC',                  category: 'Force — Poids du corps',   videoUrl: null, pdfAliases: ['Fentes bulgares'] },
    pompes_max:                  { masterName: 'Pompes (challenge max)',             category: 'Force — Poids du corps',   videoUrl: null, notInMaster: true },

    // — Force — Avec charges —
    squat_barre:                 { masterName: 'Squat barre',                        category: 'Force — Avec charges',     videoUrl: YT('gsNoPYwWXeM'), pdfAliases: ['Squat à la barre'] },
    souleve_de_terre:            { masterName: 'Soulevé de terre',                   category: 'Force — Avec charges',     videoUrl: YT('op9kVnSso6Q') },
    leg_curl:                    { masterName: 'Leg curl',                           category: 'Force — Avec charges',     videoUrl: null },
    developpe_couche:            { masterName: 'Développé couché',                   category: 'Force — Avec charges',     videoUrl: YT('vcBig73ojpE') },
    developpe_incline_halteres:  { masterName: 'Développé incliné haltères',         category: 'Force — Avec charges',     videoUrl: null },
    tractions_lestees:           { masterName: 'Tractions lestées',                  category: 'Force — Avec charges',     videoUrl: null, pdfAliases: ['Tractions lestées ou assistées'] },
    rowing_barre:                { masterName: 'Rowing barre',                       category: 'Force — Avec charges',     videoUrl: null },
    dips_lestes:                 { masterName: 'Dips lestés',                        category: 'Force — Avec charges',     videoUrl: null },
    curl_biceps_halteres:        { masterName: 'Curl biceps haltères',               category: 'Force — Avec charges',     videoUrl: null },
    medicine_ball_slams:         { masterName: 'Medicine ball slams',                category: 'Force — Avec charges',     videoUrl: null },
    hip_thrust_charge:           { masterName: 'Hip thrust chargé',                  category: 'Force — Avec charges',     videoUrl: YT('xDmFkJxPzeM'), pdfAliases: ['Hip Thrust'] },
    squat_jump_charge:           { masterName: 'Squat jump chargé',                  category: 'Force — Avec charges',     videoUrl: null, pdfAliases: ['Squat jump avec charge'] },
    power_clean:                 { masterName: 'Power clean (variantes)',            category: 'Force — Avec charges',     videoUrl: YT('e7ND8Wm67sg'), pdfAliases: ['Power clean ou clean pull'] },
    step_ups_explosifs:          { masterName: 'Step-ups explosifs',                 category: 'Force — Avec charges',     videoUrl: null },
    goblet_squat:                { masterName: 'Goblet squat',                       category: 'Force — Avec charges',     videoUrl: null },
    front_squat:                 { masterName: 'Front squat',                        category: 'Force — Avec charges',     videoUrl: null },
    romanian_deadlift:           { masterName: 'Romanian deadlift',                  category: 'Force — Avec charges',     videoUrl: null },
    leg_press:                   { masterName: 'Leg press',                          category: 'Force — Avec charges',     videoUrl: null },
    leg_extension:               { masterName: 'Leg extension',                      category: 'Force — Avec charges',     videoUrl: null },
    developpe_militaire:         { masterName: 'Développé militaire',                category: 'Force — Avec charges',     videoUrl: null },
    rowing_halteres:             { masterName: 'Rowing haltères',                    category: 'Force — Avec charges',     videoUrl: null },
    elevations_laterales:        { masterName: 'Élévations latérales',               category: 'Force — Avec charges',     videoUrl: null },
    face_pulls:                  { masterName: 'Face pulls',                         category: 'Force — Avec charges',     videoUrl: null },
    battle_ropes:                { masterName: 'Battle ropes',                       category: 'Force — Avec charges',     videoUrl: null },

    // — Gainage & Core —
    rotation_explosive_planche:  { masterName: 'Rotation explosive buste en planche', category: 'Gainage & Core',          videoUrl: null },
    shoulder_taps_planche:       { masterName: 'Planche dynamique (tap épaules)',    category: 'Gainage & Core',           videoUrl: null, pdfAliases: ['Shoulder taps en planche', 'Planche avant-bras + touche épaule', 'Planche avec tap épaules'] },
    dead_bug:                    { masterName: 'Dead bug',                           category: 'Gainage & Core',           videoUrl: null, pdfAliases: ['Dead bug explosif'] },
    pallof_press:                { masterName: 'Pallof press',                       category: 'Gainage & Core',           videoUrl: null },
    russian_twists:              { masterName: 'Russian twists',                     category: 'Gainage & Core',           videoUrl: null },
    planche_laterale:            { masterName: 'Planche latérale',                   category: 'Gainage & Core',           videoUrl: null },

    // — Travail du pied —
    elevation_orteils:           { masterName: 'Dorsiflexion / tibial antérieur',    category: 'Travail du pied',          videoUrl: null, pdfAliases: ['Élévation orteils'] },
    travail_tibial:              { masterName: 'Dorsiflexion / tibial antérieur',    category: 'Travail du pied',          videoUrl: null, pdfAliases: ['Travail tibial antérieur', 'Dorsiflexion résistée'] },
    calf_raises_debout:          { masterName: 'Calf raises debout',                 category: 'Travail du pied',          videoUrl: null },
    calf_raise_unipodal:         { masterName: 'Calf raise unipodal',                category: 'Travail du pied',          videoUrl: null, pdfAliases: ['Calf raises unipodal', 'Relevé de pointe unipodal'] },
    marche_pointe_pieds:         { masterName: 'Marche sur pointe de pieds',         category: 'Travail du pied',          videoUrl: null },
    marche_talons:               { masterName: 'Marche sur les talons',              category: 'Travail du pied',          videoUrl: null },
    toe_taps:                    { masterName: 'Toe taps',                           category: 'Travail du pied',          videoUrl: null },

    // — Sprint & Vitesse —
    sprint_lineaire:             { masterName: 'Sprint linéaire (10–60m)',           category: 'Sprint & Vitesse',         videoUrl: YT('4N4MFqo2J8c'), pdfAliases: ['Sprint 20 m'] },
    fractionne_court:            { masterName: 'Fractionné court (10s + récup)',     category: 'Sprint & Vitesse',         videoUrl: null, pdfAliases: ['Sprint 10 s + Jogging 30 s + Marche 20 s', 'Fractionné : 15 s sprint (100%) + 15 s repos'] },
    fractionne_long:             { masterName: 'Fractionné long (1mn/1mn)',          category: 'Sprint & Vitesse',         videoUrl: null, pdfAliases: ['Fractionné : 1 mn (80%) + 1 mn marche'] },
    course_a_pied:               { masterName: 'Course à pied 35mn',                 category: 'Sprint & Vitesse',         videoUrl: null, generic: true },

    // — Récupération —
    etirements:                  { masterName: 'Étirements',                         category: 'Récupération',             videoUrl: null, generic: true, pdfAliases: ['Étirements légers', 'Étirements — Focus bas du corps', 'Étirements haut du corps', 'Étirements + foam rolling', 'Étirements complets'] },
    rock_back_breathing:         { masterName: 'Rock Back breathing',                category: 'Récupération',             videoUrl: null },
    visualisation:               { masterName: 'Visualisation',                      category: 'Récupération',             videoUrl: null },
    retour_au_calme:             { masterName: 'Retour au calme',                    category: 'Récupération',             videoUrl: null, generic: true },

    // — Tests —
    test_detente_verticale:      { masterName: 'Détente verticale (saut au mur)',    category: 'Tests',                    videoUrl: null, test: true },
    test_1rm_squat:              { masterName: 'Squat à la barre — 1RM',             category: 'Tests',                    videoUrl: YT('gsNoPYwWXeM'), test: true },
    test_1rm_souleve:            { masterName: 'Soulevé de terre — 1RM',             category: 'Tests',                    videoUrl: YT('op9kVnSso6Q'), test: true },
    test_1rm_hip_thrust:         { masterName: 'Hip Thrust — 1RM',                   category: 'Tests',                    videoUrl: YT('xDmFkJxPzeM'), test: true },
    test_1rm_dc:                 { masterName: 'Développé couché — 1RM',             category: 'Tests',                    videoUrl: YT('vcBig73ojpE'), test: true }
  };

  // Helper : construit l'objet exercice complet d'une instance de séance.
  function ex(id, name, opts) {
    var m = EA_MASTER_EXERCISES[id];
    if (!m) throw new Error('Exercice inconnu dans la librairie maître : ' + id);
    var o = opts || {};
    return {
      exerciseId: id,
      exerciseName: name || m.masterName,
      masterName: m.masterName,
      category: m.category,
      blockType: o.block || 'main',                 // warmup / main / accessory / mobility / recovery / test
      sets: o.sets != null ? o.sets : null,          // null = non applicable (durée libre)
      repsOrDuration: o.reps || '',
      rest: o.rest || 'Sans repos / enchaînement',
      intensity: o.intensity || null,
      technique: o.technique || 'classique',         // classique / bi-set / cluster / fractionné / isométrie / stato-dynamique / excentrique / challenge
      coachingCue: o.cue || null,
      commonMistake: o.mistake || null,
      videoTitle: m.masterName,
      videoUrl: m.videoUrl || null,
      videoStatus: m.videoUrl ? 'available' : 'placeholder',
      videoPlaceholderText: m.videoUrl ? null : 'Vidéo bientôt disponible'
    };
  }

  // 'VAR' = nombre de séries variable selon la semaine (P1 : 5 → 4 → 3)
  var VAR = 'VAR';

  // ──────────────────────────────────────────────────────────────────────────
  // 2. JOURNÉES-TYPES — transcription fidèle du PDF séances (p.4 à p.16)
  // ──────────────────────────────────────────────────────────────────────────
  var EA_DAY_TEMPLATES = {

    // ═══ PHASE 1 — FONDATION ATHLÉTIQUE (PDF : "Vertical Test") ═══
    P1_J1: {
      title: 'Pliométrie extensive + Mobilité',
      type: 'entrainement', duration: '45-60 mn',
      equipment: ['Aucun matériel', 'Espace extérieur 20 m'],
      goal: 'Volume pliométrique extensif + entretien de la mobilité — qualité de chaque bond avant la quantité.',
      exercises: [
        ex('echauffement_dynamique', 'Échauffement dynamique général', { block: 'warmup', reps: '8-10 mn', rest: 'Aucun — enchaînement direct', cue: 'Cardio léger + articulations' }),
        ex('broad_jumps', 'Broad jumps — bonds en avant', { sets: VAR, reps: '12-15 reps', rest: '1 mn', cue: 'Enchaîner sans pause' }),
        ex('lateral_bounds', 'Lateral bounds — bonds latéraux', { sets: VAR, reps: '12-15 reps', rest: '1 mn', cue: 'Alternance gauche-droite' }),
        ex('split_jumps', 'Split jumps', { sets: VAR, reps: '12-15 reps', rest: '1 mn', cue: 'Alterner les jambes' }),
        ex('carioca', 'Carioca', { block: 'mobility', sets: 3, reps: '20 m aller-retour', rest: '45 s', cue: 'Coordination latérale' }),
        ex('mobilite_mouv', 'Mobilité mouv', { block: 'mobility', sets: 3, reps: '8 reps', rest: '45 s', cue: 'Amplitude complète' }),
        ex('quatre_vingt_dix_90', '90/90', { block: 'mobility', sets: 3, reps: '8 reps / côté', rest: '45 s', cue: 'Rotation hanches' }),
        ex('elevation_orteils', 'Élévation orteils', { block: 'accessory', sets: 3, reps: '15 reps', rest: '30 s' }),
        ex('travail_tibial', 'Travail tibial antérieur', { block: 'accessory', sets: 3, reps: '15 reps', rest: '30 s', cue: 'Dorsiflexion contrôlée' }),
        ex('etirements', 'Étirements légers', { block: 'recovery', reps: '5-10 mn', rest: 'Aucun — enchaînement direct' })
      ]
    },
    P1_J2: {
      title: 'Pliométrie extensive & intensive + Mobilité',
      type: 'entrainement', duration: '50-65 mn',
      equipment: ['Support stable (banc / muret) pour depth jumps & box squat jumps'],
      goal: 'Introduire la pliométrie intensive (depth jumps) sur une base extensive — réactivité au sol.',
      exercises: [
        ex('echauffement_dynamique', 'Échauffement dynamique général', { block: 'warmup', reps: '8-10 mn', rest: 'Aucun — enchaînement direct', cue: 'Cardio léger + articulations' }),
        ex('broad_jumps', 'Broad jumps — bonds en avant', { sets: VAR, reps: '12-15 reps', rest: '1 mn' }),
        ex('split_jumps', 'Split jumps', { sets: VAR, reps: '12-15 reps', rest: '1 mn' }),
        ex('depth_jumps', 'Depth jumps', { sets: VAR, reps: '6-8 reps', rest: '2 mn 30', cue: 'Hauteur adaptée' }),
        ex('box_squat_jumps', 'Box squat jumps — assis-debout', { sets: VAR, reps: '6-8 reps', rest: '2 mn 30', cue: 'Explosion maximale' }),
        ex('nordic_hamstring', 'Nordic hamstring', { sets: VAR, reps: '30 s → 1 mn 30', rest: '2 mn 30', technique: 'excentrique', cue: 'Contrôle excentrique' }),
        ex('reverse_nordic', 'Reverse nordic', { sets: VAR, reps: '30 s → 1 mn 30', rest: '2 mn 30', technique: 'excentrique', cue: 'Renforcement quadriceps' }),
        ex('carioca', 'Carioca', { block: 'mobility', sets: 3, reps: '20 m aller-retour', rest: '45 s' }),
        ex('mobilite_mouv', 'Mobilité mouv', { block: 'mobility', sets: 3, reps: '8 reps', rest: '45 s' }),
        ex('quatre_vingt_dix_90', '90/90', { block: 'mobility', sets: 3, reps: '8 reps / côté', rest: '45 s' }),
        ex('elevation_orteils', 'Élévation orteils', { block: 'accessory', sets: 3, reps: '15 reps', rest: '30 s' }),
        ex('travail_tibial', 'Travail tibial antérieur', { block: 'accessory', sets: 3, reps: '15 reps', rest: '30 s' }),
        ex('etirements', 'Étirements légers', { block: 'recovery', reps: '5-10 mn', rest: 'Aucun — enchaînement direct' })
      ]
    },
    P1_J3: {
      title: 'Pliométrie extensive + Mobilité',
      type: 'entrainement', duration: '45-60 mn',
      equipment: ['Aucun matériel', 'Espace extérieur 20 m'],
      goal: 'Même structure que le Jour 1 — répéter pour ancrer la qualité du geste.',
      exercises: [
        ex('echauffement_dynamique', 'Échauffement dynamique général', { block: 'warmup', reps: '8-10 mn', rest: 'Aucun — enchaînement direct', cue: 'Cardio léger + articulations' }),
        ex('broad_jumps', 'Broad jumps — bonds en avant', { sets: VAR, reps: '12-15 reps', rest: '1 mn' }),
        ex('lateral_bounds', 'Lateral bounds — bonds latéraux', { sets: VAR, reps: '12-15 reps', rest: '1 mn' }),
        ex('split_jumps', 'Split jumps', { sets: VAR, reps: '12-15 reps', rest: '1 mn' }),
        ex('carioca', 'Carioca', { block: 'mobility', sets: 3, reps: '20 m aller-retour', rest: '45 s' }),
        ex('mobilite_mouv', 'Mobilité mouv', { block: 'mobility', sets: 3, reps: '8 reps', rest: '45 s' }),
        ex('quatre_vingt_dix_90', '90/90', { block: 'mobility', sets: 3, reps: '8 reps / côté', rest: '45 s' }),
        ex('elevation_orteils', 'Élévation orteils', { block: 'accessory', sets: 3, reps: '15 reps', rest: '30 s' }),
        ex('travail_tibial', 'Travail tibial antérieur', { block: 'accessory', sets: 3, reps: '15 reps', rest: '30 s' }),
        ex('etirements', 'Étirements légers', { block: 'recovery', reps: '5-10 mn', rest: 'Aucun — enchaînement direct' })
      ]
    },
    P1_J4: {
      title: 'Pliométrie intensive + Stato-dynamique + Sprint 20 m',
      type: 'entrainement', duration: '55-70 mn',
      equipment: ['Support stable pour depth jumps', 'Couloir 20 m'],
      goal: 'Pliométrie intensive + stato-dynamique + premières pointes de vitesse maximale.',
      exercises: [
        ex('echauffement_dynamique', 'Échauffement dynamique général', { block: 'warmup', reps: '8-10 mn', rest: 'Aucun — enchaînement direct', cue: 'Cardio léger + articulations' }),
        ex('broad_jumps', 'Broad jumps — bonds en avant', { sets: VAR, reps: '12-15 reps', rest: '1 mn' }),
        ex('split_jumps', 'Split jumps', { sets: VAR, reps: '12-15 reps', rest: '1 mn' }),
        ex('depth_jumps', 'Depth jumps', { sets: VAR, reps: '6-8 reps', rest: '2 mn 30', cue: 'Hauteur adaptée' }),
        ex('box_squat_jumps', 'Box squat jumps — assis-debout', { sets: VAR, reps: '6-8 reps', rest: '2 mn 30', cue: 'Explosion maximale' }),
        ex('squat_stato_dynamique', 'Squat stato-dynamique', { sets: VAR, reps: '6 s min → explosion', rest: '2 mn 30', technique: 'stato-dynamique', cue: 'Isométrie profonde puis explosion' }),
        ex('split_stance_isometrique', 'Split stance — maintien fente profonde', { sets: VAR, reps: '30 s → 1 mn 30', rest: '2 mn 30', technique: 'isométrie' }),
        ex('sprint_lineaire', 'Sprint 20 m', { sets: 4, reps: '1 rep', rest: '2 mn 30', cue: 'Vitesse maximale — qualité > quantité' }),
        ex('elevation_orteils', 'Élévation orteils', { block: 'accessory', sets: 3, reps: '15 reps', rest: '30 s' }),
        ex('travail_tibial', 'Travail tibial antérieur', { block: 'accessory', sets: 3, reps: '15 reps', rest: '30 s' }),
        ex('etirements', 'Étirements légers', { block: 'recovery', reps: '5-10 mn', rest: 'Aucun — enchaînement direct' })
      ]
    },
    // Semaine 4 — protocole spécial du PDF (p.3)
    P1_TRANSMISSION: {
      title: 'Transmission de force — sauts libres à 100%',
      type: 'entrainement', duration: '20-30 mn',
      equipment: ['Box / panier / espace selon le saut choisi'],
      goal: 'Transformer le travail des 3 premières semaines en sauts libres à intensité maximale. Box jumps, dunks, broad jumps — tu choisis.',
      exercises: [
        ex('echauffement_dynamique', 'Échauffement dynamique général', { block: 'warmup', reps: '8-10 mn', rest: 'Aucun — enchaînement direct' }),
        ex('transmission_de_force', 'Sauts libres à 100% (box jumps, dunks, broad jumps — au choix)', { reps: '6-12 mn', rest: 'Récupération complète entre les sauts', intensity: '100% — chaque saut à intention maximale' }),
        ex('etirements', 'Étirements légers', { block: 'recovery', reps: '5-10 mn', rest: 'Aucun — enchaînement direct' })
      ]
    },
    P1_TEST: {
      title: 'Test de détente verticale',
      type: 'test', duration: '20-30 mn',
      equipment: ['Mur + mètre OU application de mesure', 'Téléphone pour filmer'],
      goal: 'Mesurer la progression depuis le test initial. Mesure et filme-toi pour comparer.',
      exercises: [
        ex('echauffement_dynamique', 'Échauffement dynamique général', { block: 'warmup', reps: '8-10 mn', rest: 'Aucun — enchaînement direct' }),
        ex('test_detente_verticale', 'Test de détente verticale', { block: 'test', sets: 3, reps: '3 essais — garde le meilleur', rest: 'Récupération complète', cue: 'Mesure et filme-toi pour comparer avec ton test initial' })
      ]
    },

    // ═══ PHASE 2 — DETOX TURBO ═══
    P2_J1: {
      title: 'UPPER — Challenge + Circuit Cluster + Épaules',
      type: 'entrainement', duration: '45-60 mn',
      equipment: ['Chaise ou banc pour les dips', 'Support pour pieds surélevés'],
      goal: 'Challenge haute intensité + circuit cluster pour briser la stagnation du haut du corps.',
      challengeSlot: 0, // index de l'exo challenge (remplacé en rotation)
      exercises: [
        ex('bring_sally_up', 'Bring Sally Up — pompes', { sets: 1, reps: "Suivre la chanson 'Flower' de Moby", rest: 'Aucun — enchaînement direct', technique: 'challenge', cue: 'Note ton score pour mesurer ta progression' }),
        ex('pompes_diamant', '1) Pompes diamant', { sets: 4, reps: '2-3 reps cluster', rest: 'Enchaîner avec le suivant', technique: 'cluster' }),
        ex('dips_chaise', '2) Dips sur chaise / banc', { sets: 4, reps: '2-3 reps cluster', rest: 'Enchaîner', technique: 'cluster' }),
        ex('pompes_declinees', '3) Pompes déclinées — pieds surélevés', { sets: 4, reps: '2-3 reps cluster', rest: 'Enchaîner', technique: 'cluster' }),
        ex('pike_push_ups', '4) Pike push-ups — pompes en V', { sets: 4, reps: '2-3 reps cluster', rest: '2 mn après les 4 tours', technique: 'cluster' }),
        ex('rotation_explosive_planche', 'Rotation explosive du buste en planche', { block: 'accessory', sets: 3, reps: '10 reps', rest: '1 mn', cue: 'Puissance rotative — reste gainé' }),
        ex('rock_back_breathing', 'Rock Back breathing', { block: 'recovery', reps: '2-5 mn', rest: 'Aucun — enchaînement direct', cue: 'Respiration diaphragmatique' }),
        ex('visualisation', 'Visualisation', { block: 'recovery', reps: '1-2 mn', rest: 'Aucun — enchaînement direct', cue: 'Visualise ta prochaine performance' })
      ]
    },
    P2_J2: {
      title: 'LOWER — Isométrique + Sprint',
      type: 'entrainement', duration: '50-60 mn',
      equipment: ['Aucun matériel', 'Colline ou pente (marche arrière)'],
      goal: 'Renforcement isométrique du bas du corps + travail du pied + sprint fractionné ALL OUT.',
      exercises: [
        ex('echauffement_dynamique', 'Échauffement dynamique', { block: 'warmup', reps: '5-10 mn', rest: 'Aucun — enchaînement direct', cue: 'Préparation articulaire' }),
        ex('squat_isometrique', 'Squat isométrique — mur ou air', { sets: 4, reps: '30-45 s', rest: '1 mn', technique: 'isométrie', cue: 'Contraction active' }),
        ex('fente_isometrique', 'Fente isométrique', { sets: 3, reps: '30 s / jambe', rest: '45 s', technique: 'isométrie', cue: 'Genou à 90°' }),
        ex('single_leg_squat_hold', 'Single leg squat hold', { sets: 3, reps: '20-30 s / jambe', rest: '45 s', technique: 'isométrie', cue: 'Équilibre + force' }),
        ex('calf_raise_unipodal', 'Relevé de pointe unipodal', { block: 'accessory', sets: 3, reps: '15 reps / jambe', rest: '30 s', cue: 'Amplitude complète' }),
        ex('marche_pointe_pieds', 'Marche sur pointe de pieds', { block: 'accessory', sets: 2, reps: '1 mn', rest: '30 s' }),
        ex('marche_talons', 'Marche sur les talons', { block: 'accessory', sets: 2, reps: '1 mn', rest: '30 s', cue: 'Activation tibial' }),
        ex('travail_tibial', 'Dorsiflexion résistée', { block: 'accessory', sets: 3, reps: '15 reps', rest: '30 s' }),
        ex('equilibre_yeux_fermes', 'Équilibre sur une jambe yeux fermés', { block: 'accessory', sets: 3, reps: '30 s / jambe', rest: '30 s', cue: 'Proprioception' }),
        ex('marche_arriere_colline', 'Marche en arrière en colline', { block: 'accessory', sets: 1, reps: '10 mn minimum', rest: 'Aucun — enchaînement direct', cue: 'Dehors de préférence' }),
        ex('fractionne_court', 'Sprint 10 s + Jogging 30 s + Marche 20 s', { sets: 8, reps: 'Cycle complet', rest: 'Aucun — enchaînement direct', technique: 'fractionné', intensity: 'ALL OUT sur le sprint' }),
        ex('etirements', 'Étirements légers', { block: 'recovery', reps: '5-10 mn', rest: 'Aucun — enchaînement direct' })
      ]
    },
    P2_J3: {
      title: 'UPPER — Focus épaules + Proprioception',
      type: 'entrainement', duration: '45-55 mn',
      equipment: ['Mur (handstand)'],
      goal: 'Force d\'épaules au poids du corps + proprioception + fractionné modéré.',
      challengeSlot: -1, // pas de slot dans le PDF — challenge inséré en tête par rotation (consigne p.8)
      exercises: [
        ex('echauffement_haut_du_corps', 'Échauffement dynamique haut du corps', { block: 'warmup', reps: '5-10 mn', rest: 'Aucun — enchaînement direct', cue: 'Rotations épaules' }),
        ex('pike_push_ups', 'Pike push-ups', { sets: 4, reps: '8-12 reps', rest: '1 mn' }),
        ex('handstand_hold', 'Handstand hold — poirier contre mur', { sets: 4, reps: '20-40 s', rest: '1 mn 30', technique: 'isométrie', cue: 'Pieds au mur' }),
        ex('pompes_hindou', 'Pompes hindou', { sets: 3, reps: '8-10 reps', rest: '1 mn', cue: 'Épaules dynamiques' }),
        ex('shoulder_taps_planche', 'Shoulder taps en planche', { block: 'accessory', sets: 3, reps: '20 reps (10/côté)', rest: '45 s' }),
        ex('shoulder_taps_planche', 'Planche avant-bras + touche épaule', { block: 'accessory', sets: 3, reps: '12 reps (6/côté)', rest: '45 s' }),
        ex('t_hold', 'T-hold — équilibre en T', { block: 'accessory', sets: 3, reps: '20-30 s / jambe', rest: '45 s' }),
        ex('fractionne_long', 'Fractionné : 1 mn (80%) + 1 mn marche', { sets: 8, reps: 'Cycle complet', rest: 'Aucun — enchaînement direct', technique: 'fractionné', cue: 'Allure soutenue' }),
        ex('rock_back_breathing', 'Rock Back breathing', { block: 'recovery', reps: '2-5 mn', rest: 'Aucun — enchaînement direct', cue: 'Récupération système nerveux' })
      ]
    },
    P2_J4: {
      title: 'LOWER — Cardio 35 mn',
      type: 'entrainement', duration: '45-55 mn',
      equipment: ['Aucun — extérieur de préférence'],
      goal: 'Capacité aérobie : 35 mn à allure conversationnelle (60% vitesse max).',
      exercises: [
        ex('echauffement_dynamique', 'Échauffement dynamique', { block: 'warmup', reps: '5-10 mn', rest: 'Aucun — enchaînement direct', cue: 'Montée en température' }),
        ex('course_a_pied', 'Course à pied — 60% vitesse max', { reps: '35 mn', rest: 'Aucun — enchaînement direct', cue: 'Allure conversationnelle' }),
        ex('etirements', 'Étirements légers', { block: 'recovery', reps: '5-10 mn', rest: 'Aucun — enchaînement direct' })
      ]
    },
    P2_J5: {
      title: 'UPPER — Focus épaules + Sprint haute intensité',
      type: 'entrainement', duration: '45-55 mn',
      equipment: ['Mur (handstand)', 'Couloir de sprint'],
      goal: 'Progression épaules vs Jour 3 + sprint fractionné 15/15 ALL OUT.',
      challengeSlot: -1,
      exercises: [
        ex('echauffement_haut_du_corps', 'Échauffement dynamique haut du corps', { block: 'warmup', reps: '5-10 mn', rest: 'Aucun — enchaînement direct', cue: 'Préparation sprint' }),
        ex('pike_push_ups', 'Pike push-ups', { sets: 4, reps: '10-15 reps', rest: '1 mn', cue: 'Progression vs Jour 3' }),
        ex('pseudo_planche_push_ups', 'Pseudo planche push-ups', { sets: 4, reps: '5-8 reps', rest: '1 mn 30', cue: 'Force épaules' }),
        ex('pompes_archer', 'Pompes archer', { sets: 3, reps: '6-8 reps / côté', rest: '1 mn', cue: 'Unilatéral' }),
        ex('handstand_progression', 'Handstand progression', { sets: 4, reps: '15-30 s', rest: '1 mn 30', technique: 'isométrie' }),
        ex('fractionne_court', 'Fractionné : 15 s sprint (100%) + 15 s repos', { sets: 8, reps: 'Cycle complet', rest: 'Aucun — enchaînement direct', technique: 'fractionné', intensity: 'ALL OUT' }),
        ex('rock_back_breathing', 'Rock Back breathing', { block: 'recovery', reps: '2-5 mn', rest: 'Aucun — enchaînement direct' })
      ]
    },
    P2_J6: {
      title: 'LOWER — Isométrique + Pied',
      type: 'entrainement', duration: '50-60 mn',
      equipment: ['Aucun matériel', 'Colline ou pente'],
      goal: 'Isométrie bas du corps en progression + travail du pied complet.',
      exercises: [
        ex('echauffement_dynamique', 'Échauffement dynamique', { block: 'warmup', reps: '5-10 mn', rest: 'Aucun — enchaînement direct', cue: 'Mobilité complète' }),
        ex('squat_isometrique', 'Squat isométrique (90°)', { sets: 4, reps: '30-60 s', rest: '1 mn', technique: 'isométrie', cue: 'Progresser le temps chaque semaine' }),
        ex('fente_isometrique', 'Fente isométrique', { sets: 3, reps: '30-45 s / jambe', rest: '1 mn', technique: 'isométrie' }),
        ex('single_leg_squat_hold', 'Single leg squat hold', { sets: 3, reps: '20-40 s / jambe', rest: '1 mn', technique: 'isométrie' }),
        ex('calf_raise_unipodal', 'Relevé de pointe unipodal', { block: 'accessory', sets: 3, reps: '15 reps / jambe', rest: '30 s' }),
        ex('marche_pointe_pieds', 'Marche sur pointe de pieds', { block: 'accessory', sets: 2, reps: '1 mn', rest: '30 s' }),
        ex('marche_talons', 'Marche sur les talons', { block: 'accessory', sets: 2, reps: '1 mn', rest: '30 s' }),
        ex('travail_tibial', 'Dorsiflexion résistée', { block: 'accessory', sets: 3, reps: '15 reps', rest: '30 s' }),
        ex('equilibre_yeux_fermes', 'Équilibre sur une jambe yeux fermés', { block: 'accessory', sets: 3, reps: '30 s / jambe', rest: '30 s' }),
        ex('toe_taps', 'Toe taps', { block: 'accessory', sets: 3, reps: '20 reps', rest: '30 s', cue: 'Coordination tibial' }),
        ex('marche_arriere_colline', 'Marche en arrière en colline', { block: 'accessory', sets: 1, reps: '10 mn minimum', rest: 'Aucun — enchaînement direct' }),
        ex('etirements', 'Étirements légers', { block: 'recovery', reps: '5-10 mn', rest: 'Aucun — enchaînement direct' })
      ]
    },

    // ═══ PHASE 3 — EXPLOSIVE MUSCLE ═══
    P3_TESTS: {
      title: 'Tests obligatoires avant de démarrer la phase',
      type: 'test', duration: '60-90 mn',
      equipment: ['Salle de sport (barre, rack, banc)', 'Mur + mètre'],
      goal: 'Mesurer tes 1RM pour calculer tes charges de travail de la phase. Sans ces chiffres, impossible de doser correctement.',
      exercises: [
        ex('echauffement_dynamique', 'Échauffement général + montée en charge progressive', { block: 'warmup', reps: '15 mn', rest: 'Aucun — enchaînement direct' }),
        ex('test_1rm_squat', 'Squat 1RM', { block: 'test', reps: 'Montée progressive vers le max', rest: '3-5 mn entre tentatives' }),
        ex('test_1rm_souleve', 'Soulevé de terre 1RM', { block: 'test', reps: 'Montée progressive vers le max', rest: '3-5 mn entre tentatives' }),
        ex('test_1rm_hip_thrust', 'Hip Thrust 1RM', { block: 'test', reps: 'Montée progressive vers le max', rest: '3-5 mn entre tentatives' }),
        ex('test_1rm_dc', 'Développé couché 1RM', { block: 'test', reps: 'Montée progressive vers le max', rest: '3-5 mn entre tentatives' }),
        ex('test_detente_verticale', 'Détente verticale', { block: 'test', sets: 3, reps: '3 essais — garde le meilleur', rest: 'Récupération complète' })
      ]
    },
    P3_J1: {
      title: 'Force pure + Pliométrie — dernière série à l\'échec',
      type: 'entrainement', duration: '75-90 mn',
      equipment: ['Salle de sport', 'Box pliométrique', 'Barre + rack'],
      goal: 'Force maximale bas du corps couplée à la pliométrie — la dernière série de chaque mouvement de force part à l\'échec.',
      pctRM: true,
      exercises: [
        ex('echauffement_dynamique', 'Échauffement général + mobilité', { block: 'warmup', reps: '10 mn', rest: 'Aucun — enchaînement direct', cue: 'Cardio léger + articulations' }),
        ex('activation_neuromusculaire', 'Activation neuromusculaire — Squats poids du corps', { block: 'warmup', sets: 2, reps: '10 reps', rest: '30 s' }),
        ex('box_jumps', 'Box jumps', { sets: 4, reps: '5 reps', rest: '2 mn', cue: 'Explosivité max — récupération complète' }),
        ex('depth_jumps', 'Depth jumps', { sets: 3, reps: '4 reps', rest: '2 mn 30', cue: 'Hauteur adaptée — réactivité au sol' }),
        ex('broad_jumps', 'Broad jumps', { sets: 3, reps: '5 reps', rest: '2 mn', cue: 'Distance maximale' }),
        ex('squat_barre', 'Squat à la barre', { sets: 4, reps: '6-8 reps', rest: '3 mn', cue: 'Dernière série → à l\'échec total' }),
        ex('souleve_de_terre', 'Soulevé de terre', { sets: 4, reps: '5-6 reps', rest: '3 mn', cue: 'Dernière série → à l\'échec' }),
        ex('fente_bulgare_pdc', 'A) Fentes bulgares', { block: 'accessory', sets: 3, reps: '8 reps / jambe', rest: 'Enchaîner avec B', technique: 'bi-set' }),
        ex('leg_curl', 'B) Leg curl', { block: 'accessory', sets: 3, reps: '10-12 reps', rest: '2 mn après B', technique: 'bi-set' }),
        ex('calf_raises_debout', 'Calf raises debout', { block: 'accessory', sets: 4, reps: '15-20 reps', rest: '1 mn', cue: 'Amplitude complète' }),
        ex('calf_raise_unipodal', 'Calf raises unipodal', { block: 'accessory', sets: 3, reps: '12 reps / jambe', rest: '1 mn' }),
        ex('etirements', 'Étirements — focus bas du corps', { block: 'recovery', reps: '10 mn', rest: 'Aucun — enchaînement direct' })
      ]
    },
    P3_J2: {
      title: 'Puissance haut du corps + Explosivité',
      type: 'entrainement', duration: '75-90 mn',
      equipment: ['Salle de sport', 'Medicine ball', 'Barre + haltères', 'Station tractions/dips'],
      goal: 'Puissance et force du haut du corps — du balistique vers le lourd.',
      pctRM: true,
      exercises: [
        ex('echauffement_haut_du_corps', 'Échauffement général + mobilité épaules', { block: 'warmup', reps: '10 mn', rest: 'Aucun — enchaînement direct', cue: 'Rotations, bandes élastiques' }),
        ex('pompes_pliometriques', 'Pompes claquées', { sets: 4, reps: '6 reps', rest: '2 mn', cue: 'Mains décollent du sol' }),
        ex('medicine_ball_slams', 'Medicine ball slams', { sets: 3, reps: '8 reps', rest: '1 mn 30', cue: 'Puissance' }),
        ex('pompes_pliometriques', 'Pompes pliométriques', { sets: 3, reps: '5 reps', rest: '2 mn' }),
        ex('developpe_couche', 'Développé couché', { sets: 4, reps: '6-8 reps', rest: '3 mn' }),
        ex('developpe_incline_halteres', 'Développé incliné haltères', { sets: 3, reps: '8-10 reps', rest: '2 mn 30' }),
        ex('tractions_lestees', 'A) Tractions lestées ou assistées', { sets: 4, reps: '6-8 reps', rest: 'Enchaîner avec B', technique: 'bi-set' }),
        ex('rowing_barre', 'B) Rowing barre', { sets: 4, reps: '8-10 reps', rest: '2 mn après B', technique: 'bi-set' }),
        ex('dips_lestes', 'A) Dips lestés', { block: 'accessory', sets: 3, reps: '8-10 reps', rest: 'Enchaîner avec B', technique: 'bi-set' }),
        ex('curl_biceps_halteres', 'B) Curl biceps haltères', { block: 'accessory', sets: 3, reps: '10-12 reps', rest: '1 mn 30 après B', technique: 'bi-set' }),
        ex('shoulder_taps_planche', 'Planche avec tap épaules', { block: 'accessory', sets: 3, reps: '20 reps', rest: '1 mn', cue: 'Hanches stables' }),
        ex('dead_bug', 'Dead bug explosif', { block: 'accessory', sets: 3, reps: '12 reps', rest: '1 mn' }),
        ex('etirements', 'Étirements haut du corps', { block: 'recovery', reps: '8 mn', rest: 'Aucun — enchaînement direct' })
      ]
    },
    P3_J3: {
      title: 'Explosivité bas du corps + Pliométrie',
      type: 'entrainement', duration: '75-90 mn',
      equipment: ['Salle de sport', 'Haies / box', 'Barre + haltères', 'Corde à sauter', 'Surface instable'],
      goal: 'Convertir la force en explosivité spécifique — pliométrie avancée + mouvements balistiques chargés.',
      pctRM: true,
      exercises: [
        ex('echauffement_dynamique', 'Échauffement dynamique', { block: 'warmup', reps: '10 mn', rest: 'Aucun — enchaînement direct', cue: 'Skipping, talons-fesses' }),
        ex('squats_sautes_legers', 'Squats sautés légers', { block: 'warmup', sets: 2, reps: '8 reps', rest: '1 mn', cue: 'Activation neuromusculaire' }),
        ex('hurdle_hops', 'Hurdle hops — sauts de haies', { sets: 4, reps: '6 reps', rest: '2 mn 30', cue: 'Hauteur progressive' }),
        ex('single_leg_box_jumps', 'Single leg box jumps', { sets: 3, reps: '4 reps / jambe', rest: '2 mn', cue: 'Unilatéral — soigne l\'atterrissage' }),
        ex('tuck_jumps', 'Tuck jumps', { sets: 3, reps: '6 reps', rest: '2 mn', cue: 'Genoux à la poitrine' }),
        ex('hip_thrust_charge', 'Hip Thrust', { sets: 4, reps: '8-10 reps', rest: '2 mn 30', cue: 'Charge lourde — glutes max' }),
        ex('squat_jump_charge', 'Squat jump avec charge', { sets: 4, reps: '5 reps', rest: '2 mn 30', intensity: '20-30% du 1RM squat' }),
        ex('power_clean', 'Power clean ou clean pull', { sets: 3, reps: '5 reps', rest: '3 mn', cue: 'Technique + puissance' }),
        ex('step_ups_explosifs', 'A) Step-ups explosifs', { block: 'accessory', sets: 3, reps: '8 reps / jambe', rest: 'Enchaîner avec B', technique: 'bi-set' }),
        ex('goblet_squat', 'B) Goblet squat', { block: 'accessory', sets: 3, reps: '12 reps', rest: '2 mn après B', technique: 'bi-set', cue: 'Tempo contrôlé' }),
        ex('sauts_a_la_corde', 'Sauts à la corde', { block: 'accessory', sets: 3, reps: '1 mn', rest: '1 mn' }),
        ex('equilibre_unipodal_instable', 'Équilibre unipodal — surface instable', { block: 'accessory', sets: 3, reps: '30 s / jambe', rest: '45 s', cue: 'Yeux ouverts puis fermés' }),
        ex('etirements', 'Étirements + foam rolling', { block: 'recovery', reps: '10 mn', rest: 'Aucun — enchaînement direct' })
      ]
    },
    P3_J4: {
      title: 'Force complète + Conditionnement',
      type: 'entrainement', duration: '80-95 mn',
      equipment: ['Salle de sport', 'Barre + haltères + machines', 'Battle ropes'],
      goal: 'Force complète corps entier + finisher métabolique.',
      pctRM: true,
      exercises: [
        ex('echauffement_dynamique', 'Échauffement général corps complet', { block: 'warmup', reps: '10 mn', rest: 'Aucun — enchaînement direct' }),
        ex('front_squat', 'Front squat', { sets: 4, reps: '6-8 reps', rest: '3 mn' }),
        ex('romanian_deadlift', 'Romanian deadlift', { sets: 4, reps: '8 reps', rest: '2 mn 30', cue: 'Focus ischio-jambiers' }),
        ex('leg_press', 'A) Leg press', { block: 'accessory', sets: 3, reps: '10-12 reps', rest: 'Enchaîner avec B', technique: 'bi-set' }),
        ex('leg_extension', 'B) Leg extension', { block: 'accessory', sets: 3, reps: '12-15 reps', rest: '2 mn après B', technique: 'bi-set' }),
        ex('developpe_militaire', 'Développé militaire', { sets: 4, reps: '6-8 reps', rest: '2 mn 30' }),
        ex('rowing_halteres', 'Rowing haltères', { sets: 4, reps: '8-10 reps', rest: '2 mn' }),
        ex('elevations_laterales', 'A) Élévations latérales', { block: 'accessory', sets: 3, reps: '12 reps', rest: 'Enchaîner avec B', technique: 'bi-set' }),
        ex('face_pulls', 'B) Face pulls', { block: 'accessory', sets: 3, reps: '15 reps', rest: '1 mn 30 après B', technique: 'bi-set' }),
        ex('pallof_press', 'Pallof press', { block: 'accessory', sets: 3, reps: '10 reps / côté', rest: '1 mn', cue: 'Anti-rotation' }),
        ex('russian_twists', 'Russian twists', { block: 'accessory', sets: 3, reps: '20 reps totales', rest: '1 mn', cue: 'Avec charge' }),
        ex('planche_laterale', 'Planche latérale', { block: 'accessory', sets: 2, reps: '30-45 s / côté', rest: '1 mn' }),
        ex('burpees', 'Burpees', { sets: 3, reps: '10 reps', rest: '1 mn 30' }),
        ex('battle_ropes', 'Battle ropes', { sets: 3, reps: '30 s', rest: '1 mn', intensity: 'Intensité max' }),
        ex('retour_au_calme', 'Retour au calme', { block: 'recovery', reps: '5 mn', rest: 'Aucun — enchaînement direct' }),
        ex('etirements', 'Étirements complets', { block: 'recovery', reps: '10 mn', rest: 'Aucun — enchaînement direct' })
      ]
    },
    P3_RETEST: {
      title: 'Retest final — mesure tes gains',
      type: 'test', duration: '60-90 mn',
      equipment: ['Salle de sport', 'Mur + mètre'],
      goal: 'Comparer avec les tests du début de phase : détente verticale + 1RM. C\'est ici que tu mesures les +5-10 cm.',
      exercises: [
        ex('echauffement_dynamique', 'Échauffement général + montée en charge progressive', { block: 'warmup', reps: '15 mn', rest: 'Aucun — enchaînement direct' }),
        ex('test_detente_verticale', 'Détente verticale', { block: 'test', sets: 3, reps: '3 essais — garde le meilleur', rest: 'Récupération complète' }),
        ex('test_1rm_squat', 'Squat 1RM', { block: 'test', reps: 'Montée progressive vers le max', rest: '3-5 mn entre tentatives' }),
        ex('test_1rm_souleve', 'Soulevé de terre 1RM', { block: 'test', reps: 'Montée progressive vers le max', rest: '3-5 mn entre tentatives' }),
        ex('test_1rm_hip_thrust', 'Hip Thrust 1RM', { block: 'test', reps: 'Montée progressive vers le max', rest: '3-5 mn entre tentatives' }),
        ex('test_1rm_dc', 'Développé couché 1RM', { block: 'test', reps: 'Montée progressive vers le max', rest: '3-5 mn entre tentatives' })
      ]
    }
  };

  // ──────────────────────────────────────────────────────────────────────────
  // 3. RÈGLES DE PROGRESSION (transcrites des PDF)
  // ──────────────────────────────────────────────────────────────────────────

  // P1 : nombre de séries des exos "Var.*" selon la semaine (PDF p.2)
  var P1_WEEK_SETS = { 1: 5, 2: 4, 3: 3 };
  var P1_WEEK_FOCUS = {
    1: 'Apprentissage des mouvements — qualité avant tout (5 séries)',
    2: 'Consolidation — légère réduction du volume (4 séries)',
    3: 'Affûtage — intensité maximale sur chaque répétition (3 séries)',
    4: 'Transmission Force + Test de détente verticale'
  };

  // P2 : focus par semaine (PDF p.7-8). Le contenu des jours est identique,
  // l'intention évolue.
  var P2_WEEK_FOCUS = {
    1: 'Adaptation — maîtriser les exercices et le volume',
    2: 'Intensification — réduire les temps de repos',
    3: 'Surcharge — volume maximal',
    4: 'Surcharge — repousser les limites',
    5: 'Maintien de l\'intensité — nouveaux records aux challenges',
    6: 'Affûtage — réduction légère du volume, maintien intensité'
  };
  // Rotation des challenges (PDF p.8) : "tous les 2 jours (Jour 1/3/5...)
  // en rotation". Cycle de 3 appliqué aux jours UPPER successifs.
  var P2_CHALLENGES = [
    ex('bring_sally_up', 'Challenge — Bring Sally Up (pompes)', { sets: 1, reps: "Suivre la chanson 'Flower' de Moby", rest: 'Aucun — enchaînement direct', technique: 'challenge', cue: 'Note ton score' }),
    ex('pompes_max', 'Challenge — Pompes max en 2 mn', { sets: 1, reps: 'Max reps en 2 mn', rest: 'Aucun — enchaînement direct', technique: 'challenge', cue: 'Note ton score' }),
    ex('burpees', 'Challenge — Burpees max en 3 mn', { sets: 1, reps: 'Max reps en 3 mn', rest: 'Aucun — enchaînement direct', technique: 'challenge', cue: 'Note ton score' })
  ];

  // P3 : intensité (%1RM) par bloc de 2 semaines (PDF p.12)
  var P3_WEEK_INTENSITY = {
    1: '70-75% 1RM — Adaptation technique + volume',
    2: '70-75% 1RM — Adaptation technique + volume',
    3: '75-85% 1RM — Intensification',
    4: '75-85% 1RM — Intensification',
    5: '80-90% 1RM — Surcharge maximale',
    6: '80-90% 1RM — Surcharge maximale',
    7: 'Affûtage — Réduction volume -20-30%',
    8: 'Affûtage — Réduction volume -20-30% + Retest final'
  };

  // Clone profond simple (les objets exos sont de la data pure)
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  // Construit une session à partir d'un template + contexte semaine
  function buildSession(phaseKey, weekNum, sessNum, tplKey, opts) {
    var tpl = EA_DAY_TEMPLATES[tplKey];
    var o = opts || {};
    var exos = clone(tpl.exercises);

    // P1 : remplace les séries 'VAR' par la valeur de la semaine
    if (o.varSets != null) {
      exos.forEach(function (e) { if (e.sets === VAR) e.sets = o.varSets; });
    }
    // P2 : remplace/insère le challenge en rotation
    if (o.challenge) {
      var c = clone(o.challenge);
      if (tpl.challengeSlot >= 0) exos[tpl.challengeSlot] = c;
      else exos.splice(1, 0, c); // après l'échauffement
    }
    // P3 : applique l'intensité de la semaine aux mouvements chargés
    if (o.weekIntensity && tpl.pctRM) {
      exos.forEach(function (e) {
        if (e.category === 'Force — Avec charges' && !e.intensity) e.intensity = o.weekIntensity;
      });
    }

    var equipment = clone(tpl.equipment);
    return {
      sessionId: 'EA-' + phaseKey + '-W' + weekNum + '-S' + sessNum,
      sessionNumber: sessNum,
      sessionTitle: o.title || tpl.title,
      sessionGoal: o.goal || tpl.goal,
      sessionType: tpl.type,                          // entrainement / test
      estimatedDuration: tpl.duration,
      requiredEquipment: equipment,
      exercises: exos
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 4. BUILD — expansion déterministe des 18 semaines
  // ──────────────────────────────────────────────────────────────────────────
  function buildEliteAthleteProgram() {
    var phases = [];
    var globalWeek = 0;

    // ═══ PHASE 1 — Fondation Athlétique (4 semaines, 4 j/sem) ═══
    var p1weeks = [];
    for (var w1 = 1; w1 <= 4; w1++) {
      globalWeek++;
      var sessions1 = [];
      if (w1 <= 3) {
        var vs = P1_WEEK_SETS[w1];
        sessions1 = [
          buildSession('P1', w1, 1, 'P1_J1', { varSets: vs }),
          buildSession('P1', w1, 2, 'P1_J2', { varSets: vs }),
          buildSession('P1', w1, 3, 'P1_J3', { varSets: vs }),
          buildSession('P1', w1, 4, 'P1_J4', { varSets: vs })
        ];
      } else {
        // Semaine 4 — protocole spécial (PDF p.3)
        sessions1 = [
          buildSession('P1', w1, 1, 'P1_TRANSMISSION', {}),
          buildSession('P1', w1, 2, 'P1_TRANSMISSION', { title: 'Transmission de force — 2e passage' }),
          buildSession('P1', w1, 3, 'P1_TEST', {})
        ];
      }
      p1weeks.push({
        weekId: 'EA-P1-W' + w1,
        weekNumber: w1,
        globalWeekNumber: globalWeek,
        weekFocus: P1_WEEK_FOCUS[w1],
        sessions: sessions1
      });
    }
    phases.push({
      phaseId: 'EA-P1',
      phaseName: 'Fondation Athlétique',
      pdfName: 'Vertical Test', // nom dans le PDF — NE PAS afficher
      phaseGoal: 'Développer la coordination neuromusculaire, la mobilité articulaire et les premières bases d\'explosivité. Tu poses les fondations sur lesquelles reposera tout le reste du programme.',
      durationWeeks: 4,
      frequency: '4 jours / semaine (Lun · Mer · Ven · Sam)',
      location: 'Extérieur / Sans salle — poids du corps exclusif',
      expectedResults: '+3-5 cm de détente | Meilleure coordination neuromusculaire | Bases d\'explosivité solides',
      testProtocol: 'SET (Super Explosif Test)',
      weeks: p1weeks
    });

    // ═══ PHASE 2 — Detox Turbo (6 semaines, 6 j/sem) ═══
    var p2weeks = [];
    var challengeIdx = 0;
    for (var w2 = 1; w2 <= 6; w2++) {
      globalWeek++;
      var sessions2 = [];
      var dayTpls = ['P2_J1', 'P2_J2', 'P2_J3', 'P2_J4', 'P2_J5', 'P2_J6'];
      for (var d = 0; d < 6; d++) {
        var tplKey = dayTpls[d];
        var opts2 = {};
        // Jours UPPER (J1/J3/J5 = index 0/2/4) → challenge en rotation
        if (d === 0 || d === 2 || d === 4) {
          opts2.challenge = P2_CHALLENGES[challengeIdx % 3];
          challengeIdx++;
        }
        sessions2.push(buildSession('P2', w2, d + 1, tplKey, opts2));
      }
      p2weeks.push({
        weekId: 'EA-P2-W' + w2,
        weekNumber: w2,
        globalWeekNumber: globalWeek,
        weekFocus: P2_WEEK_FOCUS[w2],
        sessions: sessions2
      });
    }
    phases.push({
      phaseId: 'EA-P2',
      phaseName: 'Detox Turbo',
      pdfName: 'Detox Turbo',
      phaseGoal: 'Améliorer le conditionnement physique général, renforcer la structure isométrique du corps et développer la capacité cardiovasculaire tout en maintenant l\'explosivité. La nutrition représente 70-80% des résultats sur cette phase.',
      durationWeeks: 6,
      frequency: '6 jours / semaine (repos le dimanche)',
      location: 'Sans matériel | Max 1 h / séance',
      expectedResults: 'Conditionnement physique supérieur | Structure isométrique renforcée | Capacité cardio développée',
      testProtocol: 'SET (Super Explosif Test)',
      weeks: p2weeks
    });

    // ═══ PHASE 3 — Explosive Muscle (8 semaines, 4 j/sem) ═══
    var p3weeks = [];
    for (var w3 = 1; w3 <= 8; w3++) {
      globalWeek++;
      var sessions3 = [];
      var intensity = P3_WEEK_INTENSITY[w3];
      // Tests pré-phase : session 0 en semaine 1
      if (w3 === 1) {
        sessions3.push(buildSession('P3', w3, 0, 'P3_TESTS', {}));
      }
      sessions3.push(buildSession('P3', w3, 1, 'P3_J1', { weekIntensity: intensity }));
      sessions3.push(buildSession('P3', w3, 2, 'P3_J2', { weekIntensity: intensity }));
      sessions3.push(buildSession('P3', w3, 3, 'P3_J3', { weekIntensity: intensity }));
      sessions3.push(buildSession('P3', w3, 4, 'P3_J4', { weekIntensity: intensity }));
      // Retest final en semaine 8
      if (w3 === 8) {
        sessions3.push(buildSession('P3', w3, 5, 'P3_RETEST', {}));
      }
      p3weeks.push({
        weekId: 'EA-P3-W' + w3,
        weekNumber: w3,
        globalWeekNumber: globalWeek,
        weekFocus: P3_WEEK_INTENSITY[w3],
        sessions: sessions3
      });
    }
    phases.push({
      phaseId: 'EA-P3',
      phaseName: 'Explosive Muscle',
      pdfName: 'Explosive Muscle',
      phaseGoal: 'Transformer la base construite en phases 1 et 2 en puissance explosive pure. Tu travailles avec des charges lourdes pour maximiser ta détente verticale. C\'est la phase où les gains les plus importants se produisent.',
      durationWeeks: 8,
      frequency: '4 jours / semaine (Lun · Mer · Ven · Sam)',
      location: 'Salle de sport obligatoire',
      expectedResults: '+5-10 cm de détente | Force +10-15% | Explosivité athlétique complète',
      testProtocol: 'SAT (Super Athlétique Test)',
      weeks: p3weeks
    });

    return {
      programId: 'eliteAthlete',
      programName: 'Elite Athlète',
      programGoal: 'Développer un profil athlétique complet : détente verticale, vitesse, agilité et développement physique. Du grand débutant à l\'athlète avancé — la difficulté s\'ajuste par les 6 variables d\'entraînement.',
      sourceVersion: 'EA_SOT_V1', // source of truth version
      bookReference: 'Les Secrets de la Détente Verticale — Alassane Dia',
      methodology: 'Upper/Lower split — augmente la charge hebdomadaire sans fatigue nerveuse excessive, permet un entraînement très fréquent en basculant les qualités sollicitées.',
      sixVariables: ['Exécution', 'Intensité', 'Charge', 'Repos', 'Répétitions', 'Technique'],
      totalWeeks: 18,
      totalPhases: 3,
      phases: phases
    };
  }

  var program = buildEliteAthleteProgram();

  return {
    program: program,
    masterExercises: EA_MASTER_EXERCISES,
    dayTemplates: EA_DAY_TEMPLATES,
    build: buildEliteAthleteProgram
  };
});
