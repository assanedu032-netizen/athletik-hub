/* ═══════════════════════════════════════
   ONBOARDING.JS — Flow onboarding complet
   Dépendances : storage.js
   Athletik Hub V8
═══════════════════════════════════════ */

// ═══════════════════════════════════════
// ATHLETIK HUB V5 — STEP 1 v2
// ═══════════════════════════════════════

// R déjà déclaré

// ── INIT ──

// ── TYPING ANIMATION ──
function typeText(el, text, speed, cb) {
  let i = 0;
  el.innerHTML = '';
  const cursor = document.createElement('span');
  cursor.className = 't-cursor';
  function tick() {
    if (i < text.length) {
      const ch = text.charAt(i);
      if (ch === '\n') {
        el.appendChild(document.createElement('br'));
      } else if (text.substring(i).startsWith('<b>')) {
        const end = text.indexOf('</b>', i);
        const bold = document.createElement('strong');
        bold.textContent = text.substring(i+3, end);
        el.appendChild(bold);
        i = end + 4;
        el.appendChild(cursor);
        setTimeout(tick, speed);
        return;
      } else {
        el.appendChild(document.createTextNode(ch));
      }
      i++;
      el.appendChild(cursor);
      setTimeout(tick, ch === '.' || ch === '—' ? speed * 3 : speed);
    } else {
      cursor.remove();
      if (cb) cb();
    }
  }
  tick();
}

// ── SCREEN NAV ──
function go(id) {
  const cur = document.querySelector('.scr.on');
  const nxt = document.getElementById(id);
  if (!nxt || (cur && cur.id === id)) return;
  if (cur) { cur.classList.remove('on'); cur.classList.add('out'); setTimeout(() => cur.classList.remove('out'), 500); }
  nxt.classList.add('on');

  // Trigger typing on Titan intro
  if (id === 'titanIntro') {
    setTimeout(() => {
      const msg = "La motivation c'est des conneries.\n\nMoi je m'appelle Titan.\nAlassane m'a créé pour une seule mission — <b>te faire progresser.</b>\n\nPas te flatter. Pas te ménager.\nTe faire progresser.\n\nDis-moi qui tu es.";
      typeText(document.getElementById('titanBubble'), msg, 30, () => {
        document.getElementById('btnStart').classList.add('show');
      });
    }, 600);
  }

  // Trigger thinking → result
  // thinking handled by startThinking()
}

// ── CHECKBOX TOGGLE ──
function toggleChk(el, qId, val) {
  el.classList.toggle('sel');
  const arr = checks[qId];
  const idx = arr.indexOf(val);
  if (idx > -1) arr.splice(idx, 1); else arr.push(val);
  // Enable/disable next button
  const btn = document.getElementById('btn' + qId.toUpperCase());
  if (btn) { arr.length > 0 ? btn.classList.add('ready') : btn.classList.remove('ready'); }
}

// ── SINGLE CHOICE (Q4 objective) ──
function pickOne(el, qId, val) {
  // Chercher le conteneur parent (ob-opts ou ob)
  var container = el.closest('.ob-opts') || el.parentElement;
  container.querySelectorAll('.ob-opt').forEach(function(o) { o.classList.remove('sel'); });
  el.classList.add('sel');
  R[qId] = val;
  setTimeout(function() { go('q5'); }, 350);
}

// ── SPORT PICK ──
function pickSport(el, val) {
  document.querySelectorAll('.sport-chip').forEach(c => c.classList.remove('sel'));
  el.classList.add('sel');
  R.sport = val;
  setTimeout(() => go('q6'), 350);
}

// ── AGE SUBMIT ──
function submitAge() {
  const age = document.getElementById('ageSelect').value;
  if (!age) { alert('Choisis ton âge pour continuer.'); return; }
  R.age = age;
  go('thinking');
}

// ── SCORING (exact Tally logic) ──
function calcResult() {
  const S = { ea:0, vd:0, tri:0, se:0, mt:0, ep:0 };

  // Q1 — Situation (checkboxes)
  checks.q1.forEach(v => {
    if (v === 'irregulier') { S.mt += 5; S.se += 2; }
    if (v === 'surpoids')   { S.se += 10; }
    if (v === 'pas_salle')  { S.tri += 5; S.mt += 3; }
    if (v === 'regulier')   { S.ea += 3; S.vd += 3; S.ep += 2; }
    if (v === 'debutant')   { S.tri += 3; S.mt += 2; }
    if (v === 'avance')     { S.ea += 3; S.vd += 3; S.ep += 5; }
  });

  // Q2 — Contraintes (checkboxes)
  checks.q2.forEach(v => {
    if (v === 'acces_salle') { S.ea += 2; S.vd += 2; S.ep += 3; S.se += 2; }
    if (v === 'pas_salle2')  { S.tri += 5; S.mt += 3; }
    if (v === 'peu_temps')   { S.mt += 5; }
    if (v === 'temps_ok')    { S.ea += 3; S.vd += 3; S.se += 2; }
    if (v === 'quotidien')   { S.mt += 3; S.tri += 2; }
    if (v === 'partenaire')  { S.ep += 2; S.ea += 2; }
  });

  // Q3 — Matériel (checkboxes)
  checks.q3.forEach(v => {
    if (v === 'halteres')    { S.ea += 2; S.vd += 2; S.se += 2; }
    if (v === 'barre')       { S.ea += 3; S.vd += 3; S.ep += 3; }
    if (v === 'elastiques')  { S.tri += 2; S.mt += 2; }
    if (v === 'gilet')       { S.tri += 2; S.ea += 2; }
    if (v === 'rien')        { S.tri += 5; S.mt += 3; }
  });

  // Q4 — Objectif (single choice)
  const obj = R.q4;
  if (obj === 'dunker')     S.vd += 10;
  if (obj === 'vertical')   S.vd += 10;
  if (obj === 'explosif')   S.ea += 10;
  if (obj === 'force')      S.tri += 10;
  if (obj === 'poids')      S.se += 10;
  if (obj === 'discipline') S.mt += 10;
  if (obj === 'tout')       S.ep += 10;

  // Find winner
  const entries = Object.entries(S);
  entries.sort((a,b) => b[1] - a[1]);
  const winner = entries[0][0];

  showResult(winner);
}

function showResult(key) {
  const P = {
    ea: { emoji:'🏆', name:'ELITE ATHLETE', obj:'Explosivité globale', dur:'⏱ 16-20 sem', lvl:'📊 Tous niveaux',
      msg:'"Tu veux tout — vitesse, détente, force, explosivité. C’est le programme le plus exigeant. Si tu t’y tiens, les résultats vont parler."' },
    vd: { emoji:'🏀', name:'VERTICAL DUNK', obj:'Dunker + Détente verticale max', dur:'⏱ 10 sem', lvl:'📊 Tous niveaux',
      msg:'"Ton objectif c’est le cercle. Dans 10 semaines, soit tu touches le bord, soit tu rappelles que t’as pas suivi le programme."' },
    tri: { emoji:'💪', name:'TRIPHASIQUE', obj:'Force explosive sans salle', dur:'⏱ 12 sem', lvl:'📊 Tous niveaux',
      msg:'"Pas de salle ? Pas d\'excuse. Poids du corps et méthodes de force avancées. Les résultats vont parler."' },
    se: { emoji:'🔥', name:'SHRED EXPLOSE', obj:'Perdre du gras + Exploser', dur:'⏱ 16 sem', lvl:'📊 Tous niveaux',
      msg:'"T’es venu pour perdre du gras et exploser. Ces deux objectifs ensemble, c’est dur. Mais c’est faisable. Si tu suis exactement ce que je dis."' },
    mt: { emoji:'⏰', name:'MICROTRAINING', obj:'Discipline et habitudes', dur:'⏱ 6 sem', lvl:'📊 Tous niveaux',
      msg:'"Séances courtes, calibrées pour réveiller ton système nerveux et installer la discipline. C\'est la fondation de tout."' },
    ep: { emoji:'⚡', name:'EXPLOSE+', obj:'Transformation totale', dur:'⏱ 16 sem', lvl:'📊 Avancé',
      msg:'"Le programme complet. Corps, mental, nutrition, récupération, engagement. Tout. Si t’es pas prêt à tout changer, prends un autre programme."' }
  };

  const p = P[key];
  document.getElementById('rEmoji').textContent = p.emoji;
  document.getElementById('rName').textContent = p.name;
  document.getElementById('rObj').textContent = p.obj;
  document.getElementById('rDur').textContent = p.dur;
  document.getElementById('rLvl').textContent = p.lvl;
  document.getElementById('rMsg').innerHTML = p.msg;

  R.program = key;
  R.programName = p.name;
  go('result');
  go('result');
}

