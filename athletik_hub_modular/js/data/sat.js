/* ═══════════════════════════════════════
   DATA/SAT.JS — Données SAT/SET exercices
   Athletik Hub V8
═══════════════════════════════════════ */

// ═══ SET — SESSION D'ÉVALUATION TERRAIN ═══
var SET_TYPES = {
  jump: [
    { ic: '🦘', name: 'Détente verticale', target: 'Hauteur max atteinte', unit: 'cm', placeholder: '290' },
    { ic: '📐', name: 'Taille bras levés', target: 'Pour calcul détente nette', unit: 'cm', placeholder: '230' },
    { ic: '🔄', name: 'CMJ — Counter Movement Jump', target: 'Meilleur essai sur 3', unit: 'cm', placeholder: '55' },
  ],
  sprint: [
    { ic: '⚡', name: 'Sprint 10m', target: 'Temps depuis départ debout', unit: 'sec', placeholder: '1.8' },
    { ic: '🏃', name: 'Sprint 30m', target: 'Temps meilleur essai', unit: 'sec', placeholder: '4.2' },
  ],
  force: [
    { ic: '🏋️', name: 'Back Squat 5RM', target: 'Charge maximale × 5 reps', unit: 'kg', placeholder: '80' },
    { ic: '⚓', name: 'Soulevé de Terre 5RM', target: 'Dos droit, tibia contre barre', unit: 'kg', placeholder: '100' },
    { ic: '🍑', name: 'Hip Thrust 5RM', target: 'Dos sur banc, poussée hanches', unit: 'kg', placeholder: '80' },
  ],
  complet: [
    { ic: '🦘', name: 'Détente verticale', target: 'Hauteur max atteinte', unit: 'cm', placeholder: '290' },
    { ic: '⚡', name: 'Sprint 30m', target: 'Temps meilleur essai', unit: 'sec', placeholder: '4.2' },
    { ic: '🏋️', name: 'Back Squat 5RM', target: 'Charge max', unit: 'kg', placeholder: '80' },
    { ic: '🧘', name: 'FMS Mobilité', target: 'Score sur 21 points', unit: '/21', placeholder: '14' },
  ]
};

var currentSetType = 'jump';
var setHistory = [];

function selectSetType(el, type) {
  document.querySelectorAll('.set-day-card').forEach(function(c){ c.classList.remove('sel'); });
  el.classList.add('sel');
  currentSetType = type;
  renderSETExercises();
}

function renderSETExercises() {
  var exercises = SET_TYPES[currentSetType];
  var html = '';
  exercises.forEach(function(ex, i) {
    html += '<div class="set-exercise">';
    html += '<div class="set-ex-ic">' + ex.ic + '</div>';
    html += '<div class="set-ex-body"><div class="set-ex-name">' + ex.name + '</div><div class="set-ex-desc">' + ex.target + '</div></div>';
    html += '<div style="display:flex;align-items:center;gap:6px">';
    html += '<input class="set-ex-input" type="number" id="setVal' + i + '" placeholder="' + ex.placeholder + '" step="0.1">';
    html += '<div style="font-size:11px;color:var(--muted);font-weight:700;min-width:20px">' + ex.unit + '</div>';
    html += '</div>';
    html += '</div>';
  });
  document.getElementById('setExercises').innerHTML = html;
  // Date label
  var now = new Date();
  var days = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];
  var months = ['jan','fév','mar','avr','mai','jun','jul','août','sep','oct','nov','déc'];
  var dateEl = document.getElementById('setDateLabel');
  if (dateEl) dateEl.textContent = days[now.getDay()] + ' ' + now.getDate() + ' ' + months[now.getMonth()];
}

function validateSET() {
  var exercises = SET_TYPES[currentSetType];
  var results = [];
  var hasAny = false;
  exercises.forEach(function(ex, i) {
    var el = document.getElementById('setVal' + i);
    var val = el ? parseFloat(el.value) : 0;
    if (val) hasAny = true;
    results.push({ name: ex.name, val: val, unit: ex.unit });
  });
  if (!hasAny) { alert('Saisis au moins une valeur pour enregistrer ta SET.'); return; }
  // Sauvegarder
  var entry = {
    date: new Date().toLocaleDateString('fr-FR'),
    type: currentSetType,
    results: results
  };
  setHistory.unshift(entry);
  // Afficher historique
  renderSETHistory();
  document.getElementById('setHistory').style.display = 'block';
  // Feedback Titan
  var msgs = {
    jump: '"Détente enregistrée. Dans 4 semaines on compare. Ne relâche rien."',
    sprint: '"Chrono noté. La vitesse se construit en millisecondes. Continue."',
    force: '"Charges enregistrées. La progression se voit en semaines. Pas en jours."',
    complet: '"SET complète enregistrée. T\'as tes chiffres de référence. Maintenant tu bosses."'
  };
  // Réinitialiser les champs
  exercises.forEach(function(ex, i) {
    var el = document.getElementById('setVal' + i);
    if (el) el.value = '';
  });
}

function renderSETHistory() {
  var html = '';
  setHistory.slice(0, 5).forEach(function(entry) {
    var typeNames = { jump: '🦘 Détente', sprint: '⚡ Sprint', force: '🏋️ Force', complet: '🔥 Complet' };
    html += '<div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:12px;margin-bottom:8px">';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">';
    html += '<div style="font-family:\'Bebas Neue\',sans-serif;font-size:14px;color:var(--text);letter-spacing:1px">' + (typeNames[entry.type] || entry.type) + '</div>';
    html += '<div style="font-size:10px;color:var(--muted)">' + entry.date + '</div>';
    html += '</div>';
    entry.results.forEach(function(r) {
      if (!r.val) return;
      html += '<div style="display:flex;justify-content:space-between;font-size:12px;color:var(--text2);padding:3px 0">';
      html += '<span>' + r.name + '</span><span style="font-weight:700;color:var(--gold)">' + r.val + r.unit + '</span>';
      html += '</div>';
    });
    html += '</div>';
  });
  document.getElementById('setHistoryList').innerHTML = html || '<div style="font-size:13px;color:var(--muted)">Aucune SET enregistrée.</div>';
}

// Init SET
document.addEventListener('DOMContentLoaded', function() {
  setTimeout(function() { renderSETExercises(); }, 100);
});

