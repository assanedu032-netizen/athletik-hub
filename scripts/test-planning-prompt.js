// Rappel proactif des préférences d'entraînement.
// L'enjeu : être proactif SANS être intrusif. On teste surtout les cas où la
// bannière doit se TAIRE.
//   node scripts/test-planning-prompt.js [autre.html]
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(process.argv[2] || path.join(__dirname, '..', 'index.html'), 'utf8');

function grab(decl) {
  const start = html.indexOf(decl);
  if (start < 0) throw new Error('introuvable: ' + decl);
  let i = html.indexOf('{', html.indexOf('(', start)), d = 0, j = i;
  for (; j < html.length; j++) {
    if (html[j] === '{') d++;
    else if (html[j] === '}') { d--; if (!d) { j++; break; } }
  }
  return html.slice(start, j);
}

const src = 'var PROMPT_MIN_AGE_DAYS = 2, PROMPT_COOLDOWN_DAYS = 7, PROMPT_MAX_DISMISS = 3;\n'
  + grab('function _ahSafeParse(') + '\n'
  + grab('function _ahDaysBetween(') + '\n'
  + grab('window._ahPlanningPromptState = function(') + ';';

function build(profile, daysConfigured, sessionCount) {
  const store = { ah_profile: JSON.stringify(profile || {}) };
  const localStorage = {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; },
  };
  const window_ = {};
  const trainingDays = { size: daysConfigured || 0 };
  const _getWeekPlan = () => ({ sessionCount: sessionCount == null ? 4 : sessionCount });
  const fn = new Function('localStorage', 'window', 'console', 'trainingDays', '_getWeekPlan',
    src + '\nreturn window._ahPlanningPromptState;');
  return fn(localStorage, window_, console, trainingDays, _getWeekPlan);
}

const D = (daysAgo) => {
  const d = new Date('2026-06-15T10:00:00Z');
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString();
};
const NOW = D(0);

const R = [];
const ok = (l, c, d) => { R.push(c); console.log((c ? '  PASS  ' : '  FAIL  ') + l + (d && !c ? '  → ' + d : '')); };

console.log('\n=== QUAND LA BANNIÈRE DOIT SE TAIRE ===\n');
{
  const st = build({ trialStartedAt: D(30) }, 4)(NOW);
  ok('planning déjà configuré → silence', st.show === false && st.reason === 'configured', JSON.stringify(st));
}
{
  const st = build({ trialStartedAt: D(1) }, 0)(NOW);
  ok('compte de 1 jour → trop tôt, on laisse découvrir', st.show === false && st.reason === 'too_early', JSON.stringify(st));
}
{
  const st = build({ trialStartedAt: D(0) }, 0)(NOW);
  ok('compte créé aujourd\'hui → silence', st.show === false, JSON.stringify(st));
}
{
  const st = build({}, 0)(NOW);
  ok('âge du compte inconnu → silence plutôt que harcèlement',
     st.show === false && st.reason === 'no_age', JSON.stringify(st));
}
{
  const st = build({ trialStartedAt: D(30), planPromptDismissals: 3 }, 0)(NOW);
  ok('3 refus → on arrête DÉFINITIVEMENT', st.show === false && st.reason === 'refused', JSON.stringify(st));
}
{
  const st = build({ trialStartedAt: D(30), planPromptDismissals: 1, planPromptLastAt: D(3) }, 0)(NOW);
  ok('refus il y a 3 jours → cooldown, silence', st.show === false && st.reason === 'cooldown', JSON.stringify(st));
}
{
  const st = build({ ah_profile: 'CASSÉ' }, 0)(NOW);
  ok('profil corrompu → silence, aucune exception', st.show === false);
}

console.log('\n=== QUAND ELLE DOIT APPARAÎTRE ===\n');
{
  const st = build({ trialStartedAt: D(2), prenom: 'Alassane' }, 0)(NOW);
  ok('compte de 2 jours, sans planning → affichée', st.show === true, JSON.stringify(st));
  ok('prénom repris pour personnaliser', st.prenom === 'Alassane');
  ok('nombre de séances lu du programme réel', st.need === 4, String(st.need));
}
{
  const st = build({ trialStartedAt: D(30), planPromptDismissals: 1, planPromptLastAt: D(8) }, 0)(NOW);
  ok('refus il y a 8 jours → reproposée', st.show === true, JSON.stringify(st));
  ok('compteur de refus conservé', st.dismissals === 1);
}
{
  const st = build({ trialStartedAt: D(30), planPromptDismissals: 2, planPromptLastAt: D(10) }, 0)(NOW);
  ok('2e refus dépassé → 3e et dernière proposition', st.show === true);
}
{
  // Programme pas encore attribué : on demande quand même, sans chiffre inventé
  const st = build({ trialStartedAt: D(5) }, 0, 0)(NOW);
  ok('sans programme → affichée, mais aucun nombre de séances', st.show === true && st.need === 0,
     JSON.stringify(st));
}

console.log('\n=== LIMITES DU CYCLE ===\n');
{
  const st = build({ trialStartedAt: D(30), planPromptDismissals: 1, planPromptLastAt: D(7) }, 0)(NOW);
  ok('exactement 7 jours → reproposée (borne incluse)', st.show === true, JSON.stringify(st));
}
{
  const st = build({ trialStartedAt: D(30), planPromptDismissals: 1, planPromptLastAt: D(6) }, 0)(NOW);
  ok('6 jours → encore en cooldown', st.show === false && st.reason === 'cooldown');
}
{
  // Fréquence maximale sur un an : 3 apparitions, pas une de plus
  let dismissals = 0, shows = 0, last = null;
  for (let day = 2; day < 365; day++) {
    const prof = { trialStartedAt: D(365) };
    if (dismissals) { prof.planPromptDismissals = dismissals; prof.planPromptLastAt = last; }
    const now = new Date('2026-06-15T10:00:00Z');
    now.setUTCDate(now.getUTCDate() + day);
    const st = build(prof, 0)(now.toISOString());
    if (st.show) { shows++; dismissals++; last = now.toISOString(); }
  }
  ok('sur un an, 3 apparitions maximum', shows === 3, String(shows) + ' apparition(s)');
}

console.log('\n=== INTÉGRATION ===\n');
{
  ok('aucune UI de saisie dupliquée — openPlanModal réutilisé',
     /_ahOpenPlanningFromPrompt[\s\S]{0,400}openPlanModal\(\)/.test(html));
  ok('branchée sur le cycle de rendu Home existant',
     /renderResumeTestsBanner\(\); \} catch\(e\) \{\}\s*\n\s*try \{ renderPlanningPrompt\(\)/.test(html));
  ok('disparaît dès le planning confirmé',
     /renderMoiPlanning\(\); \} catch\(e\) \{\}[\s\S]{0,200}renderPlanningPrompt/.test(html));
  ok('ouvrir n\'incrémente PAS le compteur de refus',
     !/_ahOpenPlanningFromPrompt[\s\S]{0,300}planPromptDismissals/.test(html));
  ok('le refus est bien enregistré',
     /_ahDismissPlanningPrompt[\s\S]{0,300}planPromptDismissals = \(p\.planPromptDismissals \|\| 0\) \+ 1/.test(html));
  ok('bannière fermable', /aria-label="Plus tard"/.test(html));
  const code = html.split('\n').filter(l => !l.trim().startsWith('//')).join('\n');
  ok('aucun vocabulaire culpabilisant',
     !/tu dois|obligatoire|attention[ ,]|il faut absolument/i.test(
       (/renderPlanningPrompt = function[\s\S]*?\n\};/.exec(code) || [''])[0]));
}

const failed = R.filter(x => !x).length;
console.log('\n' + '='.repeat(60));
console.log(failed ? 'RÉSULTAT : ' + failed + ' ÉCHEC(S) sur ' + R.length
                   : 'RÉSULTAT : ' + R.length + '/' + R.length + ' tests passés.');
process.exit(failed ? 1 : 0);
