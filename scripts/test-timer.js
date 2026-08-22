// Harnais : rejoue le scénario "je lance le timer, je vais sur YouTube".
// La seule couche qui survit à l'app endormie est le push FCM différé
// (couche 4). Ce test vérifie qu'elle s'arme vraiment.
//   node scripts/test-timer.js                  # version courante
//   node scripts/test-timer.js <autre.html>     # comparer une version
const fs = require('fs');
const path = require('path');
const target = process.argv[2] || path.join(__dirname, '..', 'index.html');
const html = fs.readFileSync(target, 'utf8');

function extract(name) {
  const start = html.indexOf('function ' + name + '(');
  if (start < 0) return null;
  let i = html.indexOf('{', html.indexOf('(', start)), d = 0, j = i;
  for (; j < html.length; j++) {
    if (html[j] === '{') d++;
    else if (html[j] === '}') { d--; if (!d) { j++; break; } }
  }
  return html.slice(start, j);
}

const R = [];
function ok(label, cond, detail) {
  R.push(cond);
  console.log((cond ? '  PASS  ' : '  FAIL  ') + label + (detail && !cond ? '  → ' + detail : ''));
}

// Construit un bac à sable avec les vraies fonctions de la couche push.
function build(opts) {
  const calls = { fetches: [], toasts: [], registerCalled: 0 };
  const store = { ah_profile: JSON.stringify(opts.profile || {}) };
  const localStorage = {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; },
  };
  const Notification = opts.permission === undefined
    ? undefined
    : { permission: opts.permission };
  const window_ = {
    _registerFCMToken: opts.canRegister
      ? () => { calls.registerCalled++;
                store.ah_profile = JSON.stringify(
                  Object.assign(JSON.parse(store.ah_profile), { fcmToken: 'TOK_' + 'x'.repeat(40) }));
                return Promise.resolve('TOK_' + 'x'.repeat(40)); }
      : undefined,
  };
  const fetch = (url, init) => {
    calls.fetches.push({ url, body: init && init.body ? JSON.parse(init.body) : null });
    return Promise.resolve({ ok: true, status: 202 });
  };
  const tim_toast = (m) => calls.toasts.push(m);

  const names = ['_tim_fcmGetToken', '_tim_fcmEnsureToken', '_tim_setAlertState',
                 '_tim_announceAlert', 'tim_fcmSchedulePush', 'tim_fcmCancelPush'];
  const srcs = names.map(extract).filter(Boolean);
  const preamble = `
    var _tim_fcmTimerId = null;
    var TIM_FCM_MAX_DELAY = 14 * 60 * 1000;
    var _tim_alertState = null, _tim_alertReason = '';
    var _tim_alertAnnounced = false, _tim_alertAnnounceTimer = null;
  `;
  const fn = new Function('localStorage', 'Notification', 'window', 'fetch', 'tim_toast',
    'console', 'setTimeout', 'clearTimeout', 'Promise',
    preamble + srcs.join('\n') +
    '\nreturn { schedule: tim_fcmSchedulePush, state: function(){ return _tim_alertState; },' +
    ' reason: function(){ return _tim_alertReason; } };');
  const api = fn(localStorage, Notification, window_, fetch, tim_toast,
                 console, setTimeout, clearTimeout, Promise);
  return { api, calls };
}

const tick = () => new Promise(r => setImmediate(() => setImmediate(r)));

(async function () {
  console.log('\n=== SCÉNARIO DU BUG ===');
  console.log('Permission accordée DEPUIS le timer → aucun fcmToken enregistré.\n');
  {
    const { api, calls } = build({ permission: 'granted', profile: {}, canRegister: true });
    api.schedule(Date.now() + 90000);
    await tick(); await tick();
    ok('le token est enregistré à la volée', calls.registerCalled === 1);
    ok('la couche push est bien armée (appel serveur parti)',
       calls.fetches.some(f => f.url.indexOf('timer-alert-background') > -1));
    const f = calls.fetches.find(x => x.url.indexOf('timer-alert-background') > -1);
    ok('le token part bien dans la requête', !!(f && f.body && f.body.token));
    ok('état rapporté = push', api.state() === 'push', api.state() + '/' + api.reason());
    ok('toast honnête (alerte armée)', calls.toasts.some(t => t.indexOf('armée') > -1));
  }

  console.log('\n=== TOKEN DÉJÀ PRÉSENT (cas nominal) ===\n');
  {
    const { api, calls } = build({ permission: 'granted',
      profile: { fcmToken: 'T'.repeat(45) }, canRegister: true });
    api.schedule(Date.now() + 60000);
    await tick(); await tick();
    ok('pas de ré-enregistrement inutile', calls.registerCalled === 0);
    ok('couche push armée', api.state() === 'push');
  }

  console.log('\n=== NOTIFICATIONS REFUSÉES ===\n');
  {
    const { api, calls } = build({ permission: 'denied', profile: {}, canRegister: true });
    api.schedule(Date.now() + 60000);
    await tick(); await tick();
    ok('aucun appel serveur inutile',
       !calls.fetches.some(f => f.url.indexOf('timer-alert-background') > -1));
    ok('état rapporté = local', api.state() === 'local');
    ok('l\'utilisateur est prévenu de garder l\'app ouverte',
       calls.toasts.some(t => t.indexOf('Garde l\'app ouverte') > -1));
  }

  console.log('\n=== TIMER TROP LONG (> 14 min) ===\n');
  {
    const { api, calls } = build({ permission: 'granted',
      profile: { fcmToken: 'T'.repeat(45) }, canRegister: true });
    api.schedule(Date.now() + 20 * 60 * 1000);
    await tick(); await tick();
    ok('pas d\'appel hors fenêtre background',
       !calls.fetches.some(f => f.url.indexOf('timer-alert-background') > -1));
    ok('état dégradé annoncé', api.state() === 'local');
    ok('raison explicite donnée', /trop long/.test(api.reason()), api.reason());
  }

  console.log('\n=== ANNULATION PENDANT L\'ENREGISTREMENT DU TOKEN ===\n');
  {
    const { api, calls } = build({ permission: 'granted', profile: {}, canRegister: true });
    api.schedule(Date.now() + 60000);
    api.schedule(Date.now() + 120000);   // re-réglage immédiat
    await tick(); await tick(); await tick();
    const armed = calls.fetches.filter(f => f.url.indexOf('timer-alert-background') > -1);
    ok('un seul timer armé malgré le re-réglage', armed.length === 1,
       armed.length + ' armés');
  }

  const failed = R.filter(x => !x).length;
  console.log('\n' + '='.repeat(58));
  console.log(failed ? 'RÉSULTAT : ' + failed + ' ÉCHEC(S) sur ' + R.length
                     : 'RÉSULTAT : ' + R.length + '/' + R.length + ' tests passés.');
  process.exit(failed ? 1 : 0);
})();
