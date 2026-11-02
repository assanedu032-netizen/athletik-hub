/* ════════════════════════════════════════════════════════════════════════════
 * Athletik Master — PACK DÉMO (données FICTIVES, jamais en production)
 * ────────────────────────────────────────────────────────────────────────────
 * Le document source ne contient pas encore les questions des quiz. Pour
 * pouvoir tester le parcours de bout en bout, le mode démo remplace chaque
 * quiz vide par des questions de test ÉTIQUETÉES « [DÉMO] » : elles ne disent
 * rien de la méthode et ne doivent jamais être confondues avec le contenu réel.
 * En production (store distant), ce fichier n'est pas utilisé : un quiz vide
 * affiche « Questions à ajouter ».
 * ════════════════════════════════════════════════════════════════════════════ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.AMDemo = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function written(q) {
    return !!(q && q.q && q.q.trim() && q.options && q.options.length >= 2 && q.options.every(function (o) { return o && o.trim(); }));
  }

  // Renvoie { content, quizKeys } : une COPIE du programme où chaque emplacement
  // de question encore vide est rempli par une question [DÉMO]. Les questions
  // déjà rédigées (via l'éditeur) sont conservées, avec leurs réponses (extraKeys).
  function withDemoQuizzes(content, extraKeys) {
    var c = JSON.parse(JSON.stringify(content));
    var keys = JSON.parse(JSON.stringify(extraKeys || {}));
    c.missions.forEach(function (m) {
      var qs = null, scored = true, diag = false;
      if (m.kind === 'boss' && m.quiz) qs = m.quiz.questions;
      else if (m.support && m.support.type === 'quiz') { qs = m.support.questions; scored = !!m.support.scored; diag = !scored; }
      if (!qs) return;
      if (!qs.length) for (var i = 1; i <= (m.kind === 'boss' ? (c.settings.bossQuestionCount || 5) : 3); i++) qs.push({ id: 'q' + i, q: '', options: [] });
      qs.forEach(function (q, i) {
        if (written(q)) return;
        q.demo = true;
        if (diag) {
          q.q = '[DÉMO] Question de diagnostic n°' + (i + 1) + ' — toutes les réponses sont acceptées.';
          q.options = ['Réponse A', 'Réponse B', 'Réponse C'];
        } else {
          q.q = '[DÉMO] Question test n°' + (i + 1) + ' — choisis « Bonne réponse » pour réussir.';
          q.options = ['Mauvaise réponse A', 'Bonne réponse', 'Mauvaise réponse B'];
          keys[m.id] = keys[m.id] || {};
          keys[m.id][q.id] = 1;
        }
      });
    });
    return { content: c, quizKeys: keys };
  }

  // Participants fictifs pour l'espace admin de démonstration.
  function demoParticipants(engine, now) {
    var DAY = 86400000;
    var people = [
      { name: '[DÉMO] Inès K.', email: 'ines.demo@example.com', daysAgo: 29, upTo: 'm2.3' },
      { name: '[DÉMO] Moussa D.', email: 'moussa.demo@example.com', daysAgo: 61, upTo: 'boss-a5' },
      { name: '[DÉMO] Léa B.', email: 'lea.demo@example.com', daysAgo: 3, upTo: 'm0.4' }
    ];
    return people.map(function (p) {
      var start = now - p.daysAgo * DAY;
      var state = engine.newState(start, 60);
      var t = start;
      // Valide tout jusqu'à upTo inclus, en écrivant directement l'état
      // (on fabrique un historique, on ne rejoue pas les règles).
      for (var i = 0; i < engine.playable.length; i++) {
        var m = engine.playable[i];
        state.missions[m.id] = { validatedAt: t };
        engine.content.habits.forEach(function (h) {
          if (h.unlockedBy === m.id) state.habits[h.id] = { unlockedAt: t, log: {} };
        });
        if (m.kind === 'boss') {
          engine.content.rewards.forEach(function (r) {
            if (r.trigger === 'boss:' + m.arena) state.rewards.push({ id: r.id, at: t });
          });
        }
        if (m.id === 'm0.6') state.rewards.push({ id: 'rookie', at: t });
        t += m.arena === 'n0' ? 600000 : DAY;
        if (m.id === p.upTo) break;
      }
      return {
        uid: 'demo-' + p.email, name: p.name, email: p.email, state: state,
        access: { plan: 'installments', installments: 3, payments: [{ id: 'd1', at: start - DAY, amount: null }] },
        contacted: p.daysAgo > 60 ? { d30: start + 30 * DAY } : {}
      };
    });
  }

  return { withDemoQuizzes: withDemoQuizzes, demoParticipants: demoParticipants };
});
