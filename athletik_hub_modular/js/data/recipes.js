/* ═══════════════════════════════════════
   DATA/RECIPES.JS — Données recettes
   Athletik Hub V8
═══════════════════════════════════════ */

function showNutriTab(el, tab) {
  document.querySelectorAll('#vNutri .sub-tab').forEach(function(t){ t.classList.remove('on'); });
  document.querySelectorAll('#vNutri .pg').forEach(function(p){ p.classList.remove('on'); });
  el.classList.add('on');
  var target = document.getElementById('ntab-' + tab);
  if (target) target.classList.add('on');
}

// ═══ RECIPE DATA ═══
var RECIPES = {
  bowl: {
    name: 'BOWL PROTÉINÉ AVOINE', tag: 'pre', tagLabel: 'PRE',
    img: 'https://images.unsplash.com/photo-1511690743698-d9d85f2fbf38?w=800&q=80',
    cals: 520, prot: 28, carbs: 62, fat: 14, time: '5min',
    titan: '"Mange ça 90 min avant ta séance. Les flocons d\'avoine libèrent l\'énergie progressivement. Le whey garantit que tes muscles ont ce qu\'il faut."',
    ingredients: [
      { name: 'Flocons d\'avoine', qty: '80g' },
      { name: 'Protéine Whey Vanille', qty: '30g' },
      { name: 'Banane', qty: '1 moyenne' },
      { name: 'Lait d\'amande', qty: '200ml' },
      { name: 'Beurre de cacahuète', qty: '1 c.à.s' },
      { name: 'Miel', qty: '1 c.à.c' },
    ],
    steps: [
      'Mélange les flocons d\'avoine avec le lait d\'amande chaud (pas bouillant — le whey ne supporte pas la chaleur excessive).',
      'Laisse gonfler 2-3 minutes puis ajoute la protéine Whey et mélange vigoureusement.',
      'Tranche la banane et dispose-la par-dessus.',
      'Ajoute le beurre de cacahuète et le filet de miel.',
      'Consomme dans les 30 min pour un effet pre-workout optimal.'
    ]
  },
  shake: {
    name: 'SHAKE WHEY PB', tag: 'post', tagLabel: 'POST',
    img: 'https://images.unsplash.com/photo-1553530979-7ee52a2670c4?w=800&q=80',
    cals: 320, prot: 35, carbs: 18, fat: 12, time: '2min',
    titan: '"Post-workout : la fenêtre anabolique est ouverte 30 min après l\'effort. Ce shake ferme la fenêtre correctement. Prends-le sans excuses."',
    ingredients: [
      { name: 'Whey Isolate Chocolat', qty: '40g (2 scoops)' },
      { name: 'Beurre de cacahuète', qty: '15g' },
      { name: 'Lait écrémé', qty: '250ml' },
      { name: 'Glace', qty: '4-5 glaçons' },
      { name: 'Créatine monohydrate', qty: '5g (optionnel)' },
    ],
    steps: [
      'Mets tous les ingrédients dans un blender ou shaker.',
      'Mixe 30 secondes à vitesse maximale pour une texture lisse.',
      'Si shaker : ferme bien, agite 20 secondes vigoureusement.',
      'Consomme immédiatement après la séance, idéalement dans les 20 min.'
    ]
  },
  poulet: {
    name: 'POULET QUINOA LÉGUMES', tag: 'meal', tagLabel: 'REPAS',
    img: 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=800&q=80',
    cals: 580, prot: 42, carbs: 58, fat: 12, time: '25min',
    titan: '"Le repas parfait. Protéines complètes, glucides complexes, légumes. Si t\'es sérieux dans ta progression, ce plat est ton meilleur allié."',
    ingredients: [
      { name: 'Blanc de poulet', qty: '200g' },
      { name: 'Quinoa cuit', qty: '150g' },
      { name: 'Brocoli', qty: '100g' },
      { name: 'Poivrons colorés', qty: '80g' },
      { name: 'Huile d\'olive', qty: '1 c.à.s' },
      { name: 'Herbes de provence, sel, poivre', qty: 'à goût' },
    ],
    steps: [
      'Fais cuire le quinoa selon les instructions (ratio 1:2 avec l\'eau, 15min à feu doux).',
      'Assaisonne le poulet et fais-le cuire à la poêle avec l\'huile d\'olive — 6min par face à feu moyen.',
      'Cuit les légumes à la vapeur ou à la poêle 5-7 min en gardant du croquant.',
      'Repose le poulet 2-3 min avant de trancher pour conserver les jus.',
      'Dresse : quinoa en base, légumes, poulet tranché par-dessus.'
    ]
  },
  saumon: {
    name: 'SAUMON PATATE DOUCE', tag: 'meal', tagLabel: 'REPAS',
    img: 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=800&q=80',
    cals: 520, prot: 38, carbs: 48, fat: 18, time: '30min',
    titan: '"Omega-3 pour la récupération musculaire. Patate douce pour l\'énergie de qualité. Ce repas appartient à ta liste de base. Point."',
    ingredients: [
      { name: 'Filet de saumon', qty: '180g' },
      { name: 'Patate douce', qty: '200g' },
      { name: 'Épinards frais', qty: '60g' },
      { name: 'Citron', qty: '½' },
      { name: 'Ail', qty: '2 gousses' },
      { name: 'Huile d\'olive', qty: '1 c.à.s' },
    ],
    steps: [
      'Précuire la patate douce au four 200°C pendant 25min ou à la vapeur 15min.',
      'Assaisonne le saumon avec citron, ail haché, sel et poivre.',
      'Fais cuire le saumon à la poêle — 3min côté peau, 2min côté chair. Le centre doit rester rosé.',
      'Saute les épinards à l\'huile d\'olive 2 min jusqu\'à ce qu\'ils tombent.',
      'Dresse et sers immédiatement.'
    ]
  },
  pates: {
    name: 'PÂTES PESTO POULET', tag: 'meal', tagLabel: 'REPAS',
    img: 'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=800&q=80',
    cals: 640, prot: 38, carbs: 82, fat: 16, time: '20min',
    titan: '"Repas de charge. Mange ça la veille d\'une grosse séance. Les glucides complexes constituent ta réserve glycogène pour le lendemain."',
    ingredients: [
      { name: 'Pâtes complètes (sèches)', qty: '120g' },
      { name: 'Blanc de poulet', qty: '150g' },
      { name: 'Pesto verde', qty: '2 c.à.s' },
      { name: 'Parmesan râpé', qty: '20g' },
      { name: 'Huile d\'olive', qty: '1 c.à.c' },
      { name: 'Basilic frais', qty: 'quelques feuilles' },
    ],
    steps: [
      'Cuis les pâtes al dente selon les instructions, garde ½ tasse d\'eau de cuisson.',
      'Grille le poulet à la poêle avec l\'huile d\'olive jusqu\'à cuisson complète. Tranche en lanières.',
      'Égoutte les pâtes et remets-les dans la casserole hors feu.',
      'Ajoute le pesto, l\'eau de cuisson, mélange pour bien enrober.',
      'Ajoute le poulet, parsème de parmesan et basilic.'
    ]
  },
  tacos: {
    name: 'TACOS STEAK AVOCAT', tag: 'meal', tagLabel: 'REPAS',
    img: 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=800&q=80',
    cals: 580, prot: 35, carbs: 52, fat: 22, time: '20min',
    titan: '"La version athlète des tacos. L\'avocat apporte des graisses mono-insaturées pour les articulations. Mange ça un jour de repos — tu mérites ça après une semaine solide."',
    ingredients: [
      { name: 'Steak haché 5% MG', qty: '150g' },
      { name: 'Tortillas complètes', qty: '3 petites' },
      { name: 'Avocat mûr', qty: '½' },
      { name: 'Salade iceberg', qty: '40g' },
      { name: 'Tomate', qty: '1' },
      { name: 'Citron vert, cumin, paprika', qty: 'à goût' },
    ],
    steps: [
      'Assaisonne le steak haché avec cumin, paprika, sel et poivre.',
      'Fais cuire la viande à la poêle en l\'émiettant — 7-8 min à feu vif.',
      'Prépare le guacamole express : avocat écrasé à la fourchette avec citron vert et sel.',
      'Chauffe les tortillas 30 sec à sec dans une poêle.',
      'Dresse : tortilla, guacamole, salade, viande, tomate en dés.'
    ]
  }
};

function showRecipe(key) {
  var r = RECIPES[key];
  if (!r) return;
  document.getElementById('rmTitle').textContent = r.name;
  var tagEl = document.getElementById('rmTag');
  tagEl.textContent = r.tagLabel;
  tagEl.className = 'rm-tag ' + r.tag;
  document.getElementById('rmImg').src = r.img;
  document.getElementById('rmCals').textContent = r.cals + ' kcal';
  document.getElementById('rmProt').textContent = r.prot + 'g';
  document.getElementById('rmCarbs').textContent = r.carbs + 'g';
  document.getElementById('rmFat').textContent = r.fat + 'g';
  document.getElementById('rmTime').textContent = r.time;
  document.getElementById('rmTitanMsg').textContent = r.titan;
  // Ingrédients
  var ingrHtml = r.ingredients.map(function(i) {
    return '<div class="rm-ingr"><div class="rm-ingr-dot"></div><div class="rm-ingr-name">' + i.name + '</div><div class="rm-ingr-qty">' + i.qty + '</div></div>';
  }).join('');
  document.getElementById('rmIngredients').innerHTML = ingrHtml;
  // Étapes
  var stepsHtml = r.steps.map(function(s, i) {
    return '<div class="rm-step"><div class="rm-step-num">' + (i+1) + '</div><div class="rm-step-txt">' + s + '</div></div>';
  }).join('');
  document.getElementById('rmSteps').innerHTML = stepsHtml;
  // Stocker la recette courante
  window._currentRecipe = r;
  // Ouvrir le modal
  var modal = document.getElementById('recipeModal');
  modal.classList.add('open');
  modal.scrollTop = 0;
}

function closeRecipeModal() {
  document.getElementById('recipeModal').classList.remove('open');
}

function addRecipeToJournal() {
  var r = window._currentRecipe;
  if (!r) return;
  // Feedback visuel
  var btn = document.querySelector('.rm-add-btn');
  btn.textContent = '✅ Ajouté au journal !';
  btn.style.background = 'linear-gradient(135deg, #22C55E, #16A34A)';
  setTimeout(function() {
    btn.textContent = '+ Ajouter au journal du jour';
    btn.style.background = '';
    closeRecipeModal();
  }, 1500);
}

