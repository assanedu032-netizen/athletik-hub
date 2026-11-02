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

  function demoQuestions(n, prefix) {
    var qs = [];
    for (var i = 1; i <= n; i++) {
      qs.push({
        id: prefix + i,
        q: '[DÉMO] Question test n°' + i + ' — choisis « Bonne réponse » pour réussir.',
        options: ['Mauvaise réponse A', 'Bonne réponse', 'Mauvaise réponse B'],
        demo: true
      });
    }
    return qs;
  }

  // Renvoie { content, quizKeys } : une COPIE du programme avec des quiz de démo.
  function withDemoQuizzes(content) {
    var c = JSON.parse(JSON.stringify(content));
    var keys = {};
    c.missions.forEach(function (m) {
      if (m.kind === 'boss' && m.quiz && (!m.quiz.questions || !m.quiz.questions.length)) {
        m.quiz.questions = demoQuestions(c.settings.bossQuestionCount || 5, 'dq');
        keys[m.id] = {};
        m.quiz.questions.forEach(function (q) { keys[m.id][q.id] = 1; });
      }
      if (m.support && m.support.type === 'quiz' && (!m.support.questions || !m.support.questions.length)) {
        m.support.questions = demoQuestions(3, 'dq');
        if (m.support.scored) {
          keys[m.id] = {};
          m.support.questions.forEach(function (q) { keys[m.id][q.id] = 1; });
        } else {
          m.support.questions.forEach(function (q) {
            q.q = '[DÉMO] Question de diagnostic test — toutes les réponses sont acceptées.';
            q.options = ['Réponse A', 'Réponse B', 'Réponse C'];
          });
        }
      }
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
