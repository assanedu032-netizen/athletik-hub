/* ═══════════════════════════════════════
   APP.JS — Point d'entrée + Navigation globale
   Athletik Hub V8
   Ordre de chargement requis :
   1. data/recipes.js
   2. data/sat.js
   3. storage.js
   4. onboarding.js
   5. home.js
   6. sat.js
   7. train.js
   8. titan.js
   9. tracks.js
   10. nutrition.js
   11. app.js (ce fichier, en dernier)
═══════════════════════════════════════ */

/* ── NAVIGATION GLOBALE ── */
function showView(id) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('on'));
  const el = document.getElementById(id);
  if (el) el.classList.add('on');
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  const btn = document.querySelector(`[data-view="${id}"]`);
  if (btn) btn.classList.add('active');
}

/* ── PWA SERVICE WORKER ── */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}

/* ── INIT GLOBAL ── */
document.addEventListener('DOMContentLoaded', () => {
  // Les modules s'initialisent chacun via leurs propres DOMContentLoaded ou fonctions init
  console.log('Athletik Hub V8 — Modular ready');
});
