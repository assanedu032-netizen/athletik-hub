/* ════════════════════════════════════════════════════════════════════════════
 * Athletik Master — MOTEUR DE PROGRESSION (pur, sans DOM, sans réseau)
 * ────────────────────────────────────────────────────────────────────────────
 * Une seule implémentation des règles du jeu, exécutée à trois endroits :
 *   - côté SERVEUR (netlify/functions/master-api.js) : fait foi en production,
 *     avec l'heure du serveur — le client ne peut pas avancer sa montre ;
 *   - côté NAVIGATEUR en mode démo (store local) ;
 *   - dans les TESTS (tests/test-engine.js).
 *
 * Règles (document « Plan du contenu ») :
 *   - Niveau 0 : les 6 étapes ouvertes tout de suite, sans attente.
 *   - Ensuite une seule mission ouverte à la fois ; la suivante s'ouvre 24 h
 *     après la validation de la précédente.
 *   - Valider = regarder la vidéo (si elle existe) + compléter le support.
 *   - Missions sur plusieurs jours : validables à la fin de leur durée.
 *   - Boss : s'ouvre quand toutes les missions de l'arène sont validées ;
 *     défi pratique validé ET ≥ 4/5 → gagné ; sinon nouvel essai le lendemain.
 *   - Boss final : tests refaits + vidéo envoyée → gagné, quels que soient les
 *     chiffres. On ne fait jamais échouer quelqu'un sur sa performance physique.
 *   - Toute mission validée reste consultable.
 *
 * L'état est un objet JSON simple (voir newState). apply() ne mute jamais
 * l'état reçu : il renvoie une copie + la liste des événements produits
 * (récompense, habitude débloquée, arène ouverte…).
 * ════════════════════════════════════════════════════════════════════════════ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.AMEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var HOUR = 3600 * 1000;
  var DAY = 24 * HOUR;
  var MAX_TEXT = 2000;

  // ─── Dates ────────────────────────────────────────────────────────────────
  // tz = décalage en minutes à AJOUTER à l'UTC pour obtenir l'heure locale
  // (Paris l'hiver = +60, Dakar = 0). Le client envoie -getTimezoneOffset().
  function dayKey(ms, tz) {
    return new Date(ms + (tz || 0) * 60000).toISOString().slice(0, 10);
  }
  function dayNum(key) { return Math.round(Date.parse(key + 'T00:00:00Z') / DAY); }
  function keyFromNum(n) { return new Date(n * DAY).toISOString().slice(0, 10); }
  function startOfNextDay(ms, tz) {
    return Date.parse(dayKey(ms, tz) + 'T00:00:00Z') + DAY - (tz || 0) * 60000;
  }
  function weekdayOf(key) { return new Date(key + 'T00:00:00Z').getUTCDay(); }

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function EngineError(code, message) {
    var e = new Error(message || code);
    e.code = code;
    e.isEngineError = true;
    return e;
  }

  // ─── Construction ─────────────────────────────────────────────────────────
  function createEngine(content, opts) {
    opts = opts || {};
    var settings = content.settings || {};
    var quizKeys = opts.quizKeys || {};
    var defaultDelay = settings.defaultUnlockDelayHours != null ? settings.defaultUnlockDelayHours : 24;
    var bossCount = settings.bossQuestionCount || 5;
    var bossPass = settings.bossPassMin || 4;

    var arenas = content.arenas.slice();
    var arenaById = {};
    arenas.forEach(function (a) { arenaById[a.id] = a; });

    var byId = {};
    content.missions.forEach(function (m) { byId[m.id] = m; });

    // Items jouables par arène (les brouillons restent visibles mais hors parcours)
    var itemsByArena = {};
    arenas.forEach(function (a) {
      itemsByArena[a.id] = content.missions.filter(function (m) { return m.arena === a.id && !m.draft; });
    });
    var playable = [];
    arenas.forEach(function (a) { playable = playable.concat(itemsByArena[a.id]); });

    var habits = content.habits || [];
    var habitById = {};
    habits.forEach(function (h) { habitById[h.id] = h; });

    var rewards = content.rewards || [];
    var rewardById = {};
    rewards.forEach(function (r) { rewardById[r.id] = r; });

    function mission(id) {
      var m = byId[id];
      if (!m) throw EngineError('unknown_mission', 'Mission inconnue : ' + id);
      return m;
    }
    function supportOf(m) { return m.kind === 'boss' ? m.challenge : m.support; }
    function delayHours(m) {
      if (m.unlockDelayHours != null) return m.unlockDelayHours;
      return arenaById[m.arena].instantUnlock ? 0 : defaultDelay;
    }

    // ─── État initial ───────────────────────────────────────────────────────
    function newState(now, tz) {
      return {
        v: 1,
        startedAt: now,
        tz: typeof tz === 'number' ? Math.max(-840, Math.min(840, Math.round(tz))) : 0,
        introSeenAt: null,
        missions: {},
        rewards: [],
        grants: [],
        habits: {},
        runs: []
      };
    }

    function rec(state, id) { return state.missions[id] || {}; }

    // ─── Prérequis et statut ───────────────────────────────────────────────
    // Renvoie la liste d'items qui doivent être validés avant `m`.
    function prereqs(m) {
      var arena = arenaById[m.arena];
      if (arena.instantUnlock) return [];
      var list = itemsByArena[m.arena];
      var idx = list.indexOf(m);
      if (idx > 0) return [list[idx - 1]];
      // Première mission d'une arène : toute l'arène précédente (boss compris)
      var aIdx = arenas.indexOf(arena);
      for (var i = aIdx - 1; i >= 0; i--) {
        var prev = itemsByArena[arenas[i].id];
        if (prev.length) return prev;
      }
      return [];
    }

    function unlockInfo(state, m) {
      var pr = prereqs(m);
      if (!pr.length) return { ready: true, at: state.startedAt };
      var last = 0;
      for (var i = 0; i < pr.length; i++) {
        var r = rec(state, pr[i].id);
        if (!r.validatedAt) return { ready: false, at: null };
        if (r.validatedAt > last) last = r.validatedAt;
      }
      return { ready: true, at: last + delayHours(m) * HOUR };
    }

    // 'draft' | 'locked' | 'waiting' | 'open' | 'validated'
    function status(state, id, now) {
      var m = mission(id);
      if (m.draft) return 'draft';
      if (rec(state, id).validatedAt) return 'validated';
      var u = unlockInfo(state, m);
      if (!u.ready) return 'locked';
      if (now < u.at) return 'waiting';
      return 'open';
    }

    // ─── Jours de pratique (missions sur plusieurs jours) ──────────────────
    function runInfo(state, m, now) {
      var r = rec(state, m.id);
      var days = (r.checkins || []).map(function (c) { return c.day; });
      var n = m.durationDays || 0;
      var today = dayKey(now, state.tz);
      var todayDone = days.indexOf(today) >= 0;
      var current = 0;
      if (days.length) {
        if (m.consecutive) {
          var sorted = days.map(dayNum).sort(function (a, b) { return a - b; });
          var last = sorted[sorted.length - 1];
          current = 1;
          for (var i = sorted.length - 2; i >= 0; i--) {
            if (sorted[i] === sorted[i + 1] - 1) current++;
            else break;
          }
          // Série cassée : la dernière coche date d'avant-hier ou plus tôt
          if (last < dayNum(today) - 1) current = 0;
        } else {
          current = days.length;
        }
      }
      var done = !!r.durationDoneAt;
      return {
        required: n, current: done ? Math.max(current, n) : current, done: done,
        todayDone: todayDone, broken: !!(m.consecutive && days.length && current === 0 && !done)
      };
    }

    // ─── Vérifications de complétude ───────────────────────────────────────
    function isFilled(v) {
      if (v === true) return true;
      if (typeof v === 'number') return isFinite(v);
      if (typeof v === 'string') return v.trim().length > 0;
      return false;
    }

    function supportCheck(state, m, sup, r) {
      if (!sup || sup.type === 'undefined') return { ok: false, label: 'Support à définir', contentMissing: true };
      var data = r.support || {};
      if (sup.type === 'checklist') {
        if (sup.daily) return null; // couvert par les jours de pratique
        var okC = sup.items.every(function (it) { return isFilled(data[it.id]); });
        return { ok: okC, label: 'Checklist complétée' };
      }
      if (sup.type === 'fiche') {
        var okF = sup.fields.every(function (f) {
          if (f.type === 'recall' || !f.required) return true;
          return isFilled(data[f.id]);
        });
        return { ok: okF, label: 'Fiche remplie' };
      }
      if (sup.type === 'quiz') {
        if (!sup.questions || !sup.questions.length) return { ok: false, label: 'Questions du quiz à ajouter', contentMissing: true };
        return { ok: !!(r.quiz && r.quiz.submittedAt), label: 'Quiz terminé' };
      }
      return { ok: false, label: 'Support inconnu', contentMissing: true };
    }

    // Liste des conditions de validation d'une mission (ou du défi d'un boss)
    function checks(state, id, now) {
      var m = mission(id);
      var r = rec(state, id);
      var out = [];
      if (m.video && settings.requireVideoWhenProvided !== false) {
        out.push({ key: 'video', ok: !!r.videoWatchedAt, label: 'Vidéo regardée' });
      }
      var sc = supportCheck(state, m, supportOf(m), r);
      if (sc) { sc.key = 'support'; out.push(sc); }
      if (m.durationDays) {
        var ri = runInfo(state, m, now);
        out.push({
          key: 'days', ok: ri.done,
          label: m.durationDays + ' jours' + (m.consecutive ? ' d\'affilée' : '') + ' (' + Math.min(ri.current, m.durationDays) + '/' + m.durationDays + ')'
        });
      }
      if (m.kind === 'boss' && !m.final && settings.bossHabitRule && settings.bossHabitRule.enabled) {
        var h = habits.filter(function (x) { return x.arena === m.arena; })[0];
        if (h) {
          var hc = habitWindowCount(state, h.id, now, settings.bossHabitRule.windowDays || 7);
          var min = settings.bossHabitRule.minDays || 5;
          out.push({ key: 'habit', ok: hc >= min, label: 'Habitude « ' + h.title + ' » tenue ' + min + ' jours sur ' + (settings.bossHabitRule.windowDays || 7) + ' (' + hc + ')' });
        }
      }
      return out;
    }
    function allOk(list) { return list.every(function (c) { return c.ok; }); }

    function bossQuizReady(m) {
      var q = (m.quiz && m.quiz.questions) || [];
      if (q.length !== bossCount) return false;
      // Côté navigateur en production, les réponses restent sur le serveur :
      // on ne peut vérifier que la présence des questions.
      if (opts.assumeKeys) return true;
      var keys = quizKeys[m.id] || {};
      return q.every(function (qq) { return typeof keys[qq.id] === 'number'; });
    }

    function lastAttempt(r) { var a = r.attempts || []; return a.length ? a[a.length - 1] : null; }

    function bossRetryAt(state, m, now) {
      var la = lastAttempt(rec(state, m.id));
      if (!la || la.won) return null;
      if (la.day === dayKey(now, state.tz)) return startOfNextDay(now, state.tz);
      return null;
    }

    // ─── Assainissement des saisies ────────────────────────────────────────
    function cleanValue(v) {
      if (v === true || v === false) return v;
      if (typeof v === 'number') return isFinite(v) ? v : null;
      if (typeof v === 'string') return v.slice(0, MAX_TEXT);
      return null;
    }
    function sanitizeSupport(sup, data) {
      var out = {};
      if (!data || typeof data !== 'object') return out;
      var allowed = [];
      if (sup.type === 'checklist') allowed = sup.items.map(function (i) { return i.id; });
      else if (sup.type === 'fiche') allowed = sup.fields.filter(function (f) { return f.type !== 'recall'; }).map(function (f) { return f.id; });
      allowed.forEach(function (k) {
        if (Object.prototype.hasOwnProperty.call(data, k)) {
          var v = cleanValue(data[k]);
          if (v !== null) out[k] = v;
        }
      });
      if (sup.type === 'checklist') {
        sup.items.forEach(function (it) {
          if (it.choices && out[it.id] !== undefined && it.choices.indexOf(out[it.id]) < 0) delete out[it.id];
          if (!it.choices && out[it.id] !== undefined && typeof out[it.id] !== 'boolean') delete out[it.id];
        });
      }
      return out;
    }

    function scoreQuiz(id, questions, answers) {
      var keys = quizKeys[id] || {};
      var score = 0, total = 0, details = {};
      questions.forEach(function (q) {
        if (typeof keys[q.id] !== 'number') return;
        total++;
        var ok = answers[q.id] === keys[q.id];
        if (ok) score++;
        details[q.id] = { ok: ok, correct: keys[q.id] };
      });
      return { score: score, total: total, details: details };
    }

    function cleanAnswers(questions, answers) {
      var out = {};
      if (!answers || typeof answers !== 'object') return out;
      questions.forEach(function (q) {
        var v = answers[q.id];
        if (typeof v === 'number' && v >= 0 && v < q.options.length && Math.floor(v) === v) out[q.id] = v;
      });
      return out;
    }

    // ─── Récompenses et habitudes ──────────────────────────────────────────
    function grantReward(state, trigger, now, events) {
      rewards.forEach(function (rw) {
        if (rw.trigger !== trigger) return;
        if (state.rewards.some(function (x) { return x.id === rw.id; })) return;
        state.rewards.push({ id: rw.id, at: now });
        events.push({ type: 'reward', id: rw.id });
        if (rw.grant) {
          state.grants.push({
            type: rw.grant.type, months: rw.grant.months || 0, rewardId: rw.id, at: now,
            // Rien n'est encore appliqué dans Athletik Hub : voir README § Intégrations.
            status: 'pending_hub_integration'
          });
          events.push({ type: 'grant', grant: rw.grant.type });
        }
      });
    }

    function onValidated(state, m, now, events) {
      habits.forEach(function (h) {
        if (h.unlockedBy === m.id && !state.habits[h.id]) {
          state.habits[h.id] = { unlockedAt: now, log: {} };
          events.push({ type: 'habit', id: h.id });
        }
      });
      var list = itemsByArena[m.arena];
      var sectionDone = list.every(function (x) { return !!rec(state, x.id).validatedAt; });
      if (sectionDone) {
        if (m.kind === 'boss') grantReward(state, 'boss:' + m.arena, now, events);
        grantReward(state, 'section:' + m.arena, now, events);
        events.push({ type: 'arena_done', id: m.arena });
        if (m.final) events.push({ type: 'finished' });
      }
    }

    function habitWindowCount(state, hid, now, windowDays) {
      var h = state.habits[hid];
      if (!h) return 0;
      var t = dayNum(dayKey(now, state.tz));
      var c = 0;
      for (var i = 0; i < windowDays; i++) if (h.log[keyFromNum(t - i)] === 'yes') c++;
      return c;
    }

    function habitStreak(state, hid, now) {
      var def = habitById[hid];
      var h = state.habits[hid];
      if (!def || !h) return 0;
      var log = h.log || {};
      var t = dayNum(dayKey(now, state.tz));
      var floor = dayNum(dayKey(h.unlockedAt, state.tz));
      var step = 1, start = t;
      if (def.kind === 'weekly') {
        step = 7;
        // dernier jour cible (dimanche) ≤ aujourd'hui
        while (weekdayOf(keyFromNum(start)) !== (def.weekday || 0)) start--;
      }
      if (log[keyFromNum(start)] === undefined) start -= step; // pas encore répondu aujourd'hui : on part d'hier
      var streak = 0;
      for (var d = start; d >= floor; d -= step) {
        var v = log[keyFromNum(d)];
        if (v === 'yes') streak++;
        else if (v === 'skip') continue;
        else break;
      }
      return streak;
    }

    function habitDueToday(state, hid, now) {
      var def = habitById[hid];
      if (def.kind !== 'weekly') return true;
      return weekdayOf(dayKey(now, state.tz)) === (def.weekday || 0);
    }

    // ─── Actions ───────────────────────────────────────────────────────────
    function requireAccessible(state, id, now, allowValidated) {
      var st = status(state, id, now);
      if (st === 'open') return st;
      if (st === 'validated' && allowValidated) return st;
      if (st === 'waiting') throw EngineError('waiting', 'Cette mission n\'est pas encore débloquée.');
      if (st === 'locked') throw EngineError('locked', 'Cette mission est verrouillée.');
      if (st === 'draft') throw EngineError('draft', 'Contenu à venir.');
      throw EngineError('not_allowed', 'Action impossible sur une mission ' + (st === 'validated' ? 'déjà validée' : st) + '.');
    }

    function apply(state0, action, now) {
      if (!action || typeof action.type !== 'string') throw EngineError('bad_action', 'Action invalide.');
      var state = clone(state0);
      var events = [];
      var result = null;
      var m, r, sup;

      switch (action.type) {
        case 'intro':
          if (!state.introSeenAt) state.introSeenAt = now;
          break;

        case 'video':
          m = mission(action.id);
          requireAccessible(state, m.id, now, true);
          r = state.missions[m.id] = state.missions[m.id] || {};
          if (!r.videoWatchedAt) r.videoWatchedAt = now;
          break;

        case 'support':
          m = mission(action.id);
          sup = supportOf(m);
          if (!sup || (sup.type !== 'checklist' && sup.type !== 'fiche')) throw EngineError('bad_support', 'Support non modifiable.');
          if (sup.daily) throw EngineError('bad_support', 'Ce support se coche jour après jour.');
          requireAccessible(state, m.id, now, true);
          r = state.missions[m.id] = state.missions[m.id] || {};
          r.support = Object.assign({}, r.support || {}, sanitizeSupport(sup, action.data));
          r.savedAt = now;
          break;

        case 'checkin':
          m = mission(action.id);
          if (!m.durationDays) throw EngineError('bad_action', 'Cette mission ne se pratique pas sur plusieurs jours.');
          requireAccessible(state, m.id, now, false);
          r = state.missions[m.id] = state.missions[m.id] || {};
          sup = supportOf(m);
          if (sup && sup.type === 'checklist' && sup.daily) {
            var items = action.items || {};
            var all = sup.items.every(function (it) { return items[it.id] === true; });
            if (!all) throw EngineError('incomplete', 'Coche tous les éléments du jour.');
          }
          var today = dayKey(now, state.tz);
          r.checkins = r.checkins || [];
          if (r.checkins.some(function (c) { return c.day === today; })) throw EngineError('already', 'Déjà coché aujourd\'hui. Reviens demain.');
          var entry = { day: today, at: now };
          if (typeof action.note === 'string' && action.note.trim()) entry.note = action.note.slice(0, MAX_TEXT);
          r.checkins.push(entry);
          if (!r.startedAt) r.startedAt = now;
          var ri = runInfo(state, m, now);
          if (!r.durationDoneAt && ri.current >= m.durationDays) {
            r.durationDoneAt = now;
            events.push({ type: 'duration_done', id: m.id });
          }
          break;

        case 'quiz':
          m = mission(action.id);
          sup = m.support;
          if (m.kind === 'boss' || !sup || sup.type !== 'quiz') throw EngineError('bad_action', 'Pas de quiz ici.');
          if (!sup.questions || !sup.questions.length) throw EngineError('content_missing', 'Les questions de ce quiz ne sont pas encore ajoutées.');
          requireAccessible(state, m.id, now, true);
          var ans = cleanAnswers(sup.questions, action.answers);
          if (Object.keys(ans).length !== sup.questions.length) throw EngineError('incomplete', 'Réponds à toutes les questions.');
          r = state.missions[m.id] = state.missions[m.id] || {};
          var sq = sup.scored ? scoreQuiz(m.id, sup.questions, ans) : null;
          r.quiz = { answers: ans, submittedAt: now };
          if (sq && sq.total) { r.quiz.score = sq.score; r.quiz.total = sq.total; }
          result = { score: sq ? sq.score : null, total: sq ? sq.total : null, details: sq ? sq.details : {} };
          break;

        case 'validate':
          m = mission(action.id);
          if (m.kind === 'boss' && !m.final) throw EngineError('bad_action', 'Un boss se gagne en relevant le défi et en répondant aux 5 questions.');
          requireAccessible(state, m.id, now, false);
          var cl = checks(state, m.id, now);
          if (!allOk(cl)) {
            var miss = cl.filter(function (c) { return !c.ok; }).map(function (c) { return c.label; });
            throw EngineError('incomplete', 'Il reste à faire : ' + miss.join(', ') + '.');
          }
          r = state.missions[m.id] = state.missions[m.id] || {};
          r.validatedAt = now;
          events.push({ type: 'validated', id: m.id });
          onValidated(state, m, now, events);
          break;

        case 'boss':
          m = mission(action.id);
          if (m.kind !== 'boss' || m.final) throw EngineError('bad_action', 'Ce n\'est pas un boss à questions.');
          requireAccessible(state, m.id, now, false);
          if (bossRetryAt(state, m, now)) throw EngineError('retry_tomorrow', 'Nouvel essai possible demain, sans pénalité.');
          if (!allOk(checks(state, m.id, now))) throw EngineError('challenge_incomplete', 'Termine d\'abord le défi pratique.');
          if (!bossQuizReady(m)) throw EngineError('content_missing', 'Les 5 questions de ce boss ne sont pas encore ajoutées.');
          var bans = cleanAnswers(m.quiz.questions, action.answers);
          if (Object.keys(bans).length !== bossCount) throw EngineError('incomplete', 'Réponds aux ' + bossCount + ' questions.');
          var bs = scoreQuiz(m.id, m.quiz.questions, bans);
          var won = bs.score >= bossPass;
          r = state.missions[m.id] = state.missions[m.id] || {};
          r.attempts = r.attempts || [];
          r.attempts.push({ at: now, day: dayKey(now, state.tz), score: bs.score, total: bs.total, won: won });
          var okMap = {};
          Object.keys(bs.details).forEach(function (k) { okMap[k] = bs.details[k].ok; });
          result = { won: won, score: bs.score, total: bs.total, ok: okMap, retryAt: won ? null : startOfNextDay(now, state.tz) };
          if (won) {
            r.validatedAt = now;
            events.push({ type: 'boss_won', id: m.id });
            onValidated(state, m, now, events);
          } else {
            events.push({ type: 'boss_lost', id: m.id });
          }
          break;

        case 'habit':
          var hdef = habitById[action.id];
          if (!hdef) throw EngineError('unknown_habit', 'Habitude inconnue.');
          var hs = state.habits[action.id];
          if (!hs) throw EngineError('locked', 'Habitude pas encore débloquée.');
          var val = action.value;
          if (['yes', 'no', 'skip'].indexOf(val) < 0) throw EngineError('bad_action', 'Réponse invalide.');
          if (val === 'skip' && hdef.kind !== 'session') throw EngineError('bad_action', '« Pas de séance » ne vaut que pour une habitude liée aux séances.');
          var tKey = dayKey(now, state.tz);
          var target = action.day || tKey;
          var yKey = keyFromNum(dayNum(tKey) - 1);
          if (target !== tKey && target !== yKey) throw EngineError('bad_day', 'On ne peut répondre que pour aujourd\'hui ou hier.');
          if (dayNum(target) < dayNum(dayKey(hs.unlockedAt, state.tz))) throw EngineError('bad_day', 'Habitude pas encore débloquée ce jour-là.');
          if (hdef.kind === 'weekly' && weekdayOf(target) !== (hdef.weekday || 0)) throw EngineError('bad_day', 'Cette habitude se coche le ' + WEEKDAYS[hdef.weekday || 0] + '.');
          hs.log[target] = val;
          break;

        case 'restart':
          var fin = playable[playable.length - 1];
          if (!rec(state, fin.id).validatedAt) throw EngineError('not_allowed', 'Le parcours n\'est pas terminé.');
          state.runs.push({ startedAt: state.startedAt, finishedAt: rec(state, fin.id).validatedAt, missions: state.missions });
          state.missions = {};
          state.startedAt = now;
          // Les récompenses, les habitudes et les droits sont acquis pour de bon.
          break;

        default:
          throw EngineError('bad_action', 'Action inconnue : ' + action.type);
      }
      return { state: state, events: events, result: result };
    }

    var WEEKDAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

    // ─── Vue dérivée (tout ce qu'affiche l'interface) ──────────────────────
    function view(state, now) {
      var items = {};
      var validated = 0;
      content.missions.forEach(function (m) {
        var st = status(state, m.id, now);
        var u = m.draft ? { ready: false } : unlockInfo(state, m);
        var r = rec(state, m.id);
        var it = { id: m.id, status: st, unlockAt: st === 'waiting' ? u.at : null, validatedAt: r.validatedAt || null };
        if (m.durationDays) it.run = runInfo(state, m, now);
        if (m.kind === 'boss' && !m.final) {
          it.retryAt = bossRetryAt(state, m, now);
          it.attempts = (r.attempts || []).length;
          it.quizReady = bossQuizReady(m);
        }
        if (st === 'open' || st === 'validated') {
          it.checks = checks(state, m.id, now);
          it.canValidate = st === 'open' && allOk(it.checks);
        }
        if (st === 'validated') validated++;
        items[m.id] = it;
      });

      var arenaViews = arenas.map(function (a) {
        var list = itemsByArena[a.id];
        var done = list.filter(function (m) { return items[m.id].status === 'validated'; }).length;
        var reachable = list.some(function (m) { var s = items[m.id].status; return s !== 'locked'; });
        var st = list.length && done === list.length ? 'done' : (reachable ? 'current' : 'locked');
        return {
          id: a.id, status: st, done: done, total: list.length,
          items: content.missions.filter(function (m) { return m.arena === a.id; }).map(function (m) { return m.id; })
        };
      });

      var next = null;
      for (var i = 0; i < playable.length; i++) {
        var s = items[playable[i].id].status;
        if (s === 'open' || s === 'waiting') {
          if (!next) next = playable[i].id;
          if (s === 'open') { next = playable[i].id; break; }
        }
      }
      // Au niveau 0 on propose la première étape encore ouverte, dans l'ordre.
      var current = arenaViews.filter(function (a) { return a.status === 'current'; })[0] || null;

      var earned = state.rewards.map(function (x) {
        return Object.assign({}, rewardById[x.id], { at: x.at });
      }).filter(function (x) { return x.id; });
      var rank = null;
      earned.forEach(function (x) { if (x.rank) rank = x.rank; });

      var habitViews = habits.filter(function (h) { return !!state.habits[h.id]; }).map(function (h) {
        var tk = dayKey(now, state.tz);
        return {
          id: h.id, unlockedAt: state.habits[h.id].unlockedAt,
          today: state.habits[h.id].log[tk] || null,
          dueToday: habitDueToday(state, h.id, now),
          streak: habitStreak(state, h.id, now)
        };
      });

      var programDays = settings.programDays || 90;
      var dayN = Math.floor((now - state.startedAt) / DAY) + 1;
      var fin = playable[playable.length - 1];

      return {
        now: now,
        day: dayN,
        programDays: programDays,
        endAt: state.startedAt + (programDays - 1) * DAY,
        items: items,
        arenas: arenaViews,
        currentArena: current ? current.id : null,
        next: next,
        validatedCount: validated,
        totalCount: playable.length,
        progress: playable.length ? Math.round(validated * 100 / playable.length) : 0,
        rank: rank,
        rewards: earned,
        habits: habitViews,
        finished: !!rec(state, fin.id).validatedAt,
        milestones: (settings.humanTouchDays || []).map(function (d) {
          return { day: d, at: state.startedAt + (d - 1) * DAY };
        })
      };
    }

    return {
      content: content,
      settings: settings,
      playable: playable,
      itemsByArena: itemsByArena,
      arenaById: arenaById,
      mission: mission,
      supportOf: supportOf,
      habitById: habitById,
      rewardById: rewardById,
      newState: newState,
      status: status,
      checks: checks,
      apply: apply,
      view: view,
      habitStreak: habitStreak,
      bossQuizReady: bossQuizReady
    };
  }

  return {
    createEngine: createEngine,
    dayKey: dayKey,
    startOfNextDay: startOfNextDay,
    DAY: DAY,
    HOUR: HOUR
  };
});
