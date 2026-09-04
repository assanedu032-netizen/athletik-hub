// Titan écrit dans le journal nutritionnel — les sept vérifications du cahier.
// L'enjeu : une ANALYSE ne doit jamais écrire, et une ÉCRITURE ne doit jamais
// partir d'autre chose que d'un tap. Le harnais extrait les vraies fonctions
// d'index.html et de titan.js et les rejoue.
//   node scripts/test-titan-nutri-action.js [autre.html] [autre-titan.js]
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(process.argv[2] || path.join(ROOT, 'index.html'), 'utf8');
const srv  = fs.readFileSync(process.argv[3] || path.join(ROOT, 'netlify', 'functions', 'titan.js'), 'utf8');

function grab(text, decl) {
  const s = text.indexOf(decl);
  if (s < 0) throw new Error('introuvable: ' + decl);
  let i = text.indexOf('{', text.indexOf('(', s)), d = 0, j = i;
  for (; j < text.length; j++) {
    if (text[j] === '{') d++;
    else if (text[j] === '}') { d--; if (!d) { j++; break; } }
  }
  return text.slice(s, j);
}
function grabConst(text, name) {
  const re = new RegExp('const\\s+' + name + '\\s*=\\s*\\d+;');
  const m = re.exec(text);
  if (!m) throw new Error('introuvable: ' + name);
  return m[0];
}
// Le déclencheur est bâti par new RegExp([...].join('|')) : on prend le bloc entier.
function grabTrigger() {
  const s = html.indexOf('var TITAN_FOOD_RE = new RegExp([');
  const e = html.indexOf("].join('|'), 'i');", s);
  if (s < 0 || e < 0) throw new Error('introuvable: TITAN_FOOD_RE');
  return html.slice(s, e + "].join('|'), 'i');".length);
}

// ── Côté client ──
const store = {};
const localStorage = {
  getItem: k => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: k => { delete store[k]; }
};
const calls = { render: 0, save: 0 };
const doc = { getElementById: () => null };
const cli = new Function(
  'localStorage', 'document', 'window', 'navigator', 'console',
  'renderJournalToday', 'fbSaveProfile', '_lsEsc',
  grabTrigger() + '\n'
  + grab(html, 'function _titanIsFoodMessage(') + '\n'
  + grab(html, 'function _titanNutriFmt(') + '\n'
  + grab(html, 'function _titanNutriLabel(') + '\n'
  + 'window._titanNutriPending = {};\n'
  + html.slice(html.indexOf('window._titanNutriSave = function'),
               html.indexOf('window._titanNutriOpenJournal =')) + '\n'
  + 'return { isFood:_titanIsFoodMessage, label:_titanNutriLabel, save:window._titanNutriSave,'
  + '         pending:window._titanNutriPending };'
)(localStorage, doc, {}, {}, console,
  () => { calls.render++; }, () => { calls.save++; }, (t) => String(t));

// ── Côté serveur ──
const sanitize = new Function(
  grabConst(srv, 'NUTRITION_MAX_ITEMS') + '\n'
  + grab(srv, 'function nutNum(') + '\n'
  + grab(srv, 'function nutStr(') + '\n'
  + grab(srv, 'function sanitizeNutrition(') + '\n'
  + grab(srv, 'function parseNutritionJson(') + '\n'
  + 'return { san:sanitizeNutrition, parse:parseNutritionJson };'
)();

const R = [];
const ok = (l, c, d) => { R.push(c); console.log((c ? '  PASS  ' : '  FAIL  ') + l + (d && !c ? '  → ' + d : '')); };
const journal = () => { try { return JSON.parse(store.ah_nutri_journal || '[]'); } catch (e) { return []; } };

console.log('\n=== TEST 6 · LANGAGE NATUREL, FAUTES COMPRISES ===\n');
{
  // Le message brut du cahier des charges, fautes incluses.
  const brut = "Ojd j'ai manger Une glace vanille Un smothie vert j'ai mis épinard "
             + "hachoi Ganda glaçon au citron, 5g creatine, un petit morceau de gingembre";
  ok('le message du cahier déclenche l\'analyse', cli.isFood(brut) === true);
  [
    "aujourd'hui j'ai mangé une glace vanille et du poulet",
    "j'ai pris un smoothie ce matin",
    "je viens de manger des pâtes",
    "calcule mon total calorique",
    "combien de calories dans ma journée ?",
    "enregistre ça dans mon journal",
    "ajoute ce repas à mon suivi",
    "mon petit dej c'était deux oeufs",
    "j'ai rien mangé depuis hier"
  ].forEach(t => ok('  « ' + t.slice(0, 42) + ' »', cli.isFood(t) === true, t));
}
{
  // Faux positifs : chaque déclenchement consomme un appel du quota, et
  // ferait répondre Titan en mode analyse à une question d'entraînement.
  [
    'comment améliorer ma détente ?',
    'je suis fatigué aujourd\'hui',
    'combien de séries sur le squat ?',
    'ok',
    'mon programme de la semaine',
    'j\'ai mal au genou depuis la séance'
  ].forEach(t => ok('n\'analyse PAS « ' + t.slice(0, 40) + ' »', cli.isFood(t) === false, t));
  ok('un message trop court ne déclenche rien', cli.isFood('mangé') === false);
  ok('une valeur absente ne casse rien', cli.isFood(null) === false && cli.isFood(undefined) === false);
}

console.log('\n=== TEST 7 · L\'ESTIMATION NE SE FAIT PAS PASSER POUR UNE MESURE ===\n');
{
  const n = sanitize.san({
    items: [
      { name: 'Poulet grillé', quantity: '150 g', calories: 250, protein: 35, carbs: 0, fat: 11, estimated: false },
      { name: 'Patate douce', quantity: 'une portion', calories: 180, protein: 3, carbs: 41, fat: 0, estimated: true }
    ],
    totals: { calories: 9999, protein: 1, carbs: 1, fat: 1 },   // total mensonger du modèle
    estimatedItems: ['quantité de patate douce'],
    confidence: 'moyenne', wantsSave: false, question: ''
  });
  ok('les totaux sont RECALCULÉS depuis les items, pas repris du modèle',
     n.totals.calories === 430 && n.totals.protein === 38 && n.totals.carbs === 41 && n.totals.fat === 11,
     JSON.stringify(n.totals));
  ok('un aliment estimé est marqué comme tel', n.items[1].estimated === true);
  ok('  et une quantité précise ne l\'est pas', n.items[0].estimated === false);
  ok('la liste des incertitudes est conservée',
     n.estimatedItems.join() === 'quantité de patate douce', JSON.stringify(n.estimatedItems));
}
{
  const n = sanitize.san({ items: [{ name: 'Nutella', calories: 200, protein: 2, carbs: 22, fat: 12, estimated: true }],
                           confidence: 'inventée', wantsSave: 'oui' });
  ok('un niveau de confiance inconnu retombe sur « moyenne »', n.confidence === 'moyenne', n.confidence);
  ok('wantsSave n\'est vrai que si c\'est un booléen vrai', n.wantsSave === false, String(n.wantsSave));
}

console.log('\n=== TITAN NE PEUT PAS INVENTER DE VALEURS ABERRANTES ===\n');
{
  const n = sanitize.san({ items: [
    { name: 'Eau', calories: 0, protein: 0, carbs: 0, fat: 0 },
    { name: 'Créatine 5 g', calories: 0, protein: 0, carbs: 0, fat: 0 },
    { name: 'Aberration', calories: 999999, protein: -50, carbs: 'beaucoup', fat: NaN }
  ] });
  ok('l\'eau et la créatine restent à zéro',
     n.items[0].calories === 0 && n.items[1].calories === 0);
  ok('une valeur délirante est bornée', n.items[2].calories === 5000, String(n.items[2].calories));
  ok('une valeur négative devient zéro', n.items[2].protein === 0, String(n.items[2].protein));
  ok('du texte dans un champ chiffré devient zéro', n.items[2].carbs === 0, String(n.items[2].carbs));
  ok('NaN devient zéro', n.items[2].fat === 0, String(n.items[2].fat));
  ok('un aliment sans nom est retiré',
     sanitize.san({ items: [{ calories: 100 }, { name: 'Riz', calories: 130 }] }).items.length === 1);
  ok('la liste d\'aliments est plafonnée',
     sanitize.san({ items: Array.from({ length: 60 }, (_, i) => ({ name: 'A' + i, calories: 1 })) }).items.length === 25);
  ok('une analyse absente ne lève pas d\'exception',
     sanitize.san(null) === null && sanitize.san('x') === null);
}

console.log('\n=== LA RÉPONSE DU MODÈLE EST TOUJOURS DU TEXTE LISIBLE ===\n');
{
  const p = sanitize.parse('```json\n{"reply":"Voilà ton total.","nutrition":{"items":[{"name":"Riz","calories":200}]}}\n```');
  ok('les balises de code sont retirées', p && p.reply === 'Voilà ton total.', JSON.stringify(p));
  ok('  et l\'analyse est assainie', p.nutrition.items.length === 1 && p.nutrition.totals.calories === 200);
  ok('du JSON invalide ne renvoie rien', sanitize.parse('pas du json') === null);
  ok('une réponse sans texte est refusée',
     sanitize.parse('{"nutrition":{"items":[]}}') === null);
  const sansNut = sanitize.parse('{"reply":"Je ne vois pas de repas ici."}');
  ok('une réponse sans analyse reste une réponse valide',
     sansNut && sansNut.reply && sansNut.nutrition === null, JSON.stringify(sansNut));
}

console.log('\n=== TESTS 1 à 4 · ANALYSER N\'EST PAS ÉCRIRE ===\n');
{
  // TEST 1 — analyser ne touche pas au journal.
  ok('au départ le journal est vide', journal().length === 0);
  const nut = sanitize.san({
    items: [
      { name: 'Poulet grillé', quantity: '2 morceaux', calories: 280, protein: 35, carbs: 0, fat: 14, estimated: true },
      { name: 'Attiéké', quantity: '300 g', calories: 330, protein: 2, carbs: 72, fat: 1, estimated: false },
      { name: 'Tomates', quantity: 'salade', calories: 30, protein: 1, carbs: 6, fat: 0, estimated: true }
    ],
    estimatedItems: ['quantité de poulet'], confidence: 'moyenne', wantsSave: true
  });
  ok('TEST 1 — une analyse préparée n\'écrit rien', journal().length === 0);
  ok('  et ne déclenche aucune synchronisation', calls.save === 0);

  // TEST 2 — l'action est préparée, pas exécutée.
  cli.pending['c1'] = nut;
  ok('TEST 2 — l\'action attend dans la file', !!cli.pending['c1']);
  ok('  le journal est toujours vide', journal().length === 0);

  // TEST 3 — la confirmation écrit.
  cli.save('c1');
  const j = journal();
  ok('TEST 3 — la confirmation écrit UNE entrée', j.length === 1, String(j.length));
  ok('  au format que le journal sait lire',
     j[0].totals && j[0].totals.cal === 640 && j[0].totals.p === 38 && j[0].totals.g === 78 && j[0].totals.l === 15,
     JSON.stringify(j[0].totals));
  ok('  avec les champs des autres écrivains (cals/prot/carbs/fat)',
     j[0].cals === 640 && j[0].prot === 38 && j[0].carbs === 78 && j[0].fat === 15);
  ok('  une date exploitable', /^\d{4}-\d{2}-\d{2}T/.test(j[0].date) && typeof j[0].ts === 'number');
  ok('  la source est identifiable', j[0].source === 'titan');
  ok('  le détail des aliments est conservé', Array.isArray(j[0].foods) && j[0].foods.length === 3);
  ok('  le niveau de confiance aussi', j[0].confidence === 'moyenne');
  ok('  et le fait que ce soit une estimation', j[0].estimated === true);
  ok('  le libellé nomme les aliments les plus caloriques',
     /Attiéké/.test(j[0].name) && /Poulet/.test(j[0].name), j[0].name);
  ok('  le journal du jour est rafraîchi', calls.render === 1, String(calls.render));
  ok('  la synchronisation Firestore est déclenchée UNE fois', calls.save === 1, String(calls.save));

  // Double tap : aucune double écriture.
  cli.save('c1');
  ok('un second tap n\'écrit pas une deuxième fois', journal().length === 1, String(journal().length));
  ok('  et ne redéclenche pas la synchro', calls.save === 1, String(calls.save));

  // « Pas maintenant » n'écrit jamais.
  cli.pending['c2'] = nut;
  delete cli.pending['c2'];
  cli.save('c2');
  ok('une carte écartée n\'écrit rien', journal().length === 1, String(journal().length));

  // TEST 4 — persistance : la donnée est dans la clé synchronisée.
  ok('TEST 4 — l\'entrée vit dans ah_nutri_journal', !!store.ah_nutri_journal);
  const relu = JSON.parse(store.ah_nutri_journal);
  ok('  elle survit à une relecture complète', relu.length === 1 && relu[0].totals.cal === 640);
}
{
  // Le libellé ne doit jamais être vide ni interminable.
  ok('un repas sans aliment nommé garde un libellé',
     cli.label({ items: [] }) === 'Repas (Titan)', cli.label({ items: [] }));
  const long = cli.label({ items: Array.from({ length: 9 }, (_, i) => ({ name: 'Aliment numéro ' + i, calories: 100 - i })) });
  ok('un repas très fourni est résumé, pas tronqué au hasard',
     long.length <= 70 && /\+6$/.test(long), long);
}

console.log('\n=== TEST 5 · CLOISONNEMENT ENTRE UTILISATEURS ===\n');
{
  // L'écriture passe par ah_nutri_journal → users/{uid}.nutriJournal, doc
  // protégé par isOwner(uid). Aucun chemin nouveau, donc aucune faille neuve.
  ok('l\'écriture ne vise que la clé locale de l\'appareil',
     /localStorage\.setItem\('ah_nutri_journal'/.test(html));
  {
    // On borne la lecture à la fonction elle-même plutôt qu'à un nombre de
    // caractères deviné : la synchro doit passer par fbSaveProfile, jamais
    // par un appel Firestore direct qui contournerait FB_SYNC_KEYS.
    const i = html.indexOf('window._titanNutriSave = function');
    const corps = html.slice(i, html.indexOf('window._titanNutriOpenJournal ='));
    ok('  la synchro passe par fbSaveProfile, pas par un chemin direct',
       /fbSaveProfile\(\)/.test(corps) && !/window\.fb\./.test(corps),
       corps.length + ' caractères lus');
  }
  ok('  ah_nutri_journal est bien une clé synchronisée',
     /\['ah_nutri_journal',\s*'nutriJournal',\s*true\]/.test(html));
  const rules = fs.readFileSync(path.join(ROOT, 'firestore.rules'), 'utf8');
  ok('  et users/{uid} n\'est lisible que par son propriétaire',
     /match \/users\/\{uid\} \{[\s\S]{0,200}allow read: if isOwner\(uid\)/.test(rules));
  // `sk-ant-` apparaît deux fois dans index.html, mais uniquement comme
  // VALIDATION DE FORMAT d'un champ où l'athlète colle SA propre clé pour le
  // scan photo (chemin legacy). Ce qu'on vérifie, c'est qu'aucune clé réelle
  // n'est écrite dans le fichier, et que Titan n'en utilise jamais côté client.
  ok('aucune clé Anthropic RÉELLE n\'est écrite dans le fichier',
     !/sk-ant-[A-Za-z0-9_-]{20,}/.test(html));
  ok('  les deux occurrences ne sont que des contrôles de format',
     (html.match(/sk-ant-/g) || []).length === 2
     && /startsWith\('sk-ant-'\)/.test(html));
  ok('  Titan appelle Anthropic uniquement côté serveur',
     /x-api-key': process\.env\.ANTHROPIC_API_KEY/.test(srv)
     && !/api\.anthropic\.com[\s\S]{0,200}_titanNutri/.test(html));
}

console.log('\n=== LA SÉPARATION CHAT / ACTION EST DANS LE CODE ===\n');
{
  ok('le mode nutrition n\'est demandé que sur un message alimentaire',
     /_titanIsFoodMessage\(text\)/.test(html)
     && /isFood \? \{ mode: 'nutrition' \} : null/.test(html));
  ok('un seul appel sert la réponse ET l\'analyse',
     /window\._titanLastNutrition = data\.nutrition \|\| null;/.test(html));
  ok('la carte est rendue APRÈS la bulle de réponse',
     html.indexOf("addMessage(reply, 'titan');") < html.indexOf('_titanRenderNutriCard(nutrition)'));
  ok('la carte est isolée : son échec ne casse pas la conversation',
     /try \{ _titanRenderNutriCard\(nutrition\); \} catch \(e\)/.test(html));
  ok('le serveur ne renvoie QUE des données — aucune écriture serveur',
     !/nutriJournal/.test(srv));
  ok('le prompt interdit à Titan de prétendre avoir enregistré',
     /N'écris JAMAIS que tu as enregistré/.test(srv));
  ok('le prompt impose zéro calorie aux compléments',
     /Cr[ée]atine, L-carnitine[\s\S]{0,120}0 calorie/.test(srv));
  ok('  et l\'eau à zéro', /Eau, th[ée], caf[ée] noir[\s\S]{0,40}0 partout/.test(srv));
  ok('wantsSave exige une demande EXPLICITE',
     /wantsSave[\s\S]{0,180}SEULEMENT si l'athlète demande explicitement/.test(srv));
}

const failed = R.filter(x => !x).length;
console.log('\n' + '='.repeat(62));
console.log(failed ? 'RÉSULTAT : ' + failed + ' ÉCHEC(S) sur ' + R.length
                   : 'RÉSULTAT : ' + R.length + '/' + R.length + ' tests passés.');
process.exit(failed ? 1 : 0);
