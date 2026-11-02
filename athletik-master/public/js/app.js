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

  function waLink(kind) {
    var num = String(CFG.whatsappNumber || '').replace(/\D/g, '');
    if (!num) return null;
    var msg = ((APP.program.settings.whatsappMessages || {})[kind]) || '';
    return 'https://wa.me/' + num + (msg ? '?text=' + encodeURIComponent(msg) : '');
  }

  // ─── Démarrage ────────────────────────────────────────────────────────────
  function boot() {
    fetch('content/program.json', { cache: 'no-cache' }).then(function (r) { return r.json(); }).then(function (p) {
      APP.program = p;
      var mode = null;
      try { mode = localStorage.getItem(MODE_KEY); } catch (e) {}
      if (/[?&]demo\b/.test(location.search)) mode = 'demo';
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
    APP.store = new AMStore.DemoStore(APP.program);
    APP.engine = APP.store.engine;
    if (fresh || !APP.store.data) APP.store.start(name);
    return APP.store.init().then(function (s) { APP.session = s; APP.gate = null; refresh(); });
  }

  function startRemote() {
    setMode('remote');
    APP.store = new AMStore.RemoteStore(CFG);
    APP.engine = AMEngine.createEngine(APP.program, { assumeKeys: true });
    $app.innerHTML = '<div class="login"><p class="muted" style="text-align:center">Connexion…</p></div>';
    return APP.store.init().then(function (s) {
      APP.gate = null;
      APP.session = s ? fromServer(s) : null;
      if (s) refresh(); else render();
    }).catch(function (e) {
      APP.session = null;
      APP.gate = e.code || 'server_error';
      render();
    });
  }

  function fromServer(j) {
    return { profile: j.profile, state: j.state, access: j.access, roles: j.roles };
  }

  function refresh() {
    if (APP.session) APP.view = APP.engine.view(APP.session.state, APP.store.now());
    render();
  }

  // ─── Actions ──────────────────────────────────────────────────────────────
  function act(action, opts) {
    opts = opts || {};
    return APP.store.act(action).then(function (r) {
      if (r.state) APP.session.state = r.state;
      if (r.access) APP.session.access = r.access;
      if (r.roles) APP.session.roles = r.roles;
      if (r.profile) APP.session.profile = r.profile;
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
    return { name: parts[0] || 'accueil', arg: parts[1] ? decodeURIComponent(parts[1]) : null };
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
      case 'debut': body = viewStart(); break;
      case 'fin': body = viewEnd(); break;
      default: body = viewDashboard();
    }
    var tab = { accueil: 'accueil', carte: 'carte', arene: 'carte', mission: 'carte', regles: 'carte', habitudes: 'habitudes', recompenses: 'recompenses', fin: 'recompenses', profil: 'profil', admin: 'profil', debut: 'accueil' }[r.name] || 'accueil';
    $app.innerHTML = shell(body, tab);
    window.scrollTo(0, keep ? y : 0);
    if (r.name === 'admin' && !APP.adminData) loadAdmin();
  }

  function shell(body, tab) {
    var v = APP.view;
    var day = Math.min(Math.max(v.day, 1), v.programDays);
    var tabs = [
      ['accueil', '🏠', 'Accueil'], ['carte', '🗺️', 'Carte'], ['habitudes', '✅', 'Habitudes'],
      ['recompenses', '🏆', 'Récompenses'], ['profil', '👤', 'Profil']
    ];
    return (APP.store.demo ? '<div class="demo-bar">MODE DÉMO — données fictives, enregistrées sur cet appareil uniquement · <button data-act="travel" data-ms="86400000">+24 h</button><button data-act="goProfile">outils</button></div>' : '') +
      '<header class="topbar"><img class="logo" src="icons/logo-mark.png" alt="">' +
      '<div class="brand">ATHLETIK MASTER<small>' + esc(v.rank ? 'Rang ' + v.rank : 'Niveau 0 en cours') + '</small></div>' +
      '<div class="spacer"></div><span class="daypill">Jour ' + day + ' / ' + v.programDays + '</span></header>' +
      '<nav class="tabbar" aria-label="Navigation principale">' + tabs.map(function (t) {
        return '<a href="#/' + (t[0] === 'accueil' ? '' : t[0]) + '" class="' + (tab === t[0] ? 'on' : '') + '"' + (tab === t[0] ? ' aria-current="page"' : '') + '><span class="ic" aria-hidden="true">' + t[1] + '</span>' + t[2] + '</a>';
      }).join('') + '</nav>' +
      '<main class="page">' + body + '</main>';
  }

  // ─── Connexion et écrans d'accès ──────────────────────────────────────────
  function renderLogin() {
    var signup = APP.loginTab === 'signup';
    return '<div class="login">' +
      '<img class="logo" src="icons/logo-mark.png" alt="">' +
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
    return '<div class="login"><img class="logo" src="icons/logo-mark.png" alt=""><div class="card stack">' +
      '<h2 class="h-display">' + esc(title) + '</h2><p class="muted">' + esc(text) + '</p>' +
      '<button class="btn block" data-act="retry">Réessayer</button>' + btns +
      '<button class="linkbtn small" data-act="signout">Se déconnecter</button></div></div>';
  }

  // ─── Début / fin de programme ─────────────────────────────────────────────
  function viewStart() {
    var name = (APP.session.profile && APP.session.profile.name) || '';
    return '<div class="stack">' +
      '<div class="card hero stack">' +
      '<div class="eyebrow">Début du programme</div>' +
      '<h1 class="h-display">Bienvenue' + (name ? ', ' + esc(name.split(' ')[0]) : '') + ' !</h1>' +
      '<p class="muted" style="font-size:17px">Deviens l\'athlète dont tu as toujours rêvé. 90 jours pour passer d\'athlète qui stagne à athlète explosif.</p>' +
      '<div class="steps"><span>Regarder</span><em>→</em><span>Comprendre</span><em>→</em><span>Passer à l\'action</span><em>→</em><span>Valider</span><em>→</em><span>Débloquer la suite</span></div>' +
      '</div>' +
      '<div class="card stack"><h3>Ton parcours</h3><ul style="margin:0;padding-left:20px">' +
      '<li><b>Niveau 0 — Préparation</b> : 6 étapes à faire dès aujourd\'hui.</li>' +
      '<li><b>8 arènes</b>, une mission par jour, un boss à battre par arène.</li>' +
      '<li><b>Des rangs</b> : Rookie au départ, on monte en battant les boss.</li>' +
      '<li><b>8 habitudes</b> qui s\'installent une à une et restent jusqu\'au 90ᵉ jour.</li></ul></div>' +
      '<div class="card stack"><h3>La seule règle à retenir</h3><p class="muted" style="margin:0">Regarde, fais l\'action, valide : la suite se débloque le lendemain.</p>' +
      '<a class="small" href="#/regles">Lire les règles du jeu</a></div>' +
      '<div class="card stack"><h3>Ta vidéo d\'engagement</h3><p class="muted" style="margin:0">Pendant le niveau 0 (étape 0.5), tu enverras à Alassane une vidéo sur WhatsApp : ta situation actuelle, tes objectifs, tes motivations et ton engagement sur les 90 jours. Il la regarde.</p></div>' +
      '<button class="btn primary block" data-act="startProgram">' + (st().introSeenAt ? 'Aller au niveau 0' : 'Commencer le niveau 0') + '</button>' +
      '</div>';
  }

  function viewEnd() {
    var v = APP.view;
    if (!v.finished) {
      return '<div class="stack"><div class="eyebrow">Fin du programme</div><h1 class="h-display">La ligne d\'arrivée</h1>' +
        '<div class="card stack"><p class="muted" style="margin:0">Le boss final « Deviens Athletik Master » t\'attend au bout de l\'arène 8 : refaire tes tests physiques et envoyer ta vidéo de fin. Il est gagné dès que c\'est fait, quels que soient les chiffres.</p>' +
        '<div class="progress"><i style="width:' + v.progress + '%"></i></div><p class="small muted" style="margin:0">' + v.validatedCount + ' / ' + v.totalCount + ' missions validées</p></div>' +
        '<a class="btn block" href="#/carte">Voir la carte</a></div>';
    }
    var wa = waLink('final');
    return '<div class="stack">' +
      '<div class="card gold stack" style="text-align:center"><div class="eyebrow">Fin du programme</div>' +
      '<div class="bigart" style="margin:6px auto;width:110px;height:146px;border-radius:14px;display:flex;align-items:center;justify-content:center;font-family:var(--display);font-size:22px;color:var(--gold-ink);background:linear-gradient(160deg,var(--gold2),var(--gold) 60%,#9C7A25)">ATHLETIK MASTER</div>' +
      '<h1 class="h-display">Tu es Athletik Master</h1><p class="muted">90 jours, 8 arènes, 8 habitudes installées. Bravo.</p></div>' +
      '<div class="card stack"><h3>Ta vidéo de fin</h3><p class="muted" style="margin:0">Envoie-la à Alassane sur WhatsApp : elle sera comparée à ta vidéo du départ.</p>' +
      (wa ? '<a class="btn wa block" href="' + attr(wa) + '" target="_blank" rel="noopener">Envoyer ma vidéo sur WhatsApp</a>' : '<span class="placeholder">Lien WhatsApp à configurer</span>') + '</div>' +
      '<div class="card stack"><h3>Et maintenant ?</h3><p class="muted" style="margin:0">Athletik Master est un entraînement, pas un cours qu\'on termine. Pioche librement dans les missions pour retravailler un concept, ou recommence le parcours. Tout reste accessible, et tes habitudes continuent.</p>' +
      '<a class="btn block" href="#/carte">Piocher dans les missions</a>' +
      '<button class="btn ghost block" data-act="restart">Recommencer le parcours</button></div></div>';
  }

  // ─── Tableau de bord ──────────────────────────────────────────────────────
  function viewDashboard() {
    var v = APP.view, s = APP.session;
    var name = (s.profile && s.profile.name) || 'athlète';
    var arena = v.currentArena ? A(v.currentArena) : null;
    var h = '<div class="stack">';
    h += '<div><div class="eyebrow">Jour ' + Math.min(Math.max(v.day, 1), v.programDays) + ' sur ' + v.programDays + '</div><h1 class="h-display">Salut ' + esc(name.split(' ')[0]) + ' !</h1></div>';

    // Prochaine mission
    h += nextCard();

    // Rang + progression
    h += '<div class="card hero"><div class="rankcard">' +
      '<div class="rank-badge ' + (v.rank ? '' : 'none') + '">' + esc(v.rank || 'À VENIR') + '</div>' +
      '<div class="grow"><div class="tiny">Ton rang</div><div style="font-weight:800;font-size:19px">' + esc(v.rank || 'Termine le niveau 0 pour devenir Rookie') + '</div>' +
      '<div class="progress" style="margin-top:10px" role="progressbar" aria-valuenow="' + v.progress + '" aria-valuemin="0" aria-valuemax="100"><i style="width:' + v.progress + '%"></i></div>' +
      '<div class="small muted" style="margin-top:6px">' + v.validatedCount + ' / ' + v.totalCount + ' missions terminées · ' + v.progress + ' %</div></div></div></div>';

    h += '<div class="grid2"><div class="card stat"><b>' + v.validatedCount + '</b><span>missions terminées</span></div>' +
      '<a class="card stat card-link" href="' + (arena ? '#/arene/' + arena.id : '#/carte') + '"><b>' + (arena ? arena.num : '★') + '</b><span>' + (arena ? esc(arena.label + ' — ' + arena.name) : 'Parcours terminé') + '</span></a></div>';

    if (s.access && s.access.parcel) {
      h += '<div class="card gold row"><span style="font-size:30px" aria-hidden="true">📦</span><div><b>Un colis est en route</b><div class="small muted">Surprise…</div></div></div>';
    }

    // Habitudes du jour
    h += '<div class="section-title"><h2>Mes habitudes du jour</h2><a href="#/habitudes">Tout voir</a></div>';
    if (!v.habits.length) h += '<div class="notice">Ta première habitude se débloque dans l\'arène 1. Elles s\'additionnent ensuite, une par arène.</div>';
    else h += '<div class="stack">' + v.habits.map(habitCard).join('') + '</div>';

    // Récompenses
    h += '<div class="section-title"><h2>Dernières récompenses</h2><a href="#/recompenses">Toutes</a></div>';
    var last = v.rewards.slice(-3).reverse();
    h += last.length ? '<div class="rewards">' + last.map(function (r) { return rewardTile(r, true); }).join('') + '</div>' :
      '<div class="notice">Ta première récompense : la carte Rookie, à la fin du niveau 0.</div>';

    h += '<div class="section-title"><h2>Ton parcours</h2></div>';
    h += '<a class="btn primary block" href="#/carte">🗺️ Voir la carte des 8 arènes</a>';
    h += '<a class="btn ghost block" href="#/regles">Règles du jeu</a>';
    return h + '</div>';
  }

  function nextCard() {
    var v = APP.view;
    if (v.finished) {
      return '<a class="card gold card-link" href="#/fin"><div class="eyebrow">Parcours terminé</div><h3 style="font-size:20px;margin-top:4px">Tu es Athletik Master 🏆</h3><p class="small muted" style="margin:4px 0 0">Recommence ou pioche dans les missions.</p></a>';
    }
    if (!v.next) return '';
    var m = M(v.next), it = v.items[m.id], a = A(m.arena);
    var label = m.kind === 'boss' ? (m.final ? 'Boss final' : 'Boss') : 'Mission ' + m.num;
    var cta, extra = '';
    if (it.status === 'waiting') {
      cta = '<span class="chip wait">🔒 Se débloque ' + esc(fmtWhen(it.unlockAt)) + '</span>';
      extra = '<p class="small muted" style="margin:8px 0 0">Bien joué pour aujourd\'hui. La suite arrive dans ' + esc(fmtIn(it.unlockAt)) + '.</p>';
    } else {
      var started = rec(m.id).checkins || rec(m.id).support;
      cta = '<span class="btn primary sm">' + (started ? 'Continuer' : 'Commencer') + ' →</span>';
      if (it.run) extra = '<p class="small muted" style="margin:8px 0 0">Jour ' + Math.min(it.run.current + (it.run.todayDone ? 0 : 1), m.durationDays) + ' / ' + m.durationDays + (it.run.todayDone ? ' · déjà coché aujourd\'hui ✓' : '') + '</p>';
    }
    return '<a class="card next-card card-link ' + (it.status === 'open' ? 'gold' : '') + '" href="#/mission/' + encodeURIComponent(m.id) + '">' +
      '<div class="eyebrow">' + (it.status === 'open' ? 'Ta prochaine mission' : 'Prochaine mission') + '</div>' +
      '<div class="num" style="margin-top:6px">' + esc(a.label + ' · ' + label) + '</div>' +
      '<h3>' + esc(m.title) + '</h3><p class="small muted" style="margin:0 0 10px">' + esc(m.action) + '</p>' + cta + extra + '</a>';
  }

  // ─── Carte des arènes ─────────────────────────────────────────────────────
  var CHIP = { done: '<span class="chip done">✓ Terminée</span>', current: '<span class="chip cur">● En cours</span>', locked: '<span class="chip lock">🔒 Verrouillée</span>' };

  function viewMap() {
    var v = APP.view;
    var h = '<div class="row" style="justify-content:space-between;align-items:flex-end"><div><div class="eyebrow">Ton parcours</div><h1 class="h-display">La carte</h1></div><a class="btn sm" href="#/regles">Règles du jeu</a></div>';
    h += '<p class="small muted">' + v.validatedCount + ' / ' + v.totalCount + ' missions · un boss à battre dans chaque arène.</p>';
    h += '<div class="map" style="margin-top:8px">';
    v.arenas.forEach(function (av) {
      var a = A(av.id);
      var reward = APP.program.rewards.filter(function (r) { return r.trigger === 'boss:' + a.id || r.trigger === 'section:' + a.id; })[0];
      h += '<a class="map-node ' + av.status + '" href="#/arene/' + a.id + '">' +
        '<div class="map-dot"><span>' + (av.status === 'done' ? '✓' : a.num) + '</span></div>' +
        '<div class="map-body"><div class="row" style="justify-content:space-between;gap:6px"><span class="lbl">' + esc(a.label) + ' · ' + esc(a.theme) + '</span>' + CHIP[av.status] + '</div>' +
        '<h3>' + esc(a.name) + '</h3>' +
        '<div class="progress" style="height:6px"><i style="width:' + (av.total ? Math.round(av.done * 100 / av.total) : 0) + '%"></i></div>' +
        '<div class="tiny" style="margin-top:6px">' + av.done + ' / ' + av.total + (reward ? ' · 🏆 ' + esc(reward.title) : '') + '</div></div></a>';
    });
    return h + '</div>';
  }

  function viewArena(id) {
    var a = A(id);
    if (!a) return notFound();
    var av = APP.view.arenas.filter(function (x) { return x.id === id; })[0];
    var habit = APP.program.habits.filter(function (x) { return x.arena === id; })[0];
    var h = '<div class="crumb"><a href="#/carte">Carte</a> › ' + esc(a.label) + '</div>';
    h += '<div class="row" style="justify-content:space-between;margin-top:6px"><div><div class="eyebrow">' + esc(a.label) + ' · ' + esc(a.theme) + '</div><h1 class="h-display">' + esc(a.name) + '</h1></div>' + CHIP[av.status] + '</div>';
    h += '<div class="card stack" style="margin-top:12px">' +
      (a.blocage ? '<div><div class="tiny">Le blocage</div><b>' + esc(a.blocage) + '</b></div>' : '') +
      '<div><div class="tiny">Objectif</div>' + esc(a.objectif) + '</div>' +
      '<div><div class="tiny">Livrable</div>' + esc(a.livrable) + '</div>' +
      (habit ? '<div><div class="tiny">Habitude qui reste</div>✅ ' + esc(habit.title) + ' <span class="muted small">(' + esc(habit.frequency) + ')</span></div>' : '') +
      '</div>';
    if (av.status === 'locked') {
      h += '<div class="notice" style="margin-top:12px">🔒 Arène verrouillée : bats le boss de l\'arène précédente pour l\'ouvrir. Tu peux déjà voir ce qui t\'attend.</div>';
    }
    h += '<div class="mlist" style="margin-top:14px">' + av.items.map(missionRow).join('') + '</div>';
    return h;
  }

  function missionRow(id) {
    var m = M(id), it = APP.view.items[id];
    var right = {
      validated: '<span class="chip done">✓</span>',
      open: '<span class="chip cur">Ouverte</span>',
      waiting: '<span class="chip wait">' + esc(it.unlockAt ? fmtWhen(it.unlockAt) : '') + '</span>',
      locked: '<span class="chip lock">🔒</span>',
      draft: '<span class="chip todo">Contenu à venir</span>'
    }[it.status];
    var clickable = it.status === 'validated' || it.status === 'open';
    var tag = clickable ? 'a' : 'div';
    return '<' + tag + ' class="mrow ' + it.status + (m.kind === 'boss' ? ' boss' : '') + '"' + (clickable ? ' href="#/mission/' + encodeURIComponent(id) + '"' : ' aria-disabled="true"') + '>' +
      '<div class="n">' + (m.kind === 'boss' ? '⚔️' : esc(m.num)) + '</div>' +
      '<div class="grow"><div class="t">' + (m.kind === 'boss' ? esc(m.num) + ' · ' : '') + esc(m.title) + '</div><div class="a">' + esc(m.action) + '</div></div>' + right + '</' + tag + '>';
  }

  // ─── Page mission / boss ──────────────────────────────────────────────────
  function viewMission(id) {
    var m;
    try { m = M(id); } catch (e) { return notFound(); }
    var it = APP.view.items[id], a = A(m.arena), boss = m.kind === 'boss';
    var h = '<div class="crumb"><a href="#/carte">Carte</a> › <a href="#/arene/' + a.id + '">' + esc(a.label + ' · ' + a.name) + '</a></div>';
    h += '<div class="mhead ' + (boss ? 'boss' : '') + '" style="margin-top:10px"><span class="num">' + esc(boss ? (m.final ? 'BOSS FINAL' : 'BOSS') : 'MISSION ' + m.num) + '</span>' +
      '<h1 class="h-display">' + esc(m.title) + '</h1></div>';

    if (it.status === 'locked' || it.status === 'waiting' || it.status === 'draft') {
      h += '<div class="card stack" style="margin-top:14px"><p style="margin:0"><b>Ton action :</b> ' + esc(m.action) + '</p>' +
        (it.status === 'waiting' ? '<div class="notice info">🔒 Cette mission se débloque ' + esc(fmtWhen(it.unlockAt)) + '.</div>' :
          it.status === 'draft' ? '<div class="notice warn">Contenu à venir : cette mission est en préparation.</div>' :
            '<div class="notice">🔒 Termine les missions précédentes pour ouvrir celle-ci.</div>') + '</div>';
      return h + missionNav(m);
    }

    if (it.status === 'validated') {
      h += '<div class="notice ok" style="margin-top:12px">✓ ' + (boss ? 'Boss vaincu' : 'Mission validée') + ' le ' + esc(fmtDate(it.validatedAt)) + '. Elle reste accessible à tout moment.</div>';
    }

    h += '<div class="stack" style="margin-top:14px">';
    if (boss && (m.rulesIntro || !m.final)) h += bossRules(m);
    h += videoBlock(m);
    h += '<div class="card stack"><div class="eyebrow">La notion</div>' +
      (m.description ? '<p style="margin:0">' + esc(m.description) + '</p>' : '') +
      (m.body ? '<div style="white-space:pre-wrap">' + esc(m.body) + '</div>' : '<div><span class="placeholder">Contenu pédagogique à compléter</span></div>') + '</div>';
    if (m.caution) h += '<div class="notice warn">⚠️ Prudence : demande l\'avis d\'un professionnel de santé avant tout changement, et c\'est obligatoire si tu es mineur.</div>';
    h += '<div class="card action-card"><div class="eyebrow">' + (boss ? 'Le défi pratique' : 'Ton action') + '</div><div class="big" style="margin-top:4px">' + esc(m.action) + '</div>' + linksBlock(m) + '</div>';
    h += supportBlock(m, it);
    if (m.durationDays) h += daysBlock(m, it);
    h += '<div id="mfoot">' + footBlock(m, it) + '</div>';
    if (boss && !m.final) h += bossQuizBlock(m, it);
    h += '</div>';
    return h + missionNav(m);
  }

  function bossRules(m) {
    return '<div class="card" style="border-color:rgba(240,106,106,.35)"><div class="eyebrow" style="color:var(--bad)">Battre un boss</div>' +
      (m.final ? '<p style="margin:6px 0 0">Le boss final n\'est pas un examen : refais tes tests physiques et envoie ta vidéo de fin. Il est gagné dès que c\'est fait, quels que soient les chiffres.</p>' :
        '<p style="margin:6px 0 0">1 défi pratique + 5 questions sur les notions de l\'arène. Le boss est battu quand le défi est validé <b>et</b> qu\'au moins 4 réponses sur 5 sont justes. Sinon : nouvel essai le lendemain, sans pénalité.</p>') + '</div>';
  }

  function videoEmbed(url) {
    var y = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{6,})/);
    if (y) return '<iframe src="https://www.youtube-nocookie.com/embed/' + y[1] + '?rel=0" title="Vidéo" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowfullscreen></iframe>';
    var v = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
    if (v) return '<iframe src="https://player.vimeo.com/video/' + v[1] + '" title="Vidéo" allow="fullscreen; picture-in-picture" allowfullscreen></iframe>';
    return '<video controls playsinline preload="metadata" data-video-for="' + attr(APP.currentMission) + '" src="' + attr(url) + '"></video>';
  }

  function videoBlock(m) {
    APP.currentMission = m.id;
    if (!m.video) return '<div class="video empty"><div class="play" aria-hidden="true">▶</div><b>Vidéo à ajouter</b><span class="small">La vidéo de cette mission sera bientôt disponible.</span></div>';
    var watched = !!rec(m.id).videoWatchedAt;
    return '<div><div class="video">' + videoEmbed(m.video) + '</div>' +
      '<div class="row" style="margin-top:8px;justify-content:space-between">' +
      (watched ? '<span class="chip done">✓ Vidéo regardée</span>' : '<span class="small muted">Regarde la vidéo jusqu\'au bout.</span><button class="btn sm" data-act="videoDone" data-id="' + attr(m.id) + '">J\'ai regardé la vidéo</button>') +
      '</div></div>';
  }

  function linksBlock(m) {
    var out = '';
    (m.links || []).forEach(function (l) {
      if (l.type === 'hub') out += '<a class="btn sm" href="' + attr(CFG.hubUrl) + '" target="_blank" rel="noopener">↗ ' + esc(l.label) + '</a>';
    });
    if (m.whatsapp) {
      var wa = waLink(m.whatsapp);
      out += wa ? '<a class="btn wa sm" href="' + attr(wa) + '" target="_blank" rel="noopener">Envoyer ma vidéo sur WhatsApp</a>' : '<span class="placeholder">Lien WhatsApp à configurer</span>';
    }
    return out ? '<div class="row wrap" style="margin-top:12px">' + out + '</div>' : '';
  }

  // ─── Supports génériques ──────────────────────────────────────────────────
  function supportBlock(m, it) {
    var sup = E().supportOf(m);
    if (!sup || sup.type === 'undefined') return '<div class="notice warn">Support à définir.</div>';
    if (sup.type === 'checklist' && sup.daily) return '';
    var title = { checklist: 'Ta checklist', fiche: 'Ta fiche', quiz: 'Ton quiz' }[sup.type];
    var h = '<div class="card"><div class="eyebrow">' + (m.kind === 'boss' ? 'Défi pratique · ' : '') + title + '</div>';
    if (sup.type === 'checklist') h += checklistBlock(m, sup);
    else if (sup.type === 'fiche') h += ficheBlock(m, sup);
    else if (sup.type === 'quiz') h += quizBlock(m, sup, it);
    return h + '</div>';
  }

  function checklistBlock(m, sup) {
    var data = rec(m.id).support || {};
    return sup.items.map(function (item) {
      if (item.choices) {
        return '<div class="field"><label>' + esc(item.label) + '</label><div class="choices" role="radiogroup">' + item.choices.map(function (c) {
          var on = data[item.id] === c;
          return '<button class="choice ' + (on ? 'on' : '') + '" role="radio" aria-checked="' + on + '" data-act="choice" data-id="' + attr(m.id) + '" data-item="' + attr(item.id) + '" data-val="' + attr(c) + '">' + esc(c) + '</button>';
        }).join('') + '</div></div>';
      }
      var on2 = data[item.id] === true;
      return '<div class="check-item ' + (on2 ? 'on' : '') + '" role="checkbox" tabindex="0" aria-checked="' + on2 + '" data-act="check" data-id="' + attr(m.id) + '" data-item="' + attr(item.id) + '"><span class="check-box" aria-hidden="true">✓</span><span>' + esc(item.label) + '</span></div>';
    }).join('');
  }

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
          return '<div class="check-item ' + (val === true ? 'on' : '') + '" role="checkbox" tabindex="0" aria-checked="' + (val === true) + '" data-act="ficheCheck" data-id="' + attr(m.id) + '" data-item="' + attr(f.id) + '" style="margin-top:14px"><span class="check-box" aria-hidden="true">✓</span><span>' + esc(f.label) + req + '</span></div>';
        case 'scale':
          var btns = '';
          for (var i = f.min || 1; i <= (f.max || 10); i++) btns += '<button class="' + (val === i ? 'on' : '') + '" aria-pressed="' + (val === i) + '" data-act="scale" data-id="' + attr(m.id) + '" data-item="' + attr(f.id) + '" data-val="' + i + '">' + i + '</button>';
          return '<div class="field"><label>' + esc(f.label) + req + '</label><div class="scale" role="group" aria-label="' + attr(f.label) + '">' + btns + '</div></div>';
        default: inner = '<input class="input' + (f.strike ? ' strike' : '') + '" type="text"' + base + ' placeholder="' + attr(f.placeholder || ' ') + '" value="' + attr(val || '') + '" maxlength="2000">';
      }
      return '<div class="field"><label for="' + id + '">' + esc(f.label) + req + '</label>' + inner + '</div>';
    }).join('') + '<div class="saved" id="saved_' + attr(m.id) + '" aria-live="polite">' + (rec(m.id).savedAt ? 'Réponses enregistrées' : '') + '</div>';
  }

  function quizBlock(m, sup, it) {
    var r = rec(m.id), res = APP.quizRes[m.id];
    var submitted = r.quiz && r.quiz.submittedAt;
    var sel = APP.quizSel[m.id] || (submitted ? Object.assign({}, r.quiz.answers) : {});
    APP.quizSel[m.id] = sel;
    var review = submitted && APP.retrying !== m.id;
    var h = sup.scored ? '' : '<p class="small muted" style="margin:6px 0 0">Pas de bonne ou de mauvaise réponse : ce quiz t\'aide à te situer.</p>';
    if (!sup.questions.length) return h + '<div class="notice warn" style="margin-top:10px">Questions du quiz à ajouter. Cette mission ne peut pas encore être validée.</div>';
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
      h += '<div class="notice ok" style="margin-top:14px">✓ Quiz terminé' + (score ? ' — score : ' + score : '') + '. Tes réponses sont enregistrées.</div>';
      if (it.status === 'open') h += '<button class="linkbtn small" data-act="quizRetry" data-id="' + attr(m.id) + '">Refaire le quiz</button>';
    } else {
      h += '<button class="btn primary block" style="margin-top:14px" data-act="quizSubmit" data-id="' + attr(m.id) + '">Valider mes réponses</button>';
    }
    return h;
  }

  function daysBlock(m, it) {
    var r = rec(m.id), run = it.run, sup = E().supportOf(m);
    var n = m.durationDays, cur = Math.min(run.current, n);
    var h = '<div class="card"><div class="eyebrow">' + n + ' jours' + (m.consecutive ? ' d\'affilée' : '') + '</div>';
    h += '<div class="days" aria-label="' + cur + ' jours sur ' + n + '">';
    for (var i = 0; i < n; i++) h += '<i class="' + (i < cur ? 'on' : (i === cur && !run.todayDone && it.status === 'open' ? 'today' : '')) + '">' + (i < cur ? '✓' : i + 1) + '</i>';
    h += '</div>';
    if (run.broken) h += '<div class="notice warn">Série interrompue : pas grave, on repart de zéro aujourd\'hui.</div>';
    if (it.status === 'validated' || run.done) {
      h += '<p class="small muted" style="margin:0">' + (it.status === 'validated' ? 'Durée tenue ✓' : 'Durée atteinte ✓ — tu peux valider.') + '</p>';
    } else if (it.status === 'open' && run.todayDone) {
      h += '<div class="notice ok">✓ Journée validée. Reviens demain pour le jour ' + Math.min(cur + 1, n) + '.</div>';
    } else if (it.status === 'open') {
      if (sup && sup.type === 'checklist' && sup.daily) {
        var sel = APP.pending['day_' + m.id] || {};
        sup.items.forEach(function (item) {
          var label = item.label;
          if (item.recall) { var v = (rec(item.recall[0]).support || {})[item.recall[1]]; if (v) label += ' (' + v + ')'; }
          h += '<div class="check-item ' + (sel[item.id] ? 'on' : '') + '" role="checkbox" tabindex="0" aria-checked="' + !!sel[item.id] + '" data-act="dayCheck" data-id="' + attr(m.id) + '" data-item="' + attr(item.id) + '"><span class="check-box" aria-hidden="true">✓</span><span>' + esc(label) + '</span></div>';
        });
        if (sup.items.some(function (x) { return x.note; })) {
          h += '<div class="field"><label for="note_' + attr(m.id) + '">Note du jour <span class="muted small">(facultatif)</span></label><textarea class="input" id="note_' + attr(m.id) + '" maxlength="2000" placeholder="Écris ici…"></textarea></div>';
        }
      }
      h += '<button class="btn ok block" style="margin-top:12px" data-act="checkin" data-id="' + attr(m.id) + '">' + esc(m.dailyLabel || 'Valider ma journée') + ' — jour ' + (cur + 1) + ' / ' + n + '</button>';
    }
    var hist = (r.checkins || []).filter(function (c) { return c.note; });
    if (hist.length) h += '<details style="margin-top:10px"><summary>Mes notes (' + hist.length + ')</summary>' + hist.map(function (c) { return '<p class="small"><b>' + esc(c.day) + '</b> — ' + esc(c.note) + '</p>'; }).join('') + '</details>';
    return h + '</div>';
  }

  function footBlock(m, it) {
    if (it.status !== 'open') return '';
    var boss = m.kind === 'boss' && !m.final;
    var list = (it.checks || []).map(function (c) {
      return '<li class="' + (c.ok ? 'ok' : '') + '">' + (c.ok ? '✓' : '○') + ' ' + esc(c.label) + '</li>';
    }).join('');
    var h = '<div class="card"><div class="eyebrow">' + (boss ? 'Avant d\'affronter le boss' : 'Pour valider') + '</div><ul class="checks">' + list + '</ul>';
    if (!boss) {
      h += '<button class="btn ' + (it.canValidate ? 'primary' : '') + ' block" style="margin-top:12px" data-act="validate" data-id="' + attr(m.id) + '"' + (it.canValidate ? '' : ' disabled') + '>' + (m.final ? 'Valider le boss final' : 'Valider la mission') + '</button>';
      if (!it.canValidate) h += '<p class="tiny" style="margin:8px 0 0;text-align:center">Complète les éléments ci-dessus pour valider.</p>';
    }
    return h + '</div>';
  }

  function bossQuizBlock(m, it) {
    var h = '<div class="card"><div class="eyebrow" style="color:var(--bad)">Les 5 questions</div>';
    var res = APP.quizRes[m.id];
    if (it.status === 'validated') {
      return h + '<p style="margin:6px 0 0">Boss vaincu' + (res ? ' — ' + res.score + ' / ' + res.total : '') + ' 🏆</p></div>';
    }
    if (res && !res.won) {
      h += '<div class="notice warn" style="margin-top:8px"><b>Pas cette fois : ' + res.score + ' / ' + res.total + '.</b> Il en faut 4. Nouvel essai ' + esc(fmtWhen(res.retryAt)) + ', sans pénalité. Ton défi pratique reste acquis.</div>';
    }
    var challengeOk = (it.checks || []).every(function (c) { return c.ok; });
    if (!it.quizReady) return h + '<div class="notice warn" style="margin-top:8px">Questions du boss à ajouter : le contenu est en préparation.</div></div>';
    if (it.retryAt) {
      if (!res) h += '<div class="notice info" style="margin-top:8px">Nouvel essai ' + esc(fmtWhen(it.retryAt)) + ', sans pénalité.</div>';
      return h + '</div>';
    }
    if (!challengeOk) return h + '<div class="notice" style="margin-top:8px">🔒 Termine le défi pratique pour débloquer les questions.</div></div>';
    var sel = APP.quizSel[m.id] = APP.quizSel[m.id] || {};
    m.quiz.questions.forEach(function (q, qi) {
      h += '<div class="quiz-q"><div class="q">' + (qi + 1) + '. ' + esc(q.q) + '</div>';
      q.options.forEach(function (o, oi) {
        h += '<button class="opt ' + (sel[q.id] === oi ? 'on' : '') + '" data-act="quizPick" data-id="' + attr(m.id) + '" data-q="' + attr(q.id) + '" data-o="' + oi + '"><span class="dot" aria-hidden="true"></span>' + esc(o) + '</button>';
      });
      h += '</div>';
    });
    h += '<button class="btn primary block" style="margin-top:14px" data-act="bossSubmit" data-id="' + attr(m.id) + '">⚔️ Affronter le boss</button>';
    return h + '</div>';
  }

  function missionNav(m) {
    var list = E().content.missions.filter(function (x) { return !x.draft; });
    var i = list.indexOf(m);
    var prev = list[i - 1], next = list[i + 1];
    var ok = function (x) { var s = APP.view.items[x.id].status; return s === 'open' || s === 'validated'; };
    var h = '<div class="mnav">';
    h += prev && ok(prev) ? '<a class="btn" href="#/mission/' + encodeURIComponent(prev.id) + '">← ' + esc(prev.kind === 'boss' ? 'Boss' : prev.num) + '</a>' : '<span></span>';
    if (next) {
      var nit = APP.view.items[next.id];
      if (ok(next)) h += '<a class="btn" href="#/mission/' + encodeURIComponent(next.id) + '">' + esc(next.kind === 'boss' ? 'Boss' : next.num) + ' →</a>';
      else h += '<span class="btn disabled" aria-disabled="true">' + (nit.status === 'waiting' ? '🔒 ' + esc(fmtWhen(nit.unlockAt)) : '🔒 Suivante') + '</span>';
    }
    return h + '</div>';
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
    var h = '<div class="eyebrow">Une coche par jour</div><h1 class="h-display">Mes habitudes du jour</h1>';
    h += '<div class="notice info" style="margin-top:10px">Suivi provisoire dans Athletik Master. À terme, ces coches se feront dans Athletik Hub, qui partagera les mêmes séries.</div>';
    h += '<div class="stack" style="margin-top:14px">';
    if (!v.habits.length) h += '<div class="notice">Aucune habitude débloquée pour l\'instant. La première arrive avec la mission 1.1.</div>';
    h += v.habits.map(habitCard).join('');
    var locked = APP.program.habits.filter(function (x) { return !st().habits[x.id]; });
    if (locked.length) {
      h += '<div class="section-title"><h2>À débloquer</h2></div>';
      h += locked.map(function (x) {
        var by = M(x.unlockedBy), a = A(x.arena);
        return '<div class="card habit locked"><div class="row"><div class="grow"><b>' + esc(x.title) + '</b><div class="tiny">' + esc(x.frequency) + ' · ' + esc(a.label + ' — ' + a.name) + ', mission ' + esc(by.num) + '</div></div><span aria-hidden="true">🔒</span></div></div>';
      }).join('');
    }
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
    if (APP.session.access && APP.session.access.parcel) h += '<div class="card gold row" style="margin-top:12px"><span style="font-size:30px" aria-hidden="true">📦</span><div><b>Un colis est en route</b><div class="small muted">Surprise…</div></div></div>';
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
  function viewRules() {
    return '<div class="crumb"><a href="#/carte">Carte</a> › Règles du jeu</div>' +
      '<h1 class="h-display" style="margin-top:6px">Règles du jeu</h1>' +
      '<div class="stack rules" style="margin-top:12px">' +
      '<div class="card"><h2>🎯 L\'objectif : 90 jours</h2><p>Devenir Athletik Master : traverser les 8 arènes, battre leurs boss et repartir avec 8 habitudes installées.</p>' +
      '<div class="steps"><span>Regarde</span><em>→</em><span>Fais l\'action</span><em>→</em><span>Valide</span><em>→</em><span>La suite se débloque le lendemain</span></div></div>' +
      '<div class="card"><h2>📋 Les missions</h2><ul><li>Chaque mission = une notion + une action concrète.</li><li>Valider une mission = regarder la vidéo + compléter son support (checklist, fiche ou quiz).</li><li>Certaines missions se pratiquent sur plusieurs jours (« tenir 7 jours »…) : elles se valident à la fin de leur durée.</li><li>Toute mission validée reste consultable, pendant et après les 90 jours.</li></ul></div>' +
      '<div class="card"><h2>🔓 Le déblocage</h2><ul><li><b>Niveau 0</b> : les 6 étapes sont ouvertes tout de suite. Tu démarres le jour même.</li><li><b>Ensuite</b> : une seule mission ouverte à la fois. La suivante se débloque <b>24 h</b> après la validation de la précédente.</li></ul></div>' +
      '<div class="card"><h2>⚔️ Les boss</h2><ul><li>Le boss s\'ouvre quand toutes les missions de l\'arène sont validées.</li><li>Chaque boss = 1 défi pratique + 5 questions sur les notions de l\'arène.</li><li>Battu quand le défi est validé <b>et</b> qu\'au moins 4 réponses sur 5 sont justes.</li><li>Sinon : nouvel essai le lendemain, sans pénalité.</li><li>Le battre ouvre l\'arène suivante.</li><li><b>Boss final</b> : refaire tes tests physiques + envoyer ta vidéo de fin. Gagné dès que c\'est fait, quels que soient les chiffres.</li></ul></div>' +
      '<div class="card"><h2>🏆 Rangs et récompenses</h2><ul>' + APP.program.rewards.map(function (r) {
        var trig = r.trigger.split(':'), a = A(trig[1]);
        return '<li><b>' + esc(trig[0] === 'section' ? 'Fin du niveau 0' : 'Boss ' + a.name) + '</b> : ' + esc(r.title.replace(/ — .*/, '')) + (r.grant ? ' + ' + esc(r.grant.label) : '') + '</li>';
      }).join('') + '</ul><p class="small muted">Rookie au départ, on monte en battant les boss.</p></div>' +
      '<div class="card"><h2>✅ Les habitudes</h2><p>Savoir ne change pas un comportement, répéter le change. Chaque arène laisse une habitude qui continue jusqu\'à la fin du programme : une coche par jour, oui ou non, et une série par habitude. Elles s\'additionnent, une à la fois.</p></div>' +
      '<div class="card"><h2>🤝 Les moments humains</h2><ul><li>Au départ : ta vidéo d\'engagement sur WhatsApp. Alassane la regarde.</li><li>Vers le 30ᵉ et le 60ᵉ jour : Alassane reprend contact avec toi.</li><li>À la fin : ta vidéo de fin, comparée à celle du départ.</li></ul></div>' +
      '</div>';
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
      (ro.admin ? '<a class="btn primary block" href="#/admin">Espace administrateur</a>' : '') +
      (APP.installEvt ? '<button class="btn block" data-act="install">Installer l\'application</button>' : '') + '</div>';
    if (APP.store.demo) {
      h += '<div class="card stack" style="border-color:#6a4800"><h3>Outils de démonstration</h3><p class="small muted" style="margin:0">Pour tester les délais sans attendre. Horloge démo : ' + esc(fmtShort(APP.store.now()) + ' ' + hm(APP.store.now())) + '</p>' +
        '<div class="row wrap"><button class="btn sm" data-act="travel" data-ms="3600000">+1 h</button><button class="btn sm" data-act="travel" data-ms="86400000">+24 h</button><button class="btn sm" data-act="travel" data-ms="604800000">+7 jours</button></div>' +
        '<button class="btn block sm" data-act="demoPay">Simuler le paiement complet (+ délai de 14 jours)</button>' +
        '<button class="btn block sm" data-act="demoReset">Remettre la démo à zéro</button></div>';
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
      if (el) el.textContent = 'Réponses enregistrées ✓';
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
      if (!confirm('Remettre la démo à zéro ? Toute ta progression de démo sera effacée.')) return;
      APP.store.reset(); APP.quizSel = {}; APP.quizRes = {}; APP.pending = {};
      return startDemo(true).then(function () { go('#/debut'); });
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
    habit: function (d) { return act({ type: 'habit', id: d.id, value: d.val }); },
    saveName: function () { var v = document.getElementById('pName').value; return act({ type: 'profile', name: v }).then(function () { toast('Prénom enregistré.'); }); },
    restart: function () {
      if (!confirm('Recommencer le parcours ? Tes récompenses, tes habitudes et tes droits restent acquis.')) return;
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

  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-act]');
    if (!el) return;
    var name = el.dataset.act, fn = HANDLERS[name];
    if (!fn) return;
    if (el.tagName === 'A' && name !== 'closeCelebrate') e.preventDefault();
    if (el.disabled) return;
    busy(function () { return fn(el.dataset, el); });
  });
  document.addEventListener('keydown', function (e) {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('[role="checkbox"][data-act]')) {
      e.preventDefault(); e.target.click();
    }
    if (e.key === 'Escape') { var o = document.querySelector('.overlay'); if (o) HANDLERS.closeCelebrate(); }
  });
  document.addEventListener('submit', function (e) {
    if (e.target.id !== 'loginForm') return;
    e.preventDefault();
    var email = document.getElementById('lEmail').value.trim(), pass = document.getElementById('lPass').value;
    APP.store = new AMStore.RemoteStore(CFG);
    var p = APP.loginTab === 'signup' ? APP.store.signUp(email, pass) : APP.store.signIn(email, pass);
    busy(function () { return p.then(startRemote).catch(function (err) { toast(authMsg(err), true); }); });
  });

  window.addEventListener('hashchange', function () { if (route().name === 'admin') APP.adminData = null; render(); });
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
