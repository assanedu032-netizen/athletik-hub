# Elite Athlète — Validation de la source de vérité (EA_SOT_V1)

> Fichier : `data/elite-athlete-program.js` · Vérification : `node scripts/verify-ea-program.js --table`
> **Statut : EN ATTENTE DE VALIDATION PAR ALASSANE — non intégré dans l'app.**

## Résumé

| Métrique | Valeur |
|---|---|
| Phases | 3 — Fondation Athlétique (4 sem) · Detox Turbo (6 sem) · Explosive Muscle (8 sem) |
| Semaines totales | **18** (livre : 16-20 ✓) |
| Sessions totales | **85** (P1: 15 · P2: 36 · P3: 34 dont 2 sessions de tests) |
| Instances d'exercices | 902 |
| Exercices uniques | **93** |
| Avec vidéo disponible | **12** (depth jumps, sprint, box jumps, squat barre, soulevé de terre, développé couché, hip thrust, power clean + les 4 tests 1RM) |
| Sans vidéo (placeholder "Vidéo bientôt disponible") | **81** |
| Hors librairie maître Excel | **1** (`pompes_max` — challenge "Pompes max 2 mn", absent de l'Excel) |
| Problèmes structurels détectés | **0** (continuité W1→W18 OK, aucun ID en doublon, aucun champ manquant) |

## Structure des données

- `EA_MASTER_EXERCISES` — 93 exercices, `exerciseId` = slug stable lié au nom canonique Excel, catégorie Excel, `videoUrl` quand existante dans la librairie du code, `pdfAliases` pour tracer les noms du PDF.
- `EA_DAY_TEMPLATES` — les 13 journées-types transcrites mot à mot du PDF séances (c'est CETTE partie à relire pour valider).
- `buildEliteAthleteProgram()` — expansion déterministe (zéro IA, zéro aléatoire) en 18 semaines selon les règles documentées :
  - **P1** : séries `Var.*` = 5 (S1) → 4 (S2) → 3 (S3). Semaine 4 = 2× Transmission Force + Test détente (PDF p.3).
  - **P2** : 6 jours identiques/semaine, focus hebdo évolutif, **challenges en rotation** sur les jours UPPER (Bring Sally Up → Pompes max 2 mn → Burpees max 3 mn).
  - **P3** : %1RM appliqué aux mouvements chargés par bloc de 2 semaines (70-75 → 75-85 → 80-90 → affûtage). Session 0 = tests 1RM obligatoires (W1), session 5 = retest final (W8).

## Incohérences trouvées dans les documents (à arbitrer)

1. **Nom Phase 1** — PDF : "Vertical Test" / doc structure : "Fondation Athlétique (Verticale Test)". → **Résolu** comme demandé : nom officiel `Fondation Athlétique`, le nom PDF est conservé en champ `pdfName` (jamais affiché).
2. **Durée P1** — doc structure : "4 semaines profil avancé / 6 semaines non initié" ; PDF séances : 4 semaines fixes. → **Choisi : 4 semaines** (PDF prime pour le déroulé). L'extension à 6 semaines pourra être une variable d'individualisation Titan (répéter S1-S2).
3. **Thèmes P1 divergents** — doc structure décrit 4 thèmes ("Vitesse multidirectionnelle + Puissance rotation…") qui ne correspondent PAS aux 4 jours du PDF séances ("Pliométrie extensive + Mobilité…"). → **Choisi : les jours du PDF** (seule source avec exercices détaillés). À confirmer par Alassane.
4. **P1 semaine 4 "Jour 5"** — le PDF dit "Jour 1 et Jour 3 = Transmission Force, Jour 5 = Test" alors que la semaine type n'a que 4 jours d'entraînement. → Interprété comme 3 sessions (2 transmissions + 1 test en fin de semaine).
5. **Challenges P2 jours 3/5** — la consigne p.8 ("challenges tous les 2 jours en rotation J1/3/5") n'apparaît pas dans le détail des jours 3 et 5 du PDF. → Le challenge est INSÉRÉ en tête des séances J3/J5 par le builder, en rotation continue. À confirmer.
6. **"Pompes claquées" vs "Pompes pliométriques"** — 2 lignes distinctes dans P3-J2 du PDF (#2 : 4×6, #4 : 3×5) mais regroupées dans l'Excel sous un seul canonique. → Les 2 instances sont conservées (fidélité PDF), liées au même `exerciseId`.
7. **Challenge "Pompes max 2 mn"** — cité p.8 du PDF mais absent de la liste maître Excel. → Créé avec `notInMaster: true`, à ajouter à l'Excel.
8. **Tests par phase** — doc structure : SET pour P1-P2, SAT pour P3 ✓ cohérent avec `PROGRAM_TESTS` du code (eliteAthlete = SAT+SET).
9. **Repos en tirets** — tous les "–" du PDF sont normalisés en "Aucun — enchaînement direct" (directive §6 du doc structure).
10. **`coachingCue`** = uniquement les notes réellement présentes dans le PDF. **`commonMistake` = null partout** — non inventé ; à remplir depuis le livre dans une passe dédiée si souhaité.

## Et maintenant ?

1. **Alassane relit les 13 journées-types** dans `data/elite-athlete-program.js` (section `EA_DAY_TEMPLATES`) — c'est la seule partie écrite à la main, le reste est dérivé.
2. Arbitrer les incohérences 2, 3, 5 ci-dessus.
3. Une fois validé → Prompt 2 (intégration app).
