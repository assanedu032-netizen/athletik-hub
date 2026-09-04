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

// Extraction d'une fonction de premier niveau.
// L'équilibrage d'accolades classique ne tient pas ici : ces fonctions
// contiennent des accolades dans des CHAÎNES ('{'), des commentaires FRANÇAIS
// pleins d'apostrophes, et des littéraux d'EXPRESSION RÉGULIÈRE contenant des
// guillemets (/"reply"\s*:/). Distinguer tout ça demanderait un vrai parseur.
// Ce fichier indente systématiquement ses corps de fonction : une accolade
// fermante en COLONNE 0 marque donc la fin, sans ambiguïté.
function grab(text, decl) {
  const s = text.indexOf(decl);
  if (s < 0) throw new Error('introuvable: ' + decl);
  const e = text.indexOf('\n}', s);
  if (e < 0) throw new Error('fin introuvable: ' + decl);
  return text.slice(s, e + 2);
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
const calls = { render: 0, save: 0, toasts: [] };
const doc = { getElementById: () => null };
const win = { _titanNutriTurns: 0 };
const cst = (n) => {
  const m = new RegExp('var ' + n + ' = [^\n]+;').exec(html);
  if (!m) throw new Error('introuvable: ' + n);
  return m[0];
};
const cli = new Function(
  'localStorage', 'document', 'window', 'navigator', 'console',
  'renderJournalToday', 'fbSaveProfile', '_lsEsc', 'showToast',
  grabTrigger() + '\n'
  + grab(html, 'function _titanIsFoodMessage(') + '\n'
  + cst('TITAN_NUTRI_LATCH') + '\n' + cst('TITAN_OFFTOPIC_RE') + '\n'
  + grab(html, 'function _titanWantsNutrition(') + '\n'
  + grab(html, 'function _mealId(') + '\n'
  + grab(html, 'function _journalRead(') + '\n'
  + grab(html, 'function _journalWrite(') + '\n'
  + grab(html, 'function _journalIndexOf(') + '\n'
  + grab(html, 'function removeJournalMeal(') + '\n'
  + grab(html, 'function updateJournalMeal(') + '\n'
  + grab(html, 'function _titanRemainingToday(') + '\n'
  + grab(html, 'function _titanNutriFmt(') + '\n'
  + grab(html, 'function _titanNutriLabel(') + '\n'
  + 'window._titanNutriPending = {};\n'
  + html.slice(html.indexOf('window._titanNutriSave = function'),
               html.indexOf('window._titanNutriOpenJournal =')) + '\n'
  + 'return { isFood:_titanIsFoodMessage, wants:_titanWantsNutrition,'
  + '         label:_titanNutriLabel, save:window._titanNutriSave,'
  + '         mealId:_mealId, read:_journalRead, indexOf:_journalIndexOf,'
  + '         remove:removeJournalMeal, update:updateJournalMeal,'
  + '         reste:_titanRemainingToday,'
  + '         pending:window._titanNutriPending };'
)(localStorage, doc, win, {}, console,
  () => { calls.render++; }, () => { calls.save++; }, (t) => String(t),
  (m) => { calls.toasts.push(m); });

// ── Côté serveur ──
const sanitize = new Function(
  grabConst(srv, 'NUTRITION_MAX_ITEMS') + '\n'
  + grab(srv, 'function nutNum(') + '\n'
  + grab(srv, 'function nutStr(') + '\n'
  + grab(srv, 'function nutEscapeControlChars(') + '\n'
  + grab(srv, 'function nutCloseTruncated(') + '\n'
  + grab(srv, 'function nutExtractReply(') + '\n'
  + grab(srv, 'function nutLooksLikeEnvelope(') + '\n'
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
  // Ces deux assertions encodaient la règle « pas de JSON → rien », qui est
  // exactement ce qui affichait « J'ai calé sur ce message » sur une réponse
  // parfaitement valide. Une prose est maintenant une réponse.
  ok('du texte simple devient la réponse, sans carte',
     (sanitize.parse('pas du json') || {}).reply === 'pas du json');
  ok('une réponse sans texte est refusée',
     sanitize.parse('{"nutrition":{"items":[]}}') === null);
  const sansNut = sanitize.parse('{"reply":"Je ne vois pas de repas ici."}');
  ok('une réponse sans analyse reste une réponse valide',
     sansNut && sansNut.reply && sansNut.nutrition === null, JSON.stringify(sansNut));
}

console.log('\n=== AUCUN JSON NE DOIT ARRIVER DANS UNE BULLE ===\n');
{
  // Le cas réellement observé en production : Titan écrit en PARAGRAPHES, donc
  // il met des retours à la ligne LITTÉRAUX dans la chaîne "reply". C'est
  // illégal en JSON, JSON.parse levait, et le repli déversait le brut à
  // l'écran. Le JSON était pourtant complet — il se terminait par "}}}.
  const avecSautsDeLigne = '{"reply":"Voilà ton estimation.\n\n'
    + 'Beaucoup de quantités sont à la louche.\n\n**Total : 1500 kcal**",'
    + '"nutrition":{"items":[{"name":"Céréales","quantity":"2 poignées","calories":220,'
    + '"protein":5,"carbs":44,"fat":2,"estimated":true}],"confidence":"moyenne"}}';
  const p = sanitize.parse(avecSautsDeLigne);
  ok('un retour à la ligne littéral ne fait plus échouer la lecture', p !== null);
  ok('  la réponse est récupérée entière', /Voilà ton estimation/.test(p.reply) && /1500 kcal/.test(p.reply), p && p.reply);
  ok('  ses paragraphes sont conservés', /\n\n/.test(p.reply));
  ok('  et l\'analyse est exploitable', p.nutrition && p.nutrition.items.length === 1
     && p.nutrition.totals.calories === 220, JSON.stringify(p.nutrition && p.nutrition.totals));
  ok('  aucune accolade ne subsiste dans le texte', p.reply.indexOf('{') < 0 && p.reply.indexOf('"nutrition"') < 0);
}
{
  // Réponse coupée au plafond de jetons : on sauve ce qui est complet.
  const coupe = '{"reply":"Voilà ton total.","nutrition":{"items":['
    + '{"name":"Riz","quantity":"200 g","calories":260,"protein":5,"carbs":57,"fat":1,"estimated":false},'
    + '{"name":"Poulet","quantity":"150 g","calories":250,"protein":35,"carbs":0,"fat":11,"estimated":false},'
    + '{"name":"Avoca';
  const p = sanitize.parse(coupe);
  ok('une réponse coupée en plein vol reste lisible', p !== null && p.reply === 'Voilà ton total.', p && p.reply);
  ok('  et les aliments complets sont conservés',
     p.nutrition && p.nutrition.items.length === 2, JSON.stringify(p.nutrition && p.nutrition.items.map(i => i.name)));
  ok('  l\'aliment tronqué est écarté',
     !(p.nutrition.items || []).some(i => /Avoca/.test(i.name)));
}
{
  // Structure irrécupérable : on sauve au moins la phrase.
  const casse = '{"reply":"J\'ai fait le calcul.","nutrition":{"items":[{{{ !!! ';
  const p = sanitize.parse(casse);
  ok('une structure détruite laisse quand même une phrase',
     p !== null && p.reply === "J'ai fait le calcul.", p && p.reply);
  ok('  et aucune analyse inventée', p.nutrition === null);
  ok('une phrase sans JSON est transmise telle quelle',
     (sanitize.parse('Salut, ça va ?') || {}).reply === 'Salut, ça va ?');
  ok('  et sans analyse inventée', (sanitize.parse('Salut, ça va ?') || {}).nutrition === null);
}
{
  // Le repli serveur ne renvoie PLUS jamais le brut.
  ok('le serveur ne renvoie plus `reply: raw`', !/reply: raw/.test(srv));
  ok('  il renvoie une phrase en français', /calé sur ce message/.test(srv));
}
{
  // Filet client : même si un JSON passait, la bulle ne doit pas l'afficher.
  const unwrap = new Function(grab(html, 'function _titanUnwrapJson(') + '\nreturn _titanUnwrapJson;')();
  ok('le client déballe un JSON qui aurait échappé au serveur',
     unwrap('{"reply":"Voilà ton total.","nutrition":{"items":[]}}') === 'Voilà ton total.');
  ok('  même si ce JSON est cassé',
     unwrap('{"reply":"Texte sauvé.","nutrition":{"items":[{{{') === 'Texte sauvé.');
  ok('  et il restitue les sauts de ligne échappés',
     unwrap('{"reply":"Ligne 1\\nLigne 2","nutrition":null}') === 'Ligne 1\nLigne 2');
  ok('un message normal n\'est jamais touché',
     unwrap('Salut. Voilà ton total : 1500 kcal.') === 'Salut. Voilà ton total : 1500 kcal.');
  ok('  ni un message qui commence par une accolade sans être du JSON Titan',
     unwrap('{ceci n\'est pas du json}') === '{ceci n\'est pas du json}');
  ok('le filet est branché sur les bulles de Titan',
     /if \(type === 'titan'\) text = _titanUnwrapJson\(text\);/.test(html));
}

console.log('\n=== UNE RÉPONSE EN PROSE EST UNE RÉPONSE VALIDE ===\n');
{
  // Le mode nutrition reste armé plusieurs échanges, et toutes les questions
  // qui y passent ne décrivent pas un repas. « Redis-moi ce que j'ai mangé
  // aujourd'hui » est une question de LECTURE : Titan y répond en prose.
  // Exiger du JSON jetait cette réponse et affichait « J'ai calé sur ce
  // message » — alors que la réponse était juste.
  const prose = "Aujourd'hui tu as mangé des céréales avec du lait d'amande, "
    + "un smoothie vert et deux tranches de pain complet. Environ 515 kcal.";
  const p = sanitize.parse(prose);
  ok('une réponse en texte simple passe', p !== null && p.reply === prose, p && p.reply);
  ok('  et elle ne produit AUCUNE carte', p.nutrition === null);
  ok('  le message d\'erreur ne s\'affiche plus à sa place',
     !/calé sur ce message/.test(p.reply));

  const avecAccolade = 'Tu as pris { deux } tranches de pain ce matin.';
  const p2 = sanitize.parse(avecAccolade);
  ok('une accolade au fil d\'une phrase ne fait pas tout jeter',
     p2 !== null && p2.reply === avecAccolade, p2 && p2.reply);

  // La règle de v279 tient toujours : une enveloppe JSON cassée ne se déverse
  // JAMAIS à l'écran.
  ok('une enveloppe JSON irrécupérable est toujours refusée',
     sanitize.parse('{"nutrition":{"items":[{{{ !!!') === null);
  ok('  reconnue comme enveloppe, pas comme prose',
     /"reply"\s*:/.test('{"reply":"x"}') && /nutLooksLikeEnvelope/.test(srv));
  ok('une enveloppe cassée dont on peut sauver la phrase la garde',
     (sanitize.parse('{"reply":"Texte sauvé.","nutrition":{"items":[{{{') || {}).reply === 'Texte sauvé.');
  ok('un texte vide ne renvoie rien', sanitize.parse('') === null && sanitize.parse('   ') === null);

  ok('le prompt couvre les questions sur le journal',
     /QUESTIONS SUR LE JOURNAL/.test(srv)
     && /redis-moi ce que j'ai mangé aujourd'hui/.test(srv));
  ok('  en restant dans l\'enveloppe JSON',
     /Tu restes dans le JSON, la réponse va dans "reply"/.test(srv));
}

console.log('\n=== « TU PEUX ENREGISTRER » DOIT DÉCLENCHER L\'ACTION ===\n');
{
  // La phrase exacte de la capture. Le déclencheur exigeait « \benregistre\b »,
  // qui ne matche PAS « enregistrer » : la frontière de mot échoue devant le
  // « r ». Le message partait en chat normal, et Titan répondait qu'il ne
  // savait pas enregistrer.
  [
    'Tu peux enregistrer dans le journal',
    'enregistre ça',
    'Enregistre',
    'ajoute ça à mon journal',
    'rajoute le tout dans mon suivi',
    'sauvegarde ça',
    'note ça dans mon journal',
    'tu peux enregistrer ça'
  ].forEach(t => ok('  « ' + t + ' »', cli.isFood(t) === true, t));
  ok('mais « Pk tu répond comme ça » ne déclenche rien', cli.isFood('Pk tu répond comme ça') === false);
  ok('le prompt interdit à Titan de dire qu\'il ne peut pas enregistrer',
     /Ne dis JAMAIS que tu ne peux pas enregistrer/.test(srv));
  ok('  et le prompt de base annonce la carte',
     /CE QUE L'APP SAIT FAIRE POUR TOI[\s\S]{0,400}Enregistrer dans mon journal/.test(srv));
  ok('  sans jamais prétendre écrire lui-même',
     /Tu n'écris jamais toi-même dans son journal/.test(srv));
}

console.log('\n=== LA NUTRITION EST UN SUJET, PAS UN MESSAGE ISOLÉ ===\n');
{
  // Le trou observé en production : après « calcule mes kilocal », l'athlète
  // rebondit (« pk tu répond comme ça », « refais le calcul »). Ces messages
  // ne matchent aucun motif alimentaire, repassaient en chat normal, et Titan
  // redonnait le total EN TEXTE — l'app n'avait plus rien à enregistrer, et
  // le journal restait à zéro.
  win._titanNutriTurns = 0;
  const suite = [
    ["Ojd j'ai manger des cereal avec du lait d'amande, calcul mes kilocal", true],
    ['Pk tu répond comme ça', true],
    ['Tu peux enregistrer dans le journal', true],
    ['refais le calcul', true]
  ];
  suite.forEach(([m, att]) => {
    ok('  « ' + m.slice(0, 46) + ' » → ' + (att ? 'analyse' : 'chat'), cli.wants(m) === att, m);
  });
  ok('le verrou est bien armé après un message alimentaire', win._titanNutriTurns > 0);
}
{
  // Un vrai changement de sujet relâche le verrou immédiatement.
  win._titanNutriTurns = 0;
  ok('un repas arme le verrou', cli.wants("j'ai mangé du poulet ce midi") === true);
  ok('une question d\'entraînement le relâche', cli.wants('et ma séance de demain ?') === false);
  ok('  et il reste relâché', cli.wants('combien de séries sur le squat') === false);
  ok('  le compteur est remis à zéro', win._titanNutriTurns === 0, String(win._titanNutriTurns));
}
{
  // Le verrou s'épuise seul : il ne colle pas à la conversation pour toujours.
  win._titanNutriTurns = 0;
  cli.wants("j'ai mangé une pomme et deux oeufs");
  let n = 0;
  while (cli.wants('et donc ?') && n < 10) n++;
  ok('le verrou expire après quelques échanges', n > 0 && n <= 4, String(n) + ' rebonds');
  ok('  puis on revient en chat normal', cli.wants('et donc ?') === false);
}
{
  // Sans verrou armé, rien ne change pour les messages hors sujet.
  win._titanNutriTurns = 0;
  ['comment améliorer ma détente ?', 'je suis fatigué', 'ok', 'salut']
    .forEach(m => ok('  « ' + m + ' » reste du chat', cli.wants(m) === false, m));
}
{
  // Un message resté en mode analyse alors qu'il ne parle pas de nourriture
  // ne coûte RIEN : le prompt renvoie une liste vide, donc aucune carte. On
  // vérifie que la règle est bien écrite côté serveur.
  ok('le prompt sait répondre normalement hors sujet',
     /ne parle vraiment pas de nourriture[\s\S]{0,120}"items": \[\]/.test(srv));
  ok('  et un total sans aliments est explicitement interdit',
     /Si tu donnes un total, tu donnes les aliments/.test(srv));
  ok('  le rebond sur une analyse déjà faite est couvert',
     /QUAND TU REVIENS SUR UNE ANALYSE DÉJÀ FAITE/.test(srv)
     && /REMPLIS "items" À NOUVEAU/.test(srv));
}
{
  // Régression que j'avais introduite : le mode nutrition ne chargeait PAS
  // STATIC_SYSTEM, donc Titan perdait sa personnalité complète.
  const i = srv.indexOf("if (body.mode === 'nutrition')");
  const bloc = srv.slice(i, i + 900);
  ok('le mode nutrition garde la personnalité de Titan',
     /text: STATIC_SYSTEM/.test(bloc), bloc.slice(0, 200));
  ok('  et elle est mise en cache, donc gratuite ensuite',
     /text: STATIC_SYSTEM, cache_control/.test(bloc));
  ok('  le système nutrition vient ensuite', bloc.indexOf('STATIC_SYSTEM') < bloc.indexOf('NUTRITION_SYSTEM'));
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
    // L'écriture passe par _journalWrite, le point de passage UNIQUE qui rend
    // le journal et déclenche la synchro. Aucun appel Firestore direct nulle
    // part : ce serait contourner FB_SYNC_KEYS.
    ok('  l\'écriture passe par le point de passage unique du journal',
       /_journalWrite\(arr\)/.test(corps) && !/window\.fb\./.test(corps),
       corps.length + ' caractères lus');
    ok('  et ce point de passage synchronise bien',
       /function _journalWrite[\s\S]{0,400}?fbSaveProfile\(\)/.test(html));
    ok('  aucun écrivain du journal n\'appelle Firestore directement',
       !/_journalWrite[\s\S]{0,300}?window\.fb\.(setDoc|doc)\(/.test(html));
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
  // Le champ où l'athlète collait SA clé a été retiré : il ne reste plus la
  // moindre mention du format d'une clé Anthropic dans la page.
  ok('  et plus la moindre mention du format d\'une clé',
     (html.match(/sk-ant-/g) || []).length === 0,
     String((html.match(/sk-ant-/g) || []).length) + ' occurrence(s)');
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

console.log('\n=== CHAQUE REPAS A UNE IDENTITÉ ===\n');
{
  // Avant : un repas ne se désignait que par sa POSITION dans le tableau
  // global. Cet index se décale dès qu'une autre écriture arrive — recette,
  // plan repas, synchro d'un autre appareil — et « supprime ce que je viens
  // d'ajouter » pouvait retirer le mauvais.
  store.ah_nutri_journal = JSON.stringify([]);
  const a = cli.mealId(), b = cli.mealId();
  ok('deux identifiants ne se ressemblent pas', a !== b, a + ' / ' + b);
  ok('  et ils sont utilisables comme clé', /^m[a-z0-9]+$/.test(a), a);

  const mk = (id, nom, cal) => ({ id, ts: Date.now(), date: new Date().toISOString(),
    name: nom, cals: cal, prot: 0, carbs: 0, fat: 0,
    totals: { cal, p: 0, g: 0, l: 0 }, source: 'titan' });
  store.ah_nutri_journal = JSON.stringify([mk('m1', 'Petit-déj', 400), mk('m2', 'Déjeuner', 700)]);

  ok('un repas se retrouve par son id', cli.indexOf('m2') === 1, String(cli.indexOf('m2')));
  ok('  et par son index, comme avant', cli.indexOf(0) === 0);
  ok('  un id inconnu ne renvoie personne', cli.indexOf('mZZZ') === -1);
  ok('  une entrée sans id reste joignable par index',
     cli.indexOf(1, [{ name: 'vieux' }, { name: 'vieux2' }]) === 1);
}
{
  // Le scénario qui cassait : une autre écriture s'intercale, puis on
  // supprime « celui d'avant ».
  const mk = (id, nom, cal) => ({ id, ts: Date.now(), date: new Date().toISOString(),
    name: nom, cals: cal, totals: { cal, p: 0, g: 0, l: 0 } });
  store.ah_nutri_journal = JSON.stringify([mk('m1', 'Petit-déj', 400), mk('m2', 'Déjeuner', 700)]);
  const visé = 'm1';
  // Une recette s'ajoute AU DÉBUT (synchro d'un autre appareil, par ex.).
  const arr = cli.read(); arr.unshift(mk('m0', 'Recette', 300));
  store.ah_nutri_journal = JSON.stringify(arr);
  cli.remove(visé);
  const reste = cli.read().map(m => m.name);
  ok('la suppression par id retire le BON repas malgré le décalage',
     reste.join('|') === 'Recette|Déjeuner', reste.join('|'));
  ok('  supprimer deux fois ne casse rien', cli.remove(visé) === false);
  ok('  et le dit à l\'athlète', calls.toasts.some(t => /introuvable/.test(t)),
     JSON.stringify(calls.toasts.slice(-2)));
}
{
  // Modifier — n'existait sous aucune forme dans l'app.
  const mk = (id, cal) => ({ id, ts: Date.now(), date: new Date().toISOString(),
    name: 'Riz', cals: cal, prot: 5, carbs: 45, fat: 1, totals: { cal, p: 5, g: 45, l: 1 } });
  store.ah_nutri_journal = JSON.stringify([mk('r1', 240)]);
  ok('« finalement 250 g au lieu de 200 » est applicable',
     cli.update('r1', { calories: 300, carbs: 56 }) === true);
  const m = cli.read()[0];
  ok('  les totaux lus par le journal sont à jour',
     m.totals.cal === 300 && m.totals.g === 56, JSON.stringify(m.totals));
  ok('  et les champs plats ne divergent pas',
     m.cals === 300 && m.carbs === 56, m.cals + '/' + m.carbs);
  ok('  ce qui n\'est pas corrigé est conservé', m.totals.p === 5 && m.totals.l === 1);
  ok('  la correction est datée', /^\d{4}-/.test(m.editedAt || ''), m.editedAt);
  ok('modifier un repas inconnu échoue proprement', cli.update('inconnu', { calories: 1 }) === false);
  ok('un patch vide est refusé', cli.update('r1', null) === false);
}

console.log('\n=== CAS 3 · « COMBIEN ME RESTE-T-IL ? » ===\n');
{
  store.ah_profile = JSON.stringify({ nutriCal: 2988 });
  const today = new Date().toISOString();
  store.ah_nutri_journal = JSON.stringify([
    { id: 'a', date: today, totals: { cal: 515, p: 14, g: 84, l: 14 } },
    { id: 'b', date: '2020-01-01T10:00:00Z', totals: { cal: 9000, p: 0, g: 0, l: 0 } }
  ]);
  ok('les restantes se calculent sur la journée EN COURS',
     cli.reste() === 2473, String(cli.reste()));
  store.ah_nutri_journal = JSON.stringify([]);
  ok('journal vide → la cible entière reste', cli.reste() === 2988, String(cli.reste()));
  store.ah_nutri_journal = JSON.stringify([{ id: 'c', date: today, totals: { cal: 3200 } }]);
  ok('cible dépassée → valeur négative, pas zéro', cli.reste() === -212, String(cli.reste()));
  store.ah_profile = JSON.stringify({});
  ok('sans cible enregistrée, on n\'invente rien', cli.reste() === null, String(cli.reste()));

  // Côté serveur : la ligne doit exister dans le prompt.
  // L'apostrophe est échappée dans la source JS : RESTE AUJOURD\'HUI.
  ok('le prompt porte la ligne RESTE AUJOURD\'HUI', /RESTE AUJOURD\\?'HUI/.test(srv));
  ok('  et le détail repas par repas', /a\.liste\.forEach/.test(srv));
  ok('  avec les identifiants, mais jamais montrés à l\'athlète',
     /Ne les montre jamais à/.test(srv));
}

console.log('\n=== CAS 2 · « OUI, AJOUTE-LE » ÉCRIT VRAIMENT ===\n');
{
  // wantsSave vient du serveur et n'est vrai que sur une demande EXPLICITE.
  store.ah_nutri_journal = JSON.stringify([]);
  store.ah_profile = JSON.stringify({ nutriCal: 2000 });
  const nut = sanitize.san({
    items: [{ name: 'Poulet', quantity: '150 g', calories: 250, protein: 35, carbs: 0, fat: 11 },
            { name: 'Riz', quantity: '200 g', calories: 260, protein: 5, carbs: 57, fat: 1 }],
    wantsSave: true, confidence: 'haute'
  });
  ok('la demande explicite est portée par l\'analyse', nut.wantsSave === true);
  cli.pending['x1'] = nut;
  cli.save('x1', true);
  const j = cli.read();
  ok('le repas est écrit', j.length === 1 && j[0].totals.cal === 510, JSON.stringify(j.map(m => m.totals)));
  ok('  et il porte un identifiant', !!j[0].id, String(j[0].id));
  ok('les restantes sont recalculées APRÈS écriture', cli.reste() === 1490, String(cli.reste()));

  // Le filet : annuler retire exactement cette entrée.
  ok('l\'ajout s\'annule', cli.remove(j[0].id) === true);
  ok('  et le journal revient comme avant', cli.read().length === 0);
}
{
  // La règle de sécurité : une simple mention n'écrit RIEN.
  store.ah_nutri_journal = JSON.stringify([]);
  const nut = sanitize.san({
    items: [{ name: 'Riz', calories: 260, protein: 5, carbs: 57, fat: 1 }],
    wantsSave: false
  });
  ok('CAS 6 — une intention future ne demande pas l\'écriture', nut.wantsSave === false);
  cli.pending['x2'] = nut;
  ok('  et rien n\'est écrit tant qu\'on n\'a pas décidé', cli.read().length === 0);
  ok('le prompt exige une demande explicite',
     /wantsSave[\s\S]{0,300}intention future[\s\S]{0,60}false/.test(srv));
  ok('  et fait parler Titan au passé quand l\'app a écrit',
     /Quand "wantsSave" vaut true, l'app ÉCRIT le repas dès ta réponse/.test(srv));
}
{
  // Le rendu de la carte : demande explicite → accusé de réception + Annuler.
  const i = html.indexOf('function _titanRenderNutriCard');
  const corps = html.slice(i, html.indexOf('window._titanRenderNutriCard ='));
  ok('une demande explicite écrit sans attendre de tap',
     /if \(nut\.wantsSave\) \{[\s\S]{0,400}_titanNutriSave\(id, true\)/.test(corps));
  ok('  et la carte porte un bouton Annuler',
     /_titanNutriUndo\(/.test(html) && /Annuler cet ajout/.test(html));
  ok('  qui retire l\'entrée par son identifiant',
     /removeJournalMeal\(mealId\)/.test(html));
  ok('sans demande explicite, la carte propose et n\'écrit pas',
     /tn-btn-go" onclick="window\._titanNutriSave\(\\'/.test(html));
}

console.log('\n=== LES FENÊTRES DE CONTEXTE ===\n');
{
  ok('le mode nutrition voit 10 messages, comme le chat',
     (srv.match(/messages\.slice\(-10\)/g) || []).length === 2
     && !/messages\.slice\(-6\)/.test(srv),
     (srv.match(/messages\.slice\(-\d+\)/g) || []).join(', '));
  ok('le fil garde 60 messages', /var TITAN_CHAT_KEEP = 60;/.test(html));
  ok('  et la synchro reste bornée en octets', /TITAN_CHAT_SYNC_BYTES = 60000/.test(html));
}

console.log('\n=== LE SCAN PHOTO PASSE PAR LE PROXY, PLUS PAR LE NAVIGATEUR ===\n');
{
  // Avant : le scan appelait api.anthropic.com EN DIRECT depuis la page, avec
  // une clé que l'athlète collait dans les réglages et qui dormait en clair
  // dans localStorage. Zéro auth, zéro quota, zéro modération — toutes les
  // protections du projet contournées. Et le champ de saisie ayant disparu du
  // HTML entre-temps, la fonctionnalité était de toute façon MORTE.
  // Le nom du domaine subsiste dans un commentaire d'historique : ce qu'on
  // vérifie, c'est qu'aucun FETCH ne le vise plus.
  ok('plus aucun appel direct à Anthropic depuis la page',
     !/fetch\(\s*['"`]https:\/\/api\.anthropic\.com/.test(html));
  ok('  le domaine ne subsiste que dans un commentaire',
     (html.match(/api\.anthropic\.com/g) || []).length <= 1
     && /\/\/[^\n]*api\.anthropic\.com/.test(html));
  ok('l\'en-tête d\'accès direct navigateur a disparu',
     !/anthropic-dangerous-direct-browser-access/.test(html));
  ok('aucune clé Anthropic n\'est plus lue', !/getItem\('ah_anthropic_key'\)/.test(html));
  ok('  et la clé d\'un ancien appareil est purgée',
     /removeItem\('ah_anthropic_key'\)/.test(html));
  ok('le code mort du champ de saisie est retiré',
     !/function apiKeySave\(/.test(html) && !/function apiKeyRestore\(/.test(html)
     && !/function scanScrollToApi\(/.test(html));
  ok('  et plus personne ne l\'appelle',
     !/apiKeyRestore\(\)/.test(html) && !/scanScrollToApi/.test(html));
  ok('l\'encart « ajoute ta clé API » est retiré',
     !/ajoute ta clé API Anthropic/.test(html));

  ok('le scan passe par la fonction Netlify',
     /fetch\('\/\.netlify\/functions\/titan'[\s\S]{0,400}?mode: 'scan'/.test(html));
  ok('  avec un jeton d\'authentification',
     /mode: 'scan'/.test(html) && /Bearer ' \+ idToken/.test(html));
  ok('  et il refuse de partir sans compte connecté',
     /if \(!window\.fbUser\)[\s\S]{0,220}?Connecte-toi pour analyser une photo/.test(html));
  ok('la raison d\'un échec vient du serveur, plus d\'un « vérifie ta clé »',
     /parsed && parsed\.error/.test(html) && !/Vérifie ta clé API/.test(html));
}
{
  // Côté serveur : le mode existe, il est borné, et il refuse une requête
  // sans image.
  ok('le serveur porte le mode scan', /body\.mode === 'scan'/.test(srv));
  ok('  il exige une image', /isScan && !\(body\.image/.test(srv));
  ok('  le prompt du scan a été déplacé côté serveur, à l\'identique',
     /const SCAN_SYSTEM = 'Tu es un expert en nutrition sportive/.test(srv));
  ok('  et la clé reste une variable d\'environnement',
     /'x-api-key': process\.env\.ANTHROPIC_API_KEY/.test(srv));

  const scan = new Function(
    grabConst(srv, 'SCAN_MAX_FOODS') + '\n'
    + grab(srv, 'function nutNum(') + '\n'
    + grab(srv, 'function nutStr(') + '\n'
    + grab(srv, 'function nutEscapeControlChars(') + '\n'
    + grab(srv, 'function nutCloseTruncated(') + '\n'
    + grab(srv, 'function sanitizeScan(') + '\n'
    + grab(srv, 'function parseScanJson(') + '\n'
    + 'return { san:sanitizeScan, parse:parseScanJson };'
  )();

  const bon = scan.san({ foods: [
    { name: 'poulet grillé', qty: 150, unit: 'g', cal: 165, p: 31, g: 0, l: 4 },
    { name: 'oeuf', qty: 2, unit: 'unité', cal: 155, p: 13, g: 1.1, l: 11 }
  ], note: 'Correct.' });
  ok('la forme attendue par l\'écran de scan est préservée',
     bon.foods[0].name === 'poulet grillé' && bon.foods[0].unit === 'g'
     && bon.foods[0].qty === 150 && bon.foods[0].cal === 165, JSON.stringify(bon.foods[0]));
  ok('  l\'unité « unité » est reconnue', bon.foods[1].unit === 'unité' && bon.foods[1].qty === 2);
  ok('  la note de Titan est conservée', bon.note === 'Correct.');

  const sale = scan.san({ foods: [
    { name: 'x', qty: 99999, unit: 'g', cal: 99999, p: -5, g: 'plein', l: NaN },
    { qty: 100, cal: 200 },
    { name: 'riz', qty: 200, unit: 'g', cal: 130, p: 2.7, g: 28, l: 0.3 }
  ] });
  ok('une valeur délirante est bornée', sale.foods[0].cal === 900, String(sale.foods[0].cal));
  ok('  une quantité absurde aussi', sale.foods[0].qty === 5000, String(sale.foods[0].qty));
  ok('  négatif, texte et NaN deviennent zéro',
     sale.foods[0].p === 0 && sale.foods[0].g === 0 && sale.foods[0].l === 0);
  ok('  un aliment sans nom est retiré', sale.foods.length === 2, String(sale.foods.length));
  ok('la liste est plafonnée',
     scan.san({ foods: Array.from({ length: 40 }, (_, i) => ({ name: 'a' + i, cal: 1 })) }).foods.length === 20);
  ok('aucun aliment exploitable → rien plutôt qu\'une liste vide',
     scan.san({ foods: [] }) === null && scan.san(null) === null);

  ok('les balises de code sont retirées',
     (scan.parse('```json\n{"foods":[{"name":"riz","qty":100,"unit":"g","cal":130}],"note":"ok"}\n```') || {}).note === 'ok');
  ok('  et un retour à la ligne littéral ne fait pas échouer la lecture',
     !!scan.parse('{"foods":[{"name":"riz","qty":100,"unit":"g","cal":130}],"note":"Deux\nlignes."}'));
  ok('du texte sans JSON ne renvoie rien', scan.parse('désolé') === null);
}

const failed = R.filter(x => !x).length;
console.log('\n' + '='.repeat(62));
console.log(failed ? 'RÉSULTAT : ' + failed + ' ÉCHEC(S) sur ' + R.length
                   : 'RÉSULTAT : ' + R.length + '/' + R.length + ' tests passés.');
process.exit(failed ? 1 : 0);
