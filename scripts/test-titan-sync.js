// Synchronisation de la conversation Titan entre appareils.
// La clé ah_titan_chat est la seule clé synchronisée qui s'écrit à chaque
// tour de conversation ET dont la taille dépend de ce que le modèle écrit.
// Ce harnais extrait les VRAIES fonctions d'index.html et vérifie les trois
// garde-fous : fusion (pas d'écrasement), budget d'octets, écriture groupée.
//   node scripts/test-titan-sync.js [autre.html]
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(process.argv[2] || path.join(ROOT, 'index.html'), 'utf8');

function balance(from, braceFrom) {
  let d = 0, j = html.indexOf('{', braceFrom === undefined ? from : braceFrom);
  for (; j < html.length; j++) {
    if (html[j] === '{') d++;
    else if (html[j] === '}') { d--; if (!d) { j++; break; } }
  }
  return html.slice(from, j);
}
const fn = (n) => {
  const s = html.indexOf('function ' + n + '(');
  if (s < 0) throw new Error('introuvable: ' + n);
  return balance(s, html.indexOf('(', s));
};
const cst = (n) => {
  const re = new RegExp('var\\s+' + n + '\\s*=[^;]+;');
  const m = re.exec(html);
  if (!m) throw new Error('introuvable: ' + n);
  return m[0];
};

const api = new Function(
  [cst('TITAN_CHAT_KEEP'), cst('TITAN_CHAT_SYNC_BYTES'),
   fn('_titanMsgKey'), fn('_titanMergeChat'), fn('_titanChatForSync')].join('\n')
  + '\nreturn { merge:_titanMergeChat, forSync:_titanChatForSync, key:_titanMsgKey,'
  + '         KEEP:TITAN_CHAT_KEEP, BYTES:TITAN_CHAT_SYNC_BYTES };'
)();

const R = [];
const ok = (l, c, d) => { R.push(c); console.log((c ? '  PASS  ' : '  FAIL  ') + l + (d && !c ? '  → ' + d : '')); };
const T = Date.UTC(2026, 8, 1, 10, 0, 0);
const u = (txt, t) => ({ role: 'user', content: txt, t: t });
const a = (txt, t) => ({ role: 'assistant', content: txt, t: t });
const txts = (arr) => arr.map(m => (Array.isArray(m.content) ? '[img]' : m.content)).join(' | ');

console.log('\n=== FUSION : AUCUN MESSAGE N\'EST PERDU ===\n');
{
  // Le scénario réel : l'athlète parle sur son téléphone, puis ouvre la
  // tablette. Un écrasement effacerait l'une des deux moitiés.
  const tel = [u('Salut', T), a('Yo.', T + 1000)];
  const tab = [u('Et la récup ?', T + 60000), a('48 h.', T + 61000)];
  const m = api.merge(tel, tab);
  ok('les deux appareils sont réunis', m.length === 4, txts(m));
  ok('  dans l\'ordre du temps réel',
     txts(m) === 'Salut | Yo. | Et la récup ? | 48 h.', txts(m));
}
{
  // Le cas le plus fréquent : un tronc commun, puis une divergence.
  const commun = [u('Salut', T), a('Yo.', T + 1000)];
  const tel = commun.concat([u('Question A', T + 5000), a('Réponse A', T + 6000)]);
  const tab = commun.concat([u('Question B', T + 3000), a('Réponse B', T + 4000)]);
  const m = api.merge(tel, tab);
  ok('le tronc commun n\'est pas dupliqué', m.length === 6, String(m.length));
  ok('  et les deux branches s\'entrelacent par le temps',
     txts(m) === 'Salut | Yo. | Question B | Réponse B | Question A | Réponse A', txts(m));
}
{
  const local = [u('Salut', T)];
  ok('fusion avec un distant vide → le local intact',
     txts(api.merge(local, [])) === 'Salut');
  ok('fusion avec un local vide → le distant intact',
     txts(api.merge([], local)) === 'Salut');
  ok('deux côtés vides → tableau vide', api.merge([], []).length === 0);
  ok('données non conformes → aucune exception',
     Array.isArray(api.merge(null, undefined)) && Array.isArray(api.merge('x', 42)));
}
{
  // Un message identique des deux côtés ne doit apparaître qu'une fois,
  // et garder son horodatage le plus ancien (le vrai).
  const m = api.merge([a('Même texte', T + 9000)], [a('Même texte', T)]);
  ok('un message présent des deux côtés n\'apparaît qu\'une fois', m.length === 1, txts(m));
  ok('  et garde son horodatage d\'origine', m[0].t === T, String(m[0].t));
}
{
  // Rétrocompatibilité : les conversations déjà enregistrées n'ont pas de `t`.
  const vieux = [{ role: 'user', content: 'Ancien 1' }, { role: 'assistant', content: 'Ancien 2' }];
  const neuf = [u('Nouveau', T)];
  const m = api.merge(vieux, neuf);
  ok('une conversation sans horodatage n\'est pas perdue', m.length === 3, txts(m));
  ok('  les anciens messages restent en tête, dans leur ordre',
     txts(m) === 'Ancien 1 | Ancien 2 | Nouveau', txts(m));
}
{
  // Les blocs image : le contenu est un tableau, pas une chaîne.
  const img = { role: 'user', t: T, content: [
    { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: 'AAAA' } },
    { type: 'text', text: 'Regarde ça' }
  ] };
  const m = api.merge([img], [img]);
  ok('un message à blocs ne se dédouble pas', m.length === 1, String(m.length));
  ok('  et sa clé se lit sur le texte', /Regarde ça/.test(api.key(img)), api.key(img));
}
{
  // Le plafond de 40 s'applique après fusion, en gardant les plus récents.
  const gros = [];
  for (let i = 0; i < 30; i++) gros.push(u('A' + i, T + i * 1000));
  const autre = [];
  for (let i = 0; i < 30; i++) autre.push(u('B' + i, T + 100000 + i * 1000));
  const m = api.merge(gros, autre);
  ok('la fusion respecte le plafond de 40 messages', m.length === api.KEEP, String(m.length));
  ok('  et garde les plus RÉCENTS', m[m.length - 1].content === 'B29', m[m.length - 1].content);
}

console.log('\n=== BUDGET D\'OCTETS DU DOCUMENT ===\n');
{
  const court = [u('Salut', T), a('Yo.', T + 1)];
  ok('une conversation courte part entière',
     api.forSync(court).length === 2, String(api.forSync(court).length));

  // Pire cas réaliste : MAX_TOKENS = 700 côté serveur ≈ 2,8 Ko par réponse.
  // 40 messages de cette taille pèsent ~112 Ko — bien au-dessus du budget,
  // donc l'écrêtage DOIT se déclencher.
  const long = [];
  for (let i = 0; i < 60; i++) long.push(a('R'.repeat(2800), T + i * 2000));
  const sync = api.forSync(long);
  const size = JSON.stringify(sync).length;
  ok('une conversation énorme est écrêtée', sync.length < 40, String(sync.length));
  ok('  et tient dans le budget', size <= api.BYTES, size + ' octets');
  ok('  en sacrifiant les plus ANCIENS, jamais les récents',
     sync[sync.length - 1].t === long[long.length - 1].t,
     String(sync[sync.length - 1].t) + ' vs ' + String(long[long.length - 1].t));
  ok('  il en reste quand même une tranche utile', sync.length >= 15, String(sync.length));
  ok('le budget laisse de la place au reste du document',
     api.BYTES <= 200000, String(api.BYTES));
  ok('données non conformes → tableau vide, pas d\'exception',
     Array.isArray(api.forSync(null)) && Array.isArray(api.forSync('x')));
}

console.log('\n=== CÂBLAGE DANS LA COUCHE DE SYNCHRO ===\n');
{
  ok('la clé est déclarée synchronisée',
     /\['ah_titan_chat',\s*'titanChat',\s*true\]/.test(html));
  ok('la lecture FUSIONNE au lieu d\'écraser',
     /if \(sk === 'ah_titan_chat'\)/.test(html) && /_titanMergeChat\(localChat, data\[ff\]\)/.test(html));
  ok('l\'écriture passe par le budget d\'octets',
     /out\.titanChat = _titanChatForSync\(out\.titanChat\)/.test(html));
  ok('un chat illisible ne fait pas échouer toute la sauvegarde',
     /catch\(e\) \{ delete out\.titanChat; \}/.test(html));

  // §10 : pas une écriture Firestore par message.
  ok('persistTitanChat n\'appelle PAS fbSaveProfile directement',
     !/persistTitanChat\(\)[\s\S]{0,400}?fbSaveProfile\(\);\s*\n\}/.test(
        html.slice(html.indexOf('function persistTitanChat'), html.indexOf('function _titanScheduleSync'))));
  ok('les écritures sont groupées par un délai',
     /_titanSyncTimer = setTimeout\(/.test(html) && /TITAN_SYNC_DEBOUNCE/.test(html));
  ok('  et rien n\'est écrit si personne n\'est connecté',
     /if \(!window\.fbUser \|\| typeof fbSaveProfile !== 'function'\) return;/.test(html));
  ok('  une rafale de messages ne planifie qu\'une écriture',
     /if \(_titanSyncTimer\) clearTimeout\(_titanSyncTimer\);/.test(html));
}

console.log('\n=== L\'HEURE AFFICHÉE EST CELLE DU MESSAGE ===\n');
{
  const getTimeStr = new Function('return ' + fn('getTimeStr').replace(/^function /, 'function ') + ';')();
  const d = new Date(2026, 8, 1, 14, 32);
  ok('un message du jour affiche son heure', getTimeStr(d.getTime()) === '14:32', getTimeStr(d.getTime()));
  const vieux = new Date(2026, 7, 20, 9, 5).getTime();
  ok('un message d\'un autre jour porte sa date',
     /août/.test(getTimeStr(vieux)) && /09:05/.test(getTimeStr(vieux)), getTimeStr(vieux));
  ok('sans horodatage → l\'heure courante, comme avant',
     /^\d\d:\d\d$/.test(getTimeStr()), getTimeStr());
  ok('un horodatage aberrant ne casse rien', /^\d\d:\d\d$/.test(getTimeStr(NaN)), getTimeStr(NaN));
  ok('la restauration transmet l\'horodatage',
     /addMessage\(m\.content, 'user', null, m\.t\)/.test(html)
     && /addMessage\(m\.content, 'titan', null, m\.t\)/.test(html));
  ok('les nouveaux messages sont horodatés à l\'écriture',
     /role: 'user', content: userMessage, t: Date\.now\(\)/.test(html)
     && /role: 'assistant', content: data\.reply, t: Date\.now\(\)/.test(html));
}

const failed = R.filter(x => !x).length;
console.log('\n' + '='.repeat(60));
console.log(failed ? 'RÉSULTAT : ' + failed + ' ÉCHEC(S) sur ' + R.length
                   : 'RÉSULTAT : ' + R.length + '/' + R.length + ' tests passés.');
process.exit(failed ? 1 : 0);
