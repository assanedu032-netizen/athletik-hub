# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Athletik Hub is a French-language PWA for athletic training, built as a **single-file vanilla HTML/CSS/JS monolith** in `index.html` (~15K lines, ~850KB). There is no build step, no framework, no package manager. Edit the file, commit, push, deploy.

`athletik_hub_modular/` is a separate modular variant (split css/js folders) — **not the active codebase**. All work happens in the root `index.html`.

The app is the digital companion of the book *Les Secrets de la Détente Verticale* (Alassane Dia). Buyers of the book get an access code to unlock the app.

## Deploying / serving

- **Hosting**: Netlify (`netlify.toml` SPA-rewrites everything to `/index.html`). No build command; the file is served as-is. Production URL: `athletikhub.netlify.app`.
- **PWA**: two Service Workers —
  - `sw.js` (cache-first for local assets, network-first for externals) + `manifest.json`. Cache name is `athletik-v258` — bump it when shipping CSS/HTML that must invalidate.
  - `firebase-messaging-sw.js` (root) — receives background push notifications (FCM).
- **No linter, no build**. Validate changes by opening `index.html` in a browser (mobile-first, Android Chrome is the target). Before committing, sanity-check JS syntax by parsing the non-module `<script>` blocks with `node -e` (see Coding conventions).
- **Tests**: `for f in scripts/test-*.js; do node "$f"; done` — 14 suites, ~480 assertions, pure
  Node, zéro dépendance : chaque suite extrait les **vraies** fonctions d'`index.html` par
  équilibrage d'accolades et les rejoue contre des mocks. `scripts/test-live-layout.js` est la
  seule exception : elle ouvre un vrai Chromium (Playwright, hors `package.json`) pour mesurer la
  mise en page de l'écran séance en 375×667. Un test doit échouer sur le commit précédent — sinon
  il ne prouve rien.
- The previous-turn summary often contains the user's outstanding tasks — read it before starting new work.

### Netlify environment variables (required)

Set in Netlify → Site config → Environment variables. None of these belong in code.

- `ANTHROPIC_API_KEY` — Titan AI proxy (`netlify/functions/titan.js`)
- `ACCESS_CODE_SECRET` — HMAC secret for post-book access codes (`check-code.js`, `gen-codes.js`)
- `FIREBASE_VAPID_KEY` — Web Push certificate, served to the client by `notif-config.js`
- `FIREBASE_SERVICE_ACCOUNT` — full Service Account JSON, used by `send-notif.js` (FCM v1)
- `SECRETS_SCAN_SMART_DETECTION_ENABLED=false` — required to unblock the build. Netlify's
  scanner flags the Firebase Web API key (`AIzaSy…`) as a secret, but it is **public by design**
  (security relies on Firestore rules + Auth + authorized domains).

## Architecture mental model

Two parallel UI systems live in the same file and must not conflict:

1. **`.scr` screens** — full-page screens used by the onboarding/auth/profile flow (`welcome`, `titanIntro`, `obQ1`, `qSATIntro`, `qNutri`, `profil1`–`profil4plan`, `auth`, `thinking`, etc.). Navigated with `go(id)`.
2. **`.view` tab views** — the main app tabs after onboarding (`vHome`, `vTracks`, `vChat`, `vTrain`, `vMoi`, `vNutri`). Navigated with `switchTab(tab)`. Inside `vTrain`, sub-pages (`pgLib`, `pgProg`, `pgBuilder`) toggle via `showPg(id)`.

**Critical pitfall — the inline-display bug**: `discoveryGoTo()` (and a few onboarding finalizers) set `element.style.display = 'none'` inline on every `.scr` and `.view`. Any later code that only toggles a CSS class (`.on`) will lose to the inline style and render a blank screen. The fix everywhere is to explicitly reset `el.style.display = ''` before adding `.on`. `go()`, `switchTab()`, `obFinish()`, and `discoveryReturnToHome()` already do this — preserve that when editing those functions, and apply the same pattern in any new navigation code.

## Onboarding flow

`welcome → titanIntro → obQ1 (objectif) → Home (discovery mode)`. The discovery banner on Home
then drives the rest: `profil1` (identity + sit/cont/mat → `obCalcProg`), `profil3` (physical
tests), `profil4` (nutrition). `programKey` is assigned **only** inside `obCalcProg()` after the
4 Tally answers. Steps `profil3`/`profil4` are locked until `profil1` is done.

## State & persistence

All user state is in `localStorage` under `ah_*` keys. When the user is logged in (`window.fbUser` set; `window.fb` exposes `doc/setDoc/getDoc/db`), a subset of keys syncs to Firestore `users/{uid}`.

**`FB_SYNC_KEYS`** is the single source of truth for what syncs. Helpers `_fbCollectPayload()` /
`_fbApplyPayload()` serialize/restore — add a key in `FB_SYNC_KEYS` and both directions update.
Synced keys: `ah_profile`, `ah_nutri_journal`, `ah_set_history`, `ah_badges_earned`,
`ah_builder_session`, `ah_recipe_favorites`, `ah_shopping_checks`, `ah_shopping_meal_plan`,
`ah_shopping_meal_plan_checks`, `ah_sat_inprogress`, `ah_live_session`, `ah_active_habits`,
`ah_access_data` (+ `ah_access_tier` as string).

Device-local only (NOT synced): `ah_theme`, `ah_ob_inprogress`, `ah_onboarding_done`,
`ah_discovery_mode`, `ah_notif_on`, backups (`ah_before_*`, `ah_last_backup`).

`ah_profile` is the main user object. Key fields: `prenom, age, sexe, programKey, program,
objectif, sit/cont/mat, satDone, athScore, vertJump, satSprintTime, satSprintDist, satTTest,
satForce1RM, poids, taille, nutriObj, streak, level, trialStartedAt, programsDone,
completedPrograms, fcmToken, accessTier`.

`fbSaveProfile()` writes the full payload; `fbSignOut()` syncs once before `localStorage.clear()`.

## Domain logic to know about

- **Programme attribution**: `calcProgramFromTallyAnswers(objectif, sit, cont, mat)` replicates the Tally form Pd5KB5 scoring. `programKey` is **only set after `obCalcProg()`** runs (post sit/cont/mat) — until then the home séance card shows "À DÉTERMINER" (see `renderUserData()`).
- **PROGRAMS_V2**: holds the rich data (phases → weekDays → sessions → exos) for **all 6 programmes** — `vd` (Vertical Dunk), `ea` (Elite Athlète), `se` (Shred Explose), `tri` (Triphasique), `mt` (Microtraining), `ep` (Explose+). All complete, no stubs. `renderProgramV2(key)` renders the V2 UI; `openProg(k)` enforces the lock (a user can only open their attributed programme).
- **Premium access system (3 voies)** — gated par `hasValidAccess()` qui retourne `true` si :
  1. `ah_profile.hasBookAccess === true` (validé serveur, **source de vérité = Firestore users/{uid}.hasBookAccess**)
  2. Tier BETA/VIP/MASTER actif (code spécial)
  3. Trial 3 jours encore actif
  - **Bootstrap au sign-in** : `onFirebaseAuthChange` appelle `_bootstrapAccessFromServer(fbUser)` → POST `/.netlify/functions/init-user` qui crée/synchronise `users/{uid}.{createdAt, trialStartedAt, trialEndsAt, trialStatus, hasBookAccess, accessMethod}` (serverTimestamps verrouillés par Firestore Rules). Le client cache le résultat dans `ah_profile` pour les vérifs offline.
  - **Trial 3 jours** : `getTrialInfo()` retourne `{started, endsAt, elapsed, remaining, active}`. Lit `trialEndsAt` du profil (= valeur Firestore) en priorité, fallback `trialStartedAt + TRIAL_MS`. Si `hasBookAccess=true` → `{active:true, remaining:Infinity, converted:true}`.
  - **Popup premium expiré** : `_showAccessRequired()` ouvre `#premiumOverlay` (carte navy/gold, 5 bénéfices, 3 CTA : Activer / Acheter / J'ai un code). Plus de toast/redirection legacy. Gates : `launchTodaySession`, `startSessionGuarded`, `switchTab('chat')`.
  - **Bannière trial** (Home `#trialBanner`) : cachée si `hasBookAccess`, discrète ambre/or si `remaining > 24h`, urgente orange si `< 24h`, bloquante rouge si expirée. CTA principal → `openBookActivation()`.
- **Activation post-livre (Amazon order + question)** : wizard 2 étapes `#bookActivationModal`. POST `/.netlify/functions/book-challenge` action='start' → question aléatoire + sessionId HMAC stateless. POST action='verify' → réponse normalisée + numéro Amazon hashé (Netlify Blobs, used-once). Sur succès Firestore `users/{uid}.hasBookAccess=true, accessMethod='amazon_order_book_question'`. **Frontend ne reçoit jamais la réponse**. Banque de questions stable : `data/book-challenges.js` (`LDV_V1_STABLE_INTRO`, 17 questions des pages Préface / Avant-Propos / Comment je me suis formé / Pourquoi la détente verticale ? / Ma façon de faire). Régénérée via `scripts/gen-book-challenges.js` depuis `bookChallengesSeed.json` (gitignored).
- **Access codes (post-book)** : `ACCESS_TIER_META` (client, BETA/VIP/MASTER metadata). Validation serveur via `check-code.js` — HMAC-signés (`LETTER-RANDOM6-CHECK4`) + 3 codes legacy fixes. Generate codes : `scripts/gen-codes.js`.
- **Firestore Rules** : `firestore.rules` interdit toute écriture client sur `hasBookAccess`, `accessMethod`, `bookAccessVerifiedAt`, `trialStartedAt`, `trialEndsAt`, `trialStatus`, `createdAt`, `bookVersionUsed` (helpers `lockedFields()` + `noLockedDiff()` + `noLockedOnCreate()`). Collections `accessRedemptions`, `bookChallenges`, `accessCodes`, `usedAmazonOrders`, `activationAttempts`, `security_logs` : `read/write: false` (serveur Admin SDK uniquement).
- **Tests SAT/SET/PDC**: the test type depends on the programme. `PROGRAM_TESTS` maps each programme to its test ids. `getTestTypeLabel(progKey?)` returns `{short, long, icon, desc}` (SAT for vd/ea/ep, SET for se, PDC for mt/tri) — used for dynamic labels. `getActiveSatExercices()` filters the legacy `satExercices` array (Tracks tab) by `programKey`.
- **Live session** (refonte 2026-08): `launchSession(exos, sessName, progName, progKey, sessKey)` opens
  `#liveSession`. State in `window._LS`. Persisted to `ah_live_session` (24h TTL) — Home shows a
  "Reprendre" banner via `renderResumeSessionBanner()`.
  - **Layout, non négociable**: `#liveSession` = header + barre de progression + `#lsBody`.
    `#lsBody` a **4 enfants directs** : `#lsStage` (zone qui se comprime, `min-height:0`),
    `#lsRestOverlay` (état repos plein écran), `#lsFooter` (tirets + barre d'action, `flex-shrink:0`)
    et `#lsComplete`. `_lsFinalizeSession()` masque tous les enfants sauf `#lsComplete` et
    `_lsClose()` les restaure — **ne jamais imbriquer ces 4 blocs**, ça casserait la fin de séance.
  - **Tokens `--lv-*` scopés à `#liveSession`** — fond navy `#14213D` (**canal B − canal R ≥ 35 :
    le fond doit se lire comme bleu, jamais comme noir**), surfaces `#1E2E52`, boutons
    secondaires `#27395F`, or `#D4A843`, repos `#4A9EDB`. L'écran n'utilise plus `--text` / `--gold` globaux : en thème
    light (le défaut) ils produisaient du texte quasi-noir sur le navy. **L'écran de fin de
    séance lit les mêmes tokens** — `.ls-celebrate-msg` / `.ls-nextstep-txt` étaient sur
    `--ah-text` / `--ah-text2` et rendaient invisibles les deux informations les plus
    importantes de l'écran. Le fond doit rester **navy, pas noir** : c'est l'identité de marque.
  - **Normalisation à la lecture, jamais de réécriture des données**. `PROGRAMS_V2` stocke
    `e(n, s, r, rest, note)` — 5 chaînes, aucun champ `metrique`. `_lsNormalizeExo(ex, idx, exos,
    circuitMap)` (fonction pure) en dérive le modèle d'affichage. Helpers : `_lsDetectMetrique`,
    `_lsParseValeur`, `_lsSeriesInfo`, `_lsResolveVarSeries`, `_lsCircuitMap`, `_lsComplexSteps`,
    `_lsHasCharge`.
  - **8 modes** rendus par `_lsRenderMode(vm)` dans `#lsMode` : `duree`, `duree_par_cote`, `echec`
    (chrono montant), `reps` / `reps_par_cote` (steppers REPS + RPE, colonne KG **seulement si**
    `_lsHasCharge`), `distance` (chrono manuel au centième), `bloc_libre`, `complexe`
    (sous-mouvements enchaînés), `intervalle` (cycles effort/récup), `validation` (bilans,
    pesées, jeûne). Le document de refonte n'en prévoyait que 5 ; les 3 derniers couvrent
    46 lignes réelles.
  - **Un seul tag possible**, et seulement si la technique change la manière d'exécuter la série
    (`LS_TAG_TECHNIQUES` = circuit / bi-set / superset / cluster). Isométrie, fractionné,
    stato-dynamique sont portés par le mode et la consigne : un tag de plus créait une
    hiérarchie visuelle sans contenu, visible sur 1 exercice sur 5.
  - **Une seule barre de progression** : les tirets du footer. La barre fine du header disait
    la même chose.
  - **`.ls-mode::before { max-height: 80px }`** plafonne l'écart entre le titre et la donnée
    principale ; `::after` absorbe le reste.
  - **Le bloc vidéo ne disparaît jamais.** Sans vidéo il devient un placeholder neutre
    (`.ls-video-empty`, « Démo à venir », non cliquable) de même hauteur — le layout ne saute
    pas d'un exercice à l'autre, et les exercices restant à filmer se repèrent en parcourant la
    séance. `.ls-ex-name` réserve 2 lignes et `.ls-ex-precision` 1 ligne pour la même raison.
  - **Un seul bouton** : `_lsPrimaryAction()` dispatche par mode, `_lsPrimaryLabel()` annonce
    exactement ce que le tap va faire. Chrono partagé : `_lsTimerStart/Stop/Toggle/Paint`.
  - **`Var.*`** est résolu par `_lsResolveVarSeries(progKey, phaseIdx, week)` depuis
    `phase.progression[].v` — **chaque programme a sa propre courbe** (TRI monte 2→5-6, VD/EA
    descendent 5→3). Quand la table ne porte pas de séries (EXPLOSE+ phase 1 = `PDC`, semaines
    Transmission Force = `—`), on n'affiche **aucun total** — jamais `Var.*`, jamais de valeur inventée.
  - **`rest: '-'` vaut 0 seconde** (= enchaîner). 232 lignes sur 710 sont concernées ; l'ancien
    `_lsParseRest` retournait 60 et imposait une récup que le livre ne prescrit pas.
  - **Circuits déduits** d'une suite d'exercices à `rest:'-'`, close par un vrai repos
    (`_lsCircuitMap`) — `PROGRAMS_V2` ne porte aucun marqueur d'enchaînement.
  - **Un seul chemin d'écriture des performances : `_lsQuickLog`**, au format exact de
    `saveTrack()` dans `ah_track_history` — charges (`method:'charge'`), temps tenus
    (`method:'duree'`, **plus long = mieux**), sprints (`method:'temps'`, plus court = mieux).
    Records, progression et contexte Titan en profitent sans code de lecture en plus.
    La saisie vit **dans** le mode reps, plus derrière un lien replié.
  - `_lsShowComplete()` → `_seFbOpen` / `_eaOpenFeedback` → `_lsFinalizeSession` →
    `_recordSessionCompletion` (80% des séances attendues → `programsDone++`).
  - **Tests** : `scripts/test-live-screen.js` (112, les 710 exercices normalisés),
    `scripts/test-live-log.js` (38, le chemin d'écriture jusqu'au prompt Titan) et
    `scripts/test-live-layout.js` (175, vrai Chromium en 375×667 et 320×568 : zéro scroll,
    contraste AA calculé, parcours complet, et les 10 acquis de la V1 rejoués un par un —
    Playwright n'est volontairement pas dans `package.json`, `npm i -D playwright --no-save`).
- **Workout Builder**: `pgBuilder` page (3e sous-onglet de `vTrain`, à côté de Programmes/Librairie). Locked until `programsDone >= 2` (`BUILDER_UNLOCK_PROGRAMS`) OR VIP/MASTER tier OR compte fondateur (`BUILDER_FOUNDER_EMAILS` / `_builderIsDev()`). `_builderCheckUnlock()`. **Piloté par Titan** : l'utilisateur exprime une intention (objectif/durée/matériel/état via chips + phrase libre/vocal `builderToggleMic`), `builderGenerate()` POST `/.netlify/functions/titan` avec `mode:'builder'` + la librairie compacte (`_builderLibraryPayload`) → Titan renvoie une séance **JSON structurée** (blocs échauffement→principal→secondaire→finisher→retour au calme) programmée selon la méthode Athletic Hub (`BUILDER_SYSTEM` côté serveur). `_builderReconcile()` rattache vidéos/catégories depuis `catData`. `builderStartGenerated()` lance via `launchSession` (marquée `_LS.builderMeta`). En fin de séance, `_lsShowComplete` injecte un panneau de ressenti (`_builderInjectFeedback`) et **sauvegarde dans Firestore `users/{uid}/builderSessions`** (cloud, pas localStorage) — `_builderSaveSession`/`_builderSaveFeedback`.
- **Progression**: `renderProgression()` fills `#progressionCard` in the Moi tab — current score, 8-week sessions bar graph, personal records. Helper `_progressionWeeklySessions(8)`.
- **Habits**: `activeHabits` array, persisted to `ah_active_habits` via `_persistActiveHabits()`. `checkHabit()` resets the streak on a day gap. `renderActiveHabits()` renders Home + Moi.
- **Exercise library**: `catData` is the flat exercise database (198 exercises). `_LIB_CAT_MAP` maps the chip filters to `catData` keys. Schema `{name, diff:'easy'|'med'|'hard', muscles, desc, mat, tag?, video?}`. Videos: per-exo `video` field OR `_LIB_VIDEO_MAP` lookup by name. The library has a "🎯 Mon programme" filter (`_libFlatExos('myprogram')`).
- **Titan AI**: `callAnthropicAPI()` builds `ctx` from `ah_profile` (not `window.user`) and POSTs to `/.netlify/functions/titan`. Foreground/background push handled by FCM. The same function has a **`mode:'builder'` branch** (`BUILDER_SYSTEM` + `buildBuilderUserMessage` + `parseWorkoutJson`) that returns `{ workout }` (JSON, `BUILDER_MAX_TOKENS`) for the Workout Builder, reusing the auth/quota/moderation layers.

## Backend — Netlify Functions (`netlify/functions/`)

- `titan.js` — Anthropic proxy. Hides the API key, rate limit 20/day/uid, prompt-injection guard, `buildSystemPrompt(ctx)` with athlete context.
- `check-code.js` — validates access codes (HMAC-signed + legacy), timing-safe compare.
- `init-user.js` — bootstrap users/{uid} (Admin SDK transaction). Crée `createdAt, trialStartedAt, trialEndsAt, trialStatus` avec serverTimestamps. Idempotent : appelé à chaque sign-in. Renvoie l'état d'accès calculé serveur.
- `book-challenge.js` — activation post-livre, 2 actions :
  - `{action:'start'}` → renvoie `{sessionId, questionText, section, expiresAt}`. `sessionId` = HMAC-signé stateless `(challengeId|expiresAt, ACCESS_CODE_SECRET)`.
  - `{action:'verify', sessionId, answer, amazonOrder}` → vérifie HMAC + non-expiration, normalise + match timing-safe contre `BOOK.challenges[*].accepted`, hashe le numéro Amazon (`@netlify/blobs` store `book-access`, used-once), écrit Firestore `users/{uid}.hasBookAccess=true` via Admin SDK. Logs `accessRedemptions/`.
  - Auth Bearer requise (Firebase ID token), rate limiting 5/IP/15min.
- `send-notif.js` — sends a push via **FCM v1 HTTP API**. Builds a JWT from the Service Account, exchanges it for an OAuth token (cached in-memory), POSTs to `messages:send`. The legacy Server Key was deprecated by Google (June 2024).
- `notif-config.js` — serves the public VAPID key to the client.
- `scripts/gen-codes.js` — local script to generate N access codes per tier (needs `ACCESS_CODE_SECRET`).
- `scripts/gen-book-challenges.js` — régénère `data/book-challenges.js` depuis le seed local. Mode `--hash` pour passer les `accepted` en `acceptedHash` HMAC en prod.

## Coding conventions in this file

- Vanilla ES5-ish: `var`, `function`, no arrow-function callbacks in older sections (newer code mixes both). Match the surrounding style.
- Many handlers are wired via inline `onclick="…"` — for any new JS function called from HTML, assign it to `window.<name>` so it's reachable when defined inside the script block.
- No template literals across multi-line HTML strings — strings are concatenated with `+=`. Stick to that pattern when extending render functions; it keeps diffs small.
- French is the product language (UI strings, comments). Keep new UI text in French.
- **Syntax check before commit**: parse the non-module `<script>` blocks, e.g.
  `node -e "..."` extracting `<script>` (excluding `type=module`) and running `new Function(body)`.
- **Branch**: active dev branch is `claude/continue-project-W12qw`. PRs #1–#4 merged; #5 open. Push only to the active branch unless told otherwise.

## État du projet (mai 2026)

- ✅ **Fait**: écran séance live refondu (8 modes, zéro scroll vérifié au navigateur),
  6 programmes complets, auth (email + Google + reset), onboarding scoring,
  trial 3 jours + gate, codes d'accès HMAC, Titan AI proxy, FCM push notifications,
  page Progression, sync Firestore étendue, Habits (sync + streak), Workout Builder verrouillé,
  library filtrée par programme, labels SAT/SET/PDC dynamiques, "Refaire le questionnaire".
- 🔧 **Config restante** (côté propriétaire, hors code): variables d'env Netlify, Firestore
  rules appliquées dans la console Firebase, Firebase authorized domains.
- ⏳ **Hors scope MVP**: vidéos d'exercices tournées (système prêt, liens à remplir),
  publication App Store / Play Store, "Titan-cerveau" (RAG / base de connaissances).
