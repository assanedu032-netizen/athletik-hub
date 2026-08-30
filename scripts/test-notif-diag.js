// Diagnostic push (FCM) — la raison exacte d'un échec doit arriver À L'ÉCRAN.
// Avant ce chantier, les quatre chemins d'échec affichaient le même message
// générique ("Les rappels ne sont pas encore disponibles…") et la vraie cause
// n'existait que dans console.warn — invisible sur un téléphone.
// Ce harnais extrait les VRAIES fonctions d'index.html et les rejoue.
//   node scripts/test-notif-diag.js [autre.html]
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(process.argv[2] || path.join(__dirname, '..', 'index.html'), 'utf8');

// Équilibrage d'accolades : `from` est le début de la tranche à renvoyer,
// `braceFrom` l'endroit où chercher l'accolade ouvrante du corps.
function balance(from, braceFrom) {
  let d = 0, j = src.indexOf('{', braceFrom === undefined ? from : braceFrom);
  for (; j < src.length; j++) {
    if (src[j] === '{') d++;
    else if (src[j] === '}') { d--; if (!d) { j++; break; } }
  }
  return src.slice(from, j);
}
function grabFn(name) {
  const start = src.indexOf('function ' + name + '(');
  if (start < 0) throw new Error('introuvable: ' + name);
  return balance(start, src.indexOf('(', start));
}
function grabObj(name) {
  const start = src.indexOf('var ' + name + ' = {');
  if (start < 0) throw new Error('introuvable: ' + name);
  return balance(start) + ';';
}
function grabAssign(name) {
  const start = src.indexOf(name + ' = async function()');
  if (start < 0) throw new Error('introuvable: ' + name);
  return balance(start) + ';';
}

const R = [];
const ok = (l, c, d) => { R.push(c); console.log((c ? '  PASS  ' : '  FAIL  ') + l + (d && !c ? '  → ' + d : '')); };

// ── Environnement simulé : un DOM minimal, un showToast qui enregistre ──
function makeEnv(opts) {
  opts = opts || {};
  const sub = { innerHTML: 'Vérifie que les push notifs arrivent', style: { color: '' } };
  const toasts = [];
  const warns = [];
  const env = {
    document: { getElementById: id => (id === 'notifTestSub' ? sub : null) },
    showToast: (m, t) => toasts.push({ m, t }),
    console: { warn: (...a) => warns.push(a.join(' ')), log: () => {} },
    localStorage: {
      getItem: k => (k === 'ah_profile' ? JSON.stringify(opts.profile || {}) : null),
      setItem: () => {}
    },
    // `'Notification' in window` doit être FAUX quand le navigateur ne la gère
    // pas : une clé présente avec la valeur undefined resterait vraie.
    Notification: { permission: opts.permission },
    fetch: opts.fetch || (async () => ({ ok: true, status: 200, json: async () => ({ ok: true }) })),
    _registerFCMToken: opts.registerToken || (async () => null),
    _fcmLastError: opts.lastError || '',
    Date: Date,
    sub, toasts, warns
  };
  if (opts.permission === undefined) delete env.Notification;
  const body =
    grabObj('FCM_SERVER_ERRORS') + '\n' +
    grabFn('_fcmEsc') + '\n' +
    grabFn('_fcmDiag') + '\n' +
    grabFn('_fcmDiagOk') + '\n' +
    'var FCM_UNAVAILABLE_MSG = ' + JSON.stringify(GENERIC) + ';\n' +
    'var window = ENV;\n' +
    grabAssign('window.sendTestNotif') + '\n' +
    'return { _fcmDiag: _fcmDiag, _fcmDiagOk: _fcmDiagOk, _fcmEsc: _fcmEsc,' +
    '         ERRORS: FCM_SERVER_ERRORS, sendTestNotif: window.sendTestNotif };';
  const fn = new Function('ENV', 'document', 'showToast', 'console', 'localStorage',
                          'Notification', 'fetch', '_registerFCMToken', body);
  env.api = fn(env, env.document, env.showToast, env.console, env.localStorage,
               env.Notification, env.fetch, env._registerFCMToken);
  return env;
}

// Le message générique tel qu'il est écrit dans index.html — sert de repoussoir :
// aucun chemin d'échec instrumenté ne doit encore le produire.
const GENERIC = (/var FCM_UNAVAILABLE_MSG = '([^']+)'/.exec(src) || [])[1];

console.log('\n=== LA RAISON REMONTE À L\'ÉCRAN ===\n');
ok('le message générique existe toujours (dernier recours)', !!GENERIC, String(GENERIC));
{
  const e = makeEnv({});
  e.api._fcmDiag('Clé VAPID absente — variable FIREBASE_VAPID_KEY manquante sur Netlify.');
  ok('la raison précise part en toast', e.toasts.length === 1 &&
     /FIREBASE_VAPID_KEY/.test(e.toasts[0].m), JSON.stringify(e.toasts));
  ok('le toast est de type erreur', e.toasts[0].t === 'err', e.toasts[0].t);
  ok('la raison reste écrite sous le bouton', /FIREBASE_VAPID_KEY/.test(e.sub.innerHTML), e.sub.innerHTML);
  ok('la ligne passe en rouge', e.sub.style.color === '#E5484D', e.sub.style.color);
  ok('elle est aussi tracée en console', e.warns.some(w => /FIREBASE_VAPID_KEY/.test(w)));
}
{
  const e = makeEnv({});
  e.api._fcmDiag('');
  ok('sans raison connue → repli sur le message générique',
     e.toasts[0].m === GENERIC, e.toasts[0].m);
  e.api._fcmDiag('   ');
  ok('une raison vide de sens ne s\'affiche pas', e.toasts[1].m === GENERIC, e.toasts[1].m);
}
{
  const e = makeEnv({});
  e.api._fcmDiag('<img src=x onerror=alert(1)>');
  ok('le texte est échappé avant innerHTML (le serveur n\'écrit pas de HTML)',
     e.sub.innerHTML.indexOf('<img') < 0 && e.sub.innerHTML.indexOf('&lt;img') === 0, e.sub.innerHTML);
  ok('le toast aussi est échappé', e.toasts[0].m.indexOf('<') < 0, e.toasts[0].m);
}
{
  const e = makeEnv({});
  e.api._fcmDiag('erreur');
  e.api._fcmDiagOk('Envoyée à 14:32');
  ok('un succès efface la couleur d\'alerte', e.sub.style.color === '', e.sub.style.color);
  ok('un succès remplace le texte', /14:32/.test(e.sub.innerHTML), e.sub.innerHTML);
}

console.log('\n=== CODES SERVEUR TRADUITS ===\n');
{
  const E = makeEnv({}).api.ERRORS;
  // Les cinq codes que send-notif.js peut renvoyer, vérifiés contre la source.
  const server = fs.readFileSync(path.join(__dirname, '..', 'netlify', 'functions', 'send-notif.js'), 'utf8');
  const codes = [...server.matchAll(/error:\s*'([a-z_]+)'/g)].map(m => m[1]);
  ok('send-notif.js renvoie bien 5 codes distincts', new Set(codes).size === 5, codes.join(','));
  [...new Set(codes)].forEach(c => {
    ok('code « ' + c +' » traduit en français', typeof E[c] === 'string' && E[c].length > 10, E[c]);
  });
  ok('FIREBASE_SERVICE_ACCOUNT est nommée dans la traduction',
     /FIREBASE_SERVICE_ACCOUNT/.test(E.service_account_missing_or_invalid), E.service_account_missing_or_invalid);
}

console.log('\n=== sendTestNotif — CHAQUE ÉCHEC DIT SA CAUSE ===\n');
(async function () {
  {
    const e = makeEnv({ profile: {}, permission: 'denied' });
    await e.api.sendTestNotif();
    ok('permission refusée → on explique les réglages du navigateur, pas « réappuie »',
       /BLOQU/.test(e.toasts[0].m) && /Autorisations/.test(e.toasts[0].m), e.toasts[0].m);
    ok('permission refusée → pas d\'appel réseau inutile', e.toasts.length === 1);
  }
  {
    const e = makeEnv({ profile: {}, permission: 'default' });
    await e.api.sendTestNotif();
    ok('permission jamais demandée → renvoie vers le bouton du dessus',
       /bouton ci-dessus/.test(e.toasts[0].m), e.toasts[0].m);
  }
  {
    const e = makeEnv({ profile: {}, permission: undefined });
    await e.api.sendTestNotif();
    ok('navigateur sans Notification → conseille l\'installation PWA',
       /écran d'accueil/.test(e.toasts[0].m), e.toasts[0].m);
  }
  {
    const e = makeEnv({
      profile: {}, permission: 'granted',
      lastError: 'Clé VAPID invalide (12 caractères, ~88 attendus). Vérifie FIREBASE_VAPID_KEY sur Netlify.',
      registerToken: async () => null
    });
    await e.api.sendTestNotif();
    const last = e.toasts[e.toasts.length - 1];
    ok('token impossible à obtenir → la raison de _registerFCMToken est affichée',
       /VAPID invalide/.test(last.m), last.m);
    ok('… et ce n\'est plus le message générique', last.m !== GENERIC);
  }
  {
    const e = makeEnv({
      profile: { fcmToken: 'tok' }, permission: 'granted',
      fetch: async () => ({ ok: false, status: 503, json: async () => ({ ok: false, error: 'service_account_missing_or_invalid' }) })
    });
    await e.api.sendTestNotif();
    ok('503 serveur → nomme la variable Netlify manquante',
       /FIREBASE_SERVICE_ACCOUNT/.test(e.toasts[0].m), e.toasts[0].m);
  }
  {
    const e = makeEnv({
      profile: { fcmToken: 'tok' }, permission: 'granted',
      fetch: async () => ({ ok: false, status: 404, json: async () => ({ ok: false, error: 'fcm_rejected', fcm: { error: { status: 'NOT_FOUND' } } }) })
    });
    await e.api.sendTestNotif();
    ok('token périmé → statut FCM brut ajouté entre crochets',
       /\[NOT_FOUND\]/.test(e.toasts[0].m), e.toasts[0].m);
    ok('… avec la marche à suivre', /réactive/.test(e.toasts[0].m), e.toasts[0].m);
  }
  {
    const e = makeEnv({
      profile: { fcmToken: 'tok' }, permission: 'granted',
      fetch: async () => ({ ok: false, status: 500, json: async () => ({ ok: false, error: 'un_code_inconnu' }) })
    });
    await e.api.sendTestNotif();
    ok('code serveur inconnu → affiché brut plutôt qu\'effacé',
       /un_code_inconnu/.test(e.toasts[0].m), e.toasts[0].m);
  }
  {
    const e = makeEnv({
      profile: { fcmToken: 'tok' }, permission: 'granted',
      fetch: async () => ({ ok: false, status: 502, json: async () => { throw new Error('pas du JSON'); } })
    });
    await e.api.sendTestNotif();
    ok('réponse illisible → on tombe sur le code HTTP, sans exception',
       /HTTP 502/.test(e.toasts[0].m), e.toasts[0].m);
  }
  {
    let body = null;
    const e = makeEnv({
      profile: { fcmToken: 'tok-abc' }, permission: 'granted',
      fetch: async (u, o) => { body = JSON.parse(o.body); return { ok: true, status: 200, json: async () => ({ ok: true, name: 'x' }) }; }
    });
    await e.api.sendTestNotif();
    ok('succès → toast de confirmation', /Vérifie le centre de notif/.test(e.toasts[0].m), e.toasts[0].m);
    ok('succès → l\'heure d\'envoi reste sous le bouton', /Envoyée à \d\d:\d\d/.test(e.sub.innerHTML), e.sub.innerHTML);
    ok('succès → la ligne n\'est pas rouge', e.sub.style.color === '');
    ok('le token du profil est bien envoyé', body && body.token === 'tok-abc', JSON.stringify(body));
    ok('titre et corps sont fournis', body && !!body.title && !!body.body);
  }

  const bad = R.filter(x => !x).length;
  console.log('\n' + (R.length - bad) + '/' + R.length + ' assertions' + (bad ? ' — ' + bad + ' ÉCHEC(S)' : ' — OK'));
  process.exit(bad ? 1 : 0);
})();
