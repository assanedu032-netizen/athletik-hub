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

  let html = '';
  if (type === 'force') {
    html = '<div class="fi-row">'
      + '<div class="fg"><label class="fl">Poids</label><input class="fi" type="number" id="tVal1" placeholder="100"></div>'
      + '<div class="fi-unit">kg</div>'
      + '</div>'
      + '<div class="fi-row">'
      + '<div class="fg"><label class="fl">Reps</label><input class="fi" type="number" id="tVal2" placeholder="5"></div>'
      + '<div class="fi-unit">reps</div>'
      + '</div>';
    document.getElementById('trackLast').textContent = '95kg × 5 reps • RPE 7';
  } else if (type === 'sprint') {
    html = '<div class="fi-row">'
      + '<div class="fg"><label class="fl">Temps</label><input class="fi" type="number" id="tVal1" step="0.01" placeholder="4.20"></div>'
      + '<div class="fi-unit">sec</div>'
      + '</div>';
    document.getElementById('trackLast').textContent = '4.35s';
  } else if (type === 'saut') {
    html = '<div class="fi-row">'
      + '<div class="fg"><label class="fl">Hauteur</label><input class="fi" type="number" id="tVal1" placeholder="60"></div>'
      + '<div class="fi-unit">cm</div>'
      + '</div>'
      + '<div class="fi-row">'
      + '<div class="fg"><label class="fl">Reps</label><input class="fi" type="number" id="tVal2" placeholder="3"></div>'
      + '<div class="fi-unit">reps</div>'
      + '</div>';
    document.getElementById('trackLast').textContent = '55cm × 3 reps';
  }
  fields.innerHTML = html;
}

function setRPE(el, val) {
  document.querySelectorAll('#secTrack .rpe-btn').forEach(b => { b.classList.remove('on','high'); });
  el.classList.add(val >= 9 ? 'high' : 'on');
  currentRPE = val;
}

function saveTrack() {
  const sel = document.getElementById('trackExSelect');
  if (!sel.value) { alert('Choisis un exercice d\'abord.'); return; }

  const feedbacks = [
    '"Enregistré. Ton système nerveux s\'adapte. Continue."',
    '"C\'est noté. La progression se construit séance après séance."',
    '"Données sauvegardées. Je surveille ta courbe de progression."',
    '"Bien. Chaque rep compte. Ne l\'oublie jamais."'
  ];
  const msg = feedbacks[Math.floor(Math.random() * feedbacks.length)];

  document.getElementById('trackTitanFb').classList.remove('hidden');
  document.getElementById('trackTitanMsg').innerHTML = msg;
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

const catData={echauf_gen:[{name:'Jumping Jacks',diff:'easy',muscles:['Cardio','Full body'],desc:'Élever la température corporelle.'},{name:'Course sur place',diff:'easy',muscles:['Cardio','Jambes'],desc:'Montée de genoux progressive.'},{name:'Rotations articulaires',diff:'easy',muscles:['Mobilité'],desc:'Rotations lentes.'},{name:'Skip A',diff:'easy',muscles:['Jambes','Coordination'],desc:'Montée de genoux dynamique.'}],echauf_spe:[{name:'Activation fessiers',diff:'easy',muscles:['Fessiers'],desc:'Réveiller les fessiers.'},{name:'Marche latérale élastique',diff:'med',muscles:['Abducteurs'],desc:'Pas latéraux avec élastique.'},{name:'Squat progressif',diff:'easy',muscles:['Quadriceps'],desc:'Squats légers progressifs.'}],mobilite:[{name:'Dorsiflexion cheville',diff:'easy',muscles:['Chevilles'],desc:'Essentiel avant tout saut.'},{name:'90/90 Stretch',diff:'med',muscles:['Hanches'],desc:'Rotations de hanche.'},{name:"World's Greatest Stretch",diff:'med',muscles:['Full body'],desc:'Le stretch le plus complet.'}],recup:[{name:'Foam Rolling Quadriceps',diff:'easy',muscles:['Quadriceps'],desc:'Auto-massage rouleau.'}],proprio:[{name:'Équilibre unipodal',diff:'easy',muscles:['Chevilles','Core'],desc:'Équilibre sur un pied.'}],coord:[{name:'Échelle de rythme',diff:'med',muscles:['Coordination'],desc:'Vitesse des appuis.'}],gainage:[{name:'Planche frontale',diff:'easy',muscles:['Core'],desc:'Gainage statique.'}],abdos:[{name:'V-Ups',diff:'med',muscles:['Abdos'],desc:'Relevé simultané.'}],force_pdc:[{name:'Pompes explosives',diff:'med',muscles:['Pectoraux','Triceps'],desc:'Mains décollent du sol.'}],force_charge:[{name:'Back Squat',diff:'hard',muscles:['Quadriceps','Fessiers','Lombaires'],desc:'Le mouvement roi pour la force.'},{name:'Soulevé de terre',diff:'hard',muscles:['Chaîne postérieure'],desc:'Puissance chaîne postérieure.'},{name:'Hip Thrust',diff:'med',muscles:['Fessiers'],desc:'Extension de hanche explosive.'},{name:'Développé couché',diff:'med',muscles:['Pectoraux','Épaules'],desc:'Force haut du corps.'}],rotation:[{name:'Med Ball Rotational Throw',diff:'med',muscles:['Obliques'],desc:'Lancer rotatif.'}],olympiques:[{name:'Power Clean',diff:'hard',muscles:['Full body'],desc:'Triple extension complète.'}],plio_ext:[{name:'Pogo Jumps',diff:'easy',muscles:['Mollets'],desc:'Réactivité tendon d\'Achille.'},{name:'Squat Jump',diff:'med',muscles:['Quadriceps'],desc:'Puissance concentrique.'}],plio_int:[{name:'Depth Jump',diff:'hard',muscles:['Full body'],desc:'Plus fort impact sur le RFD.'},{name:'Box Jump Max',diff:'hard',muscles:['Explosivité'],desc:'Saut box hauteur max.'}],pied:[{name:'Ankling',diff:'easy',muscles:['Chevilles'],desc:'Rigidité cheville.'}],sprint:[{name:'Sprint 10m',diff:'med',muscles:['Quadriceps'],desc:'Phase de démarrage.'},{name:'Sprint 30m',diff:'med',muscles:['Full body'],desc:'Vitesse de pointe.'},{name:'Sprint 60m',diff:'hard',muscles:['Full body'],desc:'Sprint complet.'}],multi:[{name:'Navette 5-10-5',diff:'med',muscles:['Agilité'],desc:'Changements de direction.'}],saut:[{name:'Counter Movement Jump',diff:'easy',muscles:['Quadriceps','Fessiers'],desc:'Test de référence détente.'},{name:'Approach Jump',diff:'med',muscles:['Full body'],desc:'Saut avec élan.'},{name:'Single Leg Bound',diff:'hard',muscles:['Équilibre'],desc:'Bond unilatéral.'}]};
const progPhases={ea:{name:'ELITE ATHLETE',obj:'Explosivité globale',phases:[[{name:'Échauffement',detail:'5 min'},{name:'Activation fessiers',detail:'2×12'},{name:'Squat progressif',detail:'3×8 (60%)'},{name:'Pogo Jumps',detail:'3×10'},{name:'Sprint 10m',detail:'5 passages'},{name:'Planche',detail:'3×30s'}],[{name:'Back Squat',detail:'4×5 (75%)'},{name:'Box Jump',detail:'4×5'},{name:'Hip Thrust',detail:'3×8 (70%)'},{name:'Sprint 30m',detail:'4 passages'},{name:'Depth Jump',detail:'3×3'}],[{name:'Power Clean',detail:'5×3 (85%)'},{name:'Back Squat',detail:'5×3 (85%)'},{name:'Depth Jump',detail:'4×3'},{name:'Sprint 60m',detail:'3 passages'},{name:'Box Jump Max',detail:'3×3'}]]},vd:{name:'VERTICAL DUNK',obj:'Dunker + Détente max',phases:[[{name:'CMJ',detail:'5×3'},{name:'Squat Jump',detail:'4×5'},{name:'Pogo Jumps',detail:'3×15'}],[{name:'Depth Jump',detail:'4×3'},{name:'Back Squat',detail:'4×5 (80%)'},{name:'Approach Jump',detail:'5×3'}],[{name:'Box Jump Max',detail:'5×2'},{name:'Single Leg Bound',detail:'3×5/jambe'},{name:'Sprint 10m',detail:'6 passages'}]]},mt:{name:'MICROTRAINING',obj:'Discipline et habitudes',phases:[[{name:'Squat Jump',detail:'3×5'},{name:'Pompes explosives',detail:'3×8'},{name:'Planche',detail:'3×30s'}],[{name:'Pogo Jumps',detail:'3×10'},{name:'V-Ups',detail:'3×12'},{name:'Skip A',detail:'3×15'}],[{name:'Box Jump',detail:'3×5'},{name:'Sprint 10m',detail:'4 passages'}]]},tri:{name:'TRIPHASIQUE',obj:'Force sans salle',phases:[[{name:'Squat PDC',detail:'4×15'},{name:'Fentes',detail:'3×10/jambe'},{name:'Pompes',detail:'4×12'}],[{name:'Squat Jump',detail:'4×8'},{name:'Single Leg Bound',detail:'3×6/jambe'}],[{name:'Pogo Jumps',detail:'4×12'},{name:'Sprint 10m',detail:'5 passages'}]]},se:{name:'SHRED EXPLOSE',obj:'Perdre + Exploser',phases:[[{name:'Circuit cardio',detail:'15 min'},{name:'Squat',detail:'3×12'},{name:'Pogo Jumps',detail:'3×15'}],[{name:'HIIT Sprint',detail:'10×10m'},{name:'Back Squat',detail:'4×8 (65%)'},{name:'Box Jump',detail:'3×8'}],[{name:'Sprint 30m',detail:'6 passages'},{name:'Depth Jump',detail:'3×3'}]]},ep:{name:'EXPLOSE+',obj:'Transformation totale',phases:[[{name:'Questionnaire MENER',detail:'Identifier pilier faible'},{name:'15 engagements',detail:'4 semaines'}],[{name:'Back Squat',detail:'5×5 (80%)'},{name:'Power Clean',detail:'4×3'},{name:'Sprint 30m',detail:'5 passages'}],[{name:'Depth Jump',detail:'5×3'},{name:'Back Squat',detail:'5×3 (90%)'},{name:'Sprint 60m',detail:'4 passages'}]]}};
function showPg(id){document.querySelectorAll('.pg').forEach(p=>p.classList.remove('on'));document.querySelectorAll('.sub-tab').forEach(t=>t.classList.remove('on'));({lib:'pgLib',prog:'pgProg',builder:'pgBuilder'})[id]&&document.getElementById(({lib:'pgLib',prog:'pgProg',builder:'pgBuilder'})[id]).classList.add('on');event.currentTarget.classList.add('on');var __v=document.getElementById('vTrain');if(__v)__v.scrollTop=0;if(id==='lib'){closeCat();closeDetail()}if(id==='prog')closeProg()}
function openCat(n,ic,k){currentCat=n;currentCatData=catData[k]||[];document.getElementById('catTitle').textContent=ic+' '+n.toUpperCase();document.getElementById('libGrid').classList.add('hidden');document.getElementById('libCatView').classList.remove('hidden');document.getElementById('libDetailView').classList.add('hidden');currentFilter='all';renderCatEx();var __v=document.getElementById('vTrain');if(__v)__v.scrollTop=0}
function closeCat(){document.getElementById('libGrid').classList.remove('hidden');document.getElementById('libCatView').classList.add('hidden');document.getElementById('libDetailView').classList.add('hidden')}
function filterCat(el,lv){document.querySelectorAll('.filter-row .fc').forEach(f=>f.classList.remove('on'));el.classList.add('on');currentFilter=lv;renderCatEx()}
function renderCatEx(){const l=document.getElementById('catExList');l.innerHTML='';const d=currentFilter==='all'?currentCatData:currentCatData.filter(e=>e.diff===currentFilter);if(!d.length){l.innerHTML='<div style="text-align:center;padding:30px;color:var(--muted)">Aucun exercice.</div>';return}d.forEach(ex=>{const dl=ex.diff==='easy'?'Débutant':ex.diff==='med'?'Intermédiaire':'Avancé';l.innerHTML+=`<div class="ex-card" onclick="openDetail('${ex.name.replace(/'/g,"\\'")}')"><div class="ex-thumb"><div class="ex-thumb-play">▶</div></div><div class="ex-body"><div class="ex-name">${ex.name}</div><div class="ex-diff ${ex.diff}">${dl}</div></div></div>`})}
function openDetail(n){const ex=Object.values(catData).flat().find(e=>e.name===n);if(!ex)return;document.getElementById('detailName').textContent=ex.name.toUpperCase();const dl=ex.diff==='easy'?'Débutant':ex.diff==='med'?'Intermédiaire':'Avancé';const d=document.getElementById('detailDiff');d.textContent=dl;d.className='detail-diff '+ex.diff;document.getElementById('detailDesc').textContent=ex.desc;document.getElementById('detailTags').innerHTML=(ex.muscles||[]).map(m=>`<div class="tag">${m}</div>`).join('');document.getElementById('libCatView').classList.add('hidden');document.getElementById('libDetailView').classList.remove('hidden');var __v=document.getElementById('vTrain');if(__v)__v.scrollTop=0}
function closeDetail(){document.getElementById('libDetailView').classList.add('hidden');if(currentCat)document.getElementById('libCatView').classList.remove('hidden')}
function filterLib(){const q=document.getElementById('libSearch').value.toLowerCase().trim();if(q.length<2){closeCat();document.getElementById('libGrid').classList.remove('hidden');return}currentCat='Recherche';currentCatData=Object.values(catData).flat().filter(e=>e.name.toLowerCase().includes(q));document.getElementById('catTitle').textContent='🔍 "'+q+'"';document.getElementById('libGrid').classList.add('hidden');document.getElementById('libCatView').classList.remove('hidden');document.getElementById('libDetailView').classList.add('hidden');currentFilter='all';renderCatEx()}
function openProg(k){currentProgKey=k;const p=progPhases[k];if(!p)return;document.getElementById('progList').classList.add('hidden');document.getElementById('progDetail').classList.remove('hidden');document.getElementById('progDetailName').textContent=p.name;document.getElementById('progDetailObj').textContent=p.obj;document.querySelectorAll('.phase-tab').forEach((t,i)=>t.classList.toggle('on',i===0));renderPhase(p.phases[0]);var __v=document.getElementById('vTrain');if(__v)__v.scrollTop=0}
function closeProg(){document.getElementById('progList').classList.remove('hidden');document.getElementById('progDetail').classList.add('hidden')}
function switchPhase(el,i){document.querySelectorAll('.phase-tab').forEach(t=>t.classList.remove('on'));el.classList.add('on');if(currentProgKey)renderPhase(progPhases[currentProgKey].phases[i]||[])}
function renderPhase(exs){const l=document.getElementById('phaseExList');l.innerHTML='';exs.forEach((ex,i)=>{l.innerHTML+=`<div class="phase-ex"><div class="pe-num">${i+1}</div><div class="pe-body"><div class="pe-name">${ex.name}</div><div class="pe-detail">${ex.detail}</div></div><div class="pe-video" onclick="alert('Vidéo YouTube')">▶</div></div>`})}

