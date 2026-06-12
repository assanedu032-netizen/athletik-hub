#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
// scripts/verify-ea-program.js
// Vérifie la source de vérité Elite Athlète (data/elite-athlete-program.js) :
//   - résumé global (phases / semaines / sessions / exos uniques / vidéos)
//   - table de vérification par session
//   - détection de problèmes (champs manquants, repos en tiret non normalisé,
//     IDs en doublon, exos hors librairie maître)
// Usage : node scripts/verify-ea-program.js [--table]
// ════════════════════════════════════════════════════════════════════════════

const lib = require('../data/elite-athlete-program.js');
const program = lib.program;
const MASTER = lib.masterExercises;

const showTable = process.argv.includes('--table');

let totalSessions = 0, totalExInstances = 0;
const uniqueExos = new Map(); // exerciseId → { count, video }
const problems = [];
const sessionRows = [];
const seenIds = new Set();

program.phases.forEach(phase => {
  phase.weeks.forEach(week => {
    week.sessions.forEach(sess => {
      totalSessions++;
      // ID unique ?
      if (seenIds.has(sess.sessionId)) problems.push(`ID session en doublon : ${sess.sessionId}`);
      seenIds.add(sess.sessionId);

      let exCount = 0, vidOk = 0, vidPh = 0, rowProblem = [];
      (sess.exercises || []).forEach(e => {
        exCount++; totalExInstances++;
        const entry = uniqueExos.get(e.exerciseId) || { count: 0, video: e.videoStatus, name: e.masterName };
        entry.count++;
        uniqueExos.set(e.exerciseId, entry);
        if (e.videoStatus === 'available') vidOk++; else vidPh++;

        // Checks de complétude
        if (!e.repsOrDuration) rowProblem.push(`${e.exerciseId}: repsOrDuration vide`);
        if (!e.rest) rowProblem.push(`${e.exerciseId}: rest vide`);
        if (e.rest === "-" || e.rest === "–") rowProblem.push(`${e.exerciseId}: rest tiret non normalisé`);
        if (e.sets === 'VAR') rowProblem.push(`${e.exerciseId}: séries VAR non résolues`);
        if (!MASTER[e.exerciseId]) rowProblem.push(`${e.exerciseId}: absent de la librairie maître`);
        if (!e.blockType) rowProblem.push(`${e.exerciseId}: blockType manquant`);
      });
      if (!sess.exercises || !sess.exercises.length) rowProblem.push('SESSION VIDE');
      if (rowProblem.length) problems.push(`${sess.sessionId} → ${rowProblem.join(' | ')}`);

      sessionRows.push({
        phase: phase.phaseName,
        week: week.weekNumber,
        id: sess.sessionId,
        title: sess.sessionTitle,
        n: exCount,
        video: `${vidOk}✓/${vidPh}⏳`,
        status: rowProblem.length ? '⚠ ' + rowProblem.length + ' pb' : 'OK'
      });
    });
  });
});

// Continuité des semaines globales
let expectGlobal = 1;
program.phases.forEach(phase => phase.weeks.forEach(w => {
  if (w.globalWeekNumber !== expectGlobal) problems.push(`Trou de semaine globale : attendu ${expectGlobal}, trouvé ${w.globalWeekNumber} (${w.weekId})`);
  expectGlobal++;
}));

const withVideo = [...uniqueExos.entries()].filter(([id]) => MASTER[id] && MASTER[id].videoUrl);
const withoutVideo = [...uniqueExos.entries()].filter(([id]) => MASTER[id] && !MASTER[id].videoUrl);
const notInMaster = [...uniqueExos.entries()].filter(([id]) => MASTER[id] && MASTER[id].notInMaster);

console.log('═'.repeat(64));
console.log('ELITE ATHLÈTE — SOURCE DE VÉRITÉ — RÉSUMÉ');
console.log('═'.repeat(64));
console.log(`Version source        : ${program.sourceVersion}`);
console.log(`Phases                : ${program.phases.length}`);
program.phases.forEach(p => console.log(`  - ${p.phaseName.padEnd(22)} ${p.durationWeeks} sem · ${p.frequency}`));
console.log(`Semaines totales      : ${program.totalWeeks} (continuité: ${expectGlobal - 1 === program.totalWeeks ? 'OK' : 'KO'})`);
console.log(`Sessions totales      : ${totalSessions}`);
console.log(`Instances d'exercices : ${totalExInstances}`);
console.log(`Exercices uniques     : ${uniqueExos.size}`);
console.log(`  - avec vidéo dispo  : ${withVideo.length}  (${withVideo.map(([id]) => id).join(', ')})`);
console.log(`  - sans vidéo (⏳)   : ${withoutVideo.length}`);
console.log(`  - hors librairie Excel : ${notInMaster.length}  ${notInMaster.length ? '(' + notInMaster.map(([id]) => id).join(', ') + ')' : ''}`);
console.log(`Problèmes détectés    : ${problems.length}`);
problems.forEach(p => console.log(`  ⚠ ${p}`));

if (showTable) {
  console.log('\n' + '─'.repeat(64));
  console.log('TABLE DE VÉRIFICATION (phase | sem | session | titre | exos | vidéos | statut)');
  console.log('─'.repeat(64));
  sessionRows.forEach(r => {
    console.log(`${r.phase.padEnd(22)} | W${String(r.week).padEnd(2)} | ${r.id.padEnd(14)} | ${r.title.slice(0, 42).padEnd(42)} | ${String(r.n).padStart(2)} | ${r.video.padEnd(8)} | ${r.status}`);
  });
}

process.exit(problems.length ? 1 : 0);
