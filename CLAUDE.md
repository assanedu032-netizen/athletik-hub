# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Athletik Hub is a French-language PWA for athletic training, built as a **single-file vanilla HTML/CSS/JS monolith** in `index.html` (~11.8K lines, ~700KB). There is no build step, no framework, no package manager. Edit the file, commit, push, deploy.

`athletik_hub_modular/` is a separate modular variant (split css/js folders) — **not the active codebase**. All work happens in the root `index.html`.

## Deploying / serving

- **Hosting**: Netlify (`netlify.toml` SPA-rewrites everything to `/index.html`). No build command; the file is served as-is.
- **PWA**: `sw.js` (cache-first for local assets, network-first for externals) + `manifest.json`. Cache name is `athletik-v1` — bump it when shipping CSS/HTML that must invalidate.
- **No tests, no linter, no build**. Validate changes by opening `index.html` in a browser (mobile-first, Android Chrome is the target).
- The previous-turn summary often contains the user's outstanding tasks — read it before starting new work.

## Architecture mental model

Two parallel UI systems live in the same file and must not conflict:

1. **`.scr` screens** — full-page screens used by the onboarding/auth/profile flow (`welcome`, `titanIntro`, `obQ1`, `profil1`–`profil4plan`, `auth`, etc.). Navigated with `go(id)`.
2. **`.view` tab views** — the main app tabs after onboarding (`vHome`, `vTracks`, `vChat`, `vTrain`, `vMoi`, `vNutri`). Navigated with `switchTab(tab)`. Inside `vTrain`, sub-pages (`pgLib`, `pgProg`, `pgBuilder`) toggle via `showPg(id)`.

**Critical pitfall — the inline-display bug**: `discoveryGoTo()` (and a few onboarding finalizers) set `element.style.display = 'none'` inline on every `.scr` and `.view`. Any later code that only toggles a CSS class (`.on`) will lose to the inline style and render a blank screen. The fix everywhere is to explicitly reset `el.style.display = ''` before adding `.on`. `go()`, `switchTab()`, `obFinish()`, and `discoveryReturnToHome()` already do this — preserve that when editing those functions, and apply the same pattern in any new navigation code.

## State & persistence

All user state is in `localStorage` under `ah_*` keys. Optional Firebase sync writes `ah_profile` to Firestore when the user is logged in (`window.fbUser` is set; `window.fb` exposes `doc/setDoc/db`). Keys in active use:

- `ah_profile` — main user object (prenom, age, sexe, programKey, satDone, poids/taille, objNutri, streak, level…)
- `ah_onboarding_done`, `ah_discovery_mode`, `ah_ob_inprogress`, `ah_sat_inprogress` — flow flags
- `ah_recipe_favorites`, `ah_shopping_checks`, `ah_nutri_journal` — nutrition module
- `ah_set_history`, `ah_theme`, `ah_anthropic_key`, `ah_before_clear`/`ah_before_import`/`ah_last_backup`

## Domain logic to know about

- **Programme attribution**: `calcProgramFromTallyAnswers(objectif, sit, cont, mat)` replicates the Tally form Pd5KB5 scoring. The user's `programKey` is **only set after all 4 questions are answered** — until then the home séance card must show "À DÉTERMINER" (see `renderUserData()`).
- **Programmes data**: `PROGRAMS_V2` (in IIFE near line 5780) holds the rich data (phases → weekDays → sessions → exos) for Vertical Dunk and Elite Athlete. Other keys (`mt`, `tri`, `se`, `ep`) are stubs in `progPhases` for the legacy UI. `renderProgramV2(key)` dispatches to the new UI if `PROGRAMS_V2[k]` exists; `openProg(k)` enforces the lock (a user can only open their attributed programme).
- **Live session**: `launchSession(exos, sessName, progName)` opens `#liveSession` (GBG/Gymkee-style full-screen overlay). State lives in `window._LS`. `startSessionGuarded()` is the gated entry point that reads the currently selected session out of `window._progV2State`.
- **Exercise library**: `catData` is the flat exercise database (198 exercises) auto-generated from `banque_exercices_v3.xlsx`. `_LIB_CAT_MAP` maps the 11 chip filters to `catData` keys. The library renders single-column YouTube-style cards via `_libRender(filterKey)` → `_libCardHtml(it)`. To regenerate `catData` from a new Excel, see the Python script approach in earlier commits — keep the schema `{name, diff:'easy'|'med'|'hard', muscles, desc, mat, tag?}`.
- **SAT (tests physiques)**: `satExercices` (around line 4880) drives the step-by-step Tracks flow. The Sprint step uses 5-attempt fields (`trk_sprint_1`..`5`) with `_trkSprintCalcBest()`; the stopwatch fills the next empty attempt. The best time is persisted as `satSprintTime` for the scoring path.

## Coding conventions in this file

- Vanilla ES5-ish: `var`, `function`, no arrow-function callbacks in older sections (newer code mixes both). Match the surrounding style.
- Many handlers are wired via inline `onclick="…"` — for any new JS function called from HTML, assign it to `window.<name>` so it's reachable when defined inside the script block.
- No template literals across multi-line HTML strings — strings are concatenated with `+=`. Stick to that pattern when extending render functions; it keeps diffs small.
- French is the product language (UI strings, comments). Keep new UI text in French.
- The session is on branch `claude/fix-athletik-hub-errors-vb6Z6`. Open PR is #1. Push only to this branch unless told otherwise.
