/* ═══════════════════════════════════════
   TRACKS.JS — Vue Tracks + Navigation
   Dépendances : storage.js
   Athletik Hub V8
═══════════════════════════════════════ */

// ═══════════════════════════════════════
// ATHLETIK HUB V5 — STEP 6: PROFIL
// ═══════════════════════════════════════


function setMode(el, mode) {
  document.querySelectorAll('.mode-opt').forEach(m => m.classList.remove('on'));
  el.classList.add('on');
  currentMode = mode;
  console.log('Titan Engine mode:', mode);
}

function toggleDark() {
  darkMode = !darkMode;
  document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : '');
  document.getElementById('darkToggle').classList.toggle('on', darkMode);
}

function toggleNotif() {
  notifOn = !notifOn;
  document.getElementById('notifToggle').classList.toggle('on', notifOn);
}


