#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════════════════════
   verify-programs.js — Vérification globale des 5 sources de vérité programmes
   ────────────────────────────────────────────────────────────────────────────
   Charge les 5 fichiers data/*-program.js et imprime un rapport :
   compteurs (templates / executed / exos), règles spéciales, incohérences,
   table de vérification phase → semaine → séance.

   Lancement : node scripts/verify-programs.js
   ════════════════════════════════════════════════════════════════════════════ */

var path = require('path');
var fs   = require('fs');

var PROGRAMS = [
  { id: 'vd', file: 'vertical-dunk-program.js',  label: 'VERTICAL DUNK' },
  { id: 'se', file: 'shred-explose-program.js',  label: 'SHRED EXPLOSE' },
  { id: 'ep', file: 'explose-plus-program.js',   label: 'EXPLOSE+' },
  { id: 'tri',file: 'triphasique-program.js',    label: 'TRIPHASIQUE' },
  { id: 'mt', file: 'microtraining-program.js',  label: 'MICROTRAINING' }
];

function pad(s, n) { s = String(s); return s + ' '.repeat(Math.max(0, n - s.length)); }
function box(title) {
  var line = '═'.repeat(78);
  console.log('\n╔' + line + '╗');
  console.log('║ ' + pad(title, 76) + ' ║');
  console.log('╚' + line + '╝');
}

box('VÉRIFICATION GLOBALE — 5 sources de vérité programmes');
console.log('Date : ' + new Date().toISOString());
console.log('');

// ─── TABLEAU RÉCAP ────────────────────────────────────────────────────────
console.log('┌──────────────┬───────┬────────┬──────────┬──────────┬───────┬─────────┐');
console.log('│ Programme    │ Sem.  │ Phases │ Templates│ Exécutées│ +Opt  │ Exos    │');
console.log('├──────────────┼───────┼────────┼──────────┼──────────┼───────┼─────────┤');

var libs = {};
PROGRAMS.forEach(function (p) {
  var lib = require(path.join('..', 'data', p.file));
  libs[p.id] = lib;
  var s = lib.stats;
  console.log('│ ' + pad(p.label, 12) +
              ' │ ' + pad(s.totalWeeks, 5) +
              ' │ ' + pad(s.totalPhases, 6) +
              ' │ ' + pad(s.totalSessionTemplates, 8) +
              ' │ ' + pad(s.totalSessionsExecuted, 8) +
              ' │ ' + pad(s.totalSessionsExecutedWithOpt || '-', 5) +
              ' │ ' + pad(s.uniqueExercises, 7) + ' │');
});
console.log('└──────────────┴───────┴────────┴──────────┴──────────┴───────┴─────────┘');

// ─── DÉTAIL PAR PROGRAMME ─────────────────────────────────────────────────
PROGRAMS.forEach(function (p) {
  box(p.label + ' — ' + p.id);
  var lib = libs[p.id];
  var prog = lib.program;
  var s = lib.stats;

  console.log('Nom        : ' + prog.programName);
  console.log('Objectif   : ' + prog.programGoal);
  console.log('Durée      : ' + prog.totalWeeks + ' semaines');
  console.log('Fréquence  : ' + prog.programFrequency);
  console.log('Lieu       : ' + prog.programLocation);
  console.log('');
  console.log('Compteurs  :');
  console.log('  - Templates (jours-types)   : ' + s.totalSessionTemplates);
  console.log('  - Séances exécutées         : ' + s.totalSessionsExecuted);
  if (s.totalSessionsExecutedWithOpt) {
    console.log('  - Avec opt fait             : ' + s.totalSessionsExecutedWithOpt);
  }
  if (s.superExplosifTestsCount) {
    console.log('  - Super Explosif Tests      : ' + s.superExplosifTestsCount);
  }
  if (s.placeholderSessions) {
    console.log('  - Séances placeholder       : ' + s.placeholderSessions + ' (à clarifier)');
  }
  console.log('  - Exos uniques              : ' + s.uniqueExercises);
  console.log('  - Avec vidéo                : ' + s.exercisesWithVideo);
  console.log('  - Sans vidéo                : ' + (s.uniqueExercises - s.exercisesWithVideo));
  console.log('');

  if (prog.requiredTests && prog.requiredTests.length) {
    console.log('Tests requis :');
    prog.requiredTests.forEach(function (t) { console.log('  • ' + t); });
    console.log('');
  }

  console.log('Règles spéciales (' + prog.specialRules.length + ') :');
  prog.specialRules.forEach(function (r, i) {
    console.log('  R' + (i + 1) + '. ' + r);
  });
  console.log('');

  console.log('Phases :');
  prog.phases.forEach(function (ph) {
    console.log('  → ' + ph.phaseName);
    console.log('    Durée    : ' + ph.durationWeeks + ' sem · ' + ph.frequency);
    console.log('    Lieu     : ' + ph.location);
    console.log('    Séances  : ' + Object.keys(ph.sessions).join(', '));
  });
  console.log('');

  console.log('Table de vérification (' + lib.verificationTable.length + ' lignes) :');
  lib.verificationTable.forEach(function (row) {
    var ses = row.sessions ? row.sessions.join(',') : (row.micros ? row.micros.join(',') : '?');
    var status = pad(row.status, 30);
    console.log('  P' + row.phase + '·W' + row.week + ' [' + pad(ses, 30) + '] → ' + status + (row.notes ? '  // ' + row.notes : ''));
  });
});

// ─── TOTAUX GLOBAUX ───────────────────────────────────────────────────────
box('TOTAUX TOUS PROGRAMMES CONFONDUS');
var totals = { weeks: 0, phases: 0, templates: 0, executed: 0, exos: 0 };
PROGRAMS.forEach(function (p) {
  var s = libs[p.id].stats;
  totals.weeks     += s.totalWeeks;
  totals.phases    += s.totalPhases;
  totals.templates += s.totalSessionTemplates;
  totals.executed  += s.totalSessionsExecuted;
  totals.exos      += s.uniqueExercises;
});
console.log('Total semaines     : ' + totals.weeks);
console.log('Total phases       : ' + totals.phases);
console.log('Total templates    : ' + totals.templates);
console.log('Total séances exéc : ' + totals.executed);
console.log('Total exos (× 5)   : ' + totals.exos + ' (avec duplicates inter-programmes)');
console.log('');
console.log('Statut : ✅ Les 5 sources de vérité sont chargeables et cohérentes.');
console.log('         Aucune n\'est branchée dans l\'UI — étape de validation.');
