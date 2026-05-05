/* ═══════════════════════════════════════
   SAT.JS — Tests physiques SAT v7
   Dépendances : storage.js, data/sat.js
   Athletik Hub V8
═══════════════════════════════════════ */

// ═══ SAT v7 — EXERCICE PAR EXERCICE ═══
var satExercices = [
  {
    id: 'jump', name: 'Détente Verticale', emoji: '🦘',
    desc: 'Mesure ta hauteur bras levés, puis saute le plus haut possible.',
    video: 'https://www.youtube.com/embed/R4fjUyP2xuo',
    fields: [
      {id:'satReach', label:'Taille bras levés', unit:'cm', placeholder:'230'},
      {id:'satJump', label:'Hauteur max atteinte', unit:'cm', placeholder:'290'}
    ],
    hint: 'Détente = Hauteur max − Taille bras levés',
    hasTimer: false
  },
  {
    id: 'squat', name: 'Back Squat 5RM', emoji: '🏋️',
    desc: 'Charge maximale pour 5 répétitions strictes. Prends le temps de te chauffer.',
    video: 'https://www.youtube.com/embed/gsNoPYwWXeM',
    fields: [{id:'satSquat', label:'Charge 5RM', unit:'kg', placeholder:'80'}],
    hint: '1RM estimé = 5RM × 1.15',
    hasTimer: true, timerSec: 180, timerLabel: 'Repos entre séries'
  },
  {
    id: 'dl', name: 'Soulevé de Terre 5RM', emoji: '⚓',
    desc: 'Charge maximale pour 5 répétitions. Dos droit, tibia contre la barre.',
    video: 'https://www.youtube.com/embed/op9kVnSso6Q',
    fields: [{id:'satDL', label:'Charge 5RM', unit:'kg', placeholder:'100'}],
    hint: 'Deadlift — Conventionnel ou Roumain',
    hasTimer: true, timerSec: 180, timerLabel: 'Repos entre séries'
  },
  {
    id: 'ht', name: 'Hip Thrust 5RM', emoji: '🍑',
    desc: 'Charge maximale pour 5 répétitions. Dos sur le banc, poussée des hanches.',
    video: 'https://www.youtube.com/embed/xDmFkJxPzeM',
    fields: [{id:'satHT', label:'Charge 5RM', unit:'kg', placeholder:'80'}],
    hint: 'Muscle ciblé : Fessiers / Ischios',
    hasTimer: true, timerSec: 120, timerLabel: 'Repos entre séries'
  },
  {
    id: 'dc', name: 'Développé Couché 5RM', emoji: '💪',
    desc: 'Charge maximale pour 5 répétitions. Barre en contact avec la poitrine.',
    video: 'https://www.youtube.com/embed/vcBig73ojpE',
    fields: [{id:'satDC', label:'Charge 5RM', unit:'kg', placeholder:'60'}],
    hint: 'Prise large, coudes à 45°',
    hasTimer: true, timerSec: 120, timerLabel: 'Repos entre séries'
  },
  {
    id: 'sprint', name: 'Sprint 30m', emoji: '⚡',
    desc: 'Sprint maximal sur 30 mètres. Départ depuis position debout.',
    video: 'https://www.youtube.com/embed/4N4MFqo2J8c',
    fields: [{id:'satSprintTime', label:'Temps', unit:'sec', placeholder:'4.2'}],
    hint: 'Chronomètre intégré disponible',
    hasTimer: true, timerSec: 300, timerLabel: 'Récupération sprint', hasStopwatch: true
  },
  {
    id: 'fms', name: 'FMS Mobilité', emoji: '🧘',
    desc: 'Score ton niveau de mobilité sur 21 points (7 mouvements × 3 points max).',
    video: 'https://www.youtube.com/embed/4dsrMFf_SRY',
    fields: [{id:'satFMS', label:'Score FMS', unit:'/21', placeholder:'14'}],
    hint: '< 14 = risque blessure. Travaille la mobilité en priorité.',
    hasTimer: false
  }
];

var currentSatStep = 0;
var satValues = {};
var stopwatchRunning = false;
var stopwatchStart = 0;
var stopwatchEl = null;

function initSATv7() {
  currentSatStep = 0;
  satValues = {};
  renderSATStep();
}

function renderSATStep() {
  var container = document.getElementById('satForm');
  if (!container) return;
  var ex = satExercices[currentSatStep];
  var total = satExercices.length;
  var prog = Math.round((currentSatStep / total) * 100);
  
  var html = '';
  
  // Progress bar
  html += '<div style="margin-bottom:16px">';
  html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">';
  html += '<div style="font-size:12px;color:var(--muted);font-weight:600">TEST ' + (currentSatStep+1) + ' / ' + total + '</div>';
  html += '<div style="font-size:12px;color:var(--gold);font-weight:700">' + prog + '%</div>';
  html += '</div>';
  html += '<div class="prog-bar-wrap"><div class="prog-bar-fill" style="width:' + prog + '%"></div></div>';
  html += '</div>';
  
  // Exercise card
  html += '<div class="card" style="background:linear-gradient(135deg,var(--surface),var(--surface2));border:1.5px solid var(--border2)">';
  html += '<div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">';
  html += '<div style="font-size:36px">' + ex.emoji + '</div>';
  html += '<div><div style="font-family:Bebas Neue,sans-serif;font-size:20px;letter-spacing:1px;color:var(--text)">' + ex.name + '</div>';
  html += '<div style="font-size:12px;color:var(--muted)">' + ex.hint + '</div></div>';
  html += '</div>';
  html += '<div style="font-size:13px;color:var(--text2);line-height:1.5;margin-bottom:12px;padding:10px;background:rgba(255,255,255,.03);border-radius:10px">' + ex.desc + '</div>';
  // Lien vidéo si disponible
  if (ex.video) {
    html += '<a href="' + ex.video.replace('/embed/', '/watch?v=') + '" target="_blank" style="display:flex;align-items:center;gap:8px;padding:10px 14px;background:rgba(255,0,0,.08);border:1px solid rgba(255,0,0,.2);border-radius:10px;margin-bottom:12px;text-decoration:none">';
    html += '<svg width="16" height="16" viewBox="0 0 24 24" fill="#FF4444"><path d="M21.543 6.498C22 8.28 22 12 22 12s0 3.72-.457 5.502c-.254.985-.997 1.76-1.938 2.022C17.896 20 12 20 12 20s-5.895 0-7.605-.476c-.945-.266-1.687-1.04-1.938-2.022C2 15.72 2 12 2 12s0-3.72.457-5.502c.254-.985.997-1.76 1.938-2.022C6.105 4 12 4 12 4s5.896 0 7.605.476c.945.266 1.687 1.04 1.938 2.022zM10 15.5l6-3.5-6-3.5v7z"/></svg>';
    html += '<span style="font-size:12px;font-weight:700;color:#FF6666">Voir la démonstration vidéo</span>';
    html += '</a>';
  }
  
  // Fields
  ex.fields.forEach(function(f) {
    html += '<div style="margin-bottom:12px">';
    html += '<label style="font-size:12px;color:var(--text2);font-weight:600;display:block;margin-bottom:6px">' + f.label.toUpperCase() + '</label>';
    html += '<div style="display:flex;align-items:center;gap:8px">';
    html += '<input class="fi" type="number" id="' + f.id + '" placeholder="' + f.placeholder + '" step="0.1" style="flex:1;font-size:18px;font-weight:700;text-align:center" oninput="satValues[this.id]=parseFloat(this.value)||0">';
    html += '<div style="font-size:14px;color:var(--muted);font-weight:700;min-width:30px">' + f.unit + '</div>';
    html += '</div></div>';
  });
  
  // Stopwatch si sprint
  if (ex.hasStopwatch) {
    html += '<div style="margin-bottom:12px">';
    html += '<div style="display:flex;gap:8px;justify-content:center">';
    html += '<button onclick="startStopwatch()" style="padding:10px 20px;background:var(--gold);border:none;border-radius:10px;font-weight:800;color:var(--navy);cursor:pointer">▶ Start</button>';
    html += '<div id="stopwatchDisplay" style="padding:10px 20px;background:var(--surface2);border-radius:10px;font-family:Bebas Neue,sans-serif;font-size:22px;min-width:100px;text-align:center">0.00</div>';
    html += '<button onclick="stopStopwatch()" style="padding:10px 20px;background:var(--border2);border:none;border-radius:10px;font-weight:800;color:var(--text2);cursor:pointer">■ Stop</button>';
    html += '</div></div>';
  }
  
  // Timer repos si disponible
  if (ex.hasTimer && !ex.hasStopwatch) {
    html += '<button onclick="startSatTimer(' + ex.timerSec + ',this)" style="width:100%;padding:10px;background:rgba(197,164,78,.1);border:1px dashed rgba(197,164,78,.3);border-radius:10px;color:var(--gold);font-size:13px;font-weight:700;cursor:pointer;margin-bottom:12px">⏱ ' + ex.timerLabel + ' (' + Math.floor(ex.timerSec/60) + 'min)</button>';
    html += '<div id="satTimerDisplay" style="display:none;text-align:center;font-family:Bebas Neue,sans-serif;font-size:32px;color:var(--gold);margin-bottom:12px"></div>';
  }
  
  html += '</div>';
  
  // Navigation buttons
  html += '<div style="display:flex;gap:10px;margin-top:16px">';
  if (currentSatStep > 0) {
    html += '<button onclick="prevSATStep()" style="padding:14px 20px;background:var(--surface);border:1.5px solid var(--border2);border-radius:12px;font-weight:700;color:var(--text2);cursor:pointer;font-family:Outfit,sans-serif">← Retour</button>';
  }
  if (currentSatStep < satExercices.length - 1) {
    html += '<button onclick="nextSATStep()" style="flex:1;padding:14px;background:linear-gradient(135deg,#C5A44E,#D4B86A);border:none;border-radius:12px;font-weight:800;color:#0A0F1E;cursor:pointer;font-family:Outfit,sans-serif;font-size:15px">Suivant →</button>';
  } else {
    html += '<button onclick="finalizeSAT()" style="flex:1;padding:14px;background:linear-gradient(135deg,#C5A44E,#D4B86A);border:none;border-radius:12px;font-weight:800;color:#0A0F1E;cursor:pointer;font-family:Outfit,sans-serif;font-size:15px">Calculer mon score 🏆</button>';
  }
  html += '</div>';
  
  container.innerHTML = html;
}

function nextSATStep() {
  var ex = satExercices[currentSatStep];
  // Enregistrer les valeurs
  ex.fields.forEach(function(f) {
    var el = document.getElementById(f.id);
    if (el) satValues[f.id] = parseFloat(el.value) || 0;
  });
  
  if (currentSatStep < satExercices.length - 1) {
    currentSatStep++;
    renderSATStep();
    document.getElementById('vTracks').scrollTop = 0;
  }
}

function prevSATStep() {
  if (currentSatStep > 0) {
    currentSatStep--;
    renderSATStep();
    document.getElementById('vTracks').scrollTop = 0;
  }
}

function finalizeSAT() {
  // Récupérer toutes les valeurs
  satExercices.forEach(function(ex) {
    ex.fields.forEach(function(f) {
      var el = document.getElementById(f.id);
      if (el && el.value) satValues[f.id] = parseFloat(el.value) || 0;
    });
  });
  
  // Injecter dans les IDs attendus par calculateSAT
  Object.keys(satValues).forEach(function(id) {
    var existing = document.getElementById(id);
    if (!existing) {
      var hidden = document.createElement('input');
      hidden.type = 'hidden'; hidden.id = id; hidden.value = satValues[id];
      document.body.appendChild(hidden);
    } else {
      existing.value = satValues[id];
    }
  });
  
  calculateSAT();
}

var satTimerInterval = null;
function startSatTimer(seconds, btn) {
  if (satTimerInterval) clearInterval(satTimerInterval);
  var display = document.getElementById('satTimerDisplay');
  if (!display) return;
  display.style.display = 'block';
  btn.disabled = true; btn.textContent = '⏳ En cours...';
  var remaining = seconds;
  display.textContent = Math.floor(remaining/60) + ':' + String(remaining%60).padStart(2,'0');
  satTimerInterval = setInterval(function() {
    remaining--;
    display.textContent = Math.floor(remaining/60) + ':' + String(remaining%60).padStart(2,'0');
    if (remaining <= 0) {
      clearInterval(satTimerInterval);
      display.textContent = 'GO ! ✅';
      display.style.color = '#22C55E';
      btn.disabled = false; btn.textContent = '⏱ Relancer';
    }
  }, 1000);
}

function startStopwatch() {
  stopwatchRunning = true;
  stopwatchStart = Date.now();
  var display = document.getElementById('stopwatchDisplay');
  var interval = setInterval(function() {
    if (!stopwatchRunning) { clearInterval(interval); return; }
    var elapsed = (Date.now() - stopwatchStart) / 1000;
    if (display) display.textContent = elapsed.toFixed(2);
  }, 50);
}

function stopStopwatch() {
  stopwatchRunning = false;
  var elapsed = ((Date.now() - stopwatchStart) / 1000).toFixed(2);
  var display = document.getElementById('stopwatchDisplay');
  if (display) display.textContent = elapsed;
  // Injecter dans le champ sprint
  var sprintEl = document.getElementById('satSprintTime');
  if (sprintEl) sprintEl.value = elapsed;
  satValues['satSprintTime'] = parseFloat(elapsed);
}


