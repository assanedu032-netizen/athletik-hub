/* ════════════════════════════════════════════════════════════════════════════
 * Athletik Master — INTERFACE
 * Routeur par hash, vues rendues en chaînes HTML, un seul écouteur de clics
 * délégué (data-act). Les trois supports (checklist, fiche, quiz) sont des
 * composants GÉNÉRIQUES pilotés par content/program.json : aucune mission
 * n'a de code à elle.
 * ════════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var CFG = window.AM_CONFIG || {};
  var MODE_KEY = 'am_mode';
  var APP = {
    program: null, store: null, engine: null, session: null, view: null,
    gate: null, quizSel: {}, quizRes: {}, saveTimers: {}, pending: {}, celebrations: [],
    adminData: null, adminFilter: 'all', installEvt: null, busy: false
  };
  var $app = document.getElementById('app');

  // ─── Utilitaires ──────────────────────────────────────────────────────────
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function attr(s) { return esc(s); }
  var DOW = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
  var MON = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  function hm(ms) { var d = new Date(ms); return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2); }
  function fmtDate(ms) { if (!ms) return '—'; var d = new Date(ms); return d.getDate() + ' ' + MON[d.getMonth()] + ' ' + d.getFullYear(); }
  function fmtShort(ms) { var d = new Date(ms); return DOW[d.getDay()] + ' ' + d.getDate() + ' ' + MON[d.getMonth()]; }
  function localDay(ms) { var d = new Date(ms); return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); }
  function fmtWhen(at) {
    var now = APP.store.now();
    var diff = Math.round((localDay(at) - localDay(now)) / 864e5);
    if (diff <= 0) return 'aujourd\'hui à ' + hm(at);
    if (diff === 1) return 'demain à ' + hm(at);
    return fmtShort(at) + ' à ' + hm(at);
  }
  function fmtIn(at) {
    var ms = at - APP.store.now();
    if (ms <= 0) return 'maintenant';
    var h = Math.floor(ms / 36e5), m = Math.ceil((ms % 36e5) / 6e4);
    if (m === 60) { h++; m = 0; }
    return h ? (h + ' h ' + (m ? ('0' + m).slice(-2) : '')) : (m + ' min');
  }
  function toast(msg, err) {
    var old = document.querySelector('.toast'); if (old) old.remove();
    var t = document.createElement('div');
    t.className = 'toast' + (err ? ' err' : '');
    t.setAttribute('role', 'status');
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, err ? 4500 : 2600);
  }
  function go(hash) { if (location.hash === hash) render(); else location.hash = hash; }

  var E = function () { return APP.engine; };
  function M(id) { return APP.engine.mission(id); }
  function A(id) { return APP.engine.arenaById[id]; }
  function st() { return APP.session.state; }
  function rec(id) { return st().missions[id] || {}; }

  // Règles du jeu : chaque chiffre est lu dans les réglages du moteur.
  function R() {
    var st = APP.program.settings || {};
    return {
      delay: st.defaultUnlockDelayHours != null ? st.defaultUnlockDelayHours : 24,
      q: st.bossQuestionCount || 5,
      pass: st.bossPassMin || 4,
      days: st.programDays || 90
    };
  }
  function bossLine() { var r = R(); return '1 défi + ' + r.q + ' questions. ' + r.pass + ' bonnes réponses sur ' + r.q + ' pour gagner.'; }

  function waLink(kind) {
    var num = String(CFG.whatsappNumber || '').replace(/\D/g, '');
    if (!num) return null;
    var msg = ((APP.program.settings.whatsappMessages || {})[kind]) || '';
    return 'https://wa.me/' + num + (msg ? '?text=' + encodeURIComponent(msg) : '');
  }

  // ─── Démarrage ────────────────────────────────────────────────────────────
  function boot() {
    var src = window.AM_PROGRAM ? Promise.resolve(window.AM_PROGRAM) :
      fetch('content/program.json', { cache: 'no-cache' }).then(function (r) { return r.json(); });
    src.then(function (p) {
      APP.base = p;
      APP.program = p;
      var mode = null;
      try { mode = localStorage.getItem(MODE_KEY); } catch (e) {}
      if (/[?&]demo\b/.test(location.search) || CFG.demoOnly) mode = 'demo';
      if (mode === 'demo') return startDemo(false);
      if (mode === 'remote') return startRemote();
      APP.session = null; render();
    }).catch(function () {
      $app.innerHTML = '<div class="login"><div class="notice warn">Impossible de charger le contenu du programme. Vérifie ta connexion puis recharge la page.</div></div>';
    });
  }

  function setMode(m) { try { if (m) localStorage.setItem(MODE_KEY, m); else localStorage.removeItem(MODE_KEY); } catch (e) {} }

  function startDemo(fresh, name) {
    setMode('demo');
    APP.store = new AMStore.DemoStore(APP.base);
    APP.engine = APP.store.engine;
    APP.program = APP.engine.content;
    if (fresh || !APP.store.data) APP.store.start(name);
    return APP.store.init().then(function (s) { APP.session = s; APP.gate = null; refresh(); });
  }

  function startRemote() {
    setMode('remote');
    APP.store = new AMStore.RemoteStore(CFG);
    $app.innerHTML = '<div class="login"><p class="muted" style="text-align:center">Connexion…</p></div>';
    return loadRemoteContent().then(function () { return APP.store.init(); }).then(function (s) {
      APP.gate = null;
      APP.session = s ? fromServer(s) : null;
      if (s) refresh(); else render();
    }).catch(function (e) {
      APP.session = null;
      APP.gate = e.code || 'server_error';
      render();
    });
  }

  // Contenu = program.json + surcouche publiée depuis l'éditeur (sans redéploiement).
  function loadRemoteContent() {
    return APP.store.fetchPublished().then(function (pub) {
      APP.program = AMContent.merge(APP.base, pub && pub.ov);
      APP.engine = AMEngine.createEngine(APP.program, { assumeKeys: true });
    });
  }
  function reloadContent() {
    if (APP.store.demo) { APP.engine = APP.store.engine; APP.program = APP.engine.content; return Promise.resolve(); }
    return loadRemoteContent();
  }

  function fromServer(j) {
    return { profile: j.profile, state: j.state, access: j.access, roles: j.roles, shipping: j.shipping || null, uid: j.uid || null };
  }

  function refresh() {
    if (APP.session) APP.view = APP.engine.view(APP.session.state, APP.store.now());
    render();
  }

  // ─── Actions ──────────────────────────────────────────────────────────────
  function act(action, opts) {
    opts = opts || {};
    if (route().name === 'apercu') { toast('Aperçu du brouillon : publie le contenu pour l\'essayer pour de vrai.'); return Promise.reject(new Error('preview')); }
    return APP.store.act(action).then(function (r) {
      if (r.state) APP.session.state = r.state;
      if (r.access) APP.session.access = r.access;
      if (r.roles) APP.session.roles = r.roles;
      if (r.profile) APP.session.profile = r.profile;
      if (r.shipping !== undefined) APP.session.shipping = r.shipping;
      APP.view = APP.engine.view(APP.session.state, APP.store.now());
      handleEvents(r.events || []);
      if (!opts.silent) render();
      return r;
    }).catch(function (e) {
      toast(e.message || 'Erreur', true);
      if (e.code === 'auth_required') { APP.session = null; render(); }
      throw e;
    });
  }

  function handleEvents(events) {
    var finished = false;
    events.forEach(function (ev) {
      if (ev.type === 'reward') {
        var rw = APP.engine.rewardById[ev.id];
        var sub = rw.type === 'card' ? 'Nouveau rang : ' + rw.rank : 'Boss vaincu !';
        var extra = '';
        if (rw.grant) extra = '+ ' + rw.grant.label + ' — enregistré sur ton compte. Son activation dans Athletik Hub sera faite dès que le lien entre les deux apps est branché.';
        if (rw.physical && APP.session.access && APP.session.access.parcel) extra = '📬 ' + rw.physical + ' : un colis est en route.';
        APP.celebrations.push({ art: rw.type === 'badge' ? '🏆' : (rw.rank || rw.title), kind: rw.type, eyebrow: 'Récompense obtenue', title: rw.title, sub: sub, extra: extra });
      } else if (ev.type === 'habit') {
        var h = APP.engine.habitById[ev.id];
        APP.celebrations.push({ art: '✓', kind: 'habit', eyebrow: 'Nouvelle habitude débloquée', title: h.title, sub: h.frequency + ' · elle reste active jusqu\'à la fin des 90 jours.', extra: '', link: '#/habitudes', linkLabel: 'Mes habitudes du jour' });
      } else if (ev.type === 'duration_done') {
        toast('Durée atteinte : tu peux valider la mission.');
      } else if (ev.type === 'arena_done' && ev.id !== 'a8') {
        var nx = nextArena(ev.id);
        if (nx) toast('Arène terminée ! « ' + nx.name + ' » s\'ouvre dans 24 h.');
      } else if (ev.type === 'finished') {
        finished = true;
      }
    });
    if (finished) APP.afterCelebrate = '#/fin';
    showCelebration();
  }
  function nextArena(id) {
    var arr = APP.program.arenas, i = arr.map(function (a) { return a.id; }).indexOf(id);
    return arr[i + 1] || null;
  }

  function showCelebration() {
    if (document.querySelector('.overlay')) return;
    var c = APP.celebrations.shift();
    if (!c) {
      if (APP.afterCelebrate) { var h = APP.afterCelebrate; APP.afterCelebrate = null; go(h); }
      return;
    }
    var o = document.createElement('div');
    o.className = 'overlay';
    o.setAttribute('role', 'dialog');
    o.setAttribute('aria-modal', 'true');
    o.innerHTML = '<div class="celebrate">' +
      '<div class="bigart ' + esc(c.kind) + '">' + esc(c.art) + '</div>' +
      '<div class="eyebrow">' + esc(c.eyebrow) + '</div>' +
      '<h2 class="h-display" style="font-size:32px;margin:6px 0">' + esc(c.title) + '</h2>' +
      '<p class="muted">' + esc(c.sub) + '</p>' +
      (c.extra ? '<p class="small" style="color:var(--gold2)">' + esc(c.extra) + '</p>' : '') +
      '<button class="btn primary block" data-act="closeCelebrate" style="margin-top:14px">Continuer</button>' +
      (c.link ? '<a class="btn ghost block" href="' + c.link + '" data-act="closeCelebrate" style="margin-top:8px">' + esc(c.linkLabel) + '</a>' : '') +
      '</div>';
    document.body.appendChild(o);
    var b = o.querySelector('button'); if (b) b.focus();
  }

  // ─── Rendu principal ──────────────────────────────────────────────────────
  function route() {
    var h = (location.hash || '#/').slice(1);
    var parts = h.split('/').filter(Boolean);
    return { name: parts[0] || 'accueil', arg: parts[1] ? decodeURIComponent(parts[1]) : null, arg2: parts[2] ? decodeURIComponent(parts[2]) : null };
  }

  function render() {
    var y = window.scrollY, r = route(), keep = APP.lastRoute === location.hash;
    APP.lastRoute = location.hash;
    if (!APP.session) { $app.innerHTML = APP.gate ? renderGate(APP.gate) : renderLogin(); return; }
    APP.view = APP.engine.view(APP.session.state, APP.store.now());
    if (!st().introSeenAt && r.name !== 'debut' && r.name !== 'regles') { location.replace('#/debut'); r = route(); }
    var body;
    switch (r.name) {
      case 'carte': body = viewMap(); break;
      case 'arene': body = viewArena(r.arg); break;
      case 'mission': body = viewMission(r.arg); break;
      case 'habitudes': body = viewHabits(); break;
      case 'recompenses': body = viewRewards(); break;
      case 'regles': body = viewRules(); break;
      case 'profil': body = viewProfile(); break;
      case 'admin': body = viewAdmin(); break;
      case 'contenu': body = viewContent(r.arg, r.arg2); break;
      case 'apercu': body = viewPreview(r.arg); break;
      case 'debut': body = viewStart(); break;
      case 'fin': body = viewEnd(); break;
      default: body = viewDashboard();
    }
    var tab = { accueil: 'accueil', carte: 'carte', arene: 'carte', mission: 'carte', regles: 'carte', habitudes: 'habitudes', recompenses: 'recompenses', fin: 'recompenses', profil: 'profil', admin: 'profil', contenu: 'profil', apercu: 'profil', debut: 'accueil' }[r.name] || 'accueil';
    $app.innerHTML = shell(body, tab);
    window.scrollTo(0, keep ? y : 0);
    if (r.name === 'admin' && !APP.adminData) loadAdmin();
    if ((r.name === 'contenu' || r.name === 'apercu') && !APP.contentData && !APP.contentLoading) loadContentAdmin();
  }

  // Icônes au trait (barre de navigation)
  var ICON = {
    accueil: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v9.5h13V10"/>',
    carte: '<path d="M9 4 3 6.5v13L9 17l6 2.5 6-2.5v-13L15 6.5 9 4z"/><path d="M9 4v13M15 6.5v13"/>',
    habitudes: '<rect x="4" y="4" width="16" height="16" rx="4"/><path d="m8.5 12.5 2.5 2.5 4.5-5"/>',
    recompenses: '<path d="M8 4h8v5a4 4 0 0 1-8 0V4z"/><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8.5 20h7"/>',
    profil: '<circle cx="12" cy="8.5" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/>'
  };
  function icon(n) { return '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + ICON[n] + '</svg>'; }

  function shell(body, tab) {
    var v = APP.view;
    var day = Math.min(Math.max(v.day, 1), v.programDays);
    var tabs = [['accueil', 'Accueil'], ['carte', 'Carte'], ['habitudes', 'Habitudes'], ['recompenses', 'Récompenses'], ['profil', 'Profil']];
    return (APP.store.demo ? '<div class="demo-bar">Démo · données fictives <button data-act="travel" data-ms="86400000">+24 h</button><button data-act="goProfile">Outils</button></div>' : '') +
      '<header class="topbar"><img class="logo" src="icons/icon-192.png" alt=""><span class="brand">Athletik Master</span>' +
      '<span class="spacer"></span><span class="daypill" title="Jour du programme">J' + day + '<small>/' + v.programDays + '</small></span></header>' +
      '<nav class="tabbar" aria-label="Navigation principale">' + tabs.map(function (t) {
        var on = tab === t[0];
        return '<a href="#/' + (t[0] === 'accueil' ? '' : t[0]) + '" class="' + (on ? 'on' : '') + '"' + (on ? ' aria-current="page"' : '') + '>' + icon(t[0]) + '<span>' + t[1] + '</span></a>';
      }).join('') + '</nav>' +
      '<main class="page">' + body + '</main>';
  }

  // ─── Connexion et écrans d'accès ──────────────────────────────────────────
  function renderLogin() {
    var signup = APP.loginTab === 'signup';
    return '<div class="login">' +
      '<img class="logo" src="icons/icon-192.png" alt="">' +
      '<h1 class="h-display" style="font-size:42px">ATHLETIK MASTER</h1>' +
      '<p class="tag">Deviens l\'athlète dont tu as toujours rêvé.</p>' +
      '<div class="card stack">' +
      '<div class="filters" role="tablist"><button role="tab" data-act="loginTab" data-tab="signin" class="' + (!signup ? 'on' : '') + '">Se connecter</button><button role="tab" data-act="loginTab" data-tab="signup" class="' + (signup ? 'on' : '') + '">Créer mon compte</button></div>' +
      '<p class="small muted" style="margin:0">' + (signup ? 'Utilise l\'email de ton achat. Tu recevras un email pour le vérifier.' : 'Mêmes identifiants qu\'Athletik Hub.') + '</p>' +
      '<form id="loginForm" class="stack" style="margin-top:4px">' +
      '<div><label class="small" for="lEmail">Email</label><input class="input" id="lEmail" type="email" autocomplete="email" required></div>' +
      '<div><label class="small" for="lPass">Mot de passe</label><input class="input" id="lPass" type="password" autocomplete="' + (signup ? 'new-password' : 'current-password') + '" minlength="6" required></div>' +
      '<button class="btn primary block" type="submit">' + (signup ? 'Créer mon compte' : 'Se connecter') + '</button>' +
      '</form>' +
      (!signup ? '<button class="linkbtn small" data-act="forgot">Mot de passe oublié ?</button>' : '') +
      '<div class="or">ou</div>' +
      '<button class="btn block" data-act="google">Continuer avec Google</button>' +
      '</div>' +
      '<div class="card" style="margin-top:16px;text-align:center">' +
      '<p style="margin:0 0 10px"><b>Pas encore de compte ? Teste l\'expérience.</b></p>' +
      '<button class="btn block" data-act="demo">Découvrir en mode démo</button>' +
      '<p class="tiny" style="margin:8px 0 0">Données fictives, enregistrées sur cet appareil uniquement.</p>' +
      '</div></div>';
  }

  function renderGate(code) {
    var title, text, btns = '';
    if (code === 'no_access') {
      title = 'Ton accès n\'est pas encore actif';
      text = 'L\'accès s\'ouvre dès que Systeme.io nous confirme ton paiement. Si tu viens de payer, attends une minute puis réessaie. Connecte-toi bien avec l\'email utilisé lors de l\'achat.';
      if (CFG.salesUrl) btns += '<a class="btn primary block" href="' + attr(CFG.salesUrl) + '" target="_blank" rel="noopener">Découvrir Athletik Master</a>';
    } else if (code === 'email_not_verified') {
      title = 'Vérifie ton email';
      text = 'Pour protéger ton accès, ton adresse doit être vérifiée. Ouvre l\'email que nous venons de t\'envoyer et clique sur le lien, puis reviens ici.';
      btns += '<button class="btn primary block" data-act="verified">J\'ai vérifié mon email</button><button class="btn block" data-act="resend">Renvoyer l\'email</button>';
    } else if (code === 'not_configured' || code === 'network' || code === 'server_error' || code === 'method_not_allowed') {
      title = 'Service indisponible';
      text = code === 'network' ? 'Connexion impossible. Vérifie ton réseau.' :
        'Le serveur d\'Athletik Master n\'est pas encore configuré (fonctions Netlify et variables d\'environnement). Le mode démo reste disponible.';
      btns += '<button class="btn block" data-act="demo">Ouvrir le mode démo</button>';
    } else {
      title = 'Connexion impossible';
      text = 'Une erreur est survenue (' + esc(code) + ').';
    }
    return '<div class="login"><img class="logo" src="icons/icon-192.png" alt=""><div class="card stack">' +
      '<h2 class="h-display">' + esc(title) + '</h2><p class="muted">' + esc(text) + '</p>' +
      '<button class="btn block" data-act="retry">Réessayer</button>' + btns +
      '<button class="linkbtn small" data-act="signout">Se déconnecter</button></div></div>';
  }

  // ─── Début / fin de programme ─────────────────────────────────────────────
  function viewStart() {
    var name = (APP.session.profile && APP.session.profile.name) || '';
    return '<div class="stack-lg">' +
      '<section class="intro"><div class="eyebrow">Début du programme</div>' +
      '<h1 class="h-display">Bienvenue' + (name ? ', ' + esc(name.split(' ')[0]) : '') + '</h1>' +
      '<p class="lead">90 jours pour devenir l\'athlète dont tu as toujours rêvé.</p></section>' +
      '<ol class="facts">' +
      '<li><b>Niveau 0</b><span>6 étapes, toutes ouvertes aujourd\'hui.</span></li>' +
      '<li><b>8 arènes</b><span>Une mission par jour, un boss à la fin de chacune.</span></li>' +
      '<li><b>8 habitudes</b><span>Une par arène. Elles restent jusqu\'au 90ᵉ jour.</span></li></ol>' +
      '<p class="muted">La seule règle : regarde, fais l\'action, valide. La mission suivante s\'ouvre ' + R().delay + ' h plus tard.</p>' +
      '<button class="btn primary block" data-act="startProgram">' + (st().introSeenAt ? 'Aller au niveau 0' : 'Commencer le niveau 0') + '</button>' +
      '<a class="btn ghost block" href="#/regles">Règles du jeu</a></div>';
  }

  function viewEnd() {
    var v = APP.view;
    if (!v.finished) {
      return '<div class="stack-lg"><section class="intro"><div class="eyebrow">Fin du programme</div><h1 class="h-display">La ligne d\'arrivée</h1>' +
        '<p class="lead">Au bout de l\'arène 8 : refais tes tests physiques et envoie ta vidéo de fin. C\'est gagné dès que c\'est fait.</p></section>' +
        '<div class="progress"><i style="width:' + v.progress + '%"></i></div><p class="small muted">' + v.validatedCount + ' / ' + v.totalCount + ' missions validées</p>' +
        '<a class="btn block" href="#/carte">Voir la carte</a></div>';
    }
    var wa = waLink('final');
    return '<div class="stack-lg">' +
      '<section class="intro center"><div class="trophy-card">ATHLETIK<br>MASTER</div><div class="eyebrow">Fin du programme</div>' +
      '<h1 class="h-display">Tu es Athletik Master</h1><p class="lead">90 jours, 8 arènes, 8 habitudes installées.</p></section>' +
      '<div class="card stack"><h3>Ta vidéo de fin</h3><p class="muted">Envoie-la à Alassane : elle sera comparée à celle du départ.</p>' +
      (wa ? '<a class="btn wa block" href="' + attr(wa) + '" target="_blank" rel="noopener">Envoyer sur WhatsApp</a>' : '<p class="tiny">Lien WhatsApp bientôt disponible.</p>') + '</div>' +
      '<div class="card stack"><h3>Et maintenant ?</h3><p class="muted">Tout reste ouvert. Reprends une mission quand tu veux, ou recommence le parcours.</p>' +
      '<a class="btn block" href="#/carte">Revoir les missions</a>' +
      '<button class="btn ghost block" data-act="restart" data-ok="Recommencer" data-confirm="Recommencer le parcours ? Tes récompenses, tes habitudes et tes droits restent acquis.">Recommencer le parcours</button></div></div>';
  }

  // ─── Tableau de bord ──────────────────────────────────────────────────────
  function viewDashboard() {
    var v = APP.view, s = APP.session;
    var name = (s.profile && s.profile.name) || 'athlète';
    var arena = v.currentArena ? A(v.currentArena) : null;
    var h = '<div class="stack-lg">';
    h += '<section class="hello"><div class="eyebrow">' + esc(arena ? arena.label + ' · ' + arena.name : 'Parcours terminé') + '</div><h1 class="h-display">Salut ' + esc(name.split(' ')[0]) + '</h1></section>';
    h += nextCard();
    h += '<a class="prog-line" href="#/carte"><span class="ring" style="--p:' + v.progress + '" role="img" aria-label="' + v.progress + ' % du parcours"><span>' + v.progress + '%</span></span>' +
      '<span class="grow"><b>' + v.validatedCount + ' / ' + v.totalCount + ' missions</b><span class="small muted">' + esc(v.rank ? 'Rang ' + v.rank : 'Rookie à la fin du niveau 0') + '</span></span><span class="chev" aria-hidden="true">›</span></a>';
    h += parcelCard();
    if (v.habits.length) {
      h += '<section><div class="section-title"><h2>Habitudes du jour</h2><a href="#/habitudes">Tout voir</a></div><div class="list">' + v.habits.map(habitRow).join('') + '</div></section>';
    }
    var last = v.rewards[v.rewards.length - 1];
    if (last) h += '<a class="prog-line" href="#/recompenses"><span class="medal" aria-hidden="true">★</span><span class="grow"><b>' + esc(last.title) + '</b><span class="small muted">Dernière récompense</span></span><span class="chev" aria-hidden="true">›</span></a>';
    return h + '</div>';
  }

  // ─── Colis : le participant confirme où le recevoir (formulaire Tally) ────
  // La confirmation fait foi quand Tally la renvoie au serveur (tally-webhook) :
  // on n'affiche « confirmée » que sur cette preuve, jamais sur un simple clic.
  function deliveryLink() {
    if (!CFG.deliveryFormUrl) return null;
    var pr = APP.session.profile || {};
    var q = 'uid=' + encodeURIComponent(APP.session.uid || '') + '&email=' + encodeURIComponent(pr.email || '') + '&prenom=' + encodeURIComponent((pr.name || '').split(' ')[0]);
    return CFG.deliveryFormUrl + (CFG.deliveryFormUrl.indexOf('?') < 0 ? '?' : '&') + q;
  }
  function parcelCard() {
    var s = APP.session;
    if (!s.access || !s.access.parcel) return '';
    var sh = s.shipping || null, link = deliveryLink();
    if (sh && sh.confirmedAt) {
      return '<section class="parcel"><span class="parcel-ic" aria-hidden="true">📦</span><div class="grow"><b>Un colis est en route</b>' +
        '<p class="small ok-txt">✓ Livraison confirmée le ' + esc(fmtDate(sh.confirmedAt)) + '</p>' +
        (link ? '<a class="small" href="' + attr(link) + '" target="_blank" rel="noopener">Modifier mes informations ↗</a>' : '') + '</div></section>';
    }
    return '<section class="parcel"><span class="parcel-ic" aria-hidden="true">📦</span><div class="grow"><b>Un colis est en route</b>' +
      '<p class="small muted">Dis-nous où le recevoir : on l\'envoie dans un point relais près de chez toi.</p>' +
      (link ? '<a class="btn primary sm" href="' + attr(link) + '" target="_blank" rel="noopener" data-act="deliveryOpened">Confirmer ma livraison ↗</a>' : '<p class="tiny">Formulaire bientôt disponible.</p>') +
      (APP.deliveryOpened ? '<p class="tiny">Formulaire envoyé ? La confirmation s\'affiche ici dès que nous la recevons.</p>' +
        (APP.store.demo ? '<button class="btn sm ghost" data-act="demoDelivery">Simuler la confirmation (démo)</button>' : '<button class="linkbtn small" data-act="retry">Actualiser</button>') : '') +
      '</div></section>';
  }

  function habitRow(hv) {
    var h = APP.engine.habitById[hv.id];
    var b = function (val, label) {
      return '<button class="' + val + (hv.today === val ? ' on' : '') + '" aria-pressed="' + (hv.today === val) + '" data-act="habit" data-id="' + h.id + '" data-val="' + val + '">' + label + '</button>';
    };
    return '<div class="hrow"><span class="grow"><b>' + esc(h.title) + '</b><span class="tiny">🔥 ' + hv.streak + ' · ' + esc(h.frequency) + '</span></span>' +
      (hv.dueToday ? '<span class="yn sm">' + b('yes', 'Oui') + b('no', 'Non') + '</span>' : '<span class="tiny">Dimanche</span>') + '</div>';
  }

  function nextCard() {
    var v = APP.view;
    if (v.finished) {
      return '<a class="next-card done card-link" href="#/fin"><div class="eyebrow">Parcours terminé</div><h2>Tu es Athletik Master</h2><span class="btn primary sm">Voir la suite</span></a>';
    }
    if (!v.next) return '';
    var m = M(v.next), it = v.items[m.id];
    var label = m.kind === 'boss' ? (m.final ? 'Boss final' : 'Boss') : 'Mission ' + m.num;
    var href = '#/mission/' + encodeURIComponent(m.id);
    if (it.status === 'waiting') {
      return '<a class="next-card wait card-link" href="' + href + '"><div class="eyebrow">Prochaine mission</div><h2>' + esc(m.title) + '</h2>' +
        '<p class="small">🔒 Se débloque ' + esc(fmtWhen(it.unlockAt)) + '</p></a>';
    }
    var started = rec(m.id).checkins || rec(m.id).support;
    var day = it.run ? '<span class="tiny">Jour ' + Math.min(it.run.current + (it.run.todayDone ? 0 : 1), m.durationDays) + '/' + m.durationDays + (it.run.todayDone ? ' · fait aujourd\'hui ✓' : '') + '</span>' : '';
    return '<a class="next-card card-link" href="' + href + '"><div class="eyebrow">Ta mission du jour · ' + esc(label) + '</div><h2>' + esc(m.title) + '</h2>' +
      '<div class="row wrap"><span class="btn primary sm">' + (started ? 'Continuer' : 'Commencer') + '</span>' + day + '</div></a>';
  }

  // ─── Carte des arènes ─────────────────────────────────────────────────────
  var CHIP = { done: '<span class="chip done">✓ Terminée</span>', current: '<span class="chip cur">● En cours</span>', locked: '<span class="chip lock">🔒 Verrouillée</span>' };

  function viewMap() {
    var v = APP.view;
    var h = '<div class="page-head"><h1 class="h-display">La carte</h1><a class="small" href="#/regles">Règles du jeu</a></div>';
    h += '<div class="map">';
    v.arenas.forEach(function (av) {
      var a = A(av.id);
      var stTxt = av.status === 'done' ? 'Terminée' : av.status === 'current' ? 'En cours · ' + av.done + '/' + av.total : 'Verrouillée';
      h += '<a class="map-node ' + av.status + '" href="#/arene/' + a.id + '">' +
        '<span class="map-dot"><span>' + (av.status === 'done' ? '✓' : a.num) + '</span></span>' +
        '<span class="map-body"><span class="lbl">' + esc(a.label) + '</span><b>' + esc(a.name) + '</b><span class="tiny">' + esc(stTxt) + '</span></span></a>';
    });
    return h + '</div>';
  }

  function viewArena(id) {
    var a = A(id);
    if (!a) return notFound();
    var av = APP.view.arenas.filter(function (x) { return x.id === id; })[0];
    var habit = APP.program.habits.filter(function (x) { return x.arena === id; })[0];
    var h = '<div class="crumb"><a href="#/carte">‹ Carte</a></div>';
    h += '<section class="intro"><div class="eyebrow">' + esc(a.label) + ' · ' + av.done + '/' + av.total + '</div><h1 class="h-display">' + esc(a.name) + '</h1>' +
      '<p class="lead">' + esc(a.objectif) + '</p>' + (habit ? '<p class="small muted">Habitude : ' + esc(habit.title) + '</p>' : '') + '</section>';
    if (av.status === 'locked') h += '<p class="small muted">🔒 Bats le boss de l\'arène précédente pour ouvrir celle-ci.</p>';
    return h + '<div class="mlist">' + av.items.map(missionRow).join('') + '</div>';
  }

  function missionRow(id) {
    var m = M(id), it = APP.view.items[id];
    var right = {
      validated: '<span class="chip done">✓</span>',
      open: '<span class="chip cur">À faire</span>',
      waiting: '<span class="chip wait">' + esc(it.unlockAt ? fmtWhen(it.unlockAt) : '') + '</span>',
      locked: '<span class="chip lock">🔒</span>',
      draft: '<span class="chip lock">Bientôt</span>'
    }[it.status];
    var clickable = it.status === 'validated' || it.status === 'open';
    var tag = clickable ? 'a' : 'div';
    return '<' + tag + ' class="mrow ' + it.status + (m.kind === 'boss' ? ' boss' : '') + '"' + (clickable ? ' href="#/mission/' + encodeURIComponent(id) + '"' : ' aria-disabled="true"') + '>' +
      '<span class="n">' + (m.kind === 'boss' ? '⚔' : esc(m.num)) + '</span>' +
      '<span class="t grow">' + esc(m.kind === 'boss' ? 'Boss · ' + m.title : m.title) + '</span>' + right + '</' + tag + '>';
  }

  // ─── Page mission / boss ──────────────────────────────────────────────────
  function viewMission(id, preview) {
    var m;
    try { m = M(id); } catch (e) { return notFound(); }
    var it = APP.view.items[id], a = A(m.arena), boss = m.kind === 'boss';
    var h = '<div class="crumb"><a href="#/arene/' + a.id + '">‹ ' + esc(a.label + ' · ' + a.name) + '</a></div>';
    if (!preview) h += adminBar(m);
    h += '<section class="mhead' + (boss ? ' boss' : '') + '"><span class="num">' + esc(boss ? (m.final ? 'Boss final' : 'Boss') : 'Mission ' + m.num) + '</span>' +
      '<h1 class="h-display">' + esc(m.title) + '</h1>' +
      (boss && !m.final ? '<p class="small muted">' + esc(bossLine()) + ' Raté ? Tu réessaies après minuit.</p>' : '') +
      (it.status === 'validated' ? '<p class="small ok-txt">✓ ' + (boss ? 'Boss vaincu' : 'Mission validée') + ' le ' + esc(fmtDate(it.validatedAt)) + '</p>' : '') + '</section>';

    if (it.status === 'locked' || it.status === 'waiting' || it.status === 'draft') {
      h += '<div class="card stack"><p class="big-action">' + esc(m.action) + '</p>' +
        '<p class="small muted">' + (it.status === 'waiting' ? '🔒 Se débloque ' + esc(fmtWhen(it.unlockAt)) + '.' :
          it.status === 'draft' ? 'Cette mission arrive bientôt.' : '🔒 Termine les missions précédentes pour l\'ouvrir.') + '</p></div>';
      return h + missionNav(m);
    }

    h += '<div class="stack-lg">';
    h += videoBlock(m);
    if (m.body) h += '<div class="prose">' + esc(m.body) + '</div>';
    if (m.instructions) h += '<div class="instructions"><div class="eyebrow">Consignes</div><div class="prose">' + esc(m.instructions) + '</div></div>';
    if (m.caution) h += '<p class="caution">⚠️ Demande l\'avis d\'un professionnel de santé avant tout changement — obligatoire si tu es mineur.</p>';

    h += '<section class="card action-card"><div class="eyebrow">' + (boss ? 'Le défi' : 'Ton action') + '</div><p class="big-action">' + esc(m.action) + '</p>' + linksBlock(m);
    h += supportBlock(m, it);
    if (m.durationDays) h += daysBlock(m, it);
    h += '<div id="mfoot">' + footBlock(m, it) + '</div></section>';
    if (boss && !m.final) h += bossQuizBlock(m, it, preview);
    if (it.status === 'validated' && !preview) h += nextLine(m);
    h += '</div>';
    return h + (preview ? '' : missionNav(m));
  }

  // Une ligne, pas un bloc : ce qui vient après cette mission.
  function nextLine(m) {
    var list = E().playable, nx = list[list.indexOf(m) + 1];
    if (!nx) return '';
    var nit = APP.view.items[nx.id] || {};
    var when = nit.status === 'waiting' ? 'se débloque ' + fmtWhen(nit.unlockAt) : (nit.status === 'open' || nit.status === 'validated') ? 'est ouverte' : 'arrive bientôt';
    return '<p class="small muted center">Suite : « ' + esc(nx.title) + ' » ' + esc(when) + '.</p>';
  }

  // Visible seulement par l'admin : ce qu'il reste à remplir + accès direct à l'éditeur.
  function adminBar(m) {
    if (!APP.session.roles || !APP.session.roles.admin) return '';
    var s = AMContent.missionStatus(m, {});
    var todo = s.todo.filter(function (x) { return x.indexOf('réponses') !== 0; });
    return '<div class="admin-bar"><span class="grow">' + (todo.length ? 'À compléter : ' + esc(todo.join(', ')) : 'Contenu complet') + '</span>' +
      '<a class="btn sm" href="#/contenu/' + encodeURIComponent(m.id) + '">Modifier</a></div>';
  }





  function videoEmbed(url, title, mid) {
    var c = AMContent.checkVideoUrl(url);
    var t = ' title="' + attr(title || 'Vidéo') + '"';
    if (c.kind === 'youtube') return '<iframe src="https://www.youtube-nocookie.com/embed/' + attr(c.id) + '?rel=0&modestbranding=1&playsinline=1"' + t + ' allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowfullscreen loading="lazy"></iframe>';
    if (c.kind === 'vimeo') return '<iframe src="https://player.vimeo.com/video/' + attr(c.id) + '"' + t + ' allow="fullscreen; picture-in-picture" allowfullscreen loading="lazy"></iframe>';
    if (c.kind === 'mp4') return '<video controls playsinline preload="metadata" data-video-for="' + attr(mid || '') + '" src="' + attr(c.url) + '"></video>';
    return null;
  }

  function videoBlock(m) {
    var title = m.videoTitle || m.title;
    var emb = m.video ? videoEmbed(m.video, title, m.id) : null;
    if (!emb) return '<div class="video empty"><span class="play" aria-hidden="true">▶</span><span>Vidéo bientôt disponible</span></div>';
    var watched = !!rec(m.id).videoWatchedAt;
    return '<div><div class="video">' + emb + '</div>' +
      '<div class="row video-meta"><span class="video-title grow">' + esc(title) + '</span>' +
      (watched ? '<span class="chip done">✓ Vue</span>' : '<button class="btn sm ghost" data-act="videoDone" data-id="' + attr(m.id) + '">J\'ai regardé</button>') + '</div></div>';
  }

  function linksBlock(m) {
    var out = '';
    (m.links || []).forEach(function (l) {
      if (l.type === 'hub') out += '<a class="btn sm ghost" href="' + attr(CFG.hubUrl) + '" target="_blank" rel="noopener">' + esc(l.label) + ' ↗</a>';
    });
    if (m.whatsapp) {
      var wa = waLink(m.whatsapp);
      if (wa) out += '<a class="btn wa sm" href="' + attr(wa) + '" target="_blank" rel="noopener">Envoyer ma vidéo sur WhatsApp</a>';
    }
    return out ? '<div class="row wrap">' + out + '</div>' : '';
  }

  // ─── Supports génériques ──────────────────────────────────────────────────
  function supportBlock(m, it) {
    var sup = E().supportOf(m);
    if (!sup || sup.type === 'undefined') return '';
    if (sup.type === 'checklist' && sup.daily) return '';
    if (sup.type === 'checklist') return '<div class="support">' + checklistBlock(m, sup) + '</div>';
    if (sup.type === 'fiche') return '<div class="support">' + ficheBlock(m, sup) + '</div>';
    if (sup.type === 'quiz') return '<div class="support">' + quizBlock(m, sup, it) + '</div>';
    return '';
  }

  function checklistBlock(m, sup) {
    var data = rec(m.id).support || {};
    return sup.items.map(function (item) {
      if (item.choices) {
        return '<div class="field"><label>' + labelHtml(item) + '</label><div class="choices" role="radiogroup">' + item.choices.map(function (c) {
          var on = data[item.id] === c;
          return '<button class="choice ' + (on ? 'on' : '') + '" role="radio" aria-checked="' + on + '" data-act="choice" data-id="' + attr(m.id) + '" data-item="' + attr(item.id) + '" data-val="' + attr(c) + '">' + esc(c) + '</button>';
        }).join('') + '</div></div>';
      }
      var on2 = data[item.id] === true;
      return '<div class="check-item ' + (on2 ? 'on' : '') + '" role="checkbox" tabindex="0" aria-checked="' + on2 + '" data-act="check" data-id="' + attr(m.id) + '" data-item="' + attr(item.id) + '"><span class="check-box" aria-hidden="true">✓</span><span>' + labelHtml(item) + '</span></div>';
    }).join('');
  }

  // Les intitulés provisoires ne portent plus de badge côté participant :
  // c'est la barre admin qui les signale.
  function labelHtml(x) { return esc(String(x.label || '').trim() || '—'); }

  function recallHtml(f) {
    var rows = [];
    f.from.forEach(function (pair) {
      var src = M(pair[0]), sup = E().supportOf(src), data = (rec(pair[0]).support) || {};
      var fields = sup.type === 'fiche' ? sup.fields : sup.items;
      fields.forEach(function (sf) {
        if (pair[1] !== '*' && sf.id !== pair[1]) return;
        var val = data[sf.id];
        rows.push('<dt>' + esc(src.num + ' · ' + sf.label) + '</dt><dd>' + (val === undefined || val === '' ? '<span class="muted">— non renseigné</span>' : esc(val === true ? 'Oui' : val)) + '</dd>');
      });
    });
    return '<dl class="recall">' + rows.join('') + '</dl>';
  }

  function ficheBlock(m, sup) {
    var data = Object.assign({}, rec(m.id).support || {}, APP.pending[m.id] || {});
    return sup.fields.map(function (f) {
      var id = 'f_' + m.id.replace(/\W/g, '_') + '_' + f.id;
      var req = f.required ? ' <span class="req" aria-hidden="true">*</span>' : '';
      var base = ' id="' + id + '" data-field="' + attr(f.id) + '" data-id="' + attr(m.id) + '"';
      var val = data[f.id];
      var inner;
      switch (f.type) {
        case 'recall': return '<div class="field"><label>' + esc(f.label) + '</label>' + recallHtml(f) + '</div>';
        case 'textarea': inner = '<textarea class="input"' + base + ' placeholder="' + attr(f.placeholder || 'Écris ici…') + '" maxlength="2000">' + esc(val || '') + '</textarea>'; break;
        case 'number': inner = '<input class="input" type="number" inputmode="decimal" step="any"' + base + ' value="' + attr(val == null ? '' : val) + '">'; break;
        case 'date': inner = '<input class="input" type="date"' + base + ' value="' + attr(val || '') + '">'; break;
        case 'check':
          return '<div class="check-item ' + (val === true ? 'on' : '') + '" role="checkbox" tabindex="0" aria-checked="' + (val === true) + '" data-act="ficheCheck" data-id="' + attr(m.id) + '" data-item="' + attr(f.id) + '" style="margin-top:14px"><span class="check-box" aria-hidden="true">✓</span><span>' + labelHtml(f) + req + '</span></div>';
        case 'scale':
          var btns = '';
          for (var i = f.min || 1; i <= (f.max || 10); i++) btns += '<button class="' + (val === i ? 'on' : '') + '" aria-pressed="' + (val === i) + '" data-act="scale" data-id="' + attr(m.id) + '" data-item="' + attr(f.id) + '" data-val="' + i + '">' + i + '</button>';
          return '<div class="field"><label>' + labelHtml(f) + req + '</label><div class="scale" role="group" aria-label="' + attr(f.label) + '">' + btns + '</div></div>';
        default: inner = '<input class="input' + (f.strike ? ' strike' : '') + '" type="text"' + base + ' placeholder="' + attr(f.placeholder || ' ') + '" value="' + attr(val || '') + '" maxlength="2000">';
      }
      return '<div class="field"><label for="' + id + '">' + labelHtml(f) + req + '</label>' + inner + '</div>';
    }).join('') + '<div class="saved" id="saved_' + attr(m.id) + '" aria-live="polite">' + (rec(m.id).savedAt ? 'Enregistré ✓' : '') + '</div>';
  }

  function quizBlock(m, sup, it) {
    var r = rec(m.id), res = APP.quizRes[m.id];
    var submitted = r.quiz && r.quiz.submittedAt;
    var sel = APP.quizSel[m.id] || (submitted ? Object.assign({}, r.quiz.answers) : {});
    APP.quizSel[m.id] = sel;
    var review = submitted && APP.retrying !== m.id;
    var h = sup.scored ? '' : '<p class="small muted">Pas de bonne ou de mauvaise réponse.</p>';
    if (!sup.questions.length || !sup.questions.every(E().questionWritten)) return h + '<p class="small muted">Les questions de ce quiz arrivent bientôt.</p>';
    sup.questions.forEach(function (q, qi) {
      h += '<div class="quiz-q"><div class="q">' + (qi + 1) + '. ' + esc(q.q) + '</div>';
      q.options.forEach(function (o, oi) {
        var cls = sel[q.id] === oi ? 'on' : '';
        if (review && res && res.details && res.details[q.id]) {
          if (res.details[q.id].correct === oi) cls += ' good';
          else if (sel[q.id] === oi) cls += ' wrong';
        }
        h += '<button class="opt ' + cls + '"' + (review ? ' disabled' : '') + ' data-act="quizPick" data-id="' + attr(m.id) + '" data-q="' + attr(q.id) + '" data-o="' + oi + '"><span class="dot" aria-hidden="true"></span>' + esc(o) + '</button>';
      });
      h += '</div>';
    });
    if (review) {
      var score = res && res.total ? res.score + ' / ' + res.total : (r.quiz.total ? r.quiz.score + ' / ' + r.quiz.total : null);
      h += '<p class="small ok-txt">✓ Quiz terminé' + (score ? ' — ' + score : '') + '</p>';
      if (it.status === 'open') h += '<button class="linkbtn small" data-act="quizRetry" data-id="' + attr(m.id) + '">Refaire le quiz</button>';
    } else {
      h += '<button class="btn block" data-act="quizSubmit" data-id="' + attr(m.id) + '">Valider mes réponses</button>';
    }
    return h;
  }

  function daysBlock(m, it) {
    var r = rec(m.id), run = it.run, sup = E().supportOf(m);
    var n = m.durationDays, cur = Math.min(run.current, n);
    var h = '<div class="support"><div class="row"><span class="small grow"><b>Jour ' + Math.min(cur + (run.todayDone || run.done ? 0 : 1), n) + ' / ' + n + '</b>' + (m.consecutive ? ' · d\'affilée' : '') + '</span></div>';
    h += '<div class="days" aria-label="' + cur + ' jours sur ' + n + '">';
    for (var i = 0; i < n; i++) h += '<i class="' + (i < cur ? 'on' : (i === cur && !run.todayDone && it.status === 'open' ? 'today' : '')) + '"></i>';
    h += '</div>';
    if (run.broken) h += '<p class="small warn-txt">Série interrompue : on repart de zéro aujourd\'hui.</p>';
    if (it.status === 'open' && run.todayDone && !run.done) {
      h += '<p class="small ok-txt">✓ Fait aujourd\'hui. À demain.</p>';
    } else if (it.status === 'open' && !run.done) {
      if (sup && sup.type === 'checklist' && sup.daily) {
        var sel = APP.pending['day_' + m.id] || {};
        sup.items.forEach(function (item) {
          var label = item.label;
          if (item.recall) { var v = (rec(item.recall[0]).support || {})[item.recall[1]]; if (v) label += ' (' + v + ')'; }
          h += '<div class="check-item ' + (sel[item.id] ? 'on' : '') + '" role="checkbox" tabindex="0" aria-checked="' + !!sel[item.id] + '" data-act="dayCheck" data-id="' + attr(m.id) + '" data-item="' + attr(item.id) + '"><span class="check-box" aria-hidden="true">✓</span><span>' + esc(label) + '</span></div>';
        });
        if (sup.items.some(function (x) { return x.note; })) {
          h += '<label class="sr" for="note_' + attr(m.id) + '">Note du jour</label><textarea class="input" id="note_' + attr(m.id) + '" maxlength="2000" placeholder="Note du jour (facultatif)"></textarea>';
        }
      }
      h += '<button class="btn ok block" data-act="checkin" data-id="' + attr(m.id) + '">' + esc(m.dailyLabel || 'Valider ma journée') + '</button>';
    }
    var hist = (r.checkins || []).filter(function (c) { return c.note; });
    if (hist.length) h += '<details><summary>Mes notes (' + hist.length + ')</summary>' + hist.map(function (c) { return '<p class="small"><b>' + esc(c.day) + '</b> — ' + esc(c.note) + '</p>'; }).join('') + '</details>';
    return h + '</div>';
  }

  function footBlock(m, it) {
    if (it.status !== 'open') return '';
    var missing = (it.checks || []).filter(function (c) { return !c.ok; }).map(function (c) { return c.contentMissing ? 'contenu bientôt disponible' : c.label.replace(/ \(\d+\/\d+\)$/, ''); });
    if (m.kind === 'boss' && !m.final) {
      return missing.length ? '<p class="tiny center">Pour débloquer les questions : ' + esc(missing.join(', ').toLowerCase()) + '</p>' : '';
    }
    return '<button class="btn ' + (it.canValidate ? 'primary' : '') + ' block" data-act="validate" data-id="' + attr(m.id) + '"' + (it.canValidate ? '' : ' disabled') + '>' + (m.final ? 'Valider le boss final' : 'Valider la mission') + '</button>' +
      (missing.length ? '<p class="tiny center">Il reste : ' + esc(missing.join(', ').toLowerCase()) + '</p>' : '');
  }



  function bossQuizBlock(m, it, preview) {
    var h = '<section class="card"><div class="eyebrow">Les 5 questions</div>';
    var res = APP.quizRes[m.id];
    if (it.status === 'validated') return h + '<p>Boss vaincu' + (res ? ' — ' + res.score + ' / ' + res.total : '') + ' 🏆</p></section>';
    if (res && !res.won) h += '<p class="warn-txt"><b>' + res.score + ' / ' + res.total + '.</b> Il en faut 4. Nouvel essai ' + esc(fmtWhen(res.retryAt)) + ', sans pénalité. Ton défi reste acquis.</p>';
    var challengeOk = (it.checks || []).every(function (c) { return c.ok; });
    var allW = m.quiz.questions.length && m.quiz.questions.every(E().questionWritten);
    if (!allW || !it.quizReady) return h + '<p class="small muted">Les questions de ce boss arrivent bientôt.</p></section>';
    if (it.retryAt) return h + (res ? '' : '<p class="small muted">Nouvel essai ' + esc(fmtWhen(it.retryAt)) + ', sans pénalité.</p>') + '</section>';
    if (!challengeOk && !preview) return h + '<p class="small muted">🔒 Termine le défi pratique pour débloquer les questions.</p></section>';
    var sel = APP.quizSel[m.id] = APP.quizSel[m.id] || {};
    m.quiz.questions.forEach(function (q, qi) {
      h += '<div class="quiz-q"><div class="q">' + (qi + 1) + '. ' + esc(q.q) + '</div>';
      q.options.forEach(function (o, oi) {
        h += '<button class="opt ' + (sel[q.id] === oi ? 'on' : '') + '" data-act="quizPick" data-id="' + attr(m.id) + '" data-q="' + attr(q.id) + '" data-o="' + oi + '"><span class="dot" aria-hidden="true"></span>' + esc(o) + '</button>';
      });
      h += '</div>';
    });
    return h + '<button class="btn primary block" data-act="bossSubmit" data-id="' + attr(m.id) + '">Affronter le boss</button></section>';
  }

  function missionNav(m) {
    var list = E().content.missions.filter(function (x) { return !x.draft; });
    var i = list.indexOf(m);
    var prev = list[i - 1], next = list[i + 1];
    var ok = function (x) { var s = APP.view.items[x.id].status; return s === 'open' || s === 'validated'; };
    var lbl = function (x) { return x.kind === 'boss' ? 'Boss' : x.num; };
    var h = '<nav class="mnav" aria-label="Missions">';
    h += prev && ok(prev) ? '<a href="#/mission/' + encodeURIComponent(prev.id) + '">‹ ' + esc(lbl(prev)) + '</a>' : '<span></span>';
    if (next) h += ok(next) ? '<a href="#/mission/' + encodeURIComponent(next.id) + '">' + esc(lbl(next)) + ' ›</a>' : '<span class="muted">' + esc(lbl(next)) + ' 🔒</span>';
    return h + '</nav>';
  }

  // ─── Habitudes ────────────────────────────────────────────────────────────
  function habitCard(hv) {
    var h = APP.engine.habitById[hv.id];
    var out = '<div class="card habit"><div class="row"><div class="grow"><b>' + esc(h.title) + '</b><div class="tiny">' + esc(h.frequency) + '</div></div><span class="streak" title="Série">🔥 ' + hv.streak + '</span></div>';
    if (!hv.dueToday) return out + '<div class="small muted">À cocher le dimanche.</div></div>';
    var btn = function (val, label) {
      return '<button class="' + val + (hv.today === val ? ' on' : '') + '" aria-pressed="' + (hv.today === val) + '" data-act="habit" data-id="' + h.id + '" data-val="' + val + '">' + label + '</button>';
    };
    out += '<div class="yn">' + btn('yes', 'Oui') + btn('no', 'Non') + (h.kind === 'session' ? btn('skip', 'Pas de séance') : '') + '</div>';
    return out + '</div>';
  }

  function viewHabits() {
    var v = APP.view;
    var h = '<div class="page-head"><h1 class="h-display">Habitudes</h1></div>';
    h += '<div class="stack">';
    if (!v.habits.length) h += '<p class="muted">Ta première habitude arrive avec la mission 1.1.</p>';
    h += v.habits.map(habitCard).join('');
    var locked = APP.program.habits.filter(function (x) { return !st().habits[x.id]; });
    if (locked.length) {
      h += '<div class="section-title"><h2>À venir</h2></div><div class="list">' + locked.map(function (x) {
        return '<div class="hrow locked"><span class="grow"><b>' + esc(x.title) + '</b><span class="tiny">' + esc(A(x.arena).name) + '</span></span><span aria-hidden="true">🔒</span></div>';
      }).join('') + '</div>';
    }
    h += '<p class="tiny">Suivi provisoire : il passera dans Athletik Hub.</p>';
    return h + '</div>';
  }

  // ─── Récompenses ──────────────────────────────────────────────────────────
  function rewardTile(r, on) {
    return '<div class="reward ' + (r.type === 'badge' ? 'badge ' : '') + (on ? 'on' : '') + '"><div class="art" aria-hidden="true">' + (on ? (r.type === 'badge' ? '🏆' : '★') : '🔒') + '</div>' +
      '<div class="ti">' + esc(r.title) + '</div>' + (on && r.at ? '<div class="tiny">' + esc(fmtDate(r.at)) + '</div>' : '') +
      (r.grant ? '<div class="tiny">+ ' + esc(r.grant.label) + '</div>' : '') + '</div>';
  }

  function viewRewards() {
    var v = APP.view, earned = {};
    v.rewards.forEach(function (r) { earned[r.id] = r; });
    var h = '<div class="eyebrow">Rangs et récompenses</div><h1 class="h-display">Ma vitrine</h1>';
    h += '<div class="card hero rankcard" style="margin-top:12px"><div class="rank-badge ' + (v.rank ? '' : 'none') + '">' + esc(v.rank || 'À VENIR') + '</div><div><div class="tiny">Rang actuel</div><b style="font-size:19px">' + esc(v.rank || 'Pas encore de rang') + '</b><div class="small muted">' + v.rewards.length + ' / ' + APP.program.rewards.length + ' récompenses</div></div></div>';
    h += parcelCard();
    h += '<div class="rewards" style="margin-top:14px">' + APP.program.rewards.map(function (r) {
      var trig = r.trigger.split(':'), a = A(trig[1]);
      var tile = rewardTile(earned[r.id] || r, !!earned[r.id]);
      return tile.replace('</div></div>', '</div><div class="tiny">' + esc(trig[0] === 'section' ? 'Fin du ' + a.label.toLowerCase() : 'Boss ' + a.name) + '</div></div>');
    }).join('') + '</div>';
    var grants = st().grants || [];
    if (grants.length) {
      h += '<div class="section-title"><h2>Avantages</h2></div>' + grants.map(function (g) {
        return '<div class="card"><b>' + (g.type === 'hubPremium' ? (g.months || 1) + ' mois d\'Athletik Hub Premium' : esc(g.type)) + '</b><div class="small muted">Obtenu le ' + esc(fmtDate(g.at)) + '. Activation dans Athletik Hub : en attente du branchement entre les deux apps.</div></div>';
      }).join('');
    }
    return h;
  }

  // ─── Règles du jeu ────────────────────────────────────────────────────────
  // Règles du jeu : courtes, utiles, fiables. Une règle = ce que fait vraiment le moteur.
  function viewRules() {
    var r = R();
    var ranks = APP.program.rewards.filter(function (x) { return x.rank; }).map(function (x) { return x.rank; }).join(' → ');
    var groups = [
      ['Avancer', [
        'Regarde la vidéo, fais l\'action, valide.',
        'Le niveau 0 est ouvert en entier dès le premier jour.',
        'Ensuite, une mission à la fois : la suivante s\'ouvre ' + r.delay + ' h après ta validation.',
        'Certaines missions durent plusieurs jours : une coche par jour. Si c\'est « d\'affilée », un jour manqué remet le compteur à zéro.'
      ]],
      ['Battre un boss', [
        'Il s\'ouvre ' + r.delay + ' h après la dernière mission de l\'arène.',
        bossLine(),
        'Raté ? Tu réessaies après minuit, sans pénalité. Ton défi reste acquis.',
        'Le boss final : refais tes tests et envoie ta vidéo de fin. C\'est gagné, quels que soient tes chiffres.'
      ]],
      ['Ce que tu gagnes', [
        'Ton rang monte en avançant : ' + ranks + '. Les autres boss donnent un badge de victoire.',
        'Une habitude par arène. Elle reste jusqu\'au ' + r.days + 'ᵉ jour : réponds oui ou non chaque jour, ta série monte.'
      ]],
      ['Toujours vrai', [
        'Une mission validée reste ouverte, pendant et après les ' + r.days + ' jours.',
        'Alassane regarde ta vidéo de départ et te recontacte vers le 30ᵉ et le 60ᵉ jour.'
      ]]
    ];
    return '<div class="crumb"><a href="#/carte">‹ Carte</a></div><div class="page-head"><h1 class="h-display">Règles du jeu</h1></div>' +
      '<div class="stack-lg">' + groups.map(function (g) {
        return '<section><div class="section-title"><h2>' + esc(g[0]) + '</h2></div><ul class="rules">' +
          g[1].map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></section>';
      }).join('') + '</div>';
  }

  // ─── Profil ───────────────────────────────────────────────────────────────
  function viewProfile() {
    var s = APP.session, acc = s.access || {}, ro = s.roles || {};
    var planTxt = acc.plan === 'one_time' ? 'Paiement en une fois' : acc.plan === 'installments' ? 'Paiement en ' + (acc.needed || 3) + ' fois — ' + acc.paid + ' / ' + (acc.needed || 3) + ' échéances' : 'Formule à confirmer';
    var h = '<div class="eyebrow">Mon compte</div><h1 class="h-display">Profil</h1><div class="stack" style="margin-top:12px">';
    h += '<div class="card stack"><div class="field" style="margin:0"><label for="pName">Prénom</label><div class="row"><input class="input grow" id="pName" value="' + attr((s.profile && s.profile.name) || '') + '" maxlength="60"><button class="btn sm" data-act="saveName">OK</button></div></div>' +
      '<div class="small muted">' + esc((s.profile && s.profile.email) || '') + '</div></div>';
    h += '<div class="card stack"><h3>Mes accès</h3><ul class="checks">' +
      '<li class="' + (ro.master ? 'ok' : '') + '">' + (ro.master ? '✓' : '○') + ' Athletik Master</li>' +
      '<li class="' + (ro.hubStandard ? 'ok' : '') + '">' + (ro.hubStandard ? '✓' : '○') + ' Athletik Hub Standard <span class="tiny">(inclus avec Athletik Master)</span></li>' +
      '<li class="' + (ro.hubPremium ? 'ok' : '') + '">' + (ro.hubPremium ? '✓' : '○') + ' Athletik Hub Premium' + (ro.hubPremiumFromMaster ? ' <span class="tiny">(mois offert)</span>' : '') + '</li>' +
      (ro.admin ? '<li class="ok">✓ Administrateur</li>' : '') + '</ul>' +
      '<p class="small muted" style="margin:0">' + esc(planTxt) + '</p>' +
      '<p class="tiny" style="margin:0">Dans Athletik Hub, ces droits seront appliqués quand le lien entre les deux apps sera branché.</p></div>';
    h += '<div class="card stack"><h3>Raccourcis</h3><a class="btn block" href="#/debut">Page de début du programme</a><a class="btn block" href="#/fin">Page de fin du programme</a><a class="btn block" href="#/regles">Règles du jeu</a>' +
      (ro.admin ? '<a class="btn primary block" href="#/admin">Espace administrateur</a><a class="btn block" href="#/contenu">Gérer le contenu (vidéos, textes, quiz)</a>' : '') +
      (APP.installEvt ? '<button class="btn block" data-act="install">Installer l\'application</button>' : '') + '</div>';
    if (APP.store.demo) {
      h += '<div class="card stack" style="border-color:#6a4800"><h3>Outils de démonstration</h3><p class="small muted" style="margin:0">Pour tester les délais sans attendre. Horloge démo : ' + esc(fmtShort(APP.store.now()) + ' ' + hm(APP.store.now())) + '</p>' +
        '<div class="row wrap"><button class="btn sm" data-act="travel" data-ms="3600000">+1 h</button><button class="btn sm" data-act="travel" data-ms="86400000">+24 h</button><button class="btn sm" data-act="travel" data-ms="604800000">+7 jours</button></div>' +
        '<button class="btn block sm" data-act="demoPay">Simuler le paiement complet (+ délai de 14 jours)</button>' +
        '<button class="btn block sm" data-act="demoReset" data-ok="Remettre à zéro" data-confirm="Remettre la démo à zéro ? Toute ta progression de démo sera effacée.">Remettre la démo à zéro</button>' +
        '<button class="btn block sm" data-act="demoResetContent" data-ok="Effacer" data-confirm="Effacer le contenu édité dans la démo (retour au contenu d&#39;origine) ?">Effacer le contenu édité en démo</button></div>';
    }
    h += '<button class="btn ghost block" data-act="signout">' + (APP.store.demo ? 'Quitter le mode démo' : 'Se déconnecter') + '</button>';
    return h + '</div>';
  }

  // ─── Admin ────────────────────────────────────────────────────────────────
  function loadAdmin() {
    APP.store.admin('list').then(function (d) { APP.adminData = d; if (route().name === 'admin') render(); })
      .catch(function (e) { APP.adminData = { error: e.message }; if (route().name === 'admin') render(); });
  }

  var TOUCH = { done: ['done', 'Fait'], upcoming: ['lock', 'À venir'], due: ['cur', 'À contacter'], late: ['bad', 'En retard'] };

  function viewAdmin() {
    if (!APP.session.roles || !APP.session.roles.admin) return '<div class="notice warn">Accès réservé à l\'administrateur.</div>';
    var h = '<div class="crumb"><a href="#/profil">Profil</a> › Admin</div><h1 class="h-display" style="margin-top:6px">Espace administrateur</h1>';
    h += '<a class="card card-link row" href="#/contenu" style="margin-top:12px"><span style="font-size:26px" aria-hidden="true">✏️</span><div class="grow"><b>Gérer le contenu</b><div class="small muted">Titres, liens YouTube, textes, consignes, checklists, fiches et quiz — publiés sans redéploiement.</div></div><span aria-hidden="true">›</span></a>';
    if (APP.store.demo) h += '<div class="notice warn" style="margin-top:10px">Démo : les participants marqués [DÉMO] sont fictifs.</div>';
    var d = APP.adminData;
    if (!d) return h + '<p class="muted">Chargement…</p>';
    if (d.error) return h + '<div class="notice warn">' + esc(d.error) + '</div>';
    var rows = d.participants;
    var f = APP.adminFilter;
    var needTouch = function (p) { return p.touch && p.touch.some(function (t) { return t.status === 'due' || t.status === 'late'; }); };
    var filtered = rows.filter(function (p) {
      if (f === 'touch') return needTouch(p);
      if (f === 'done') return p.finished;
      if (f === 'idle') return !p.started;
      return true;
    });
    var nTouch = rows.filter(needTouch).length;
    h += '<div class="grid2" style="margin-top:12px"><div class="card stat"><b>' + rows.filter(function (p) { return p.started; }).length + '</b><span>participants actifs</span></div><div class="card stat"><b>' + nTouch + '</b><span>à contacter (J30 / J60)</span></div></div>';
    h += '<div class="filters" style="margin-top:14px">' + [['all', 'Tous'], ['touch', 'À contacter'], ['done', 'Terminés'], ['idle', 'Pas encore connectés']].map(function (x) {
      return '<button class="' + (f === x[0] ? 'on' : '') + '" data-act="adminFilter" data-f="' + x[0] + '">' + x[1] + '</button>';
    }).join('') + '<button data-act="adminReload">↻</button></div>';
    h += '<div class="stack" style="margin-top:12px">';
    if (!filtered.length) h += '<div class="notice">Aucun participant dans ce filtre.</div>';
    filtered.forEach(function (p) {
      h += '<div class="card adm-row"><div class="top"><div class="grow"><b>' + esc(p.name || p.email) + '</b><div class="tiny">' + esc(p.email) + '</div></div>' +
        (p.started ? (p.finished ? '<span class="chip done">Terminé</span>' : '<span class="chip cur">Jour ' + p.day + '</span>') : '<span class="chip lock">Pas connecté</span>') + '</div>';
      if (p.started) {
        h += '<div class="progress" style="height:6px"><i style="width:' + p.progress + '%"></i></div>';
        h += '<div class="adm-meta"><div>Arène<br><b>' + esc(p.currentArena) + '</b></div><div>Progression<br><b>' + p.validatedCount + ' / ' + p.totalCount + '</b></div>' +
          '<div>Début<br><b>' + esc(fmtDate(p.startedAt)) + '</b></div><div>Fin prévue<br><b>' + esc(fmtDate(p.endAt)) + '</b></div>' +
          '<div>Boss gagnés<br><b>' + p.bossesWon.length + ' / 8</b></div><div>Rang<br><b>' + esc(p.rank || '—') + '</b></div>' +
          '<div>Habitudes<br><b>' + p.habits.length + '</b></div><div>Dernière validation<br><b>' + esc(p.lastActivityAt ? fmtDate(p.lastActivityAt) : '—') + '</b></div></div>';
        h += '<div class="row wrap">' + p.touch.map(function (t) {
          var c = TOUCH[t.status];
          return '<span class="chip ' + c[0] + '">J' + t.day + ' · ' + esc(fmtDate(t.dueAt)) + ' · ' + c[1] + '</span>' +
            (t.status === 'due' || t.status === 'late' ? '<button class="btn sm" data-act="contacted" data-uid="' + attr(p.uid) + '" data-day="' + t.day + '">Marquer J' + t.day + ' contacté</button>' : '');
        }).join('') + '</div>';
        h += '<details><summary>Détail</summary><div class="small" style="margin-top:8px">' +
          '<p><b>Missions validées</b> : ' + esc(p.missionsValidated.join(', ') || '—') + '</p>' +
          '<p><b>Boss remportés</b> : ' + esc(p.bossesWon.join(', ') || '—') + '</p>' +
          '<p><b>Habitudes débloquées</b> : ' + (p.habits.length ? p.habits.map(function (x) { return esc(x.title) + ' (série ' + x.streak + ')'; }).join(', ') : '—') + ' <span class="tiny">(suivi provisoire Master)</span></p>' +
          '<p><b>Prochaine étape</b> : ' + esc(p.next || '—') + '</p>' +
          '<p><b>Récompenses</b> : ' + esc(p.rewards.join(', ') || '—') + '</p>' +
          (p.grants.length ? '<p><b>Premium Hub à activer</b> : ' + p.grants.map(function (g) { return (g.months || 1) + ' mois, obtenu le ' + esc(fmtDate(g.at)); }).join(', ') + '</p>' : '') +
          '</div></details>';
      }
      var ac = p.access || {};
      if (ac.kit && ac.kit.eligible) {
        h += '<div class="small">Livraison : ' + (p.shipping && p.shipping.confirmedAt ? '<span class="ok-txt">confirmée le ' + esc(fmtDate(p.shipping.confirmedAt)) + '</span>' : '<span class="warn-txt">à confirmer</span>') +
          (CFG.deliveryFormAdminUrl ? ' · <a href="' + attr(CFG.deliveryFormAdminUrl) + '" target="_blank" rel="noopener">adresses dans Tally ↗</a>' : '') + '</div>';
      }
      h += '<div class="tiny">Accès : ' + esc(ac.status || '—') + ' · ' + esc(ac.plan === 'one_time' ? '1 fois' : ac.plan === 'installments' ? ac.paid + ' / ' + ac.needed + ' échéances' : 'formule inconnue') +
        ' · Kit : ' + esc(ac.kit ? (ac.kit.eligible ? 'à expédier' : ({ installments_pending: 'paiement incomplet', retractation: 'délai de rétractation (' + fmtDate(ac.kit.eligibleAt) + ')', plan_unknown: 'formule à préciser', refunded: 'remboursé', no_access: '—' }[ac.kit.reason] || ac.kit.reason)) : '—') + '</div>';
      h += '</div>';
    });
    h += '</div>';
    h += '<div class="card stack" style="margin-top:18px"><h3>Accorder un accès manuellement</h3><p class="small muted" style="margin:0">En attendant le webhook Systeme.io, ou pour un cas particulier. Chaque clic ajoute un paiement confirmé.</p>' +
      '<input class="input" id="gEmail" type="email" placeholder="email@exemple.com"><select class="input" id="gPlan"><option value="one_time">Paiement en une fois</option><option value="installments">Paiement en 3 fois</option></select>' +
      '<button class="btn primary block" data-act="grant"' + (APP.store.demo ? ' disabled' : '') + '>Ajouter le paiement</button>' + (APP.store.demo ? '<p class="tiny" style="margin:0">Indisponible en démo.</p>' : '') + '</div>';
    return h;
  }

  // ═══ ÉDITEUR DE CONTENU (admin) ═══════════════════════════════════════════
  // Brouillon → aperçu → publication. Rien n'est écrit dans le code : les
  // modifications sont des surcouches (voir content-tools.js).
  function loadContentAdmin() {
    APP.contentLoading = true;
    return APP.store.contentCall('get').then(function (d) {
      APP.contentData = d; APP.contentLoading = false; render();
    }).catch(function (e) {
      APP.contentLoading = false; APP.contentData = { error: e.message || 'Erreur' }; render();
    });
  }
  function draftProgram() { return AMContent.merge(APP.base, APP.contentData.draft.ov); }
  function draftChanged() { var d = APP.contentData; return !AMContent.sameDraft(d.draft, d.published); }
  function missionModified(id) {
    var d = APP.contentData;
    var a = d.draft.ov && d.draft.ov.missions && d.draft.ov.missions[id];
    var b = d.published.ov && d.published.ov.missions && d.published.ov.missions[id];
    return JSON.stringify(a || null) !== JSON.stringify(b || null) ||
      JSON.stringify((d.draft.keys || {})[id] || {}) !== JSON.stringify((d.published.keys || {})[id] || {});
  }

  function contentGuard() {
    if (!APP.session.roles || !APP.session.roles.admin) return '<div class="notice warn">Accès réservé à l\'administrateur.</div>';
    if (!APP.contentData) return '<p class="muted">Chargement du contenu…</p>';
    if (APP.contentData.error) return '<div class="notice warn">' + esc(APP.contentData.error) + '</div>';
    return null;
  }

  function publishBar() {
    var d = APP.contentData, changed = draftChanged();
    var pub = d.published;
    return '<div class="card publish-bar ' + (changed ? 'gold' : '') + '"><div class="row wrap" style="justify-content:space-between">' +
      '<div><b>' + (changed ? 'Brouillon : modifications non publiées' : 'Tout est publié') + '</b><div class="tiny">Version en ligne : ' + (pub.version ? 'n° ' + pub.version + (pub.publishedAt ? ' du ' + esc(fmtDate(pub.publishedAt)) + ' à ' + hm(pub.publishedAt) : '') : 'contenu d\'origine') + '</div></div>' +
      (changed ? '<div class="row"><button class="btn sm ghost" data-act="cDiscard" data-ok="Annuler le brouillon" data-confirm="Annuler toutes les modifications non publiées ?">Annuler le brouillon</button><button class="btn sm primary" data-act="cPublish" data-ok="Publier" data-confirm="Publier le contenu ? Les participants verront ces changements dès leur prochaine ouverture de l&#39;application.">Publier</button></div>' : '') +
      '</div></div>';
  }

  function viewContent(arg, arg2) {
    var g = contentGuard(); if (g) return g;
    if (arg === 'arene') return viewArenaEditor(arg2);
    if (arg) return viewMissionEditor(arg);
    var prog = draftProgram(), keys = APP.contentData.draft.keys || {};
    var all = prog.missions.map(function (m) { return { m: m, s: AMContent.missionStatus(m, keys) }; });
    var count = function (f) { return all.filter(f).length; };
    var qTot = 0, qW = 0, kTot = 0, kOk = 0;
    all.forEach(function (x) { qTot += x.s.questions; qW += x.s.written; if (x.s.needKeys) { kTot += x.s.questions; kOk += x.s.keyed; } });
    var h = '<div class="crumb"><a href="#/profil">Profil</a> › <a href="#/admin">Admin</a> › Contenu</div><h1 class="h-display" style="margin-top:6px">Contenu</h1>';
    h += '<p class="small muted">Titres, vidéos YouTube, textes, consignes et supports de chaque mission. Enregistre, vérifie l\'aperçu, puis publie : les participants voient la mise à jour sans redéploiement.</p>';
    if (APP.store.demo) h += '<div class="notice warn">Démo : le contenu édité ici reste sur cet appareil.</div>';
    h += '<div style="margin-top:12px">' + publishBar() + '</div>';
    h += '<div class="grid2" style="margin-top:12px">' +
      '<div class="card stat"><b>' + count(function (x) { return x.s.video; }) + ' / ' + all.length + '</b><span>vidéos renseignées</span></div>' +
      '<div class="card stat"><b>' + count(function (x) { return x.s.body; }) + ' / ' + all.length + '</b><span>contenus pédagogiques</span></div>' +
      '<div class="card stat"><b>' + qW + ' / ' + qTot + '</b><span>questions rédigées</span></div>' +
      '<div class="card stat"><b>' + kOk + ' / ' + kTot + '</b><span>bonnes réponses</span></div></div>';
    prog.arenas.forEach(function (a) {
      var habit = (prog.habits || []).filter(function (x) { return x.arena === a.id; })[0];
      h += '<div class="section-title"><h2>' + esc(a.label + ' — ' + a.name) + '</h2><a href="#/contenu/arene/' + a.id + '">Modifier l\'arène</a></div>';
      if (habit) h += '<p class="tiny" style="margin:-4px 0 8px">Habitude : ' + esc(habit.title) + ' · ' + esc(habit.frequency) + '</p>';
      h += '<div class="mlist">' + all.filter(function (x) { return x.m.arena === a.id; }).map(function (x) {
        var m = x.m, s = x.s;
        var chips = '<span class="chip ' + (s.video ? 'done' : 'todo') + '">🎬</span><span class="chip ' + (s.body ? 'done' : 'todo') + '">📝</span>' +
          (s.questions ? '<span class="chip ' + (s.written === s.questions && (!s.needKeys || s.keyed === s.questions) ? 'done' : 'todo') + '">❓ ' + s.written + '/' + s.questions + '</span>' : '') +
          (missionModified(m.id) ? '<span class="chip wait">brouillon</span>' : '');
        return '<a class="mrow" href="#/contenu/' + encodeURIComponent(m.id) + '"><div class="n">' + (m.kind === 'boss' ? '⚔️' : esc(m.num)) + '</div>' +
          '<div class="grow"><div class="t">' + esc(m.title) + (m.draft ? ' <span class="chip todo">hors parcours</span>' : '') + '</div>' +
          '<div class="a">' + (s.complete ? 'Complet' : 'À compléter : ' + esc(s.todo.join(', '))) + '</div><div class="row wrap" style="gap:4px;margin-top:4px">' + chips + '</div></div></a>';
      }).join('') + '</div>';
    });
    return h;
  }

  // ─── Éditeur de mission ──────────────────────────────────────────────────
  var DEL_CONFIRM = ' data-confirm="Supprimer cet élément ? Les réponses déjà données par les participants ne seront plus affichées." data-ok="Supprimer"';
  function getPath(o, path) { return path.split('.').reduce(function (x, k) { return x == null ? x : x[k]; }, o); }
  function setPath(o, path, v) {
    var ks = path.split('.'), last = ks.pop();
    var t = ks.reduce(function (x, k) { return x[k]; }, o);
    t[last] = v;
  }
  function newId(prefix) { return prefix + Date.now().toString(36).slice(-5) + Math.random().toString(36).slice(2, 4); }

  function edInput(label, path, val, o) {
    o = o || {};
    var id = 'ed_' + path.replace(/\W/g, '_');
    var common = ' id="' + id + '" data-ed="' + attr(path) + '"' + (o.kind ? ' data-ed-kind="' + o.kind + '"' : '') + (o.max ? ' maxlength="' + o.max + '"' : '');
    var field;
    if (o.rows) field = '<textarea class="input" rows="' + o.rows + '"' + common + ' placeholder="' + attr(o.ph || '') + '">' + esc(val || '') + '</textarea>';
    else if (o.select) field = '<select class="input"' + common + '>' + o.select.map(function (x) { return '<option value="' + attr(x[0]) + '"' + (x[0] === val ? ' selected' : '') + '>' + esc(x[1]) + '</option>'; }).join('') + '</select>';
    else field = '<input class="input" type="' + (o.type || 'text') + '"' + common + ' value="' + attr(val == null ? '' : val) + '" placeholder="' + attr(o.ph || '') + '">';
    return '<div class="field"><label for="' + id + '">' + esc(label) + '</label>' + field + (o.hint ? '<div class="tiny" style="margin-top:4px"' + (o.hintId ? ' id="' + o.hintId + '"' : '') + '>' + o.hint + '</div>' : '') + '</div>';
  }
  function edCheck(label, path, val) {
    return '<label class="row small" style="margin-top:10px;gap:8px;cursor:pointer"><input type="checkbox" data-ed="' + attr(path) + '" data-ed-kind="bool"' + (val ? ' checked' : '') + ' style="width:20px;height:20px"> ' + esc(label) + '</label>';
  }

  function videoHint(url) {
    var c = AMContent.checkVideoUrl(url);
    if (!String(url || '').trim()) return 'Vide → les participants voient « Vidéo bientôt disponible ».';
    if (!c.ok) return '<span style="color:var(--bad)">Lien non reconnu. Colle une URL YouTube (youtube.com/watch?v=…, youtu.be/…, /shorts/…).</span>';
    return '<span style="color:var(--ok)">✓ ' + ({ youtube: 'Vidéo YouTube', vimeo: 'Vidéo Vimeo', mp4: 'Fichier vidéo' }[c.kind]) + ' reconnue.</span>';
  }

  function viewMissionEditor(id) {
    var prog = draftProgram();
    var base = null;
    prog.missions.forEach(function (x) { if (x.id === id) base = x; });
    if (!base) return notFound();
    if (!APP.edit || APP.edit.id !== id) {
      APP.edit = { id: id, data: JSON.parse(JSON.stringify(base)), keys: JSON.parse(JSON.stringify((APP.contentData.draft.keys || {})[id] || {})), dirty: false };
    }
    var d = APP.edit.data, a = A(d.arena) || {}, boss = d.kind === 'boss';
    var orig = APP.base.missions.filter(function (x) { return x.id === id; })[0];
    var h = '<div class="crumb"><a href="#/admin">Admin</a> › <a href="#/contenu">Contenu</a> › ' + esc(boss ? 'Boss ' + a.name : 'Mission ' + d.num) + '</div>';
    h += '<h1 class="h-display" style="margin-top:6px">' + esc(boss ? (d.final ? 'Boss final' : 'Boss') : 'Mission ' + d.num) + '</h1>';
    h += '<div id="edDirty" class="notice warn" style="margin-top:10px;' + (APP.edit.dirty ? '' : 'display:none') + '">Modifications non enregistrées.</div>';
    h += '<div class="stack" style="margin-top:12px">';

    // L'essentiel : ce qu'on remplit après avoir tourné la vidéo
    var emb = d.video ? videoEmbed(d.video, d.videoTitle, null) : null;
    h += '<div class="card"><div class="eyebrow">L\'essentiel</div>' +
      edInput('Titre de la mission', 'title', d.title, { max: 120 }) +
      edInput('Lien de la vidéo YouTube', 'video', d.video, { type: 'url', ph: 'https://youtu.be/…', hint: videoHint(d.video), hintId: 'vidHint' }) +
      '<div id="vidPrev">' + (emb ? '<div class="video">' + emb + '</div>' : '') + '</div>' +
      edInput('Titre de la vidéo', 'videoTitle', d.videoTitle, { max: 160 }) +
      edInput('Texte de la mission (affiché sous la vidéo)', 'body', d.body, { max: 20000, rows: 8, ph: 'Laisse vide si la vidéo suffit.' }) +
      edInput('Action concrète', 'action', d.action, { max: 300, rows: 2 }) +
      edInput('Consignes (facultatif)', 'instructions', d.instructions, { max: 5000, rows: 3, ph: 'Étapes pour réaliser l\'action.' }) + '</div>';

    // Support
    var supPath = boss ? 'challenge' : 'support', sup = getPath(d, supPath);
    if (sup && sup.type !== 'undefined') h += supportEditor(sup, supPath, boss);
    else h += '<div class="notice warn">Support à définir : il se choisit dans program.json (checklist, fiche ou quiz).</div>';
    if (boss && !d.final) h += quizEditor(d.quiz.questions, 'quiz.questions', true, true);

    // Le reste, replié
    h += '<details class="card more"><summary>Plus d\'options</summary>' +
      edInput('Note interne (jamais affichée aux participants)', 'description', d.description, { max: 2000, rows: 2 }) +
      edCheck('Afficher la mention de prudence (santé, mineurs)', 'caution', d.caution) +
      (orig.durationDays ? edInput('Nombre de jours', 'durationDays', d.durationDays, { type: 'number', kind: 'int' }) +
        edCheck('Jours consécutifs (une absence remet à zéro)', 'consecutive', d.consecutive) +
        edInput('Bouton du jour', 'dailyLabel', d.dailyLabel || '', { max: 120, ph: 'Valider ma journée' }) : '') +
      '<p class="tiny">' + esc((a.label || '') + ' · ' + (boss ? 'boss' : 'mission ' + d.num)) + '. L\'ordre, l\'arène, le type de support et le déblocage ne se modifient pas ici : ils portent la progression des participants.</p>' +
      '<button class="linkbtn small" data-act="edRevert" data-ok="Revenir à l&#39;origine" data-confirm="Revenir au contenu d&#39;origine pour cette mission ? Les modifications du brouillon seront perdues.">Revenir au contenu d\'origine</button></details>';

    h += '</div>';
    h += '<div class="editor-actions"><button class="btn" data-act="edSave">Enregistrer</button>' +
      '<button class="btn" data-act="edPreview">Aperçu</button>' +
      '<button class="btn primary" data-act="edPublish" data-ok="Publier" data-confirm="Enregistrer et publier ? Les participants verront la mise à jour à leur prochaine ouverture.">Publier</button></div>';
    return h;
  }

  function supportEditor(sup, path, boss) {
    var h = '<div class="card"><div class="eyebrow">' + (boss ? 'Défi pratique · ' : 'Support · ') + esc(sup.type) + (sup.daily ? ' (une coche par jour)' : '') + '</div>';
    if (sup.type === 'checklist') {
      sup.items.forEach(function (it, i) {
        var p = path + '.items.' + i;
        h += '<div class="ed-block"><div class="row" style="justify-content:space-between"><b class="small">Élément ' + (i + 1) + '</b>' +
          (sup.items.length > 1 ? '<button class="linkbtn small" data-act="edDel"' + (it.label ? DEL_CONFIRM : '') + ' data-path="' + attr(path + '.items') + '" data-idx="' + i + '">Supprimer</button>' : '') + '</div>' +
          edInput('Intitulé', p + '.label', it.label, { max: 300 }) +
          edInput('Choix proposés (séparés par des virgules, sinon simple case à cocher)', p + '.choices', (it.choices || []).join(', '), { kind: 'list' }) +
          (sup.daily ? edCheck('Proposer une note du jour', p + '.note', it.note) : '') +
          edCheck('Intitulé provisoire (signalé dans la barre admin)', p + '.pending', it.pending) + '</div>';
      });
      h += '<button class="btn sm" data-act="edAdd" data-path="' + attr(path + '.items') + '" data-kind="item">+ Ajouter un élément</button>';
    } else if (sup.type === 'fiche') {
      sup.fields.forEach(function (f, i) {
        var p = path + '.fields.' + i;
        h += '<div class="ed-block"><div class="row" style="justify-content:space-between"><b class="small">Champ ' + (i + 1) + (f.type === 'recall' ? ' · rappel des réponses précédentes' : '') + '</b>' +
          (sup.fields.length > 1 ? '<button class="linkbtn small" data-act="edDel"' + (f.label ? DEL_CONFIRM : '') + ' data-path="' + attr(path + '.fields') + '" data-idx="' + i + '">Supprimer</button>' : '') + '</div>' +
          edInput('Question / intitulé', p + '.label', f.label, { max: 300 });
        if (f.type !== 'recall') {
          h += edInput('Type de réponse', p + '.type', f.type, { select: [['textarea', 'Texte long'], ['text', 'Texte court'], ['number', 'Nombre'], ['date', 'Date'], ['check', 'Case à cocher'], ['scale', 'Note de 1 à 10']] }) +
            edInput('Texte d\'aide dans le champ', p + '.placeholder', f.placeholder || '', { max: 200 }) +
            edCheck('Réponse obligatoire pour valider', p + '.required', f.required) +
            edCheck('Intitulé provisoire (signalé dans la barre admin)', p + '.pending', f.pending);
        }
        h += '</div>';
      });
      h += '<button class="btn sm" data-act="edAdd" data-path="' + attr(path + '.fields') + '" data-kind="field">+ Ajouter un champ</button>';
    } else if (sup.type === 'quiz') {
      return h + '</div>' + quizEditor(sup.questions, path + '.questions', !!sup.scored, false);
    }
    return h + '</div>';
  }

  function quizEditor(qs, path, scored, fixed) {
    var keys = APP.edit.keys;
    var h = '<div class="card"><div class="eyebrow">' + (fixed ? 'Les 5 questions du boss' : 'Questions du quiz') + '</div>' +
      '<p class="tiny" style="margin:4px 0 0">' + (scored ? 'Coche la bonne réponse de chaque question. Les réponses restent sur le serveur, jamais dans l\'application.' : 'Quiz de diagnostic : aucune bonne réponse.') +
      ' Une question vide reste affichée « à rédiger » et bloque la validation.</p>';
    qs.forEach(function (q, i) {
      var p = path + '.' + i;
      h += '<div class="ed-block"><div class="row" style="justify-content:space-between"><b class="small">Question ' + (i + 1) + (AMContent.questionWritten(q) ? ' ✓' : ' · à rédiger') + '</b>' +
        (!fixed && qs.length > 1 ? '<button class="linkbtn small" data-act="edDel"' + (q.q ? DEL_CONFIRM : '') + ' data-path="' + attr(path) + '" data-idx="' + i + '">Supprimer</button>' : '') + '</div>' +
        edInput('Énoncé', p + '.q', q.q, { rows: 2, max: 600 });
      q.options.forEach(function (o, oi) {
        h += '<div class="row" style="margin-top:8px;gap:8px">' +
          (scored ? '<input type="radio" name="key_' + attr(q.id) + '" aria-label="Bonne réponse" title="Bonne réponse" data-act="edKey" data-q="' + attr(q.id) + '" data-o="' + oi + '"' + (keys[q.id] === oi ? ' checked' : '') + ' style="width:22px;height:22px;flex:none">' : '') +
          '<input class="input grow" data-ed="' + attr(p + '.options.' + oi) + '" value="' + attr(o) + '" maxlength="300" placeholder="Réponse ' + String.fromCharCode(65 + oi) + '" aria-label="Réponse ' + String.fromCharCode(65 + oi) + '">' +
          (q.options.length > 2 ? '<button class="btn sm ghost" style="min-height:40px;padding:6px 10px" aria-label="Supprimer cette réponse" data-act="edDelOpt" data-path="' + attr(p) + '" data-idx="' + oi + '">✕</button>' : '') + '</div>';
      });
      if (q.options.length < 6) h += '<button class="linkbtn small" data-act="edAdd" data-path="' + attr(p + '.options') + '" data-kind="option">+ Ajouter une réponse</button>';
      if (scored && AMContent.questionWritten(q) && typeof keys[q.id] !== 'number') h += '<div class="tiny" style="color:var(--warn)">Bonne réponse à cocher.</div>';
      h += edInput('Explication affichée après la réponse (facultatif)', p + '.explain', q.explain || '', { rows: 2, max: 1500 }) + '</div>';
    });
    if (!fixed) h += '<button class="btn sm" data-act="edAdd" data-path="' + attr(path) + '" data-kind="question">+ Ajouter une question</button>';
    return h + '</div>';
  }

  function viewArenaEditor(id) {
    var prog = draftProgram(), a = null, habit = null;
    prog.arenas.forEach(function (x) { if (x.id === id) a = x; });
    if (!a) return notFound();
    (prog.habits || []).forEach(function (x) { if (x.arena === id) habit = x; });
    if (!APP.edit || APP.edit.id !== 'arena:' + id) APP.edit = { id: 'arena:' + id, data: { arena: JSON.parse(JSON.stringify(a)), habit: habit ? JSON.parse(JSON.stringify(habit)) : null }, dirty: false };
    var d = APP.edit.data;
    var h = '<div class="crumb"><a href="#/admin">Admin</a> › <a href="#/contenu">Contenu</a> › ' + esc(a.label) + '</div><h1 class="h-display" style="margin-top:6px">' + esc(a.label) + '</h1>';
    h += '<div id="edDirty" class="notice warn" style="margin-top:10px;' + (APP.edit.dirty ? '' : 'display:none') + '">Modifications non enregistrées.</div>';
    h += '<div class="card stack" style="margin-top:12px"><div class="eyebrow">L\'arène</div>' +
      edInput('Nom', 'arena.name', d.arena.name, { max: 400 }) + edInput('Thème', 'arena.theme', d.arena.theme, { max: 400 }) +
      edInput('Le blocage', 'arena.blocage', d.arena.blocage, { max: 400 }) + edInput('Objectif', 'arena.objectif', d.arena.objectif, { rows: 2, max: 400 }) +
      edInput('Livrable', 'arena.livrable', d.arena.livrable, { rows: 2, max: 400 }) + '</div>';
    if (d.habit) h += '<div class="card stack" style="margin-top:12px"><div class="eyebrow">L\'habitude qui reste</div>' +
      edInput('Habitude', 'habit.title', d.habit.title, { max: 120 }) + edInput('Fréquence (texte affiché)', 'habit.frequency', d.habit.frequency, { max: 60 }) + '</div>';
    h += '<div class="editor-actions"><button class="btn primary" data-act="edSaveArena">Enregistrer le brouillon</button></div>';
    return h;
  }

  function saveEdit() {
    var e = APP.edit;
    if (!e) return Promise.resolve();
    var p;
    if (e.id.indexOf('arena:') === 0) {
      var aid = e.id.slice(6);
      p = APP.store.contentCall('saveArena', { id: aid, data: e.data.arena }).then(function () {
        return e.data.habit ? APP.store.contentCall('saveHabit', { id: e.data.habit.id, data: e.data.habit }) : null;
      });
    } else {
      p = APP.store.contentCall('saveMission', { id: e.id, data: e.data, keys: e.keys });
    }
    return p.then(function () { e.dirty = false; return loadContentAdmin(); });
  }

  // Aperçu : la page mission telle que la verront les participants, avec le brouillon.
  function viewPreview(id) {
    var g = contentGuard(); if (g) return g;
    var eng = AMEngine.createEngine(draftProgram(), { assumeKeys: true });
    var m; try { m = eng.mission(id); } catch (e) { return notFound(); }
    var now = APP.store.now();
    var saved = { engine: APP.engine, view: APP.view, session: APP.session };
    var fresh = eng.newState(now, 0);
    var item = { id: id, status: 'open', checks: eng.checks(fresh, id, now), canValidate: false };
    if (m.durationDays) item.run = { required: m.durationDays, current: 0, done: false, todayDone: false, broken: false };
    if (m.kind === 'boss' && !m.final) { item.quizReady = eng.bossQuizReady(m); item.retryAt = null; }
    APP.engine = eng;
    APP.session = Object.assign({}, saved.session, { state: fresh });
    APP.view = eng.view(fresh, now);
    APP.view.items[id] = item;
    var body;
    try {
      body = '<div class="notice warn" style="margin-bottom:12px"><b>Aperçu du brouillon</b> — ce que verra le participant. Les boutons sont inactifs. <a href="#/contenu/' + encodeURIComponent(id) + '">Retour à l\'éditeur</a></div>' + viewMission(id, true);
    } finally {
      APP.engine = saved.engine; APP.view = saved.view; APP.session = saved.session;
    }
    return body;
  }

  // Saisie dans l'éditeur : mise à jour du modèle sans re-rendu (le focus reste)
  document.addEventListener('input', function (e) { edInputHandler(e.target); });
  document.addEventListener('change', function (e) { if (e.target.dataset && e.target.dataset.ed && (e.target.type === 'checkbox' || e.target.tagName === 'SELECT')) edInputHandler(e.target, true); });
  function edInputHandler(t, rerender) {
    if (!t.dataset || !t.dataset.ed || !APP.edit) return;
    var k = t.dataset.edKind, v = t.value;
    if (t.type === 'checkbox') v = t.checked;
    else if (k === 'int') v = parseInt(v, 10) || 0;
    else if (k === 'list') v = v.split(',').map(function (x) { return x.trim(); }).filter(Boolean);
    setPath(APP.edit.data, t.dataset.ed, v);
    if (/\.pending$/.test(t.dataset.ed) === false && /\.label$/.test(t.dataset.ed) && APP.edit.data) { /* le badge provisoire se retire à la main */ }
    APP.edit.dirty = true;
    var dz = document.getElementById('edDirty'); if (dz) dz.style.display = '';
    if (t.dataset.ed === 'video') {
      var hint = document.getElementById('vidHint'); if (hint) hint.innerHTML = videoHint(v);
      var pv = document.getElementById('vidPrev'), emb = AMContent.checkVideoUrl(v).ok && v ? videoEmbed(v, APP.edit.data.videoTitle, null) : null;
      if (pv) pv.innerHTML = emb ? '<div class="video">' + emb + '</div>' : '';
    }
    if (rerender) render();
  }

  function notFound() { return '<div class="notice warn">Page introuvable. <a href="#/">Retour à l\'accueil</a></div>'; }

  // ─── Sauvegarde des fiches (au fil de la frappe) ──────────────────────────
  function queueSave(mid, field, value) {
    APP.pending[mid] = APP.pending[mid] || {};
    APP.pending[mid][field] = value;
    var el = document.getElementById('saved_' + mid);
    if (el) el.textContent = 'Enregistrement…';
    clearTimeout(APP.saveTimers[mid]);
    APP.saveTimers[mid] = setTimeout(function () { flush(mid); }, 700);
  }
  function flush(mid) {
    clearTimeout(APP.saveTimers[mid]);
    var data = APP.pending[mid];
    if (!data) return Promise.resolve();
    delete APP.pending[mid];
    return act({ type: 'support', id: mid, data: data }, { silent: true }).then(function () {
      var el = document.getElementById('saved_' + mid);
      if (el) el.textContent = 'Enregistré ✓';
      var foot = document.getElementById('mfoot');
      if (foot && route().name === 'mission' && route().arg === mid) foot.innerHTML = footBlock(M(mid), APP.view.items[mid]);
    }).catch(function () {
      var el = document.getElementById('saved_' + mid);
      if (el) el.textContent = 'Échec de l\'enregistrement — réessaie.';
    });
  }
  function flushAll() { return Promise.all(Object.keys(APP.pending).filter(function (k) { return k.indexOf('day_') !== 0; }).map(flush)); }

  document.addEventListener('input', function (e) {
    var t = e.target;
    if (t.dataset && t.dataset.field && t.dataset.id) {
      var v = t.value;
      if (t.type === 'number') v = v === '' ? '' : Number(v);
      queueSave(t.dataset.id, t.dataset.field, v);
    }
  });
  document.addEventListener('focusout', function (e) {
    var t = e.target;
    if (t.dataset && t.dataset.field && t.dataset.id && APP.pending[t.dataset.id]) flush(t.dataset.id);
  });
  window.addEventListener('beforeunload', function () { flushAll(); });

  document.addEventListener('ended', function (e) {
    var t = e.target;
    if (t.tagName === 'VIDEO' && t.dataset.videoFor) act({ type: 'video', id: t.dataset.videoFor }).catch(function () {});
  }, true);

  // ─── Clics ────────────────────────────────────────────────────────────────
  function busy(fn) {
    if (APP.busy) return;
    APP.busy = true;
    Promise.resolve().then(fn).catch(function () {}).then(function () { APP.busy = false; });
  }

  var HANDLERS = {
    closeCelebrate: function () { var o = document.querySelector('.overlay'); if (o) o.remove(); setTimeout(showCelebration, 50); },
    loginTab: function (d) { APP.loginTab = d.tab; render(); },
    demo: function () { APP.gate = null; return startDemo(false); },
    retry: function () { return startRemote(); },
    signout: function () {
      return APP.store && APP.store.signOut ? APP.store.signOut().then(function () {
        setMode(null); APP.session = null; APP.gate = null; APP.adminData = null; location.hash = '#/'; render();
      }) : (setMode(null), APP.session = null, APP.gate = null, render());
    },
    google: function () {
      APP.store = new AMStore.RemoteStore(CFG);
      return APP.store.google().then(startRemote).catch(function (e) { toast(authMsg(e), true); });
    },
    forgot: function () {
      var email = (document.getElementById('lEmail') || {}).value;
      if (!email) return toast('Saisis ton email ci-dessus.', true);
      APP.store = new AMStore.RemoteStore(CFG);
      return APP.store.resetPassword(email).then(function () { toast('Email de réinitialisation envoyé.'); }).catch(function (e) { toast(authMsg(e), true); });
    },
    resend: function () { return APP.store.resendVerification().then(function () { toast('Email renvoyé.'); }).catch(function (e) { toast(authMsg(e), true); }); },
    verified: function () { return APP.store.refreshUser().then(startRemote).catch(function (e) { toast(authMsg(e), true); }); },
    startProgram: function () {
      var p = st().introSeenAt ? Promise.resolve() : act({ type: 'intro' }, { silent: true });
      return p.then(function () { go('#/mission/m0.1'); });
    },
    goProfile: function () { go('#/profil'); },
    travel: function (d) { APP.store.travel(Number(d.ms)); toast('Horloge démo avancée.'); refresh(); },
    demoPay: function () { APP.store.simulateFullPayment(); return APP.store.init().then(function (s) { APP.session = s; toast('Paiement complet simulé.'); refresh(); }); },
    demoReset: function () {
      APP.store.reset(); APP.quizSel = {}; APP.quizRes = {}; APP.pending = {};
      return startDemo(true).then(function () { go('#/debut'); });
    },
    demoResetContent: function () {
      APP.store.resetContent(); APP.contentData = null; APP.edit = null;
      return reloadContent().then(function () { toast('Contenu de démo remis à l\'origine.'); refresh(); });
    },
    check: function (d) {
      var cur = (rec(d.id).support || {})[d.item] === true;
      var data = {}; data[d.item] = !cur;
      return act({ type: 'support', id: d.id, data: data });
    },
    ficheCheck: function (d) { return HANDLERS.check(d); },
    choice: function (d) { var data = {}; data[d.item] = d.val; return act({ type: 'support', id: d.id, data: data }); },
    scale: function (d) { var data = {}; data[d.item] = Number(d.val); return flush(d.id).then(function () { return act({ type: 'support', id: d.id, data: data }); }); },
    dayCheck: function (d) {
      var k = 'day_' + d.id; APP.pending[k] = APP.pending[k] || {};
      APP.pending[k][d.item] = !APP.pending[k][d.item];
      var note = document.getElementById('note_' + d.id); var keep = note ? note.value : null;
      render();
      var n2 = document.getElementById('note_' + d.id); if (n2 && keep) n2.value = keep;
    },
    checkin: function (d) {
      var note = document.getElementById('note_' + d.id);
      return act({ type: 'checkin', id: d.id, items: APP.pending['day_' + d.id] || {}, note: note ? note.value : '' }).then(function () {
        delete APP.pending['day_' + d.id];
        toast('Journée validée ✓');
      });
    },
    videoDone: function (d) { return act({ type: 'video', id: d.id }); },
    validate: function (d) {
      return flush(d.id).then(function () { return act({ type: 'validate', id: d.id }); }).then(function () {
        if (M(d.id).kind !== 'boss') toast('Mission validée ✓');
      });
    },
    quizPick: function (d) {
      APP.quizSel[d.id] = APP.quizSel[d.id] || {};
      APP.quizSel[d.id][d.q] = Number(d.o);
      render();
    },
    quizRetry: function (d) { APP.retrying = d.id; APP.quizSel[d.id] = {}; delete APP.quizRes[d.id]; render(); },
    quizSubmit: function (d) {
      return act({ type: 'quiz', id: d.id, answers: APP.quizSel[d.id] || {} }, { silent: true }).then(function (r) {
        APP.quizRes[d.id] = r.result || {};
        APP.retrying = null;
        render();
      });
    },
    bossSubmit: function (d) {
      return act({ type: 'boss', id: d.id, answers: APP.quizSel[d.id] || {} }, { silent: true }).then(function (r) {
        APP.quizRes[d.id] = r.result || {};
        APP.quizSel[d.id] = {};
        render();
        var el = document.querySelector('#mfoot'); if (el && !r.result.won) el.scrollIntoView({ behavior: 'smooth' });
      }).catch(function () { render(); });
    },
    edAdd: function (d) {
      var list = getPath(APP.edit.data, d.path);
      if (d.kind === 'item') list.push({ id: newId('i'), label: '' });
      else if (d.kind === 'field') list.push({ id: newId('f'), label: '', type: 'textarea', required: true });
      else if (d.kind === 'question') list.push({ id: newId('q'), q: '', options: ['', '', ''], explain: '' });
      else if (d.kind === 'option') list.push('');
      APP.edit.dirty = true; render();
    },
    edDel: function (d) {
      var list = getPath(APP.edit.data, d.path), gone = list[Number(d.idx)];
      list.splice(Number(d.idx), 1);
      if (gone && gone.q !== undefined) delete APP.edit.keys[gone.id];
      APP.edit.dirty = true; render();
    },
    edDelOpt: function (d) {
      var q = getPath(APP.edit.data, d.path), i = Number(d.idx), k = APP.edit.keys[q.id];
      q.options.splice(i, 1);
      if (k === i) delete APP.edit.keys[q.id]; else if (typeof k === 'number' && k > i) APP.edit.keys[q.id] = k - 1;
      APP.edit.dirty = true; render();
    },
    edKey: function (d) { APP.edit.keys[d.q] = Number(d.o); APP.edit.dirty = true; var dz = document.getElementById('edDirty'); if (dz) dz.style.display = ''; },
    edSave: function () { return saveEdit().then(function () { toast('Brouillon enregistré. Publie pour le mettre en ligne.'); }).catch(function (e) { toast(e.message, true); }); },
    edSaveArena: function () { return HANDLERS.edSave(); },
    edPublish: function () {
      return saveEdit().then(function () { return APP.store.contentCall('publish'); }).then(function (r) {
        var id = APP.edit && APP.edit.id;
        APP.contentData = null; APP.edit = null;
        return reloadContent().then(function () { toast('Publié (version ' + r.version + ').'); if (id && id.indexOf('arena:') !== 0) go('#/mission/' + encodeURIComponent(id)); else refresh(); });
      }).catch(function (e) { toast(e.message, true); });
    },
    edPreview: function () { return saveEdit().then(function () { go('#/apercu/' + encodeURIComponent(APP.edit.id)); }).catch(function (e) { toast(e.message, true); }); },
    edRevert: function () {
      var id = APP.edit.id;
      return APP.store.contentCall('revertMission', { id: id }).then(function () { APP.edit = null; return loadContentAdmin(); }).then(function () { toast('Mission remise au contenu d\'origine (brouillon).'); });
    },
    cPublish: function () {
      return APP.store.contentCall('publish').then(function (r) {
        APP.contentData = null; APP.edit = null;
        return reloadContent().then(function () { toast('Contenu publié (version ' + r.version + ').'); refresh(); });
      }).catch(function (e) { toast(e.message, true); });
    },
    cDiscard: function () {
      return APP.store.contentCall('discard').then(function () { APP.contentData = null; APP.edit = null; render(); });
    },
    habit: function (d) { return act({ type: 'habit', id: d.id, value: d.val }); },
    deliveryOpened: function () { APP.deliveryOpened = true; setTimeout(render, 300); },
    demoDelivery: function () { APP.store.simulateDelivery(); return APP.store.init().then(function (s) { APP.session = s; toast('Livraison confirmée (démo).'); refresh(); }); },
    saveName: function () { var v = document.getElementById('pName').value; return act({ type: 'profile', name: v }).then(function () { toast('Prénom enregistré.'); }); },
    restart: function () {
      return act({ type: 'restart' }).then(function () { go('#/'); });
    },
    install: function () { if (APP.installEvt) { APP.installEvt.prompt(); APP.installEvt = null; } },
    adminFilter: function (d) { APP.adminFilter = d.f; render(); },
    adminReload: function () { APP.adminData = null; render(); },
    contacted: function (d) { return APP.store.admin('contacted', { uid: d.uid, day: Number(d.day) }).then(function () { toast('Contact J' + d.day + ' noté.'); APP.adminData = null; render(); }); },
    grant: function () {
      var email = document.getElementById('gEmail').value.trim(), plan = document.getElementById('gPlan').value;
      if (!email) return toast('Saisis un email.', true);
      return APP.store.admin('grantAccess', { email: email, plan: plan }).then(function () { toast('Paiement ajouté pour ' + email + '.'); APP.adminData = null; render(); }).catch(function (e) { toast(e.message, true); });
    }
  };

  function authMsg(e) {
    var c = (e && e.code) || '';
    if (/invalid-credential|wrong-password|user-not-found|invalid-login/.test(c)) return 'Email ou mot de passe incorrect.';
    if (/email-already-in-use/.test(c)) return 'Un compte existe déjà avec cet email : connecte-toi (mêmes identifiants qu\'Athletik Hub).';
    if (/weak-password/.test(c)) return 'Mot de passe trop court (6 caractères minimum).';
    if (/popup-closed/.test(c)) return 'Connexion Google annulée.';
    if (/unauthorized-domain/.test(c)) return 'Ce domaine n\'est pas encore autorisé dans Firebase (voir README).';
    if (/network/.test(c)) return 'Connexion impossible. Vérifie ton réseau.';
    return (e && e.message) || 'Erreur de connexion.';
  }

  // Confirmation dans la page : confirm() est bloqué dans certaines vues intégrées
  // (application installée, aperçus) et y renvoie « non » sans rien afficher.
  function ask(message, okLabel) {
    return new Promise(function (resolve) {
      var o = document.createElement('div');
      o.className = 'overlay ask';
      o.setAttribute('role', 'alertdialog');
      o.setAttribute('aria-modal', 'true');
      o.innerHTML = '<div class="celebrate" style="text-align:left"><p style="margin:0 0 16px;font-size:16px">' + esc(message) + '</p>' +
        '<div class="row"><button class="btn grow" data-ask="0">Annuler</button><button class="btn primary grow" data-ask="1">' + esc(okLabel || 'Confirmer') + '</button></div></div>';
      document.body.appendChild(o);
      o.querySelector('[data-ask="1"]').focus();
      o.addEventListener('click', function (ev) {
        var b = ev.target.closest('[data-ask]');
        if (!b && ev.target !== o) return;
        o.remove();
        resolve(!!b && b.dataset.ask === '1');
      });
    });
  }
  window.AMAsk = ask;

  document.addEventListener('click', function (e) {
    if (e.target.closest('.ask')) return;
    var el = e.target.closest('[data-act]');
    if (!el) return;
    var name = el.dataset.act, fn = HANDLERS[name];
    if (!fn) return;
    // Un vrai lien externe (nouvel onglet) doit s'ouvrir : on ne bloque que les liens internes.
    if (el.tagName === 'A' && name !== 'closeCelebrate' && el.target !== '_blank') e.preventDefault();
    if (el.disabled) return;
    if (el.dataset.confirm) {
      if (APP.busy) return;
      ask(el.dataset.confirm, el.dataset.ok).then(function (ok) { if (ok) busy(function () { return fn(el.dataset, el); }); });
      return;
    }
    busy(function () { return fn(el.dataset, el); });
  });
  document.addEventListener('keydown', function (e) {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('[role="checkbox"][data-act]')) {
      e.preventDefault(); e.target.click();
    }
    if (e.key === 'Escape') { var a = document.querySelector('.ask'); if (a) { a.click(); return; } var o = document.querySelector('.overlay'); if (o) HANDLERS.closeCelebrate(); }
  });
  document.addEventListener('submit', function (e) {
    if (e.target.id !== 'loginForm') return;
    e.preventDefault();
    var email = document.getElementById('lEmail').value.trim(), pass = document.getElementById('lPass').value;
    APP.store = new AMStore.RemoteStore(CFG);
    var p = APP.loginTab === 'signup' ? APP.store.signUp(email, pass) : APP.store.signIn(email, pass);
    busy(function () { return p.then(startRemote).catch(function (err) { toast(authMsg(err), true); }); });
  });

  window.addEventListener('hashchange', function () {
    var r = route();
    if (r.name === 'admin') APP.adminData = null;
    // Quitter l'éditeur avec des changements : on les garde dans le brouillon (jamais publiés sans clic).
    if (APP.edit && APP.edit.dirty && !(r.name === 'contenu' && (r.arg === APP.edit.id || 'arena:' + r.arg2 === APP.edit.id))) {
      saveEdit().then(function () { toast('Modifications gardées dans le brouillon.'); }).catch(function (e) { toast(e.message, true); });
    }
    if (APP.edit && !APP.edit.dirty && r.name !== 'contenu') APP.edit = null;
    render();
  });
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); APP.installEvt = e; });
  // Les comptes à rebours se rafraîchissent chaque minute (sans toucher aux saisies)
  setInterval(function () {
    var a = document.activeElement;
    if (APP.session && !document.querySelector('.overlay') && !(a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT'))) refresh();
  }, 60000);

  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(function () {});
  }

  window.AMApp = APP; // pour les tests
  boot();
})();
