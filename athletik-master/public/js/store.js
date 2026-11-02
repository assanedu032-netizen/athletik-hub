/* ════════════════════════════════════════════════════════════════════════════
 * Athletik Master — STOCKAGE
 * Deux implémentations, une même interface :
 *   DemoStore   : tout dans localStorage (clé am_demo_v1), moteur exécuté dans
 *                 le navigateur, quiz de démo, horloge avançable. Données
 *                 FICTIVES, séparées de la production.
 *   RemoteStore : Firebase Auth (même projet qu'Athletik Hub) + API serveur
 *                 /.netlify/functions/master-api qui fait foi.
 * Interface : init() → session | null, act(action) → { state, events, result },
 *             now(), admin(action, payload), signOut().
 * ════════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var DEMO_KEY = 'am_demo_v1';

  function lsGet(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function tz() { return -new Date().getTimezoneOffset(); }

  // ─── Démo ─────────────────────────────────────────────────────────────────
  // Le contenu de la démo suit le même circuit que la production (brouillon →
  // publication), mais stocké sur l'appareil (clé am_demo_content).
  var DEMO_CONTENT_KEY = 'am_demo_content';
  function DemoStore(base) {
    this.demo = true;
    this.base = base;
    this.content = lsGet(DEMO_CONTENT_KEY) || { published: { ov: null, keys: {}, version: 0 }, draft: null };
    this.data = lsGet(DEMO_KEY);
    this.rebuild();
  }
  DemoStore.prototype.rebuild = function () {
    var pub = this.content.published;
    this.program = AMContent.merge(this.base, pub.ov);
    var pack = AMDemo.withDemoQuizzes(this.program, pub.keys);
    this.engine = AMEngine.createEngine(pack.content, { quizKeys: pack.quizKeys });
  };
  DemoStore.prototype.contentCall = function (action, payload) {
    var c = this.content, self = this;
    var draft = c.draft || { ov: c.published.ov || AMContent.emptyOverrides(), keys: c.published.keys || {} };
    return new Promise(function (resolve) {
      if (action === 'get') return resolve({ published: c.published, draft: draft });
      if (action === 'publish') {
        c.published = { ov: draft.ov, keys: draft.keys, version: (c.published.version || 0) + 1, publishedAt: Date.now() };
        c.draft = null;
        lsSet(DEMO_CONTENT_KEY, c); self.rebuild();
        return resolve({ ok: true, version: c.published.version });
      }
      if (action === 'discard') { c.draft = null; lsSet(DEMO_CONTENT_KEY, c); return resolve({ ok: true }); }
      c.draft = AMContent.draftOp(self.base, draft, Object.assign({ action: action }, payload)); // lève si invalide
      lsSet(DEMO_CONTENT_KEY, c);
      resolve({ ok: true, draft: c.draft });
    });
  };
  DemoStore.prototype.now = function () { return Date.now() + ((this.data && this.data.offset) || 0); };
  DemoStore.prototype.save = function () { lsSet(DEMO_KEY, this.data); };
  DemoStore.prototype.start = function (name) {
    var now = Date.now();
    this.data = {
      offset: 0,
      profile: { name: name || 'Athlète démo', email: 'demo@athletik-master.local' },
      state: this.engine.newState(now, tz()),
      access: { plan: 'installments', installments: 3, payments: [{ id: 'demo-1', at: now, amount: null }] },
      contacted: {}
    };
    this.save();
  };
  DemoStore.prototype.session = function () {
    var acc = AMAccess.summarize(this.data.access, this.now());
    return {
      profile: this.data.profile, state: this.data.state,
      access: { status: acc.status, plan: acc.plan, paid: acc.paid, needed: acc.needed, fullyPaid: acc.fullyPaid, parcel: acc.kit.eligible },
      roles: AMAccess.roles({ now: this.now(), access: this.data.access, hubDoc: null, grants: this.data.state.grants, isAdmin: true }),
      shipping: this.data.shipping || null, uid: 'demo-me'
    };
  };
  DemoStore.prototype.init = function () {
    return Promise.resolve(this.data ? this.session() : null);
  };
  DemoStore.prototype.act = function (action) {
    var self = this;
    return new Promise(function (resolve) {
      if (action.type === 'profile') {
        self.data.profile.name = String(action.name || '').slice(0, 60);
        self.save();
        return resolve({ state: self.data.state, events: [], result: null });
      }
      var r = self.engine.apply(self.data.state, action, self.now()); // lève une EngineError
      self.data.state = r.state;
      self.save();
      resolve(r);
    });
  };
  // Outils de démo uniquement
  DemoStore.prototype.travel = function (ms) { this.data.offset = (this.data.offset || 0) + ms; this.save(); };
  DemoStore.prototype.reset = function () { try { localStorage.removeItem(DEMO_KEY); } catch (e) {} this.data = null; };
  DemoStore.prototype.resetContent = function () {
    try { localStorage.removeItem(DEMO_CONTENT_KEY); } catch (e) {}
    this.content = { published: { ov: null, keys: {}, version: 0 }, draft: null };
    this.rebuild();
  };
  DemoStore.prototype.simulateFullPayment = function () {
    var a = this.data.access, first = a.payments[0].at, now = this.now();
    while (a.payments.length < (a.installments || 3)) a.payments.push({ id: 'demo-' + (a.payments.length + 1), at: now, amount: null });
    // délai de rétractation : 14 jours après le premier paiement
    if (now < first + 14 * 864e5) this.travel(first + 14 * 864e5 - now + 1000);
    this.save();
  };
  DemoStore.prototype.simulateDelivery = function () { this.data.shipping = { confirmedAt: this.now(), demo: true }; this.save(); };
  DemoStore.prototype.admin = function (action, payload) {
    var now = this.now();
    if (action === 'list') {
      var me = { uid: 'demo-me', name: this.data.profile.name + ' (toi)', email: this.data.profile.email, state: this.data.state, access: this.data.access, contacted: this.data.contacted, shipping: this.data.shipping };
      var people = [me].concat(AMDemo.demoParticipants(this.engine, now));
      var eng = this.engine;
      return Promise.resolve({ serverNow: now, participants: people.map(function (p) { return AMAccess.participantSummary(eng, p, now); }) });
    }
    if (action === 'contacted' && payload.uid === 'demo-me') { this.data.contacted['d' + payload.day] = now; this.save(); }
    return Promise.resolve({ ok: true, demoOnly: action !== 'contacted' });
  };
  DemoStore.prototype.signOut = function () { return Promise.resolve(); };

  // ─── Production ───────────────────────────────────────────────────────────
  var FB = 'https://www.gstatic.com/firebasejs/10.13.0/';
  function RemoteStore(cfg) {
    this.demo = false;
    this.cfg = cfg;
    this.offset = 0;
    this.fb = null;
  }
  RemoteStore.prototype.load = function () {
    var self = this;
    if (self.fb) return Promise.resolve(self.fb);
    return Promise.all([import(FB + 'firebase-app.js'), import(FB + 'firebase-auth.js')]).then(function (m) {
      var app = m[0].initializeApp(self.cfg.firebase);
      var auth = m[1].getAuth(app);
      self.fb = { auth: auth, A: m[1] };
      return self.fb;
    });
  };
  RemoteStore.prototype.currentUser = function () {
    var self = this;
    return this.load().then(function (fb) {
      return new Promise(function (resolve) {
        var off = fb.A.onAuthStateChanged(fb.auth, function (u) { off(); resolve(u); });
      });
    });
  };
  RemoteStore.prototype.now = function () { return Date.now() + this.offset; };
  RemoteStore.prototype.call = function (fn, body) {
    var self = this;
    return this.load().then(function (fb) {
      var u = fb.auth.currentUser;
      if (!u) { var e = new Error('Non connecté'); e.code = 'auth_required'; throw e; }
      return u.getIdToken().then(function (tok) {
        return fetch(self.cfg.apiBase + '/' + fn, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok },
          body: JSON.stringify(body)
        });
      });
    }).then(function (res) {
      return res.json().catch(function () { return { error: 'server_error' }; }).then(function (j) {
        if (j && j.serverNow) self.offset = j.serverNow - Date.now();
        if (!res.ok) {
          var e = new Error(j.message || j.error || 'Erreur serveur');
          e.code = j.error || 'server_error';
          e.status = res.status;
          throw e;
        }
        return j;
      });
    }).catch(function (e) {
      if (!e.code) { e.code = 'network'; e.message = 'Connexion impossible. Vérifie ton réseau.'; }
      throw e;
    });
  };
  RemoteStore.prototype.init = function () {
    var self = this;
    return this.currentUser().then(function (u) {
      if (!u) return null;
      return self.call('master-api', { action: 'state', tz: tz() });
    });
  };
  RemoteStore.prototype.act = function (action) {
    var body = Object.assign({}, action, { action: action.type });
    delete body.type;
    return this.call('master-api', body);
  };
  RemoteStore.prototype.contentCall = function (action, payload) {
    return this.call('master-content', Object.assign({ action: action }, payload || {}));
  };
  // Contenu publié (public, sans authentification), mis en cache pour le hors-ligne.
  RemoteStore.prototype.fetchPublished = function () {
    var self = this;
    return fetch(self.cfg.apiBase + '/master-content', { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error('content ' + r.status);
      return r.json();
    }).then(function (j) { lsSet('am_content_cache', j); return j; })
      .catch(function () { return lsGet('am_content_cache') || { ov: null, version: 0 }; });
  };
  RemoteStore.prototype.admin = function (action, payload) {
    return this.call('master-admin', Object.assign({ action: action }, payload || {}));
  };
  RemoteStore.prototype.signIn = function (email, pass) {
    return this.load().then(function (fb) { return fb.A.signInWithEmailAndPassword(fb.auth, email, pass); });
  };
  RemoteStore.prototype.signUp = function (email, pass) {
    return this.load().then(function (fb) {
      return fb.A.createUserWithEmailAndPassword(fb.auth, email, pass).then(function (c) {
        return fb.A.sendEmailVerification(c.user).then(function () { return c; });
      });
    });
  };
  RemoteStore.prototype.google = function () {
    return this.load().then(function (fb) { return fb.A.signInWithPopup(fb.auth, new fb.A.GoogleAuthProvider()); });
  };
  RemoteStore.prototype.resetPassword = function (email) {
    return this.load().then(function (fb) { return fb.A.sendPasswordResetEmail(fb.auth, email); });
  };
  RemoteStore.prototype.resendVerification = function () {
    return this.load().then(function (fb) { return fb.A.sendEmailVerification(fb.auth.currentUser); });
  };
  RemoteStore.prototype.refreshUser = function () {
    return this.load().then(function (fb) {
      var u = fb.auth.currentUser;
      return u.reload().then(function () { return u.getIdToken(true); });
    });
  };
  RemoteStore.prototype.signOut = function () {
    return this.load().then(function (fb) { return fb.A.signOut(fb.auth); });
  };

  window.AMStore = { DEMO_CONTENT_KEY: DEMO_CONTENT_KEY, DemoStore: DemoStore, RemoteStore: RemoteStore, DEMO_KEY: DEMO_KEY, lsGet: lsGet, lsSet: lsSet };
})();
