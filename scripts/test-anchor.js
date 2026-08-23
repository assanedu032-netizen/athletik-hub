// Ancrage comportemental (brique 3) — §12 du brief.
// Le point critique est la MIGRATION DOUCE : un profil existant, sans aucun
// de ces champs, doit se comporter exactement comme avant.
//   node scripts/test-anchor.js [autre.html]
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
function grabVar(name) {
  const s = html.indexOf('var ' + name + ' = [');
  return html.slice(s, html.indexOf('\n];', s) + 3);
}

const src = grab('function _ahSafeParse(') + '\n'
  + grabVar('AH_ANCHORS') + '\n'
  + grab('function _ahAnchorLabel(') + ';\n'
  + ['_ahReadAnchor', '_ahIsQuietHour'].map(n => grab('window.' + n + ' = function(')).join(';\n') + ';';

function build(store) {
  const localStorage = {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; },
  };
  const window_ = {};
  const fn = new Function('localStorage', 'window', 'console',
    src + '\nreturn { w: window, label: _ahAnchorLabel, ANCHORS: AH_ANCHORS };');
  const api = fn(localStorage, window_, console);
  return { read: api.w._ahReadAnchor, quiet: api.w._ahIsQuietHour, label: api.label, ANCHORS: api.ANCHORS };
}

const R = [];
const ok = (l, c, d) => { R.push(c); console.log((c ? '  PASS  ' : '  FAIL  ') + l + (d && !c ? '  → ' + d : '')); };

console.log('\n=== MIGRATION DOUCE — LE POINT CRITIQUE ===\n');
{
  // Profil d'un utilisateur existant : aucun champ d'ancrage.
  const legacy = { prenom: 'Kadia', age: 22, programKey: 'vd', satDone: true, streak: 4 };
  const api = build({ ah_profile: JSON.stringify(legacy) });
  let threw = false, a = null;
  try { a = api.read(); } catch (e) { threw = true; }
  ok('profil existant → aucune exception', !threw);
  ok('tous les champs à null, pas de valeur inventée',
     a && a.moment === null && a.time === null && a.quietStart === null && a.quietEnd === null,
     JSON.stringify(a));
  ok('isSet=false tant que rien n\'est choisi', a && a.isSet === false);
  ok('aucune heure n\'est silencieuse sans plage définie', api.quiet('03:00') === false);
}
{
  const api = build({});
  let threw = false;
  try { api.read(); api.quiet('12:00'); } catch (e) { threw = true; }
  ok('localStorage vide → aucune exception', !threw);
}
{
  const api = build({ ah_profile: 'CASSÉ{{{' });
  let threw = false, a = null;
  try { a = api.read(); } catch (e) { threw = true; }
  ok('profil corrompu → aucune exception', !threw);
  ok('profil corrompu → valeurs neutres', a && a.isSet === false);
}
{
  // quietHours mal typé (cas d'une migration bancale)
  const api = build({ ah_profile: JSON.stringify({ quietHours: 'nawak' }) });
  const a = api.read();
  ok('quietHours mal typé → ignoré proprement', a.quietStart === null && a.quietEnd === null);
}

console.log('\n=== LECTURE D\'UN ANCRAGE DÉFINI ===\n');
{
  const api = build({ ah_profile: JSON.stringify({
    anchorMoment: 'travail', anchorTime: '18:30', quietHours: { start: '22:00', end: '07:00' } }) });
  const a = api.read();
  ok('moment lu', a.moment === 'travail');
  ok('heure lue', a.time === '18:30');
  ok('plage de silence lue', a.quietStart === '22:00' && a.quietEnd === '07:00');
  ok('isSet=true', a.isSet === true);
  ok('libellé résolu', api.label('travail') === 'Je rentre du travail / des cours', api.label('travail'));
  ok('libellé inconnu → null, rien d\'inventé', api.label('zzz') === null);
}

console.log('\n=== HEURES DE SILENCE ===\n');
{
  // Plage à cheval sur minuit : le cas qui casse toujours
  const api = build({ ah_profile: JSON.stringify({ quietHours: { start: '22:00', end: '07:00' } }) });
  ok('23:30 est silencieux', api.quiet('23:30') === true);
  ok('02:00 est silencieux', api.quiet('02:00') === true);
  ok('06:59 est silencieux', api.quiet('06:59') === true);
  ok('07:00 ne l\'est plus (borne exclue)', api.quiet('07:00') === false);
  ok('12:00 n\'est pas silencieux', api.quiet('12:00') === false);
  ok('22:00 est silencieux (borne incluse)', api.quiet('22:00') === true);
}
{
  // Plage dans la même journée
  const api = build({ ah_profile: JSON.stringify({ quietHours: { start: '09:00', end: '17:00' } }) });
  ok('plage sans passage minuit : 12:00 silencieux', api.quiet('12:00') === true);
  ok('plage sans passage minuit : 20:00 non silencieux', api.quiet('20:00') === false);
  ok('plage sans passage minuit : 08:00 non silencieux', api.quiet('08:00') === false);
}
{
  const api = build({ ah_profile: JSON.stringify({ quietHours: { start: 'nawak', end: '07:00' } }) });
  ok('heure invalide → non silencieux plutôt que faux positif', api.quiet('23:00') === false);
  ok('heure absente → non silencieux', api.quiet('') === false);
}

console.log('\n=== OPTIONS DU BRIEF ===\n');
{
  const api = build({});
  const expected = ['Je rentre du travail / des cours', 'Je me réveille', 'Je finis de manger',
                    'Je pose mon sac chez moi', 'Autre'];
  ok('les 5 options du brief, dans l\'ordre',
     JSON.stringify(api.ANCHORS.map(o => o.label)) === JSON.stringify(expected),
     JSON.stringify(api.ANCHORS.map(o => o.label)));
}

console.log('\n=== NON-DUPLICATION ===\n');
{
  // On retire les commentaires avant de chercher : le mot apparaît dans celui
  // qui explique précisément pourquoi ce champ n'a PAS été créé.
  const code = html.split('\n').filter(l => !l.trim().startsWith('//')).join('\n');
  ok('ah_notif_on réutilisé, pas de notifications_enabled créé',
     !/notifications_enabled/.test(code) && /ah_notif_on/.test(code));
  ok('planning (trainingTimes) laissé intact', /var trainingTimes = \{\}/.test(html));
  ok('ancrage stocké dans ah_profile, sans nouvelle clé localStorage',
     /p\.anchorMoment = _ahAnchorDraft/.test(html) && !/localStorage\.setItem\('ah_anchor/.test(html));
}

const failed = R.filter(x => !x).length;
console.log('\n' + '='.repeat(60));
console.log(failed ? 'RÉSULTAT : ' + failed + ' ÉCHEC(S) sur ' + R.length
                   : 'RÉSULTAT : ' + R.length + '/' + R.length + ' tests passés.');
process.exit(failed ? 1 : 0);
