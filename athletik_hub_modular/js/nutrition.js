/* ═══════════════════════════════════════
   NUTRITION.JS — Module nutrition complet
   Dépendances : storage.js, data/recipes.js
   Athletik Hub V8
═══════════════════════════════════════ */

// ═══ NUTRITION MODULE ═══


// ═══════════════════════════════════════════════════
// NUTRITION MODULE — Functions (Fixed Buttons)
// ═══════════════════════════════════════════════════

function openFullNutrition() {
  document.getElementById('nutritionModal').style.display = 'block';
  document.body.style.overflow = 'hidden';
}

function closeNutritionModal() {
  document.getElementById('nutritionModal').style.display = 'none';
  document.body.style.overflow = '';
}

function openNutritionModal(meal) {
  openFullNutrition();
}

function switchNutriTab(tabEl, tabName) {
  // Remove 'on' from all tabs
  document.querySelectorAll('#nutritionModal .nutri-tab').forEach(t => t.classList.remove('on'));
  document.querySelectorAll('#nutritionModal .nutri-sec').forEach(s => s.classList.remove('on'));

  // Add 'on' to clicked tab
  tabEl.classList.add('on');
  document.getElementById('nutri' + tabName.charAt(0).toUpperCase() + tabName.slice(1)).classList.add('on');
}

function showMealDetail(meal) {
  alert('Détail du repas : ' + meal);
}

function addFood() {
  alert('Ajouter un aliment : scanne un produit ou choisis une recette.');
}

function showRecipe(key) {
  const recipes = {
    bowl: {name: 'Bowl Protéiné Avoine', emoji: '🥣', cals: 520, prot: 28, carbs: 62, fat: 14, time: '10 min', diff: 'Facile', 
           ingredients: ['80g flocons d’avoine', '200ml lait', '30g whey', '1 banane', '15g beurre de cacahuète', '10g graines de chia'],
           instructions: ['Chauffer le lait 1 min', 'Ajouter flocons, laisser gonfler 2 min', 'Ajouter whey et mélanger', 'Couper la banane', 'Ajouter beurre de cacahuète et chia']},
    shake: {name: 'Shake Whey PB', emoji: '🥤', cals: 320, prot: 35, carbs: 12, fat: 16, time: '3 min', diff: 'Facile',
            ingredients: ['40g whey isolate', '20g beurre de cacahuète', '300ml lait', '3 glaçons'],
            instructions: ['Tout mettre dans le blender', 'Mixer 30 secondes', 'Boire dans les 30 min post-workout']},
    poulet: {name: 'Poulet Quinoa', emoji: '🍗', cals: 580, prot: 42, carbs: 58, fat: 22, time: '35 min', diff: 'Moyenne',
             ingredients: ['200g filet de poulet', '150g quinoa cuit', '150g brocolis', '10ml huile d’olive', 'Ail, herbes'],
             instructions: ['Préchauffer four à 200°C', 'Assaisonner le poulet, enfourner 25 min', 'Cuire quinoa 12 min', 'Steam brocolis 5 min', 'Assembler']},
    saumon: {name: 'Saumon Patate Douce', emoji: '🐟', cals: 520, prot: 38, carbs: 48, fat: 18, time: '30 min', diff: 'Moyenne',
             ingredients: ['180g pavé de saumon', '200g patate douce', '100g épinards', '10ml huile d’olive', '1/2 citron'],
             instructions: ['Patate douce au four 25 min à 200°C', 'Saumon poêlé 4 min/côté', 'Épinards sautés 2 min', 'Assaisonner au citron']},
    pates: {name: 'Pâtes Pesto Poulet', emoji: '🍝', cals: 640, prot: 38, carbs: 72, fat: 24, time: '20 min', diff: 'Facile',
            ingredients: ['100g pâtes complètes', '150g poulet sauté', '30g pesto', '100g tomates cerises', '15g parmesan'],
            instructions: ['Cuire pâtes al dente', 'Saisir poulet en dés', 'Mélanger pesto + pâtes + poulet', 'Ajouter tomates et parmesan']},
    tacos: {name: 'Tacos Steak Avocat', emoji: '🌮', cals: 580, prot: 35, carbs: 48, fat: 26, time: '15 min', diff: 'Facile',
            ingredients: ['2 tortillas blé complet', '200g steak haché 5%', '1/2 avocat', '100g poivron/oignon', '30g fromage blanc'],
            instructions: ['Faire revenir steak avec légumes', 'Chauffer tortillas 30 sec', 'Garnir : steak + avocat + fromage blanc', 'Rouler']}
  };

  const r = recipes[key];
  if (!r) return;

  let html = '<div style="padding:20px">';
  html += '<div style="font-size:64px;text-align:center;margin-bottom:16px">' + r.emoji + '</div>';
  html += '<div style="font-family:Bebas Neue;font-size:28px;letter-spacing:2px;margin-bottom:8px">' + r.name + '</div>';
  html += '<div style="display:flex;gap:16px;margin-bottom:16px;flex-wrap:wrap">';
  html += '<div style="font-size:11px;color:var(--muted);font-weight:600">⏱ ' + r.time + '</div>';
  html += '<div style="font-size:11px;color:var(--muted);font-weight:600">🔥 ' + r.cals + ' kcal</div>';
  html += '<div style="font-size:11px;color:var(--muted);font-weight:600">🥩 ' + r.prot + 'g prot</div>';
  html += '<div style="font-size:11px;color:var(--muted);font-weight:600">Difficulté : ' + r.diff + '</div>';
  html += '</div>';

  html += '<div style="font-family:Bebas Neue;font-size:16px;color:var(--navy);letter-spacing:1px;margin:16px 0 10px">📝 INGRÉDIENTS</div>';
  r.ingredients.forEach(ing => {
    html += '<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)">';
    html += '<div style="width:20px;height:20px;border-radius:5px;border:2px solid var(--border2);cursor:pointer"></div>';
    html += '<div style="flex:1;font-size:13px">' + ing + '</div>';
    html += '</div>';
  });

  html += '<div style="font-family:Bebas Neue;font-size:16px;color:var(--navy);letter-spacing:1px;margin:16px 0 10px">👨‍🍳 PRÉPARATION</div>';
  r.instructions.forEach((inst, i) => {
    html += '<div style="display:flex;gap:10px;margin-bottom:12px">';
    html += '<div style="width:24px;height:24px;border-radius:50%;background:var(--gold);color:#fff;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex-shrink:0">' + (i+1) + '</div>';
    html += '<div style="font-size:13px;color:var(--text2);line-height:1.6">' + inst + '</div>';
    html += '</div>';
  });

  html += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:8px;text-align:center;margin-top:16px">';
  html += '<div style="background:var(--surface2);border-radius:10px;padding:10px"><div style="font-family:Bebas Neue;font-size:20px;color:var(--gold)">' + r.cals + '</div><div style="font-size:10px;color:var(--muted);font-weight:700">kcal</div></div>';
  html += '<div style="background:var(--surface2);border-radius:10px;padding:10px"><div style="font-family:Bebas Neue;font-size:20px;color:#3B82F6">' + r.prot + 'g</div><div style="font-size:10px;color:var(--muted);font-weight:700">prot</div></div>';
  html += '<div style="background:var(--surface2);border-radius:10px;padding:10px"><div style="font-family:Bebas Neue;font-size:20px;color:var(--gold)">' + r.carbs + 'g</div><div style="font-size:10px;color:var(--muted);font-weight:700">carbs</div></div>';
  html += '<div style="background:var(--surface2);border-radius:10px;padding:10px"><div style="font-family:Bebas Neue;font-size:20px;color:#EC4899">' + r.fat + 'g</div><div style="font-size:10px;color:var(--muted);font-weight:700">fat</div></div>';
  html += '</div>';

  html += '<button onclick="addRecipeToCart()" style="width:100%;margin-top:16px;padding:14px;background:linear-gradient(135deg,var(--gold),var(--gold2));color:var(--navy);border:none;border-radius:14px;font-family:Outfit;font-size:14px;font-weight:800;cursor:pointer;box-shadow:0 4px 16px var(--gold-glow)">🛒 Ajouter au panier de courses</button>';
  html += '</div>';

  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:var(--bg);z-index:400;overflow-y:auto';
  modal.innerHTML = '<div style="position:sticky;top:0;background:var(--surface);padding:16px 22px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:12px;z-index:10"><div onclick="this.parentElement.parentElement.remove()" style="cursor:pointer;font-size:20px;color:var(--muted)">←</div><div style="font-family:Bebas Neue;font-size:20px;letter-spacing:2px">RECETTE</div></div>' + html;
  document.body.appendChild(modal);
}

function addRecipeToCart() {
  alert('Ingrédients ajoutés à la liste de courses !');
}

function filterRecipes(type) {
  const grid = document.getElementById('recipeGrid');
  if (!grid) return;
  const cards = grid.querySelectorAll('.recipe-card');
  cards.forEach(card => {
    const tag = card.querySelector('.recipe-tag');
    if (!tag) return;
    const cardType = tag.textContent.toLowerCase();
    if (type === 'all' || cardType.includes(type === 'pre' ? 'pre' : type === 'post' ? 'post' : 'repas')) {
      card.style.display = '';
    } else {
      card.style.display = 'none';
    }
  });
}

function scanProduct() {
  document.getElementById('barcodeInput').value = '3017620422003';
  lookupBarcode();
}

async function lookupBarcode() {
  const barcode = document.getElementById('barcodeInput').value.trim();
  if (!barcode) {
    alert('Entre un code-barre');
    return;
  }

  try {
    const response = await fetch('https://world.openfoodfacts.org/api/v2/product/' + barcode + '.json');
    const data = await response.json();

    if (data.status === 0 || !data.product) {
      alert('Produit non trouvé dans la base Open Food Facts');
      return;
    }

    const p = data.product;
    const n = p.nutriments || {};

    document.getElementById('productName').textContent = p.product_name || 'Produit inconnu';
    document.getElementById('productBrand').textContent = p.brands || 'Marque inconnue';
    document.getElementById('productCals').textContent = Math.round(n['energy-kcal_100g'] || 0);
    document.getElementById('productProt').textContent = (n.proteins_100g || 0).toFixed(1);
    document.getElementById('productCarbs').textContent = (n.carbohydrates_100g || 0).toFixed(1);
    document.getElementById('productFat').textContent = (n.fat_100g || 0).toFixed(1);

    const cals = n['energy-kcal_100g'] || 0;
    const sugar = n.sugars_100g || 0;
    const prot = n.proteins_100g || 0;

    let analysis = '';
    if (sugar > 20) {
      analysis = '"' + Math.round(sugar) + '% de sucre. Tu veux dunker ou tu veux manger du sucre ? Choisis."';
    } else if (prot > 20) {
      analysis = '"' + Math.round(prot) + 'g de protéines pour 100g. C’est du solide. Tu peux prendre."';
    } else if (cals > 500) {
      analysis = '"' + Math.round(cals) + ' kcal/100g. C’est dense. Compte tes macros si tu prends ça."';
    } else {
      analysis = '"Produit correct. ' + Math.round(prot) + 'g de prot, pas mal pour un aliment généraliste."';
    }

    document.getElementById('titanAnalysis').textContent = analysis;
    document.getElementById('scanResult').classList.remove('hidden');

  } catch (error) {
    console.error('Scan error:', error);
    alert('Erreur de connexion. Vérifie ta connexion internet.');
  }
}

function addScanToJournal() {
  alert('Produit ajouté au journal !');
  document.getElementById('scanResult').classList.add('hidden');
}

function toggleShop(el) {
  el.classList.toggle('on');
  const name = el.nextElementSibling;
  if (name) name.classList.toggle('done');
  updateCartCount();
}

function updateCartCount() {
  const unchecked = document.querySelectorAll('#nutritionModal .shop-check:not(.on)');
  const count = document.getElementById('cartCount');
  if (count) count.textContent = unchecked.length;
}

function generateList() {
  const unchecked = document.querySelectorAll('#nutritionModal .shop-check:not(.on)');
  if (unchecked.length === 0) {
    alert('Tout est déjà coché ! Tu es prêt pour les courses.');
    return;
  }
  alert('Génération de la liste... ' + unchecked.length + ' articles restants. Titan t’envoie la liste par notification.');
}

// ═══════════════════════════════════════════════════
// V6 — ADDITIONS PROPRES (double quotes only)
// ═══════════════════════════════════════════════════

// ANIMATION TITAN
function animateTitanText() {
  var text = "Je suis Titan. Le coach Alassane m\u2019a cr\u00e9\u00e9 pour une seule mission \u2014 te faire progresser. Pas te flatter. Te faire progresser. R\u00e9ponds honn\u00eatement. Je ferai le reste.";
  var el = document.getElementById("titanTypingText");
  var btn = document.getElementById("btnStart");
  if (!el) return;
  if (btn) btn.style.display = "none";
  el.textContent = "";
  var i = 0;
  var iv = setInterval(function() {
    el.textContent = text.slice(0, i);
    i++;
    if (i > text.length) {
      clearInterval(iv);
      if (btn) { btn.style.display = "block"; }
    }
  }, 28);
}

// PRÉNOM
function submitPrenom() {
  var val = document.getElementById("prenomInput").value.trim();
  if (!val) { if (window.TEST_MODE) val = 'Test'; else return; }
  R.prenom = val.charAt(0).toUpperCase() + val.slice(1);
  user.name = R.prenom.toUpperCase();
  go("qSexe");
}

// SEXE
function pickSexe(el, val) {
  document.querySelectorAll("#qSexe .sport-chip").forEach(function(c) { c.classList.remove("on"); });
  el.classList.add("on");
  R.sexe = val;
  setTimeout(function() { go("q4"); }, 300);
}

// POSTE
var POSTES = {
  basket: ["Meneur","Arri\u00e8re","Ailier","Ailier fort","Pivot"],
  foot:   ["Gardien","D\u00e9fenseur","Milieu","Attaquant"],
  combat: ["Striker","Grappler","MMA","Boxeur"],
  volley: ["Passeur","Libero","Attaquant","Central"]
};

function setupPoste() {
  var sport = R.sport || "autre";
  var postes = POSTES[sport] || [];
  var container = document.getElementById("posteOptions");
  if (!container) return;
  if (postes.length === 0) { go("qFreq"); return; }
  var html = "";
  for (var p = 0; p < postes.length; p++) {
    html += "<div class=\"sport-chip\" onclick=\"pickPoste(this,'" + postes[p] + "')\" style=\"padding:12px 8px\"><div class=\"sport-ic\" style=\"font-size:13px\">" + postes[p] + "</div></div>";
  }
  container.innerHTML = html;
}

function pickPoste(el, val) {
  document.querySelectorAll("#qPoste .sport-chip").forEach(function(c) { c.classList.remove("on"); });
  el.classList.add("on");
  R.poste = val;
  setTimeout(function() { go("qFreq"); }, 300);
}

function skipPoste() { R.poste = null; go("qFreq"); }

// FRÉQUENCE
function pickFreq(el, val) {
  document.querySelectorAll("#qFreq .sport-chip").forEach(function(c) { c.classList.remove("on"); });
  el.classList.add("on");
  R.freq = val;
  setTimeout(function() { go("qCompet"); }, 300);
}

// COMPÉTITION
function pickCompet(el, val) {
  document.querySelectorAll("#qCompet .sport-chip").forEach(function(c) { c.classList.remove("on"); });
  el.classList.add("on");
  R.compet = val;
  setTimeout(function() { go("q6"); }, 300);
}

// OVERRIDE pickSport pour aller vers poste
var _origPickSport2 = window.pickSport;
window.pickSport = function(el, sport) {
  document.querySelectorAll("#q5 .sport-chip").forEach(function(c) { c.classList.remove("on"); });
  el.classList.add("on");
  R.sport = sport;
  setTimeout(function() { go("q6"); }, 300);
};

// \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
// PLAN REPAS AUTO (mode stricte)
// \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
function generateMealPlan() {
  if (typeof RECIPES === 'undefined') { alert('Recettes non charg\u00e9es'); return; }
  // Sort recipes by tag
  var pres   = [], meals = [], posts = [];
  Object.keys(RECIPES).forEach(function(k){
    var r = Object.assign({key:k}, RECIPES[k]);
    if (r.tag === 'pre')  pres.push(r);
    else if (r.tag === 'post') posts.push(r);
    else meals.push(r);
  });
  if (!pres.length || !meals.length) { alert('Pas assez de recettes pour g\u00e9n\u00e9rer un plan.'); return; }
  if (!posts.length) posts = meals.slice();

  // Target daily calories
  var dailyTarget = (typeof user !== 'undefined' && user.nutriCal) ? user.nutriCal : 2400;

  var days = ['LUNDI','MARDI','MERCREDI','JEUDI','VENDREDI','SAMEDI','DIMANCHE'];
  var rotate = function(arr, offset) { return arr[offset % arr.length]; };

  var html = '<div class="mp-head">Plan auto pour atteindre <strong>' + dailyTarget + ' kcal/jour</strong></div>';
  for (var i = 0; i < 7; i++) {
    var pre   = rotate(pres,  i);
    var lunch = rotate(meals, i);
    var diner = rotate(meals, i + 1);
    var post  = rotate(posts, i);
    var total = (pre.cals||0) + (lunch.cals||0) + (diner.cals||0) + (post.cals||0);
    var diff = total - dailyTarget;
    var diffTxt = diff > 0 ? ('+' + diff) : diff;
    var diffCls = Math.abs(diff) > 200 ? 'warn' : 'ok';
    html += '<div class="mp-day">'
      + '<div class="mp-day-head"><span class="mp-day-name">' + days[i] + '</span>'
      + '<span class="mp-day-cals ' + diffCls + '">' + total + ' kcal <em>(' + diffTxt + ')</em></span></div>'
      + _mealRowHtml('PRE',   pre)
      + _mealRowHtml('MIDI',  lunch)
      + _mealRowHtml('SOIR',  diner)
      + _mealRowHtml('POST',  post)
      + '</div>';
  }
  html += '<button class="btn btn-outline" onclick="addMealPlanToShopping()" style="margin-top:8px">\ud83d\uded2 Ajouter \u00e0 la liste de courses</button>';
  var grid = document.getElementById('mealPlanGrid');
  grid.innerHTML = html;
  grid.classList.remove('hidden');
}

function _mealRowHtml(slot, r) {
  return '<div class="mp-meal">'
    + '<div class="mp-meal-slot">' + slot + '</div>'
    + '<div class="mp-meal-name">' + r.name + '</div>'
    + '<div class="mp-meal-cals">' + (r.cals || '?') + 'kcal</div>'
    + '</div>';
}

function addMealPlanToShopping() {
  alert('Liste de courses agr\u00e9g\u00e9e (\u00e0 finaliser avec Firebase pour sauvegarder).');
}

// LOADING 11 SECONDES (1s si programme d\u00e9j\u00e0 calcul\u00e9)
function startThinking() {
  var messages = [
    "Analyse du profil en cours...",
    "Sport et contraintes pris en compte...",
    "Mat\u00e9riel \u00e9valu\u00e9...",
    "Calcul du programme optimal...",
    "Personnalisation en cours...",
    "Presque termin\u00e9...",
    "Programme pr\u00eat."
  ];
  var bar = document.getElementById("thinkBar");
  var pct = document.getElementById("thinkPct");
  var msg = document.getElementById("thinkMsg");
  // Fast path: if program already known (refaire onboarding), skip the 11s wait
  var alreadyCalculated = (typeof R !== 'undefined' && R.program) || (typeof user !== 'undefined' && user.programKey && user.satDone);
  var duration = alreadyCalculated ? 1200 : 11000;
  var start = Date.now();
  var iv = setInterval(function() {
    var elapsed = Date.now() - start;
    var progress = Math.min(100, (elapsed / duration) * 100);
    if (bar) bar.style.width = progress + "%";
    if (pct) pct.textContent = Math.round(progress) + "%";
    var msgIdx = Math.floor((progress / 100) * messages.length);
    if (msg) msg.textContent = messages[Math.min(msgIdx, messages.length - 1)];
    if (progress >= 100) {
      clearInterval(iv);
      if (typeof calcResult === "function") calcResult();
    }
  }, 100);
}

// OVERRIDE submitAge pour 11s
var _origSubmitAge2 = window.submitAge;
window.submitAge = function() {
  var age = document.getElementById("ageSelect").value;
  if (!age) { alert("Choisis ton \u00e2ge pour continuer."); return; }
  R.age = age;
  go("thinking");
  setTimeout(function() { startThinking(); }, 400);
};

// CHOIX MODE
function startGuidedMode() {
  user.appMode = "guided";
  document.querySelectorAll(".scr").forEach(function(e) { e.classList.remove("on","out"); e.style.display = "none"; });
  document.getElementById("mainNav").style.display = "flex";
  switchTab("home");
  renderUserData();
}

function startFreeMode() {
  user.appMode = "free";
  document.querySelectorAll(".scr").forEach(function(e) { e.classList.remove("on","out"); e.style.display = "none"; });
  document.getElementById("mainNav").style.display = "flex";
  switchTab("train");
  renderUserData();
}

// OVERRIDE enterApp
window.enterApp = function() {
  document.querySelectorAll(".scr").forEach(function(e) { e.classList.remove("on","out"); e.style.display = "none"; });
  var mc = document.getElementById("modeChoice");
  if (mc) {
    mc.style.display = "";
    mc.classList.add("on");
  }
};

// OVERRIDE createAccount
window.createAccount = function() {
  var email = document.getElementById("aEmail").value.trim();
  var pass = document.getElementById("aPass").value;
  var m = document.getElementById("authMsg");
  if (!email || !pass) { m.className = "msg err"; m.textContent = "Remplis email et mot de passe."; return; }
  if (pass.length < 6) { m.className = "msg err"; m.textContent = "6 caract\u00e8res minimum."; return; }
  m.className = "msg ok"; m.textContent = "Bienvenue " + (R.prenom || "Athl\u00e8te") + " !";
  user.name = (R.prenom || email.split("@")[0]).toUpperCase();
  user.email = email;
  if (R.programName) user.program = R.programName;
  setTimeout(function() { window.enterApp(); }, 800);
};

// OVERRIDE testMode
window.testMode = function() {
  if (typeof enterTestMode === 'function') enterTestMode();
  user.name = "TEST";
  user.appMode = "guided";
  document.querySelectorAll(".scr").forEach(function(e) { e.classList.remove("on","out"); e.style.display = "none"; });
  document.getElementById("mainNav").style.display = "flex";
  switchTab("home");
  renderUserData();
};

// CALENDRIER
var trainingDays = new Set();
function toggleDay(el) {
  var d = parseInt(el.dataset.day);
  if (trainingDays.has(d)) { trainingDays.delete(d); el.classList.remove("on"); }
  else { trainingDays.add(d); el.classList.add("on"); }
  var names = ["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"];
  var el2 = document.getElementById("calSummary");
  if (!el2) return;
  if (trainingDays.size === 0) { el2.textContent = "Aucun jour s\u00e9lectionn\u00e9"; return; }
  el2.textContent = "\uD83D\uDCC5 " + Array.from(trainingDays).sort().map(function(d) { return names[d]; }).join(", ");
}

// HABITUDES MENER
var MENER_HABITS = {
  "Mental": [
    "Visualisation 5 min avant chaque s\u00e9ance",
    "Journal de gratitude chaque soir",
    "M\u00e9ditation 10 min par jour",
    "R\u00e9p\u00e9ter son objectif \u00e0 voix haute chaque matin",
    "Protocole Flow avant chaque entra\u00eenement"
  ],
  "Engagement": [
    "Noter ses objectifs de la semaine chaque lundi",
    "Bilan hebdomadaire avec son partenaire",
    "Respecter 100% des s\u00e9ances pr\u00e9vues cette semaine",
    "Envoyer son bilan \u00e0 son partenaire chaque dimanche"
  ],
  "Nutrition": [
    "Boire 3 litres d\u2019eau par jour",
    "Prot\u00e9ines \u00e0 chaque repas",
    "Supprimer les sodas pendant 21 jours",
    "Shake prot\u00e9in\u00e9 dans les 30 min post-entra\u00eenement",
    "Aucun fast-food cette semaine"
  ],
  "Entra\u00eenement": [
    "Respecter tous les temps de repos",
    "Noter ses performances \u00e0 chaque s\u00e9ance",
    "15 min de technique de saut apr\u00e8s la s\u00e9ance",
    "Finir la s\u00e9ance m\u00eame quand c\u00e7a ne va pas"
  ],
  "R\u00e9cup\u00e9ration": [
    "Dormir 8 heures minimum chaque nuit",
    "Aucun \u00e9cran 1h avant le coucher",
    "15 min de foam rolling apr\u00e8s chaque s\u00e9ance",
    "20 min de marche les jours de repos"
  ]
};

var CAT_COLORS = {
  "Mental":"#6C63FF","Engagement":"#C5A44E",
  "Nutrition":"#27AE60","Entra\u00eenement":"#E74C3C","R\u00e9cup\u00e9ration":"#3498DB"
};

var activeHabits = [];
var selectedHabit = null;
var selectedDuration = 21;

function openHabitsModal() {
  if (activeHabits.length >= 3) { alert("Maximum 3 habitudes. Finis une habitude avant d\u2019en ajouter."); return; }
  renderHabitsList("");
  document.getElementById("habitsModal").style.display = "block";
  document.getElementById("habitContract").style.display = "none";
}

function closeHabitsModal() {
  document.getElementById("habitsModal").style.display = "none";
}

function selectDuration(el, dur) {
  document.querySelectorAll(".dur-btn").forEach(function(b) { b.classList.remove("on"); });
  el.classList.add("on");
  selectedDuration = dur;
}

function filterHabits(val) { renderHabitsList(val.toLowerCase()); }

function renderHabitsList(filter) {
  var container = document.getElementById("habitsList");
  if (!container) return;
  var html = "";
  var cats = Object.keys(MENER_HABITS);
  for (var ci = 0; ci < cats.length; ci++) {
    var cat = cats[ci];
    var habits = MENER_HABITS[cat];
    var filtered = habits.filter(function(h) { return !filter || h.toLowerCase().indexOf(filter) > -1; });
    if (!filtered.length) continue;
    html += "<div style=\"margin-bottom:16px\">";
    html += "<div style=\"font-family:'Bebas Neue',sans-serif;font-size:12px;color:" + (CAT_COLORS[cat]||"#C5A44E") + ";letter-spacing:1px;margin-bottom:8px\">" + cat.toUpperCase() + "</div>";
    for (var hi = 0; hi < filtered.length; hi++) {
      var h = filtered[hi];
      var already = activeHabits.find(function(a) { return a.name === h; });
      var clickStr = already ? "" : " onclick=\"selectHabitItem(this)\"";
      html += "<div class=\"habit-item\"" + clickStr + " data-name=\"" + h.replace(/"/g,"&quot;") + "\" data-cat=\"" + cat + "\" style=\"" + (already ? "opacity:0.4;" : "cursor:pointer;") + "\">";
      html += "<div style=\"font-size:13px;flex:1;line-height:1.4\">" + h + "</div>";
      html += "<div style=\"color:" + (CAT_COLORS[cat]||"#C5A44E") + ";font-size:18px;margin-left:8px\">" + (already ? "\u2705" : "+") + "</div>";
      html += "</div>";
    }
    html += "</div>";
  }
  container.innerHTML = html || "<div style=\"text-align:center;padding:20px\">Aucune habitude trouv\u00e9e</div>";
}

function selectHabitItem(el) {
  var name = el.dataset.name;
  var cat = el.dataset.cat;
  selectedHabit = { name: name, cat: cat };
  var contractEl = document.getElementById("habitContract");
  var contractText = document.getElementById("contractText");
  var sigInput = document.getElementById("signatureInput");
  contractText.innerHTML = "Je m\u2019engage \u00e0 pratiquer pendant <strong style=\"color:var(--gold)\">" + selectedDuration + " jours</strong> :<br><br><strong>" + name + "</strong>";
  if (sigInput && R.prenom) sigInput.value = R.prenom;
  contractEl.style.display = "block";
  contractEl.scrollIntoView({ behavior: "smooth" });
}

function signAndStartHabit() {
  if (!selectedHabit) return;
  var sig = document.getElementById("signatureInput").value.trim();
  if (!sig) { alert("Signe avec ton pr\u00e9nom pour commencer."); return; }
  activeHabits.push({
    id: Date.now(), name: selectedHabit.name, cat: selectedHabit.cat,
    duration: selectedDuration, startDate: new Date().toISOString(),
    daysCompleted: 0, signature: sig, streak: 0, lastChecked: null
  });
  closeHabitsModal();
  renderActiveHabits();
}

function shareContractWhatsApp() {
  if (!selectedHabit) return;
  var sig = (document.getElementById("signatureInput").value.trim()) || "Athl\u00e8te";
  var text = encodeURIComponent("\uD83D\uDD25 CONTRAT D\u2019ENGAGEMENT \u2014 ATHLETIK HUB\n\n" + sig + " s\u2019engage :\n\"" + selectedHabit.name + "\"\n\nDur\u00e9e : " + selectedDuration + " jours\nM\u00e9thode MENER \u2014 Les Secrets de la D\u00e9tente Verticale");
  window.open("https://api.whatsapp.com/send?text=" + text, "_blank");
}

function renderActiveHabits() {
  var container = document.getElementById("activeHabits");
  var countEl = document.getElementById("habitsCount");
  if (!container) return;
  if (countEl) countEl.textContent = activeHabits.length + " / 3 actives";
  if (!activeHabits.length) {
    container.innerHTML = "<div style=\"font-size:13px;color:var(--muted);text-align:center;padding:12px\">Aucune habitude active. Commence ton premier d\u00e9fi.</div>";
    return;
  }
  var html = "";
  for (var i = 0; i < activeHabits.length; i++) {
    var h = activeHabits[i];
    var pct = Math.round((h.daysCompleted / h.duration) * 100);
    var today = new Date().toDateString();
    var done = h.lastChecked === today;
    var col = CAT_COLORS[h.cat] || "#C5A44E";
    html += "<div style=\"background:var(--surface);border-radius:12px;padding:12px;margin-bottom:8px;border:1.5px solid var(--border2)\">";
    html += "<div style=\"display:flex;justify-content:space-between;align-items:flex-start\">";
    html += "<div style=\"flex:1\"><div style=\"font-size:10px;font-weight:700;color:" + col + ";letter-spacing:1px;margin-bottom:2px\">" + h.cat.toUpperCase() + "</div>";
    html += "<div style=\"font-size:13px;font-weight:600;margin-bottom:2px\">" + h.name + "</div>";
    html += "<div style=\"font-size:11px;color:var(--muted)\">" + h.daysCompleted + "/" + h.duration + " jours \u2022 \uD83D\uDD25 " + h.streak + "</div></div>";
    html += "<button onclick=\"checkHabit(" + h.id + ")\" style=\"background:" + (done ? "var(--border)" : col) + ";border:none;border-radius:8px;padding:8px 10px;font-size:11px;font-weight:700;color:" + (done ? "var(--muted)" : "#fff") + ";cursor:" + (done ? "default" : "pointer") + "\">" + (done ? "\u2705 Fait" : "+ Cocher") + "</button></div>";
    html += "<div style=\"height:3px;background:var(--border);border-radius:2px;overflow:hidden;margin-top:8px\"><div style=\"height:100%;background:" + col + ";width:" + pct + "%\"></div></div>";
    html += "</div>";
  }
  container.innerHTML = html;
}

function checkHabit(id) {
  var h = activeHabits.find(function(a) { return a.id === id; });
  if (!h) return;
  var today = new Date().toDateString();
  if (h.lastChecked === today) return;
  h.daysCompleted++; h.streak++; h.lastChecked = today;
  if (h.daysCompleted >= h.duration) {
    activeHabits = activeHabits.filter(function(a) { return a.id !== id; });
    alert("\uD83C\uDFC6 D\u00e9fi termin\u00e9 ! Titan est fier.");
  }
  renderActiveHabits();
}

// NPI

function selectNPIOpt(el) {
  el.closest('.npi-q').querySelectorAll('.npi-opt').forEach(function(x){ x.classList.remove('npi-sel'); });
  el.classList.add('npi-sel');
}
function openNPI() {
  var panel = document.createElement("div");
  panel.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;background:var(--bg);z-index:400;overflow-y:auto";
  panel.innerHTML = "<div style=\"padding:16px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:12px;position:sticky;top:0;background:var(--bg)\"><button onclick=\"this.closest('[style*=fixed]').remove()\" style=\"background:none;border:none;font-size:22px;cursor:pointer;color:var(--text)\">\u2190</button><div style=\"font-size:18px;font-weight:800\">MON NPI</div></div><div style=\"padding:20px\"><div style=\"font-size:13px;color:var(--text2);margin-bottom:20px\">Nutrition Performance Index \u2014 5 piliers. Score sur 100.</div><div id=\"npiForm\"></div><button onclick=\"calcNPI()\" style=\"width:100%;padding:14px;background:var(--gold);border:none;border-radius:12px;font-size:15px;font-weight:800;color:var(--navy);cursor:pointer;margin-top:8px\">Calculer mon NPI</button><div id=\"npiResult\" style=\"margin-top:20px\"></div></div>";
  
  var NPI = [
    {p:"Bilan \u00e9nerg\u00e9tique", q:"Niveau d\u2019\u00e9nergie en entra\u00eenement ?", opts:["Toujours \u00e9puis\u00e9","Souvent fatigue","Correct","Plein d\u2019\u00e9nergie"]},
    {p:"Macronutriments", q:"Prot\u00e9ines \u00e0 chaque repas ?", opts:["Jamais","Rarement","Souvent","\u00c0 chaque repas"]},
    {p:"Hydratation", q:"Litres d\u2019eau par jour ?", opts:["Moins de 1L","1-1.5L","1.5-2.5L","Plus de 2.5L"]},
    {p:"Qualit\u00e9 & Timing", q:"Repas 2h avant entra\u00eenement ?", opts:["Jamais","Parfois","Souvent","Toujours"]},
    {p:"R\u00e9cup\u00e9ration nutritionnelle", q:"Heures de sommeil par nuit ?", opts:["Moins de 6h","6-7h","7-8h","8h ou plus"]}
  ];
  
  var fEl = panel.querySelector("#npiForm");
  var html = "";
  for (var i = 0; i < NPI.length; i++) {
    html += "<div style=\"background:var(--surface);border-radius:12px;padding:14px;margin-bottom:10px\">";
    html += "<div style=\"font-size:10px;font-weight:700;color:var(--gold);letter-spacing:1px;margin-bottom:6px\">" + NPI[i].p.toUpperCase() + "</div>";
    html += "<div style=\"font-size:13px;font-weight:600;margin-bottom:10px\">" + NPI[i].q + "</div>";
    for (var j = 0; j < NPI[i].opts.length; j++) {
      html += '<div class="npi-opt" data-idx="' + i + '" data-val="' + (j+1) + '" onclick="selectNPIOpt(this)" style="padding:8px;border-radius:8px;cursor:pointer;display:flex;align-items:center;gap:10px;margin-bottom:4px">';
      html += "<div style=\"width:16px;height:16px;border-radius:50%;border:2px solid var(--border2);flex-shrink:0\"></div>";
      html += "<div style=\"font-size:13px;color:var(--text2)\">" + NPI[i].opts[j] + "</div></div>";
    }
    html += "</div>";
  }
  fEl.innerHTML = html;
  document.body.appendChild(panel);
  
  window.calcNPI = function() {
    var opts = panel.querySelectorAll(".npi-sel");
    if (opts.length < NPI.length) { alert("R\u00e9ponds \u00e0 toutes les questions."); return; }
    var total = 0;
    opts.forEach(function(o) { total += parseInt(o.dataset.val); });
    var score = Math.round((total / (NPI.length * 4)) * 100);
    var profiles = [
      {max:40, label:"D\u00e9butant", color:"#E74C3C", msg:"Ta nutrition freine clairement tes performances. Il y a du travail."},
      {max:65, label:"Interm\u00e9diaire", color:"#F39C12", msg:"T\u2019as des bases, mais des failles importantes \u00e0 corriger."},
      {max:85, label:"Avanc\u00e9", color:"#27AE60", msg:"Ta nutrition est solide. On optimise les d\u00e9tails."},
      {max:100, label:"\u00c9lite", color:"#C5A44E", msg:"Ta nutrition est un vrai avantage comp\u00e9titif. \u26A1"}
    ];
    var profile = profiles.find(function(p) { return score <= p.max; }) || profiles[3];
    panel.querySelector("#npiResult").innerHTML = "<div style=\"background:var(--surface);border:2px solid " + profile.color + ";border-radius:16px;padding:20px;text-align:center\"><div style=\"font-size:56px;font-weight:900;color:" + profile.color + "\">" + score + "</div><div style=\"font-size:11px;color:var(--muted)\">/ 100</div><div style=\"font-weight:800;font-size:18px;color:" + profile.color + ";margin:8px 0\">" + profile.label.toUpperCase() + "</div><div style=\"font-size:13px;color:var(--text2)\">" + profile.msg + "</div></div>";
  };
}

// INIT V6


/* ─── JS secondaire (fin index.html original) ─── */
// Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function() {
    navigator.serviceWorker.register('/sw.js')
      .then(function(reg) { console.log('SW enregistré:', reg.scope); })
      .catch(function(err) { console.log('SW erreur:', err); });
  });
}

// PWA Install Logic
let deferredPrompt = null;
const installBtn = document.getElementById('installBtn');
const iosModal = document.getElementById('iosInstallModal');

function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}
function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

// Show install button on iOS (always, since iOS has no prompt)
window.addEventListener('load', function() {
  if (isStandalone()) return; // already installed
  if (isIOS()) {
    setTimeout(function(){ installBtn.classList.add('show'); }, 3000);
  }
});

// Capture Android/Chrome install prompt
window.addEventListener('beforeinstallprompt', function(e) {
  e.preventDefault();
  deferredPrompt = e;
  installBtn.classList.add('show');
});

// Hide button after successful install
window.addEventListener('appinstalled', function() {
  installBtn.classList.remove('show');
  deferredPrompt = null;
});

function handleInstall() {
  if (deferredPrompt) {
    // Android/Chrome — native prompt
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then(function(choice) {
      if (choice.outcome === 'accepted') {
        installBtn.classList.remove('show');
      }
      deferredPrompt = null;
    });
  } else if (isIOS()) {
    // iOS — show tutorial modal
    iosModal.classList.add('show');
  } else {
    // Desktop fallback
    iosModal.classList.add('show');
  }
}

function closeIosModal() {
  iosModal.classList.remove('show');
}
