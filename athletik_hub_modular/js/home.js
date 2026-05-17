/* ═══════════════════════════════════════
   HOME.JS — Home view + séance du jour
   Dépendances : storage.js
   Athletik Hub V8
═══════════════════════════════════════ */

// ═══ HOME — SÉANCE DU JOUR ═══
function getTodaySession() {
  var days = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];
  var dayN = new Date().getDay(); // 0=dim, 1=lun...
  // Mapper notre trainingDays (0=Lun)
  var tdDay = dayN === 0 ? 6 : dayN - 1;
  
  var isTrainingDay = trainingDays.size === 0 || trainingDays.has(tdDay);
  
  if (isTrainingDay) {
    return {
      type: 'training',
      title: 'SÉANCE DU JOUR',
      subtitle: 'Phase ' + user.phase + ' — ' + user.program,
      duration: '45 min',
      action: "switchTab('tracks')",
      btnLabel: 'LANCER LA SÉANCE ⚡'
    };
  } else {
    return {
      type: 'rest',
      title: 'JOUR DE REPOS',
      subtitle: 'Récupération active ou mobilité',
      duration: '20 min',
      action: "switchTab('train')",
      btnLabel: 'VOIR LES EXERCICES →'
    };
  }
}

function renderTodayCard() {
  var container = document.getElementById('todayCard');
  if (!container) return;
  var s = getTodaySession();
  var icon = s.type === 'training' ? '🏋️' : '🧘';
  var html = '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">';
  html += '<div>';
  html += '<div style="font-family:Bebas Neue,sans-serif;font-size:11px;letter-spacing:2px;color:var(--gold);margin-bottom:4px">' + s.title + '</div>';
  html += '<div style="font-size:18px;font-weight:800;color:var(--text);line-height:1.2">' + s.subtitle + '</div>';
  html += '<div style="font-size:12px;color:var(--muted);margin-top:4px">⏱ ' + s.duration + '</div>';
  html += '</div>';
  html += '<div style="font-size:32px">' + icon + '</div>';
  html += '</div>';
  html += '<button onclick="' + s.action + '" style="width:100%;padding:14px;background:linear-gradient(135deg,#C5A44E,#D4B86A);border:none;border-radius:12px;font-family:Bebas Neue,sans-serif;font-size:16px;letter-spacing:1px;color:#0A0F1E;cursor:pointer">' + s.btnLabel + '</button>';
  container.innerHTML = html;
}


// ═══ FEEDBACK BÊTA ═══
function openFeedback() {
  var subject = encodeURIComponent('Feedback Athletik Hub V7 — ' + user.name);
  var body = encodeURIComponent(
    'Prénom : ' + user.name + '\n'
    + 'Programme : ' + user.program + '\n'
    + 'Streak : ' + user.streak + ' jours\n'
    + '\nCe que j’aime :\n\n'
    + 'Ce que j’améliorerais :\n\n'
    + 'Mon score global de l’app /10 :\n'
  );
  window.location.href = 'mailto:coach@athletikhub.fr?subject=' + subject + '&body=' + body;
}

// ═══ PWA MANIFEST ═══
function injectPWA() {
  var manifest = {
    name: 'Athletik Hub',
    short_name: 'AH',
    description: 'Deviens ce que tu peux être',
    start_url: '/',
    display: 'standalone',
    background_color: '#0A0F1E',
    theme_color: '#0A0F1E',
    icons: [{
      src: 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect width=%22100%22 height=%22100%22 rx=%2220%22 fill=%22%231B2A4A%22/><text y=%22.9em%22 x=%2250%22 text-anchor=%22middle%22 font-size=%2260%22 fill=%22%23C5A44E%22>AH</text></svg>',
      sizes: '192x192', type: 'image/svg+xml'
    }]
  };
  var blob = new Blob([JSON.stringify(manifest)], {type:'application/json'});
  var url = URL.createObjectURL(blob);
  var link = document.createElement('link');
  link.rel = 'manifest'; link.href = url;
  document.head.appendChild(link);
}


// ═══ INIT V7 ═══
// Override DOMContentLoaded
var _oldDCL = window.addEventListener;
document.addEventListener('DOMContentLoaded', function() {
  // Light mode par défaut, dark si préférence sauvegardée
  var savedTheme = localStorage.getItem('ah_theme') || 'light';
  darkMode = (savedTheme === 'dark');
  document.documentElement.setAttribute('data-theme', savedTheme);
  var dt = document.getElementById('darkToggle');
  if (dt) dt.classList.toggle('on', darkMode);
  // Charger les données (try/catch pour éviter tout crash)
  var hasData = false;
  try { hasData = loadData(); } catch(e) { console.warn('loadData error:', e); }

  // Override renderUserData pour auto-save
  var origRUD = window.renderUserData;
  if (origRUD) window.renderUserData = function() {
    origRUD(); renderTodayCard(); saveData();
  };

  // Splash bar animation
  var bar = document.getElementById('splashBar');
  if (bar) setTimeout(function(){ bar.style.width='100%'; }, 100);

  // Si données existantes -> bypasser l'onboarding
  if (hasData && user.email) {
    setTimeout(function() {
      document.querySelectorAll('.scr').forEach(function(e){
        e.classList.remove('on','out'); e.style.display='none';
      });
      document.getElementById('mainNav').style.display = 'flex';
      trainingDays.forEach(function(d) {
        var el = document.querySelector('[data-day="'+d+'"]');
        if (el) el.classList.add('on');
      });
      try { initSATv7(); } catch(e) {}
      try { renderUserData(); } catch(e) {}
      try { renderActiveHabits(); } catch(e) {}
      switchTab('home');
    }, 1500);
    return;
  }

  // Sinon -> onboarding normal
  if (typeof setGreeting === 'function') try { setGreeting(); } catch(e) {}
  if (typeof renderWeek === 'function') try { renderWeek(); } catch(e) {}

  setTimeout(function(){
    go('titanIntro');
    setTimeout(function() { 
      try { animateTitanText(); } catch(e) {}
    }, 400);
  }, 2200);

  try { renderActiveHabits(); } catch(e) {}
  try { injectPWA(); } catch(e) {} // PWA en dernier, non-bloquant
});






const R={}, checks={q1:[],q2:[],q3:[]};
let darkMode=false,notifOn=true,currentMode='full',satPhase='debut';
let currentRPE=0,liveRPE=0,timerInterval=null,timerSeconds=120,timerRunning=false,timerTarget=120;
let currentCat=null,currentCatData=[],currentFilter='all',currentProgKey=null;
let conversationHistory=[],liveData=[],currentLiveEx=0;
const CONFIG={ANTHROPIC_API_KEY:'YOUR_ANTHROPIC_API_KEY_HERE',LAKERA_API_KEY:'YOUR_LAKERA_API_KEY_HERE',LAKERA_ENDPOINT:'https://api.lakera.ai/v1/prompt_injection'};
const user={name:'ATHLÈTE',email:'',program:'ELITE ATHLETE',programKey:'ea',programObj:'Explosivité globale',phase:1,weekNum:2,totalWeeks:20,progressPct:12,streak:3,athScore:null,vertJump:null,level:'Rookie',levelIcon:'🥉',satDone:false,sport:'Basket',age:22};


// ═══ STUBS DE SÉCURITÉ ═══
// Garantit que les fonctions sont disponibles même si le script plante plus loin
// Ces stubs seront écrasés par les vraies fonctions déclarées ci-dessous

window.submitPrenom = window.submitPrenom || function() {
  var val = document.getElementById("prenomInput").value.trim();
  if (!val) return;
  if (typeof R !== 'undefined') { R.prenom = val.charAt(0).toUpperCase() + val.slice(1); }
  if (typeof user !== 'undefined') user.name = val.toUpperCase();
  if (typeof go === 'function') go("qSexe");
};

window.pickSexe = window.pickSexe || function(el, val) {
  document.querySelectorAll("#qSexe .sport-chip").forEach(function(c){ c.classList.remove("on"); });
  el.classList.add("on");
  if (typeof R !== 'undefined') R.sexe = val;
  setTimeout(function(){ if (typeof go === 'function') go("q4"); }, 300);
};

window.startGuidedMode = window.startGuidedMode || function() {
  document.querySelectorAll(".scr").forEach(function(e){ e.classList.remove("on","out"); e.style.display="none"; });
  document.getElementById("mainNav").style.display = "flex";
  if (typeof switchTab === 'function') switchTab("home");
  if (typeof renderUserData === 'function') renderUserData();
};

window.startFreeMode = window.startFreeMode || function() {
  document.querySelectorAll(".scr").forEach(function(e){ e.classList.remove("on","out"); e.style.display="none"; });
  document.getElementById("mainNav").style.display = "flex";
  if (typeof switchTab === 'function') switchTab("train");
  if (typeof renderUserData === 'function') renderUserData();
};

function testMode(){user.name='TEST';enterApp();}
function enterApp(){
  document.querySelectorAll('.scr').forEach(function(e){e.classList.remove('on','out');e.style.display='none';});
  document.getElementById('mainNav').style.display='flex';
  switchTab('home'); renderUserData();
}
function createAccount(){
  var email=document.getElementById('aEmail').value.trim(),pass=document.getElementById('aPass').value,m=document.getElementById('authMsg');
  if(!email||!pass){m.className='msg err';m.textContent='Remplis email et mot de passe.';return;}
  if(pass.length<6){m.className='msg err';m.textContent='6 caractères minimum.';return;}
  m.className='msg ok';m.textContent='Bienvenue !';
  user.name=email.split('@')[0].toUpperCase();user.email=email;
  if(R.programName)user.program=R.programName;
  setTimeout(function(){enterApp();},800);
}
function switchTab(tab){
  document.querySelectorAll('.view').forEach(function(v){v.classList.remove('on');});
  document.querySelectorAll('.nav-item').forEach(function(n){n.classList.remove('on');});
  var map={home:'vHome',tracks:'vTracks',train:'vTrain',chat:'vChat',moi:'vMoi',nutrition:'vNutri'},navIdx={home:0,tracks:1,train:3,nutrition:4};
  var v=document.getElementById(map[tab]);if(v){v.classList.add('on');v.scrollTop=0;}
  var ni=document.querySelectorAll('.nav-item');if(navIdx[tab]!==undefined&&ni[navIdx[tab]])ni[navIdx[tab]].classList.add('on');
  // Active le bouton Titan si chat
  var titanBtn=document.querySelector('.nav-titan');
  if(titanBtn)titanBtn.style.filter=(tab==='chat')?'drop-shadow(0 0 8px rgba(197,164,78,.6))':'none';
}
function restartOnboarding(){
  if (!confirm('Refaire l\'onboarding ? Tes réponses actuelles seront écrasées par les nouvelles, mais ton SAT et tes données sont conservés.')) return;
  document.querySelectorAll('.view').forEach(function(v){v.classList.remove('on');});
  document.querySelectorAll('.scr').forEach(function(e){e.style.display='';});
  document.getElementById('mainNav').style.display='none';
  // Clear onboarding answers so user starts fresh
  for (var k in R) delete R[k];
  go('titanIntro');
}

// Logout: keep onboarding/SAT data but clear session, redirect to auth on next load.
// With Firebase plugged in, this will also signOut from Firebase Auth.
function logoutUser(){
  if (!confirm('Se déconnecter ? Tes données restent enregistrées, tu pourras les retrouver à la prochaine connexion.')) return;
  if (typeof user !== 'undefined') { user.email = ''; user.name = 'ATHLÈTE'; }
  try { if (typeof saveData === 'function') saveData(); } catch(e) {}
  try { if (typeof firebase !== 'undefined' && firebase.auth) firebase.auth().signOut(); } catch(e) {}
  // Reload so the boot logic re-evaluates and shows the auth screen
  setTimeout(function(){ location.reload(); }, 200);
}
function toggleTheme(){
  darkMode=!darkMode;
  var theme=darkMode?'dark':'light';
  document.documentElement.setAttribute('data-theme',theme);
  localStorage.setItem('ah_theme',theme);
  document.getElementById('themeColor').content=darkMode?'#0A0F1E':'#F5F6FA';
  var b=document.getElementById('themeBtn');if(b)b.textContent=darkMode?'☀️':'🌙';
  var t=document.getElementById('darkToggle');if(t)t.classList.toggle('on',darkMode);
}
function toggleDark(){toggleTheme();}


/* ─── Home init supplémentaire ─── */
// ═══════════════════════════════════════
// ATHLETIK HUB V5 — STEP 2: HOME + NAV
// ═══════════════════════════════════════

// ── MOCK USER DATA (from onboarding — will come from Firebase later) ──

// ── INIT ──

// ── GREETING ──
function setGreeting() {
  const h = new Date().getHours();
  let greet = 'Bonsoir';
  if (h < 12) greet = 'Bonjour';
  else if (h < 18) greet = 'Bon après-midi';
  document.getElementById('greetText').textContent = greet;
  document.getElementById('userName').textContent = user.name;
}

// ── WEEK VIEW ──
function renderWeek() {
  const grid = document.getElementById('weekGrid');
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Sun
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7));

  const days = ['LUN','MAR','MER','JEU','VEN','SAM','DIM'];
  // Mock data: which days had sessions
  const sessionsThisWeek = [true, true, false, false, false, false, false]; // Mon/Tue done
  const todayIdx = (dayOfWeek + 6) % 7; // 0=Mon

  let html = '';
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const num = d.getDate();
    let cls = 'day-cell';
    if (i === todayIdx) cls += ' today';
    else if (i < todayIdx && sessionsThisWeek[i]) cls += ' done';
    else if (i < todayIdx && !sessionsThisWeek[i]) cls += ' missed';

    html += '<div class="' + cls + '">'
      + '<div class="dc-day">' + days[i] + '</div>'
      + '<div class="dc-num">' + num + '</div>'
      + '<div class="dc-dot"></div>'
      + '</div>';
  }
  grid.innerHTML = html;
}

// ── RENDER USER DATA ──
function renderUserData() {
  // Program card
  document.getElementById('pcName').textContent = user.program;
  document.getElementById('pcObj').textContent = user.programObj;
  document.getElementById('pcPhase').textContent = `Phase ${user.phase} — Fondations`;
  document.getElementById('pcPct').textContent = user.progressPct + '%';
  document.getElementById('pcBar').style.width = user.progressPct + '%';
  document.getElementById('pcDur').textContent = `⏱ Semaine ${user.weekNum} / ${user.totalWeeks}`;

  // Athletik Score
  if (user.athScore !== null) {
    document.getElementById('athScore').textContent = user.athScore;
    document.getElementById('athScoreDiff').textContent = '+0 depuis dernier test';
  }

  // Vertical jump
  if (user.vertJump !== null) {
    document.getElementById('vertJump').textContent = user.vertJump;
  }

  // Streak
  document.getElementById('streakCount').textContent = user.streak + ' JOURS';
  const streakMsgs = [
    '"Tu commences à peine. Prouve que t\'es sérieux."',
    '"3 jours c\'est bien. 30 jours c\'est mieux."',
    '"Une semaine. Pas mal. Mais c\'est maintenant que ça compte."',
    '"2 semaines. Tu deviens régulier. Continue."',
    '"1 mois. Respect. La discipline s\'installe."',
  ];
  const msgIdx = user.streak < 3 ? 0 : user.streak < 7 ? 1 : user.streak < 14 ? 2 : user.streak < 30 ? 3 : 4;
  document.getElementById('streakMsg').textContent = streakMsgs[msgIdx] + ' — Titan';

  // Level
  document.getElementById('lvIc').textContent = user.levelIcon;
  document.getElementById('lvName').textContent = user.level.toUpperCase();

  // Titan Home message
  const titanMsgs = {
    noSAT: "T'as pas encore fait ton test SAT. Sans données, je peux rien pour toi. Fais-le aujourd'hui.",
    lowStreak: "Tu reviens. C’est bien. Mais la régularité c’est pas un choix, c’est une obligation.",
    normal: "Séance prévue demain. Repose-toi bien ce soir. Le travail paie — toujours.",
    goodStreak: "Tu lâches rien. C'est exactement comme ça qu'on progresse. Continue."
  };
  let titanMsg = titanMsgs.noSAT;
  if (user.satDone && user.streak >= 7) titanMsg = titanMsgs.goodStreak;
  else if (user.satDone) titanMsg = titanMsgs.normal;
  else if (user.streak < 2) titanMsg = titanMsgs.lowStreak;
  document.getElementById('titanHomeMsg').textContent = getTitanContextualMessage();
}


