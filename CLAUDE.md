# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Athletik Hub is a French-language PWA for athletic training, built as a **single-file vanilla HTML/CSS/JS monolith** in `index.html` (~15K lines, ~850KB). There is no build step, no framework, no package manager. Edit the file, commit, push, deploy.

`athletik_hub_modular/` is a separate modular variant (split css/js folders) — **not the active codebase**. All work happens in the root `index.html`.

The app is the digital companion of the book *Les Secrets de la Détente Verticale* (Alassane Dia). Buyers of the book get an access code to unlock the app.

## Deploying / serving

- **Hosting**: Netlify (`netlify.toml` SPA-rewrites everything to `/index.html`). No build command; the file is served as-is. Production URL: `athletikhub.netlify.app`.
- **PWA**: two Service Workers —
  - `sw.js` (cache-first for local assets, network-first for externals) + `manifest.json`. Cache name is `athletik-v2` — bump it when shipping CSS/HTML that must invalidate.
  - `firebase-messaging-sw.js` (root) — receives background push notifications (FCM).
- **No tests, no linter, no build**. Validate changes by opening `index.html` in a browser (mobile-first, Android Chrome is the target). Before committing, sanity-check JS syntax by parsing the non-module `<script>` blocks with `node -e` (see Coding conventions).
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
- **Trial 3 jours**: `getTrialInfo()` returns `{started, elapsed, remaining, active}`. `hasValidAccess()` = paid tier OR trial still active. `_showAccessRequired()` shows a toast + opens the access modal. Gates: `launchTodaySession`, `startSessionGuarded`, `switchTab('chat')`. Home shows `#trialBanner` (countdown / expired).
- **Access codes (post-book)**: `ACCESS_TIER_META` (client, BETA/VIP/MASTER metadata). Validation is server-side via `check-code.js` — HMAC-signed codes (`LETTER-RANDOM6-CHECK4`) + 3 legacy fixed codes. Generate codes with `scripts/gen-codes.js`. Book question ("Loïc") is a 2nd factor.
- **Tests SAT/SET/PDC**: the test type depends on the programme. `PROGRAM_TESTS` maps each programme to its test ids. `getTestTypeLabel(progKey?)` returns `{short, long, icon, desc}` (SAT for vd/ea/ep, SET for se, PDC for mt/tri) — used for dynamic labels. `getActiveSatExercices()` filters the legacy `satExercices` array (Tracks tab) by `programKey`.
- **Live session**: `launchSession(exos, sessName, progName, progKey)` opens `#liveSession` (full-screen overlay). State lives in `window._LS` (incl. `progKey`). Persisted to `ah_live_session` (24h TTL) — Home shows a "Reprendre" banner via `renderResumeSessionBanner()`. `_lsShowComplete()` logs the session to `ah_set_history` and calls `_checkProgramCompletion()` (80% of expected sessions → `programsDone++`).
- **Workout Builder**: `pgBuilder` page. Locked until `programsDone >= 2` (`BUILDER_UNLOCK_PROGRAMS`) or VIP/MASTER tier. `_builderCheckUnlock()`.
- **Progression**: `renderProgression()` fills `#progressionCard` in the Moi tab — current score, 8-week sessions bar graph, personal records. Helper `_progressionWeeklySessions(8)`.
- **Habits**: `activeHabits` array, persisted to `ah_active_habits` via `_persistActiveHabits()`. `checkHabit()` resets the streak on a day gap. `renderActiveHabits()` renders Home + Moi.
- **Exercise library**: `catData` is the flat exercise database (198 exercises). `_LIB_CAT_MAP` maps the chip filters to `catData` keys. Schema `{name, diff:'easy'|'med'|'hard', muscles, desc, mat, tag?, video?}`. Videos: per-exo `video` field OR `_LIB_VIDEO_MAP` lookup by name. The library has a "🎯 Mon programme" filter (`_libFlatExos('myprogram')`).
- **Titan AI**: `callAnthropicAPI()` builds `ctx` from `ah_profile` (not `window.user`) and POSTs to `/.netlify/functions/titan`. Foreground/background push handled by FCM.

## Backend — Netlify Functions (`netlify/functions/`)

- `titan.js` — Anthropic proxy. Hides the API key, rate limit 20/day/uid, prompt-injection guard, `buildSystemPrompt(ctx)` with athlete context.
- `check-code.js` — validates access codes (HMAC-signed + legacy), timing-safe compare.
- `send-notif.js` — sends a push via **FCM v1 HTTP API**. Builds a JWT from the Service Account, exchanges it for an OAuth token (cached in-memory), POSTs to `messages:send`. The legacy Server Key was deprecated by Google (June 2024).
- `notif-config.js` — serves the public VAPID key to the client.
- `scripts/gen-codes.js` — local script to generate N access codes per tier (needs `ACCESS_CODE_SECRET`).

## Coding conventions in this file

- Vanilla ES5-ish: `var`, `function`, no arrow-function callbacks in older sections (newer code mixes both). Match the surrounding style.
- Many handlers are wired via inline `onclick="…"` — for any new JS function called from HTML, assign it to `window.<name>` so it's reachable when defined inside the script block.
- No template literals across multi-line HTML strings — strings are concatenated with `+=`. Stick to that pattern when extending render functions; it keeps diffs small.
- French is the product language (UI strings, comments). Keep new UI text in French.
- **Syntax check before commit**: parse the non-module `<script>` blocks, e.g.
  `node -e "..."` extracting `<script>` (excluding `type=module`) and running `new Function(body)`.
- **Branch**: active dev branch is `claude/continue-project-W12qw`. PRs #1–#4 merged; #5 open. Push only to the active branch unless told otherwise.

## État du projet (mai 2026)

- ✅ **Fait**: 6 programmes complets, auth (email + Google + reset), onboarding scoring,
  trial 3 jours + gate, codes d'accès HMAC, Titan AI proxy, FCM push notifications,
  page Progression, sync Firestore étendue, Habits (sync + streak), Workout Builder verrouillé,
  library filtrée par programme, labels SAT/SET/PDC dynamiques, "Refaire le questionnaire".
- 🔧 **Config restante** (côté propriétaire, hors code): variables d'env Netlify, Firestore
  rules appliquées dans la console Firebase, Firebase authorized domains.
- ⏳ **Hors scope MVP**: vidéos d'exercices tournées (système prêt, liens à remplir),
  publication App Store / Play Store, "Titan-cerveau" (RAG / base de connaissances).
