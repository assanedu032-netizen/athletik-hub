/* ═══════════════════════════════════════
   TRAIN.JS — Vue Train + Live Session + Timer
   Dépendances : storage.js, sat.js
   Athletik Hub V8
═══════════════════════════════════════ */

// ═══════════════════════════════════════
// ATHLETIK HUB V5 — STEP 3: TRACKS
// ═══════════════════════════════════════


// ── SUB-TAB NAVIGATION ──
function showSec(id,_el) {
  document.querySelectorAll('#vTracks .sec').forEach(s => s.classList.remove('on'));
  document.querySelectorAll('#vTracks .sub-tab').forEach(t => t.classList.remove('on'));
  var secId = 'sec' + id.charAt(0).toUpperCase() + id.slice(1);
  var sec = document.getElementById(secId);
  if(sec) sec.classList.add('on');
  if(_el) _el.classList.add('on');
  else if(event&&event.currentTarget) event.currentTarget.classList.add('on');
  var vt=document.getElementById('vTracks');if(vt)vt.scrollTop=0;
  // Init SET si nécessaire
  if(id==='set') { renderSETExercises(); }
}

// ══════════════════════════════════
// SAT — SUPER ATHLETIC TEST
// ══════════════════════════════════

function setSatPhase(el, phase) {
  document.querySelectorAll('.sec:first-child .tp').forEach(t => t.classList.remove('on'));
  el.classList.add('on');
  satPhase = phase;
}

function calculateSAT() {
  const reach = parseFloat(document.getElementById('satReach').value) || 0;
  const jump = parseFloat(document.getElementById('satJump').value) || 0;
  const squat5 = parseFloat(document.getElementById('satSquat').value) || 0;
  const dl = parseFloat(document.getElementById('satDL').value) || 0;
  const ht = parseFloat(document.getElementById('satHT').value) || 0;
  const dc = parseFloat(document.getElementById('satDC').value) || 0;
  const sprintTime = parseFloat(document.getElementById('satSprintTime').value) || 0;
  const fms = parseFloat(document.getElementById('satFMS').value) || 0;

  if (!reach || !jump) { alert('Saisis au moins tes données de détente.'); return; }

  // Calculations
  const vertJump = jump - reach;
  const squat1RM = squat5 * 1.15;

  // Scoring /100
  // Détente: 40% — reference 80cm = max score
  const jumpScore = Math.min((vertJump / 80) * 40, 40);
  // Force: 25% — reference squat 1RM 180kg = max score
  const forceScore = squat1RM > 0 ? Math.min((squat1RM / 180) * 25, 25) : 0;
  // Sprint: 20% — reference 30m in 3.8s = max score (lower is better)
  const sprintScore = sprintTime > 0 ? Math.min((3.8 / sprintTime) * 20, 20) : 0;
  // Mobility: 15% — reference FMS 21/21 = max score
  const mobilityScore = fms > 0 ? Math.min((fms / 21) * 15, 15) : 0;

  const totalScore = Math.round(jumpScore + forceScore + sprintScore + mobilityScore);

  // Level
  const levels = [
    { max:20, name:'ROOKIE', icon:'🥉', msg:'"On part de zéro. C\'est parfait. Tu n\'as qu\'un chemin : monter."' },
    { max:35, name:'DÉBUTANT', icon:'🥈', msg:'"Tu commences à comprendre. Mais tes fibres sont encore endormies."' },
    { max:50, name:'INTERMÉDIAIRE', icon:'🥇', msg:'"Pas mal. Tu sors du lot. Ne t\'arrête pas."' },
    { max:65, name:'AVANCÉ', icon:'🦅', msg:'"Là on discute. Base solide. On va chercher l\'explosion."' },
    { max:80, name:'ATHLÈTE', icon:'👑', msg:'"Respect. Tu es une machine. Les détails vont faire la différence."' },
    { max:90, name:'ÉLITE', icon:'⚡', msg:'"Top 1%. Continue de dominer."' },
    { max:100, name:'SURHUMAIN', icon:'🔱', msg:'"Je n\'ai plus rien à t\'apprendre. Tu es le Titan maintenant."' }
  ];
  const lv = levels.find(l => totalScore <= l.max) || levels[levels.length-1];

  // Display
  document.getElementById('scScore').textContent = totalScore;
  document.getElementById('scLevel').textContent = lv.icon + ' ' + lv.name;
  document.getElementById('scJump').textContent = vertJump + ' cm';
  document.getElementById('scForce').textContent = squat1RM > 0 ? Math.round(squat1RM) + ' kg' : '—';
  document.getElementById('scSprint').textContent = sprintTime > 0 ? sprintTime + 's' : '—';
  document.getElementById('scMobility').textContent = fms > 0 ? fms + '/21' : '—';
  document.getElementById('satTitanMsg').innerHTML = lv.msg;

  // Mark SAT as done so programs are unlocked
  if (typeof user !== 'undefined') {
    user.satDone = true;
    user.athScore = totalScore;
    user.vertJump = vertJump;
    user.level = lv.name;
    user.levelIcon = lv.icon;
    try { if (typeof saveData === 'function') saveData(); } catch(e) {}
  }

  document.getElementById('satForm').classList.add('hidden');
  document.getElementById('satResult').classList.remove('hidden');
}

function resetSAT() {
  document.getElementById('satForm').classList.remove('hidden');
  document.getElementById('satResult').classList.add('hidden');
}

// ══════════════════════════════════
// TRACK EXERCICES
// ══════════════════════════════════

function updateTrackFields() {
  const sel = document.getElementById('trackExSelect');
  const opt = sel.options[sel.selectedIndex];
  const type = opt.dataset.type;
  const fields = document.getElementById('trackFields');
  document.getElementById('trackLastWrap').classList.remove('hidden');

  // Last-score teaser (mock)
  const lastByType = { force:'95kg × 5 reps • RPE 7', sprint:'Meilleur 4.35s (3 essais)', saut:'55cm × 3 reps' };
  document.getElementById('trackLast').textContent = lastByType[type] || '—';

  // Default essais count: 3 for sprint (typical 3-5 passages), 1 for force/saut
  const defaultCount = (type === 'sprint') ? 3 : 1;
  window._trackType = type;
  let html = '<div id="trackEssaisList" class="tr-essais"></div>'
    + '<button type="button" class="btn btn-outline btn-sm" onclick="addEssai()" style="margin-bottom:12px">+ Ajouter un essai</button>';
  fields.innerHTML = html;
  // Seed default rows
  for (let i = 0; i < defaultCount; i++) addEssai();
}

function _essaiRowHtml(type, idx) {
  if (type === 'force') {
    return '<div class="tr-essai" data-idx="'+idx+'">'
      + '<div class="tr-essai-num">'+(idx+1)+'</div>'
      + '<div class="tr-essai-inputs">'
      +   '<input class="fi tr-essai-input" data-key="load" type="number" placeholder="100"><span class="tr-essai-unit">kg</span>'
      +   '<span class="tr-essai-x">×</span>'
      +   '<input class="fi tr-essai-input" data-key="reps" type="number" placeholder="5"><span class="tr-essai-unit">reps</span>'
      + '</div>'
      + '<button type="button" class="tr-essai-rm" onclick="removeEssai(this)" aria-label="Supprimer">✕</button>'
      + '</div>';
  }
  if (type === 'sprint') {
    return '<div class="tr-essai" data-idx="'+idx+'">'
      + '<div class="tr-essai-num">'+(idx+1)+'</div>'
      + '<div class="tr-essai-inputs">'
      +   '<input class="fi tr-essai-input" data-key="time" type="number" step="0.01" placeholder="4.20"><span class="tr-essai-unit">sec</span>'
      + '</div>'
      + '<button type="button" class="tr-essai-rm" onclick="removeEssai(this)" aria-label="Supprimer">✕</button>'
      + '</div>';
  }
  if (type === 'saut') {
    return '<div class="tr-essai" data-idx="'+idx+'">'
      + '<div class="tr-essai-num">'+(idx+1)+'</div>'
      + '<div class="tr-essai-inputs">'
      +   '<input class="fi tr-essai-input" data-key="height" type="number" placeholder="60"><span class="tr-essai-unit">cm</span>'
      +   '<span class="tr-essai-x">×</span>'
      +   '<input class="fi tr-essai-input" data-key="reps" type="number" placeholder="3"><span class="tr-essai-unit">reps</span>'
      + '</div>'
      + '<button type="button" class="tr-essai-rm" onclick="removeEssai(this)" aria-label="Supprimer">✕</button>'
      + '</div>';
  }
  return '';
}

function addEssai() {
  const list = document.getElementById('trackEssaisList');
  if (!list || !window._trackType) return;
  const idx = list.children.length;
  const row = document.createElement('div');
  row.innerHTML = _essaiRowHtml(window._trackType, idx);
  list.appendChild(row.firstChild);
}

function removeEssai(btn) {
  const list = document.getElementById('trackEssaisList');
  if (!list) return;
  if (list.children.length <= 1) return; // keep at least one
  btn.closest('.tr-essai').remove();
  // Renumber
  Array.prototype.forEach.call(list.children, function(row, i) {
    row.dataset.idx = i;
    const num = row.querySelector('.tr-essai-num');
    if (num) num.textContent = (i+1);
  });
}

function _collectEssais() {
  const list = document.getElementById('trackEssaisList');
  if (!list) return [];
  const rows = Array.prototype.slice.call(list.children);
  return rows.map(function(row) {
    const data = {};
    row.querySelectorAll('.tr-essai-input').forEach(function(inp) {
      const v = inp.value.trim();
      if (v !== '') data[inp.dataset.key] = parseFloat(v);
    });
    return data;
  }).filter(function(d) { return Object.keys(d).length > 0; });
}

function setRPE(el, val) {
  document.querySelectorAll('#secTrack .rpe-btn').forEach(b => { b.classList.remove('on','high'); });
  el.classList.add(val >= 9 ? 'high' : 'on');
  currentRPE = val;
}

function saveTrack() {
  const sel = document.getElementById('trackExSelect');
  if (!sel.value) {
    if (!window.TEST_MODE) { alert('Choisis un exercice d\'abord.'); return; }
  }
  const type = window._trackType;
  const essais = _collectEssais();
  if (!essais.length && !window.TEST_MODE) { alert('Renseigne au moins un essai.'); return; }

  // Compute best
  let bestTxt = '';
  if (type === 'sprint' && essais.length) {
    const times = essais.map(function(e){ return e.time; }).filter(function(t){ return !isNaN(t); });
    if (times.length) bestTxt = 'Meilleur : ' + Math.min.apply(null, times).toFixed(2) + 's sur ' + times.length + ' essai' + (times.length>1?'s':'');
  } else if (type === 'force' && essais.length) {
    let best = essais[0]; let bestLoad = essais[0].load || 0;
    essais.forEach(function(e){ if ((e.load||0) > bestLoad) { best = e; bestLoad = e.load; } });
    bestTxt = 'Meilleur : ' + (best.load||'—') + 'kg × ' + (best.reps||'—') + ' reps';
  } else if (type === 'saut' && essais.length) {
    const hs = essais.map(function(e){ return e.height; }).filter(function(h){ return !isNaN(h); });
    if (hs.length) bestTxt = 'Meilleur : ' + Math.max.apply(null, hs) + 'cm sur ' + hs.length + ' essai' + (hs.length>1?'s':'');
  }

  const feedbacks = [
    '"Enregistré. Ton système nerveux s\'adapte. Continue."',
    '"C\'est noté. La progression se construit séance après séance."',
    '"Données sauvegardées. Je surveille ta courbe de progression."',
    '"Bien. Chaque rep compte. Ne l\'oublie jamais."'
  ];
  const msg = feedbacks[Math.floor(Math.random() * feedbacks.length)];

  document.getElementById('trackTitanFb').classList.remove('hidden');
  document.getElementById('trackTitanMsg').innerHTML = bestTxt ? (bestTxt + '<br>' + msg) : msg;
  currentRPE = 0;
}

// ══════════════════════════════════
// SÉANCE LIVE
// ══════════════════════════════════

const liveExercises = [
  { name:'Box Jumps', target:'3 séries × 5 reps' },
  { name:'Back Squat', target:'4 séries × 3 reps (85%)' },
  { name:'Pogo Jumps', target:'3 séries × 10 reps' },
  { name:'Sprint 10m', target:'5 passages' }
];

function startLive() {
  document.getElementById('liveStart').classList.add('hidden');
  document.getElementById('liveSession').classList.remove('hidden');
  currentLiveEx = 0;
  liveData = [];
  updateLiveExercise();
}

function updateLiveExercise() {
  const ex = liveExercises[currentLiveEx];
  document.getElementById('liveStep').textContent = `EXERCICE ${currentLiveEx+1} / ${liveExercises.length}`;
  document.getElementById('liveName').textContent = ex.name.toUpperCase();
  document.getElementById('liveTarget').textContent = `Objectif : ${ex.target}`;
  document.getElementById('liveReps').value = '';
  document.getElementById('liveLoad').value = '';
  liveRPE = 0;
  document.querySelectorAll('#liveSession .rpe-btn').forEach(b => b.classList.remove('on','high'));
  resetLiveTimer();
}

function setLiveRPE(el, val) {
  document.querySelectorAll('#liveSession .rpe-btn').forEach(b => b.classList.remove('on','high'));
  el.classList.add(val >= 9 ? 'high' : 'on');
  liveRPE = val;
}

function nextLiveExercise() {
  // Save current exercise data
  liveData.push({
    name: liveExercises[currentLiveEx].name,
    reps: document.getElementById('liveReps').value || '—',
    load: document.getElementById('liveLoad').value || '—',
    rpe: liveRPE || '—'
  });

  currentLiveEx++;
  if (currentLiveEx < liveExercises.length) {
    updateLiveExercise();
  } else {
    showLiveSummary();
  }
}

function showLiveSummary() {
  document.getElementById('liveSession').classList.add('hidden');
  document.getElementById('liveSummary').classList.remove('hidden');

  const list = document.getElementById('summaryList');
  list.innerHTML = '';
  liveData.forEach((d, i) => {
    const loadTxt = d.load !== '—' ? d.load + 'kg' : '';
    const repsTxt = d.reps !== '—' ? d.reps + ' reps' : '';
    const rpeTxt = d.rpe !== '—' ? 'RPE ' + d.rpe : '';
    const parts = [repsTxt, loadTxt, rpeTxt].filter(Boolean).join(' • ');

    list.innerHTML += '<div class="summary-card">'
      + '<div class="sum-num">' + i+1 + '</div>'
      + '<div class="sum-body">'
      + '<div class="sum-name">' + d.name + '</div>'
      + '<div class="sum-data">' + parts || 'Pas de données' + '</div>'
      + '</div>'
      + '</div>';
  });
}

function endLive() {
  const feedback = document.getElementById('sessionFeedback').value;
  const sessionData = { exercises: liveData, feedback, date: new Date().toISOString() };
  console.log('Session to save to Firebase:', sessionData);
  alert('Séance sauvegardée ! 💪');
  document.getElementById('liveStart').classList.remove('hidden');
  document.getElementById('liveSummary').classList.add('hidden');
  currentLiveEx = 0;
  liveData = [];
}

// ── LIVE TIMER ──
function setTimerPreset(el, secs) {
  document.querySelectorAll('.timer-presets .tp').forEach(t => t.classList.remove('on'));
  el.classList.add('on');
  timerTarget = secs;
  timerSeconds = secs;
  timerRunning = false;
  clearInterval(timerInterval);
  document.getElementById('timerBtn').textContent = '▶ START';
  document.getElementById('timerBtn').className = 'timer-btn start';
  updateLiveTimerDisplay();
}

function toggleLiveTimer() {
  const btn = document.getElementById('timerBtn');
  if (timerRunning) {
    clearInterval(timerInterval);
    btn.textContent = '▶ REPRENDRE';
    btn.className = 'timer-btn start';
    timerRunning = false;
  } else {
    timerRunning = true;
    btn.textContent = '⏸ PAUSE';
    btn.className = 'timer-btn pause';
    timerInterval = setInterval(() => {
      timerSeconds--;
      if (timerSeconds <= 0) {
        timerSeconds = 0;
        clearInterval(timerInterval);
        timerRunning = false;
        btn.textContent = '▶ START';
        btn.className = 'timer-btn start';
        if (navigator.vibrate) navigator.vibrate([300,100,300]);
        alert('⏰ Repos terminé ! Au boulot !');
      }
      updateLiveTimerDisplay();
    }, 1000);
  }
}

function resetLiveTimer() {
  clearInterval(timerInterval);
  timerRunning = false;
  timerSeconds = timerTarget;
  document.getElementById('timerBtn').textContent = '▶ START';
  document.getElementById('timerBtn').className = 'timer-btn start';
  updateLiveTimerDisplay();
}

function updateLiveTimerDisplay() {
  const m = Math.floor(timerSeconds / 60);
  const s = timerSeconds % 60;
  document.getElementById('liveTimer').textContent = (m<10?'0':'')+m+':'+(s<10?'0':'')+s;
}

// ══════════════════════════════════
// LIVE SESSION V2 — GBG-style
// ══════════════════════════════════
const lv2CatMap = {
  echauf_gen:{label:'ÉCHAUFF.',cls:'mob'}, echauf_spe:{label:'ÉCHAUFF.',cls:'mob'},
  mobilite:{label:'MOBILITÉ',cls:'mob'}, recup:{label:'RÉCUP',cls:'mob'},
  proprio:{label:'STABILITÉ',cls:'core'}, coord:{label:'COORD',cls:'core'},
  gainage:{label:'CORE',cls:'core'}, abdos:{label:'CORE',cls:'core'},
  force_pdc:{label:'FORCE',cls:'force'}, force_charge:{label:'FORCE',cls:'force'},
  olympiques:{label:'FORCE',cls:'force'}, rotation:{label:'FORCE',cls:'force'},
  plio_ext:{label:'PLIO',cls:'plio'}, plio_int:{label:'PLIO',cls:'plio'},
  pied:{label:'VITESSE',cls:'sprint'}, sprint:{label:'SPRINT',cls:'sprint'},
  multi:{label:'AGILITÉ',cls:'sprint'}, saut:{label:'SAUT',cls:'plio'}
};
let lv2State = null;

function _lv2CatOf(name) {
  for (const k in catData) {
    if (catData[k].some(e => e.name === name)) return lv2CatMap[k] || {label:'EXERCICE', cls:''};
  }
  return {label:'EXERCICE', cls:''};
}

function _lv2ParseRounds(detail) {
  if (!detail) return {rounds:1, durSec:30};
  // "3×30s" → rounds=3, dur=30s
  var mxs = detail.match(/^(\d+)\s*[×x]\s*(\d+)\s*s/i);
  if (mxs) return {rounds:+mxs[1], durSec:+mxs[2]};
  // "3×10", "4×5 (75%)" → rounds=3, dur=30
  var mx = detail.match(/^(\d+)\s*[×x]\s*\d+/);
  if (mx) return {rounds:+mx[1], durSec:30};
  // "5 passages", "10×10m"
  var mp = detail.match(/^(\d+)\s*passages?/);
  if (mp) return {rounds:+mp[1], durSec:8};
  // "15 min", "5 min"
  var mm = detail.match(/^(\d+)\s*min/);
  if (mm) return {rounds:1, durSec:(+mm[1])*60};
  return {rounds:1, durSec:30};
}

function startLiveV2(programKey, phaseIdx) {
  programKey = programKey || (typeof R !== 'undefined' && R.program) || 'ea';
  phaseIdx = (typeof phaseIdx === 'number') ? phaseIdx : 0;
  const prog = progPhases[programKey];
  if (!prog) { alert('Programme inconnu : ' + programKey); return; }
  const exs = prog.phases[phaseIdx] || [];
  if (!exs.length) { alert('Aucun exercice dans cette phase.'); return; }
  lv2State = { exs:exs, idx:0, roundIdx:0, prog:prog, phaseIdx:phaseIdx,
               timer:null, secondsLeft:0, durSec:30, totalRounds:1, running:false };
  document.getElementById('liveStart').classList.add('hidden');
  document.getElementById('liveSession').classList.add('hidden');
  document.getElementById('liveSummary').classList.add('hidden');
  document.getElementById('liveSessionV2').classList.remove('hidden');
  _lv2BuildProgress();
  _lv2Render();
  _lv2StartTimer();
  _lv2BindSwipe();
}

function prevV2() {
  if (!lv2State) return;
  if (lv2State.idx <= 0) return;
  clearInterval(lv2State.timer);
  lv2State.idx--;
  lv2State.roundIdx = 0;
  _lv2Render();
  _lv2StartTimer();
}

// ── SWIPE GESTURE on lv2-content (preview adjacent exercises) ──
function _lv2BindSwipe() {
  const el = document.getElementById('lv2Swipe');
  if (!el || el._lv2Bound) return;
  el._lv2Bound = true;
  let startX = 0, dx = 0, dragging = false, wasRunning = false;
  const threshold = 70;
  const content = document.getElementById('lv2Content');

  function start(x) {
    dragging = true; startX = x; dx = 0;
    wasRunning = lv2State && lv2State.running;
    if (wasRunning) { clearInterval(lv2State.timer); lv2State.running = false; }
    content.style.transition = 'none';
  }
  function move(x) {
    if (!dragging) return;
    dx = x - startX;
    // Resistance at edges
    if ((lv2State && lv2State.idx === 0 && dx > 0) ||
        (lv2State && lv2State.idx === lv2State.exs.length - 1 && dx < 0)) {
      dx = dx * 0.3;
    }
    content.style.transform = 'translateX(' + dx + 'px)';
  }
  function end() {
    if (!dragging) return;
    dragging = false;
    content.style.transition = 'transform .25s ease';
    if (dx <= -threshold && lv2State.idx < lv2State.exs.length - 1) {
      content.style.transform = 'translateX(-100%)';
      setTimeout(function() {
        content.style.transition = 'none';
        content.style.transform = 'translateX(0)';
        nextV2();
      }, 200);
    } else if (dx >= threshold && lv2State.idx > 0) {
      content.style.transform = 'translateX(100%)';
      setTimeout(function() {
        content.style.transition = 'none';
        content.style.transform = 'translateX(0)';
        prevV2();
      }, 200);
    } else {
      content.style.transform = 'translateX(0)';
      if (wasRunning) _lv2StartTimer();
    }
  }
  el.addEventListener('touchstart', function(e) { start(e.touches[0].clientX); }, {passive:true});
  el.addEventListener('touchmove',  function(e) { move(e.touches[0].clientX); },  {passive:true});
  el.addEventListener('touchend',   end);
  el.addEventListener('touchcancel', end);
  // Mouse drag for desktop testing
  el.addEventListener('mousedown', function(e) { start(e.clientX); e.preventDefault(); });
  window.addEventListener('mousemove', function(e) { if (dragging) move(e.clientX); });
  window.addEventListener('mouseup', end);
}

function _lv2BuildProgress() {
  const wrap = document.getElementById('lv2Progress');
  wrap.innerHTML = lv2State.exs.map(function(){ return '<div class="lv2-pseg"></div>'; }).join('');
}

function _lv2UpdateProgress() {
  const segs = document.querySelectorAll('#lv2Progress .lv2-pseg');
  segs.forEach(function(s, i) {
    s.classList.remove('done', 'cur');
    if (i < lv2State.idx) s.classList.add('done');
    else if (i === lv2State.idx) s.classList.add('cur');
  });
}

function _lv2Render() {
  const ex = lv2State.exs[lv2State.idx];
  const next = lv2State.exs[lv2State.idx + 1];
  const cat = _lv2CatOf(ex.name);
  const parsed = _lv2ParseRounds(ex.detail);
  lv2State.totalRounds = parsed.rounds;
  lv2State.durSec = parsed.durSec;

  const catEl = document.getElementById('lv2Cat');
  catEl.textContent = cat.label;
  catEl.className = 'lv2-cat ' + cat.cls;

  document.getElementById('lv2Title').textContent = ex.name.toUpperCase();
  document.getElementById('lv2TagCircuit').textContent = (ex.detail || '').toUpperCase() || 'EXERCICE';
  document.getElementById('lv2TagRound').textContent = 'ROUND ' + (lv2State.roundIdx + 1) + '/' + parsed.rounds;
  document.getElementById('lv2NextName').textContent = next ? next.name : 'Récap séance';
  document.getElementById('lv2Side').classList.add('hidden');
  const counter = document.getElementById('lv2Counter');
  if (counter) counter.textContent = (lv2State.idx + 1) + ' / ' + lv2State.exs.length;
  const prevBtn = document.getElementById('lv2PrevBtn');
  const nextArr = document.getElementById('lv2NextArrow');
  if (prevBtn) prevBtn.style.opacity = (lv2State.idx === 0) ? '.25' : '1';
  if (nextArr) nextArr.style.opacity = (lv2State.idx === lv2State.exs.length - 1) ? '.25' : '1';
  _lv2UpdateProgress();
  _lv2SetTimer(parsed.durSec);
}

function _lv2SetTimer(secs) {
  lv2State.secondsLeft = secs;
  _lv2RenderTimer();
}

function _lv2RenderTimer() {
  const m = Math.floor(lv2State.secondsLeft / 60);
  const s = lv2State.secondsLeft % 60;
  document.getElementById('lv2Timer').textContent = (m<10?'0':'') + m + ':' + (s<10?'0':'') + s;
  const el = document.getElementById('lv2Timer');
  if (lv2State.secondsLeft <= 5 && lv2State.secondsLeft > 0) el.classList.add('warn');
  else el.classList.remove('warn');
}

function _lv2StartTimer() {
  clearInterval(lv2State.timer);
  lv2State.running = true;
  document.getElementById('lv2PauseBtn').textContent = '⏸';
  lv2State.timer = setInterval(function() {
    lv2State.secondsLeft--;
    if (lv2State.secondsLeft <= 0) {
      lv2State.secondsLeft = 0;
      _lv2RenderTimer();
      clearInterval(lv2State.timer);
      lv2State.running = false;
      if (navigator.vibrate) navigator.vibrate([200, 80, 200]);
      _lv2RoundDone();
      return;
    }
    _lv2RenderTimer();
  }, 1000);
}

function toggleLv2Pause() {
  if (!lv2State) return;
  if (lv2State.running) {
    clearInterval(lv2State.timer);
    lv2State.running = false;
    document.getElementById('lv2PauseBtn').textContent = '▶';
  } else {
    _lv2StartTimer();
  }
}

function _lv2RoundDone() {
  if (lv2State.roundIdx + 1 < lv2State.totalRounds) {
    lv2State.roundIdx++;
    document.getElementById('lv2TagRound').textContent = 'ROUND ' + (lv2State.roundIdx + 1) + '/' + lv2State.totalRounds;
    _lv2SetTimer(lv2State.durSec);
    _lv2StartTimer();
  } else {
    nextV2();
  }
}

function nextV2() {
  if (!lv2State) return;
  clearInterval(lv2State.timer);
  if (lv2State.idx + 1 < lv2State.exs.length) {
    lv2State.idx++;
    lv2State.roundIdx = 0;
    _lv2Render();
    _lv2StartTimer();
  } else {
    exitLiveV2(true);
  }
}

function exitLiveV2(finished) {
  if (lv2State) clearInterval(lv2State.timer);
  document.getElementById('liveSessionV2').classList.add('hidden');
  if (finished && lv2State) {
    liveData = lv2State.exs.map(function(e){ return {name:e.name, reps:e.detail || '—', load:'—', rpe:'—'}; });
    document.getElementById('liveSummary').classList.remove('hidden');
    const list = document.getElementById('summaryList');
    list.innerHTML = '';
    liveData.forEach(function(d, i) {
      list.innerHTML += '<div class="summary-card"><div class="sum-num">' + (i+1) + '</div>'
        + '<div class="sum-body"><div class="sum-name">' + d.name + '</div>'
        + '<div class="sum-data">' + (d.reps !== '—' ? d.reps : 'Terminé') + '</div></div></div>';
    });
  } else {
    document.getElementById('liveStart').classList.remove('hidden');
  }
  lv2State = null;
}

const catData={echauf_gen:[{name:'Jumping Jacks',diff:'easy',muscles:['Cardio','Full body'],desc:'Élever la température corporelle.'},{name:'Course sur place',diff:'easy',muscles:['Cardio','Jambes'],desc:'Montée de genoux progressive.'},{name:'Rotations articulaires',diff:'easy',muscles:['Mobilité'],desc:'Rotations lentes.'},{name:'Skip A',diff:'easy',muscles:['Jambes','Coordination'],desc:'Montée de genoux dynamique.'}],echauf_spe:[{name:'Activation fessiers',diff:'easy',muscles:['Fessiers'],desc:'Réveiller les fessiers.'},{name:'Marche latérale élastique',diff:'med',muscles:['Abducteurs'],desc:'Pas latéraux avec élastique.'},{name:'Squat progressif',diff:'easy',muscles:['Quadriceps'],desc:'Squats légers progressifs.'}],mobilite:[{name:'Dorsiflexion cheville',diff:'easy',muscles:['Chevilles'],desc:'Essentiel avant tout saut.'},{name:'90/90 Stretch',diff:'med',muscles:['Hanches'],desc:'Rotations de hanche.'},{name:"World's Greatest Stretch",diff:'med',muscles:['Full body'],desc:'Le stretch le plus complet.'}],recup:[{name:'Foam Rolling Quadriceps',diff:'easy',muscles:['Quadriceps'],desc:'Auto-massage rouleau.'}],proprio:[{name:'Équilibre unipodal',diff:'easy',muscles:['Chevilles','Core'],desc:'Équilibre sur un pied.'}],coord:[{name:'Échelle de rythme',diff:'med',muscles:['Coordination'],desc:'Vitesse des appuis.'}],gainage:[{name:'Planche frontale',diff:'easy',muscles:['Core'],desc:'Gainage statique.'}],abdos:[{name:'V-Ups',diff:'med',muscles:['Abdos'],desc:'Relevé simultané.'}],force_pdc:[{name:'Pompes explosives',diff:'med',muscles:['Pectoraux','Triceps'],desc:'Mains décollent du sol.'}],force_charge:[{name:'Back Squat',diff:'hard',muscles:['Quadriceps','Fessiers','Lombaires'],desc:'Le mouvement roi pour la force.'},{name:'Soulevé de terre',diff:'hard',muscles:['Chaîne postérieure'],desc:'Puissance chaîne postérieure.'},{name:'Hip Thrust',diff:'med',muscles:['Fessiers'],desc:'Extension de hanche explosive.'},{name:'Développé couché',diff:'med',muscles:['Pectoraux','Épaules'],desc:'Force haut du corps.'}],rotation:[{name:'Med Ball Rotational Throw',diff:'med',muscles:['Obliques'],desc:'Lancer rotatif.'}],olympiques:[{name:'Power Clean',diff:'hard',muscles:['Full body'],desc:'Triple extension complète.'}],plio_ext:[{name:'Pogo Jumps',diff:'easy',muscles:['Mollets'],desc:'Réactivité tendon d\'Achille.'},{name:'Squat Jump',diff:'med',muscles:['Quadriceps'],desc:'Puissance concentrique.'}],plio_int:[{name:'Depth Jump',diff:'hard',muscles:['Full body'],desc:'Plus fort impact sur le RFD.'},{name:'Box Jump Max',diff:'hard',muscles:['Explosivité'],desc:'Saut box hauteur max.'}],pied:[{name:'Ankling',diff:'easy',muscles:['Chevilles'],desc:'Rigidité cheville.'}],sprint:[{name:'Sprint 10m',diff:'med',muscles:['Quadriceps'],desc:'Phase de démarrage.'},{name:'Sprint 30m',diff:'med',muscles:['Full body'],desc:'Vitesse de pointe.'},{name:'Sprint 60m',diff:'hard',muscles:['Full body'],desc:'Sprint complet.'}],multi:[{name:'Navette 5-10-5',diff:'med',muscles:['Agilité'],desc:'Changements de direction.'}],saut:[{name:'Counter Movement Jump',diff:'easy',muscles:['Quadriceps','Fessiers'],desc:'Test de référence détente.'},{name:'Approach Jump',diff:'med',muscles:['Full body'],desc:'Saut avec élan.'},{name:'Single Leg Bound',diff:'hard',muscles:['Équilibre'],desc:'Bond unilatéral.'}]};
const progPhases={ea:{name:'ELITE ATHLETE',obj:'Explosivité globale',phases:[[{name:'Échauffement',detail:'5 min'},{name:'Activation fessiers',detail:'2×12'},{name:'Squat progressif',detail:'3×8 (60%)'},{name:'Pogo Jumps',detail:'3×10'},{name:'Sprint 10m',detail:'5 passages'},{name:'Planche',detail:'3×30s'}],[{name:'Back Squat',detail:'4×5 (75%)'},{name:'Box Jump',detail:'4×5'},{name:'Hip Thrust',detail:'3×8 (70%)'},{name:'Sprint 30m',detail:'4 passages'},{name:'Depth Jump',detail:'3×3'}],[{name:'Power Clean',detail:'5×3 (85%)'},{name:'Back Squat',detail:'5×3 (85%)'},{name:'Depth Jump',detail:'4×3'},{name:'Sprint 60m',detail:'3 passages'},{name:'Box Jump Max',detail:'3×3'}]]},vd:{name:'VERTICAL DUNK',obj:'Dunker + Détente max',phases:[[{name:'CMJ',detail:'5×3'},{name:'Squat Jump',detail:'4×5'},{name:'Pogo Jumps',detail:'3×15'}],[{name:'Depth Jump',detail:'4×3'},{name:'Back Squat',detail:'4×5 (80%)'},{name:'Approach Jump',detail:'5×3'}],[{name:'Box Jump Max',detail:'5×2'},{name:'Single Leg Bound',detail:'3×5/jambe'},{name:'Sprint 10m',detail:'6 passages'}]]},mt:{name:'MICROTRAINING',obj:'Discipline et habitudes',phases:[[{name:'Squat Jump',detail:'3×5'},{name:'Pompes explosives',detail:'3×8'},{name:'Planche',detail:'3×30s'}],[{name:'Pogo Jumps',detail:'3×10'},{name:'V-Ups',detail:'3×12'},{name:'Skip A',detail:'3×15'}],[{name:'Box Jump',detail:'3×5'},{name:'Sprint 10m',detail:'4 passages'}]]},tri:{name:'TRIPHASIQUE',obj:'Force sans salle',phases:[[{name:'Squat PDC',detail:'4×15'},{name:'Fentes',detail:'3×10/jambe'},{name:'Pompes',detail:'4×12'}],[{name:'Squat Jump',detail:'4×8'},{name:'Single Leg Bound',detail:'3×6/jambe'}],[{name:'Pogo Jumps',detail:'4×12'},{name:'Sprint 10m',detail:'5 passages'}]]},se:{name:'SHRED EXPLOSE',obj:'Perdre + Exploser',phases:[[{name:'Circuit cardio',detail:'15 min'},{name:'Squat',detail:'3×12'},{name:'Pogo Jumps',detail:'3×15'}],[{name:'HIIT Sprint',detail:'10×10m'},{name:'Back Squat',detail:'4×8 (65%)'},{name:'Box Jump',detail:'3×8'}],[{name:'Sprint 30m',detail:'6 passages'},{name:'Depth Jump',detail:'3×3'}]]},ep:{name:'EXPLOSE+',obj:'Transformation totale',phases:[[{name:'Questionnaire MENER',detail:'Identifier pilier faible'},{name:'15 engagements',detail:'4 semaines'}],[{name:'Back Squat',detail:'5×5 (80%)'},{name:'Power Clean',detail:'4×3'},{name:'Sprint 30m',detail:'5 passages'}],[{name:'Depth Jump',detail:'5×3'},{name:'Back Squat',detail:'5×3 (90%)'},{name:'Sprint 60m',detail:'4 passages'}]]}};
function showPg(id){document.querySelectorAll('.pg').forEach(p=>p.classList.remove('on'));document.querySelectorAll('.sub-tab').forEach(t=>t.classList.remove('on'));({lib:'pgLib',prog:'pgProg',builder:'pgBuilder'})[id]&&document.getElementById(({lib:'pgLib',prog:'pgProg',builder:'pgBuilder'})[id]).classList.add('on');event.currentTarget.classList.add('on');var __v=document.getElementById('vTrain');if(__v)__v.scrollTop=0;if(id==='lib'){closeCat();closeDetail()}if(id==='prog')closeProg()}
function openCat(n,ic,k){currentCat=n;currentCatData=catData[k]||[];document.getElementById('catTitle').textContent=ic+' '+n.toUpperCase();document.getElementById('libGrid').classList.add('hidden');document.getElementById('libCatView').classList.remove('hidden');document.getElementById('libDetailView').classList.add('hidden');currentFilter='all';renderCatEx();var __v=document.getElementById('vTrain');if(__v)__v.scrollTop=0}
function closeCat(){document.getElementById('libGrid').classList.remove('hidden');document.getElementById('libCatView').classList.add('hidden');document.getElementById('libDetailView').classList.add('hidden')}
function filterCat(el,lv){document.querySelectorAll('.filter-row .fc').forEach(f=>f.classList.remove('on'));el.classList.add('on');currentFilter=lv;renderCatEx()}
function renderCatEx(){const l=document.getElementById('catExList');l.innerHTML='';const d=currentFilter==='all'?currentCatData:currentCatData.filter(e=>e.diff===currentFilter);if(!d.length){l.innerHTML='<div style="text-align:center;padding:30px;color:var(--muted)">Aucun exercice.</div>';return}d.forEach(ex=>{const dl=ex.diff==='easy'?'Débutant':ex.diff==='med'?'Intermédiaire':'Avancé';l.innerHTML+=`<div class="ex-card" onclick="openDetail('${ex.name.replace(/'/g,"\\'")}')"><div class="ex-thumb"><div class="ex-thumb-play">▶</div></div><div class="ex-body"><div class="ex-name">${ex.name}</div><div class="ex-diff ${ex.diff}">${dl}</div></div></div>`})}
function openDetail(n){const ex=Object.values(catData).flat().find(e=>e.name===n);if(!ex)return;document.getElementById('detailName').textContent=ex.name.toUpperCase();const dl=ex.diff==='easy'?'Débutant':ex.diff==='med'?'Intermédiaire':'Avancé';const d=document.getElementById('detailDiff');d.textContent=dl;d.className='detail-diff '+ex.diff;document.getElementById('detailDesc').textContent=ex.desc;document.getElementById('detailTags').innerHTML=(ex.muscles||[]).map(m=>`<div class="tag">${m}</div>`).join('');document.getElementById('libCatView').classList.add('hidden');document.getElementById('libDetailView').classList.remove('hidden');var __v=document.getElementById('vTrain');if(__v)__v.scrollTop=0}
function closeDetail(){document.getElementById('libDetailView').classList.add('hidden');if(currentCat)document.getElementById('libCatView').classList.remove('hidden')}
function filterLib(){ renderLibrary(); }

// ══════════════════════════════════
// LIBRARY SMART FILTERS — effort type + equipment, OR logic
// ══════════════════════════════════
const LIB_EFFORT = [
  { key:'prep',    label:'Préparation', cats:['echauf_gen','echauf_spe'] },
  { key:'mob',     label:'Mobilité',    cats:['mobilite','recup'] },
  { key:'stab',    label:'Stabilité',   cats:['proprio','coord','gainage','abdos'] },
  { key:'force',   label:'Force',       cats:['force_pdc','force_charge','rotation','olympiques'] },
  { key:'plio',    label:'Explosivité', cats:['plio_ext','plio_int'] },
  { key:'speed',   label:'Vitesse',     cats:['pied','sprint','multi','saut'] }
];
const LIB_EQUIP = [
  { key:'pdc',      label:'PDC / Aucun'  },
  { key:'barre',    label:'Barre'        },
  { key:'haltere',  label:'Haltères'     },
  { key:'box',      label:'Box / Plinth' },
  { key:'elastique',label:'Élastique'    },
  { key:'medball',  label:'Med Ball'     }
];
// Equipment inferred from category + name
const LIB_EQUIP_BY_CAT = {
  echauf_gen:['pdc'], echauf_spe:['pdc','elastique'],
  mobilite:['pdc'], recup:['pdc'],
  proprio:['pdc'], coord:['pdc'], gainage:['pdc'], abdos:['pdc'],
  force_pdc:['pdc'],
  force_charge:['barre','haltere'],
  rotation:['medball','haltere'],
  olympiques:['barre'],
  plio_ext:['pdc'], plio_int:['box','pdc'],
  pied:['pdc'], sprint:['pdc'], multi:['pdc'], saut:['pdc','box']
};
function _libEquipOf(name, catKey) {
  if (!catKey) {
    // Look up category
    for (const k in catData) if (catData[k].some(e => e.name === name)) { catKey = k; break; }
  }
  let base = LIB_EQUIP_BY_CAT[catKey] ? LIB_EQUIP_BY_CAT[catKey].slice() : ['pdc'];
  const lower = (name || '').toLowerCase();
  if (lower.indexOf('élastique') >= 0) base.push('elastique');
  if (lower.indexOf('med ball') >= 0)  base.push('medball');
  if (lower.indexOf('box jump') >= 0 || lower.indexOf('depth jump') >= 0) base.push('box');
  return Array.from(new Set(base));
}
function _libCatKeyOf(name) {
  for (const k in catData) if (catData[k].some(e => e.name === name)) return k;
  return null;
}
function _libEffortKeyOf(catKey) {
  for (let i = 0; i < LIB_EFFORT.length; i++) {
    if (LIB_EFFORT[i].cats.indexOf(catKey) >= 0) return LIB_EFFORT[i].key;
  }
  return null;
}

const libFilters = { effort: new Set(), equip: new Set() };

function _initLibFilters() {
  const eEffort = document.getElementById('libChipsEffort');
  const eEquip  = document.getElementById('libChipsEquip');
  if (!eEffort || eEffort.dataset.init) return;
  eEffort.innerHTML = LIB_EFFORT.map(function(t){
    return '<button type="button" class="lib-chip" data-grp="effort" data-key="'+t.key+'" onclick="toggleLibFilter(\'effort\',\''+t.key+'\',this)">'+t.label+'</button>';
  }).join('');
  eEquip.innerHTML = LIB_EQUIP.map(function(t){
    return '<button type="button" class="lib-chip" data-grp="equip" data-key="'+t.key+'" onclick="toggleLibFilter(\'equip\',\''+t.key+'\',this)">'+t.label+'</button>';
  }).join('');
  eEffort.dataset.init = '1';
}

function toggleLibFilter(grp, key, btn) {
  const set = libFilters[grp];
  if (set.has(key)) { set.delete(key); btn.classList.remove('on'); }
  else { set.add(key); btn.classList.add('on'); }
  renderLibrary();
}

function clearLibFilters() {
  libFilters.effort.clear();
  libFilters.equip.clear();
  document.querySelectorAll('#libFilters .lib-chip').forEach(function(c){ c.classList.remove('on'); });
  const s = document.getElementById('libSearch'); if (s) s.value = '';
  renderLibrary();
}

function renderLibrary() {
  _initLibFilters();
  const q = (document.getElementById('libSearch').value || '').toLowerCase().trim();
  const hasFilters = libFilters.effort.size > 0 || libFilters.equip.size > 0;
  const hasSearch  = q.length >= 2;
  const countEl = document.getElementById('libFilterCount');
  const total = libFilters.effort.size + libFilters.equip.size;
  if (countEl) countEl.textContent = total ? (total + ' filtre' + (total>1?'s':'') + ' actif' + (total>1?'s':'')) : 'Aucun filtre actif';

  const grid = document.getElementById('libGrid');
  const results = document.getElementById('libResults');
  if (!hasFilters && !hasSearch) {
    grid.classList.remove('hidden');
    results.classList.add('hidden');
    return;
  }
  // Build flat list with OR logic
  const all = [];
  for (const k in catData) {
    catData[k].forEach(function(e) { all.push({ ex:e, catKey:k }); });
  }
  const matched = all.filter(function(it) {
    const effortKey = _libEffortKeyOf(it.catKey);
    const equipKeys = _libEquipOf(it.ex.name, it.catKey);
    let match = false;
    // OR logic: any active filter that matches → include
    if (libFilters.effort.size && libFilters.effort.has(effortKey)) match = true;
    if (libFilters.equip.size) {
      for (const eq of equipKeys) if (libFilters.equip.has(eq)) { match = true; break; }
    }
    if (!hasFilters) match = true;
    if (hasSearch && match) match = it.ex.name.toLowerCase().indexOf(q) >= 0;
    if (hasSearch && !hasFilters) match = it.ex.name.toLowerCase().indexOf(q) >= 0;
    return match;
  });

  grid.classList.add('hidden');
  results.classList.remove('hidden');
  if (!matched.length) {
    results.innerHTML = '<div style="text-align:center;padding:30px;color:var(--muted)">Aucun exercice ne correspond.</div>';
    return;
  }
  results.innerHTML = '<div class="lib-results-head">'+matched.length+' exercice'+(matched.length>1?'s':'')+'</div>' +
    matched.map(function(it){
      const ex = it.ex;
      const dl = ex.diff==='easy'?'Débutant':ex.diff==='med'?'Intermédiaire':'Avancé';
      const safe = ex.name.replace(/'/g,"\\'");
      return '<div class="ex-card" onclick="openDetail(\''+safe+'\')">'
        + '<div class="ex-thumb"><div class="ex-thumb-play">▶</div></div>'
        + '<div class="ex-body"><div class="ex-name">'+ex.name+'</div>'
        + '<div class="ex-diff '+ex.diff+'">'+dl+'</div></div>'
        + '</div>';
    }).join('');
}
function openProg(k){
  // Gate: must have completed SAT (test) or have test mode active
  if (!window.TEST_MODE && typeof user !== 'undefined' && !user.satDone) {
    showSATGate(k);
    return;
  }
  currentProgKey=k;const p=progPhases[k];if(!p)return;document.getElementById('progList').classList.add('hidden');document.getElementById('progDetail').classList.remove('hidden');document.getElementById('progDetailName').textContent=p.name;document.getElementById('progDetailObj').textContent=p.obj;document.querySelectorAll('.phase-tab').forEach((t,i)=>t.classList.toggle('on',i===0));renderPhase(p.phases[0]);var __v=document.getElementById('vTrain');if(__v)__v.scrollTop=0
}
function showSATGate(programKey) {
  // Build / reuse a SAT-gate modal
  var modal = document.getElementById('satGateModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'satGateModal';
    modal.className = 'sat-gate-modal';
    modal.innerHTML =
      '<div class="sat-gate-inner">'
      + '<div class="sat-gate-icon">🔒</div>'
      + '<div class="sat-gate-title">PROGRAMME VERROUILLÉ</div>'
      + '<div class="sat-gate-msg">Sans tes données SAT, Titan ne peut pas adapter ce programme à ton niveau. Fais le test d\'abord — c\'est non négociable.</div>'
      + '<button class="sat-gate-cta" onclick="closeSATGate(true)">Faire le SAT maintenant →</button>'
      + '<button class="sat-gate-close" onclick="closeSATGate(false)">Annuler</button>'
      + '</div>';
    document.body.appendChild(modal);
  }
  modal.dataset.program = programKey || '';
  modal.classList.add('on');
}
function closeSATGate(goSat) {
  var modal = document.getElementById('satGateModal');
  if (modal) modal.classList.remove('on');
  if (goSat) {
    // Switch to Tracks > SAT
    if (typeof switchTab === 'function') switchTab('tracks');
    if (typeof showSec === 'function') {
      setTimeout(function(){
        var satTab = document.querySelector('#vTracks .sub-tab');
        if (satTab) showSec('sat', satTab);
      }, 100);
    }
  }
}
function closeProg(){document.getElementById('progList').classList.remove('hidden');document.getElementById('progDetail').classList.add('hidden')}
function switchPhase(el,i){document.querySelectorAll('.phase-tab').forEach(t=>t.classList.remove('on'));el.classList.add('on');if(currentProgKey)renderPhase(progPhases[currentProgKey].phases[i]||[])}
function renderPhase(exs){const l=document.getElementById('phaseExList');l.innerHTML='';exs.forEach((ex,i)=>{l.innerHTML+=`<div class="phase-ex"><div class="pe-num">${i+1}</div><div class="pe-body"><div class="pe-name">${ex.name}</div><div class="pe-detail">${ex.detail}</div></div><div class="pe-video" onclick="alert('Vidéo YouTube')">▶</div></div>`})}

