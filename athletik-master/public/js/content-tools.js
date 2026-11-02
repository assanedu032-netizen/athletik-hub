/* ════════════════════════════════════════════════════════════════════════════
 * Athletik Master — GESTION DU CONTENU (pur, partagé navigateur / serveur / tests)
 * ────────────────────────────────────────────────────────────────────────────
 * Le contenu de base vit dans content/program.json (livré avec l'app). Les
 * modifications faites dans l'éditeur admin sont des SURCOUCHES :
 *   { v:1, missions: { "<id>": {champs modifiés} }, arenas: {…}, habits: {…} }
 * publiées dans Firestore (masterContent/published) et fusionnées au
 * chargement. Conséquences :
 *   - publier ne demande AUCUN redéploiement ;
 *   - une mission ajoutée plus tard dans program.json apparaît automatiquement ;
 *   - l'identité d'une mission (id, numéro, arène, type, ordre, règles de
 *     déblocage) n'est PAS modifiable depuis l'éditeur : elle porte la
 *     progression des participants. Les identifiants des éléments de support
 *     existants sont conservés (les réponses déjà données y sont rattachées).
 * Les bonnes réponses des quiz ne sont jamais dans les surcouches publiques.
 * ════════════════════════════════════════════════════════════════════════════ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.AMContent = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var LIMITS = {
    title: 120, videoTitle: 160, description: 2000, body: 20000, instructions: 5000,
    action: 300, dailyLabel: 120, label: 300, placeholder: 200, question: 600, option: 300, explain: 1500,
    arenaText: 400, habitTitle: 120, habitFreq: 60
  };
  var MAX_ITEMS = 25, MAX_OPTIONS = 6;
  var FIELD_TYPES = ['text', 'textarea', 'number', 'date', 'check', 'scale'];
  var ID_RE = /^[A-Za-z0-9_-]{1,32}$/;

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function str(v, max) {
    if (typeof v !== 'string') return '';
    return v.replace(/\r\n?/g, '\n').slice(0, max);
  }
  function err(msg) { var e = new Error(msg); e.code = 'invalid_content'; e.isEngineError = true; return e; }

  // ─── Vidéos ───────────────────────────────────────────────────────────────
  function youtubeId(url) {
    var m = String(url || '').match(/^https?:\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([\w-]{6,})/);
    return m ? m[1] : null;
  }
  function vimeoId(url) {
    var m = String(url || '').match(/^https?:\/\/(?:www\.|player\.)?vimeo\.com\/(?:video\/)?(\d+)/);
    return m ? m[1] : null;
  }
  // '' (vide) est valide = « Vidéo bientôt disponible ».
  function checkVideoUrl(url) {
    url = String(url || '').trim();
    if (!url) return { ok: true, url: '' };
    if (youtubeId(url)) return { ok: true, url: url, kind: 'youtube', id: youtubeId(url) };
    if (vimeoId(url)) return { ok: true, url: url, kind: 'vimeo', id: vimeoId(url) };
    if (/^https:\/\/[^\s"'<>]+\.mp4(\?[^\s"'<>]*)?$/i.test(url)) return { ok: true, url: url, kind: 'mp4' };
    return { ok: false, url: url };
  }

  // ─── Quiz ─────────────────────────────────────────────────────────────────
  // Une question est « rédigée » quand son texte et toutes ses options le sont.
  function questionWritten(q) {
    return !!(q && typeof q.q === 'string' && q.q.trim() && Array.isArray(q.options) &&
      q.options.length >= 2 && q.options.every(function (o) { return typeof o === 'string' && o.trim(); }));
  }

  // ─── Assainissement d'une surcouche de mission ────────────────────────────
  function uniqueIds(list) {
    var seen = {};
    list.forEach(function (x) {
      if (!ID_RE.test(x.id)) throw err('Identifiant invalide : ' + x.id);
      if (seen[x.id]) throw err('Identifiant en double : ' + x.id);
      seen[x.id] = true;
    });
  }

  function cleanSupport(base, sup, opts) {
    if (!base || !sup || typeof sup !== 'object') return clone(base);
    var out = { type: base.type };
    if (base.daily) out.daily = true;
    if (base.scored !== undefined) out.scored = base.scored;
    if (base.type === 'checklist') {
      var baseItems = {};
      (base.items || []).forEach(function (i) { baseItems[i.id] = i; });
      out.items = (Array.isArray(sup.items) ? sup.items : []).slice(0, MAX_ITEMS).map(function (i) {
        var it = { id: String(i.id || ''), label: str(i.label, LIMITS.label) };
        var b = baseItems[it.id] || {};
        if (Array.isArray(i.choices) && i.choices.length) {
          it.choices = i.choices.map(function (c) { return str(c, 60).trim(); }).filter(Boolean).slice(0, MAX_OPTIONS);
          if (it.choices.length < 2) delete it.choices;
        }
        if (i.note) it.note = true;
        if (b.recall) it.recall = b.recall;
        if (i.pending) it.pending = true;
        return it;
      });
      if (!out.items.length) throw err('Une checklist doit garder au moins un élément.');
      uniqueIds(out.items);
    } else if (base.type === 'fiche') {
      var baseFields = {};
      (base.fields || []).forEach(function (f) { baseFields[f.id] = f; });
      out.fields = (Array.isArray(sup.fields) ? sup.fields : []).slice(0, MAX_ITEMS).map(function (f) {
        var b = baseFields[f.id];
        // Un rappel des réponses précédentes garde sa source : seul l'intitulé change.
        if (b && b.type === 'recall') return Object.assign(clone(b), { label: str(f.label, LIMITS.label) || b.label });
        var type = FIELD_TYPES.indexOf(f.type) >= 0 ? f.type : 'textarea';
        var fd = { id: String(f.id || ''), label: str(f.label, LIMITS.label), type: type, required: !!f.required };
        if (f.placeholder) fd.placeholder = str(f.placeholder, LIMITS.placeholder);
        if (type === 'scale') {
          fd.min = Math.max(0, Math.min(10, parseInt(f.min, 10) || 1));
          fd.max = Math.max(fd.min + 1, Math.min(10, parseInt(f.max, 10) || 10));
        }
        if (f.strike) fd.strike = true;
        if (f.pending) fd.pending = true;
        return fd;
      });
      if (!out.fields.length) throw err('Une fiche doit garder au moins un champ.');
      uniqueIds(out.fields);
    } else if (base.type === 'quiz') {
      out.questions = cleanQuestions(sup.questions, opts && opts.fixedCount);
    } else {
      return clone(base);
    }
    return out;
  }

  function cleanQuestions(list, fixedCount) {
    list = Array.isArray(list) ? list.slice(0, MAX_ITEMS) : [];
    var qs = list.map(function (q) {
      var opts = (Array.isArray(q.options) ? q.options : []).slice(0, MAX_OPTIONS).map(function (o) { return str(o, LIMITS.option); });
      var out = { id: String(q.id || ''), q: str(q.q, LIMITS.question), options: opts };
      if (q.explain) out.explain = str(q.explain, LIMITS.explain);
      return out;
    });
    if (fixedCount && qs.length !== fixedCount) throw err('Un boss compte exactement ' + fixedCount + ' questions.');
    uniqueIds(qs);
    return qs;
  }

  // data = mission complète éditée ; renvoie la surcouche propre à stocker.
  function cleanMissionOverride(baseMission, data, settings) {
    if (!baseMission) throw err('Mission inconnue.');
    var o = {};
    ['title', 'videoTitle', 'description', 'body', 'instructions', 'action'].forEach(function (k) {
      if (typeof data[k] === 'string') o[k] = str(data[k], LIMITS[k]);
    });
    if (!o.title && data.title !== undefined) throw err('Le titre ne peut pas être vide.');
    if (data.video !== undefined) {
      var v = checkVideoUrl(data.video);
      if (!v.ok) throw err('Lien vidéo non reconnu : colle une URL YouTube (youtube.com/watch?v=…, youtu.be/…), Vimeo ou un fichier https …mp4.');
      o.video = v.url;
    }
    if (baseMission.durationDays) {
      if (data.durationDays !== undefined) {
        var n = parseInt(data.durationDays, 10);
        if (!(n >= 1 && n <= 30)) throw err('La durée doit être comprise entre 1 et 30 jours.');
        o.durationDays = n;
      }
      if (data.consecutive !== undefined) o.consecutive = !!data.consecutive;
      if (typeof data.dailyLabel === 'string') o.dailyLabel = str(data.dailyLabel, LIMITS.dailyLabel);
    }
    if (data.caution !== undefined) o.caution = !!data.caution;
    if (baseMission.kind === 'boss') {
      if (data.challenge) o.challenge = cleanSupport(baseMission.challenge, data.challenge);
      if (!baseMission.final && data.quiz) o.quiz = { questions: cleanQuestions(data.quiz.questions, (settings && settings.bossQuestionCount) || 5) };
    } else if (data.support && baseMission.support && baseMission.support.type !== 'undefined') {
      o.support = cleanSupport(baseMission.support, data.support);
    }
    return o;
  }

  function cleanArenaOverride(base, data) {
    if (!base) throw err('Arène inconnue.');
    var o = {};
    ['name', 'theme', 'blocage', 'objectif', 'livrable'].forEach(function (k) {
      if (typeof data[k] === 'string') o[k] = str(data[k], LIMITS.arenaText);
    });
    if (o.name !== undefined && !o.name.trim()) throw err('Le nom de l\'arène ne peut pas être vide.');
    return o;
  }
  function cleanHabitOverride(base, data) {
    if (!base) throw err('Habitude inconnue.');
    var o = {};
    if (typeof data.title === 'string') o.title = str(data.title, LIMITS.habitTitle);
    if (typeof data.frequency === 'string') o.frequency = str(data.frequency, LIMITS.habitFreq);
    if (o.title !== undefined && !o.title.trim()) throw err('Le titre de l\'habitude ne peut pas être vide.');
    return o;
  }

  // Clés de réponses : { qid: index } limitées aux questions existantes.
  function cleanKeys(questions, keys) {
    var out = {};
    if (!keys || typeof keys !== 'object') return out;
    (questions || []).forEach(function (q) {
      var k = keys[q.id];
      if (typeof k === 'number' && k >= 0 && k < q.options.length && Math.floor(k) === k) out[q.id] = k;
    });
    return out;
  }

  // ─── Fusion ───────────────────────────────────────────────────────────────
  function merge(base, ov) {
    var c = clone(base);
    if (!ov) return c;
    c.missions.forEach(function (m) {
      var o = ov.missions && ov.missions[m.id];
      if (o) Object.keys(o).forEach(function (k) { m[k] = clone(o[k]); });
    });
    c.arenas.forEach(function (a) {
      var o = ov.arenas && ov.arenas[a.id];
      if (o) Object.keys(o).forEach(function (k) { a[k] = o[k]; });
    });
    (c.habits || []).forEach(function (h) {
      var o = ov.habits && ov.habits[h.id];
      if (o) Object.keys(o).forEach(function (k) { h[k] = o[k]; });
    });
    c.contentVersion = ov.version || 0;
    return c;
  }

  // ─── État de complétude (tableau de bord de l'éditeur) ───────────────────
  function missionStatus(m, keys) {
    var sup = m.kind === 'boss' ? m.challenge : m.support;
    var qs = m.kind === 'boss' ? ((m.quiz && m.quiz.questions) || []) : (sup && sup.type === 'quiz' ? sup.questions || [] : []);
    var written = qs.filter(questionWritten).length;
    var needKeys = m.kind === 'boss' ? !m.final : !!(sup && sup.scored);
    var k = (keys && keys[m.id]) || {};
    var keyed = needKeys ? qs.filter(function (q) { return typeof k[q.id] === 'number'; }).length : 0;
    var labels = [];
    if (sup && sup.items) labels = sup.items;
    if (sup && sup.fields) labels = sup.fields;
    var pending = labels.filter(function (x) { return x.pending || !String(x.label || '').trim(); }).length;
    var todo = [];
    if (!m.video) todo.push('vidéo');
    if (!String(m.body || '').trim()) todo.push('contenu');
    if (qs.length && written < qs.length) todo.push('questions ' + written + '/' + qs.length);
    if (needKeys && qs.length && keyed < qs.length) todo.push('réponses ' + keyed + '/' + qs.length);
    if (pending) todo.push(pending + ' intitulé' + (pending > 1 ? 's' : '') + ' à compléter');
    if (!sup || sup.type === 'undefined') todo.push('support à définir');
    return { video: !!m.video, body: !!String(m.body || '').trim(), questions: qs.length, written: written, keyed: keyed, needKeys: needKeys, pending: pending, todo: todo, complete: !todo.length };
  }


  // ─── Brouillon de l'éditeur ───────────────────────────────────────────────
  // draft = { ov: surcouche, keys: { missionId: { qid: index } } }
  function emptyOverrides() { return { v: 1, missions: {}, arenas: {}, habits: {} }; }
  function emptyDraft() { return { ov: emptyOverrides(), keys: {} }; }
  function findById(list, id) { for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i]; return null; }

  function draftOp(base, draft, op) {
    var d = clone(draft || emptyDraft());
    d.ov = d.ov || emptyOverrides();
    ['missions', 'arenas', 'habits'].forEach(function (k) { d.ov[k] = d.ov[k] || {}; });
    d.keys = d.keys || {};
    var id = String(op.id || '');
    switch (op.action) {
      case 'saveMission':
        var bm = findById(base.missions, id);
        var o = cleanMissionOverride(bm, op.data || {}, base.settings);
        d.ov.missions[id] = o;
        var merged = Object.assign(clone(bm), o);
        var qs = merged.kind === 'boss' ? (merged.quiz && merged.quiz.questions) : (merged.support && merged.support.type === 'quiz' ? merged.support.questions : null);
        if (qs) d.keys[id] = cleanKeys(qs, op.keys);
        break;
      case 'revertMission':
        if (!findById(base.missions, id)) throw err('Mission inconnue.');
        delete d.ov.missions[id];
        delete d.keys[id];
        break;
      case 'saveArena':
        d.ov.arenas[id] = cleanArenaOverride(findById(base.arenas, id), op.data || {});
        break;
      case 'saveHabit':
        d.ov.habits[id] = cleanHabitOverride(findById(base.habits || [], id), op.data || {});
        break;
      default:
        throw err('Action inconnue.');
    }
    return d;
  }
  function sameDraft(a, b) {
    return JSON.stringify((a && a.ov) || emptyOverrides()) === JSON.stringify((b && b.ov) || emptyOverrides()) &&
      JSON.stringify((a && a.keys) || {}) === JSON.stringify((b && b.keys) || {});
  }

  return {
    emptyOverrides: emptyOverrides, emptyDraft: emptyDraft, draftOp: draftOp, sameDraft: sameDraft,
    LIMITS: LIMITS, FIELD_TYPES: FIELD_TYPES,
    youtubeId: youtubeId, vimeoId: vimeoId, checkVideoUrl: checkVideoUrl,
    questionWritten: questionWritten,
    cleanMissionOverride: cleanMissionOverride, cleanArenaOverride: cleanArenaOverride,
    cleanHabitOverride: cleanHabitOverride, cleanKeys: cleanKeys,
    merge: merge, missionStatus: missionStatus
  };
});
