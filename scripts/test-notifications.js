// Règles de notification (brique 6) — §15 à §20 du brief.
// Teste les garde-fous de session-reminders.js : heures de silence, plafond
// journalier, mode réduit après 3 ignorées, relances d'inactivité.
//   node scripts/test-notifications.js [autre.js]
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(process.argv[2] || path.join(__dirname, '..', 'netlify', 'functions', 'session-reminders.js'), 'utf8');

function grab(name) {
  const start = src.indexOf('function ' + name + '(');
  if (start < 0) throw new Error('introuvable: ' + name);
  let i = src.indexOf('{', src.indexOf('(', start)), d = 0, j = i;
  for (; j < src.length; j++) {
    if (src[j] === '{') d++;
    else if (src[j] === '}') { d--; if (!d) { j++; break; } }
  }
  return src.slice(start, j);
}
function grabConst(name) {
  // Espacement libre dans les déclarations alignées (NIGHT_END   = 7  * 60;)
  const re = new RegExp('const\\s+' + name + '\\s*=[^;]+;');
  const m = re.exec(src);
  if (!m) throw new Error('introuvable: ' + name);
  return m[0];
}

const CONSTS = ['NIGHT_START', 'NIGHT_END', 'IGNORED_THRESHOLD', 'REDUCED_MIN_GAP_MS',
                'INACTIVITY_STAGES', 'INACTIVITY_HOUR_LO', 'INACTIVITY_HOUR_HI']
  .map(grabConst).join('\n');
const FNS = ['isNightWindow', 'toMin', 'isQuietFor', 'daysBetween', 'wasIgnored',
             'sendBlockedReason', 'inactivityStageFor', 'inactivityMessage']
  .map(grab).join('\n');

const api = new Function(CONSTS + '\n' + FNS + '\nreturn { isQuietFor, wasIgnored, sendBlockedReason, inactivityStageFor, inactivityMessage };')();

const H = (h, m) => h * 60 + (m || 0);
const R = [];
const ok = (l, c, d) => { R.push(c); console.log((c ? '  PASS  ' : '  FAIL  ') + l + (d && !c ? '  → ' + d : '')); };

console.log('\n=== HEURES DE SILENCE ===\n');
{
  const prof = { quietHours: { start: '22:00', end: '07:00' } };
  ok('23:30 silencieux', api.isQuietFor(prof, H(23, 30)) === true);
  ok('03:00 silencieux', api.isQuietFor(prof, H(3)) === true);
  ok('07:00 autorisé (borne exclue)', api.isQuietFor(prof, H(7)) === false);
  ok('12:00 autorisé', api.isQuietFor(prof, H(12)) === false);
}
{
  const prof = { quietHours: { start: '13:00', end: '15:00' } };
  ok('plage sans minuit : 14:00 silencieux', api.isQuietFor(prof, H(14)) === true);
  ok('plage sans minuit : 23:00 autorisé', api.isQuietFor(prof, H(23)) === false);
}
{
  // Repli sur la fenêtre historique pour un profil sans préférence
  ok('sans quietHours → repli 22h-7h à 23:00', api.isQuietFor({}, H(23)) === true);
  ok('sans quietHours → repli 22h-7h à 10:00', api.isQuietFor({}, H(10)) === false);
  ok('quietHours mal formé → repli, pas d\'exception',
     api.isQuietFor({ quietHours: { start: 'x', end: 'y' } }, H(23)) === true);
}

console.log('\n=== PLAFOND : 1 NOTIFICATION PAR JOUR ===\n');
{
  const prof = {};
  const st = { lastNotifAt: '2026-06-10T09:00:00.000Z' };
  ok('2e envoi le même jour bloqué',
     api.sendBlockedReason(prof, st, '2026-06-10T18:00:00.000Z', H(18)) === 'daily_cap');
  ok('lendemain autorisé',
     api.sendBlockedReason(prof, st, '2026-06-11T18:00:00.000Z', H(18)) === null);
}
{
  ok('heures de silence prioritaires sur tout le reste',
     api.sendBlockedReason({}, {}, '2026-06-11T23:00:00.000Z', H(23)) === 'quiet');
}
{
  ok('aucun historique → envoi autorisé',
     api.sendBlockedReason({}, {}, '2026-06-11T18:00:00.000Z', H(18)) === null);
}

console.log('\n=== MODE RÉDUIT APRÈS 3 IGNORÉES ===\n');
{
  const prof = {};
  const st = { lastNotifAt: '2026-06-10T18:00:00.000Z', ignoredCount: 3 };
  ok('2 jours après, en mode réduit → bloqué',
     api.sendBlockedReason(prof, st, '2026-06-12T18:00:00.000Z', H(18)) === 'reduced_mode');
  ok('8 jours après → autorisé (1 par semaine)',
     api.sendBlockedReason(prof, st, '2026-06-18T19:00:00.000Z', H(18)) === null);
}
{
  const st = { lastNotifAt: '2026-06-10T18:00:00.000Z', ignoredCount: 2 };
  ok('2 ignorées seulement → rythme normal conservé',
     api.sendBlockedReason({}, st, '2026-06-12T18:00:00.000Z', H(18)) === null);
}

console.log('\n=== DÉTECTION D\'UNE NOTIFICATION IGNORÉE ===\n');
{
  const st = { lastNotifAt: '2026-06-10T18:00:00.000Z' };
  ok('app jamais ouverte depuis → ignorée',
     api.wasIgnored({ lastActive: '2026-06-09T10:00:00.000Z' }, st) === true);
  ok('app ouverte après → non ignorée',
     api.wasIgnored({ lastActive: '2026-06-10T19:00:00.000Z' }, st) === false);
  ok('lastActive absent → considérée ignorée',
     api.wasIgnored({}, st) === true);
  ok('aucune notification envoyée → rien à compter',
     api.wasIgnored({ lastActive: '2026-06-10T19:00:00.000Z' }, {}) === false);
}

console.log('\n=== RELANCES D\'INACTIVITÉ ===\n');
{
  const prof = { lastSessionDay: '2026-06-01' };
  const now = '2026-06-04T18:30:00.000Z';   // J+3
  ok('J+3 déclenche le 1er palier',
     api.inactivityStageFor(prof, {}, now, H(18, 30)) === 3, String(api.inactivityStageFor(prof, {}, now, H(18, 30))));
  ok('palier déjà franchi → aucune répétition',
     api.inactivityStageFor(prof, { inactivityStage: 3 }, now, H(18, 30)) === null);
  ok('hors de la fenêtre 18h-19h → rien',
     api.inactivityStageFor(prof, {}, now, H(10)) === null);
}
{
  const prof = { lastSessionDay: '2026-06-01' };
  ok('J+8 déclenche le palier 7',
     api.inactivityStageFor(prof, { inactivityStage: 3 }, '2026-06-09T18:30:00.000Z', H(18, 30)) === 7);
  ok('J+20 déclenche le palier 14',
     api.inactivityStageFor(prof, { inactivityStage: 7 }, '2026-06-21T18:30:00.000Z', H(18, 30)) === 14);
  ok('APRÈS J+14, plus AUCUNE relance',
     api.inactivityStageFor(prof, { inactivityStage: 14 }, '2026-07-30T18:30:00.000Z', H(18, 30)) === null);
}
{
  ok('J+1 ne déclenche rien',
     api.inactivityStageFor({ lastSessionDay: '2026-06-01' }, {}, '2026-06-02T18:30:00.000Z', H(18, 30)) === null);
  ok('aucune activité connue → rien',
     api.inactivityStageFor({}, {}, '2026-06-04T18:30:00.000Z', H(18, 30)) === null);
}

console.log('\n=== TON DES MESSAGES (§19) ===\n');
{
  const msgs = [3, 7, 14].map(s => api.inactivityMessage(s, { vertJump: 62 }).body);
  msgs.forEach((m, i) => console.log('   J+' + [3, 7, 14][i] + ' : ' + m));
  ok('aucun reproche, aucune culpabilisation',
     !msgs.some(m => /perdu|dommage|abandonn|tu n'as pas|raté|échec|déçu/i.test(m)));
  ok('aucune fausse urgence',
     !msgs.some(m => /vite|dernier jour|plus que|urgent|dépêche/i.test(m)));
  ok('J+7 utilise la donnée réelle', /62 cm/.test(msgs[1]), msgs[1]);
  ok('J+7 sans donnée → pas de chiffre inventé',
     !/\d+ cm/.test(api.inactivityMessage(7, {}).body), api.inactivityMessage(7, {}).body);
  ok('J+14 annonce l\'arrêt des rappels', /On arrête les rappels/.test(msgs[2]));
}

console.log('\n=== INTÉGRATION ===\n');
{
  ok('l\'ancrage prime sur le planning', /prof\.anchorTime && \/\^\\d\{1,2\}:\\d\{2\}\$\/\.test\(prof\.anchorTime\)/.test(src));
  ok('notifState patché séparément, jamais profile',
     /updateMask\.fieldPaths=notifState/.test(src) && !/updateMask\.fieldPaths=profile/.test(src));
  ok('l\'échec d\'écriture n\'empêche pas l\'envoi',
     /catch \(e\) \{[\s\S]{0,140}notifState:/.test(src));
  ok('le chemin du document est récupéré', /name: doc\.name/.test(src));
  ok('les préférences par catégorie sont conservées', /prof\.notifPrefs \|\| \{\}/.test(src));
}

const failed = R.filter(x => !x).length;
console.log('\n' + '='.repeat(60));
console.log(failed ? 'RÉSULTAT : ' + failed + ' ÉCHEC(S) sur ' + R.length
                   : 'RÉSULTAT : ' + R.length + '/' + R.length + ' tests passés.');
process.exit(failed ? 1 : 0);
