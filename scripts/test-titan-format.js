// Lisibilité des réponses de Titan dans le chat.
// L'enjeu : ce que Titan écrit doit arriver à l'écran aéré, avec ses listes
// et son gras — et sans qu'un message puisse injecter du HTML dans la page.
//   node scripts/test-titan-format.js
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(process.argv[2] || path.join(ROOT, 'index.html'), 'utf8');
const srv  = fs.readFileSync(path.join(ROOT, 'netlify', 'functions', 'titan.js'), 'utf8');

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

// escapeHtml passe par le DOM : on le remplace par un équivalent strict.
const render = new Function(
  'escapeHtml',
  grab(html, 'function _titanRenderMd(') + '\nreturn _titanRenderMd;'
)(t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;')
                .replace(/>/g, '&gt;').replace(/"/g, '&quot;'));

const R = [];
const ok = (l, c, d) => { R.push(c); console.log((c ? '  PASS  ' : '  FAIL  ') + l + (d && !c ? '  → ' + d : '')); };
const txt = h => h.replace(/<[^>]+>/g, '\n').replace(/\n{2,}/g, '\n').trim();

console.log('\n=== PLUS AUCUN MARKDOWN BRUT À L\'ÉCRAN ===\n');
{
  const h = render('**Estimation révisée :** voilà le détail.');
  ok('le gras est rendu, pas affiché', /<strong>Estimation révisée :<\/strong>/.test(h) && h.indexOf('**') < 0, h);
  const t = render('### Bilan\nTout va bien.');
  ok('un titre Markdown ne sort jamais avec ses dièses', t.indexOf('#') < 0 && /<strong>Bilan<\/strong>/.test(t), t);
  const l = render('- Poulet\n- Riz');
  ok('les tirets deviennent une liste, pas du texte', l.indexOf('- ') < 0 && /<li>Poulet<\/li>/.test(l), l);
}

console.log('\n=== LE MUR DE TEXTE DE LA CAPTURE ===\n');
{
  // La réponse exacte qui a motivé la correction.
  const reply = "Ah, de l'attiéké — pas du couscous. Je corrige.\n\n"
    + "L'attiéké c'est de la semoule de manioc, index glycémique un peu plus élevé que le riz.\n\n"
    + "**Estimation révisée :**\n\n"
    + "- Poulet grillé (2 morceaux) → ~250-300 kcal · ~35g protéines\n"
    + "- Attiéké (~300g) → ~300-350 kcal · ~2g protéines\n"
    + "- Tomates + salade → ~30 kcal\n\n"
    + "**Total → ~580-680 kcal · ~37-40g protéines**";
  const h = render(reply);
  ok('la réponse est découpée en blocs', (h.match(/<p>/g) || []).length >= 3,
     String((h.match(/<p>/g) || []).length) + ' paragraphes');
  ok('les trois aliments sont trois lignes',
     (h.match(/<li>/g) || []).length === 3, String((h.match(/<li>/g) || []).length));
  ok('le total ressort en gras', /<strong>Total → ~580-680 kcal · ~37-40g protéines<\/strong>/.test(h));
  ok('plus une seule astérisque visible', h.indexOf('*') < 0);
  ok('aucun bloc ne dépasse 3 phrases',
     txt(h).split('\n').every(l => (l.match(/[.!?]\s/g) || []).length <= 3));
}

console.log('\n=== LES CINQ CAS DEMANDÉS ===\n');
{
  const cas = [
    ['question très courte', 'Oui. Repose-toi.'],
    ['question nutritionnelle',
      'Ton repas tient la route.\n\n**Ce qui manque :** des légumes verts.\n\n- Épinards\n- Brocolis\n\nAjoute-en à midi.'],
    ['question d\'entraînement',
      'Là je changerais quelque chose.\n\n**Le problème :** trop de volume.\n\n→ 3 × 3 répétitions\n→ récupération complète\n→ priorité à la vitesse\n\nSi la vitesse baisse, **tu arrêtes la série.**'],
    ['réponse longue et structurée',
      'Trois choses à corriger.\n\n1. Ton sommeil est trop court.\n2. Tu enchaînes deux séances lourdes.\n3. Tu sautes le petit-déjeuner.\n\nOn commence par le sommeil. Le reste suivra.'],
    ['conversation naturelle', 'T\'es là. C\'est déjà ça. Qu\'est-ce qu\'on travaille aujourd\'hui ?']
  ];
  cas.forEach(([nom, reply]) => {
    const h = render(reply);
    const brut = /\*\*|^#{1,6}\s|(^|\n)[-*]\s/.test(txt(h));
    const lignes = txt(h).split('\n').filter(Boolean);
    ok(nom + ' — aucun Markdown brut', !brut, txt(h).slice(0, 60));
    ok(nom + ' — rien de vide, rien de perdu', lignes.length > 0 && txt(h).length > 0);
  });
  const court = render('Oui. Repose-toi.');
  ok('une réponse courte reste un seul paragraphe',
     (court.match(/<p>/g) || []).length === 1 && court.indexOf('<ul') < 0, court);
  const fleches = render('→ 3 × 3 répétitions\n→ récupération complète');
  ok('les flèches en début de ligne font une liste',
     (fleches.match(/<li>/g) || []).length === 2, fleches);
  const numer = render('1. Ton sommeil\n2. Tes séances');
  ok('une énumération numérotée aussi', (numer.match(/<li>/g) || []).length === 2, numer);
}

console.log('\n=== SÉCURITÉ : AUCUNE INJECTION POSSIBLE ===\n');
{
  // Titan reprend le texte de l'athlète : "c'est atiéké" → "Ah, de l'attiéké".
  // Un message contenant du HTML ne doit jamais devenir du HTML.
  const h = render('Tu as écrit <img src=x onerror=alert(1)> — je corrige.');
  ok('les balises sont neutralisées', h.indexOf('<img') < 0 && /&lt;img/.test(h), h);
  const s2 = render('<script>alert(1)</script>');
  ok('un script ne passe pas', s2.toLowerCase().indexOf('<script') < 0, s2);
  ok('les guillemets aussi', render('Il a dit "salut"').indexOf('&quot;') > -1);
  ok('l\'esperluette est échappée avant le reste', /&amp;/.test(render('poulet & riz')));
}

console.log('\n=== NON-RÉGRESSION ===\n');
{
  ok('le message de l\'athlète reste échappé comme avant',
     /escapeHtml\(text \|\| ''\)/.test(html));
  // Le renderer ne doit JAMAIS toucher un message de l'athlète. On énumère
  // ses points d'appel plutôt que de les compter : un nouvel appel devient
  // une décision explicite, pas un compteur à rallonge.
  //   1. sa définition
  //   2. la bulle de Titan dans addMessage
  //   3. la liste des messages enregistrés (même contenu, même rendu)
  ok('seul le message de Titan passe par le renderer',
     /_titanRenderMd\(text\)/.test(html)
     && (html.match(/_titanRenderMd\(/g) || []).length === 3
     && !/_titanRenderMd\([^)]*escapeHtml/.test(html));
  ok('  et la liste des enregistrés le rend comme la bulle',
     /class="tsv-txt">' \+ _titanRenderMd\(e\.text\)/.test(html));
  ok('la bulle sait afficher paragraphes et listes',
     /\.msg-bubble p\{/.test(html) && /\.msg-bubble \.tm-list\{/.test(html));
  ok('rien d\'autre n\'a changé dans addMessage',
     /msg\.className = 'msg ' \+ type;/.test(html) && /body\.scrollTop = body\.scrollHeight;/.test(html));

  // Le prompt : la forme seulement, la personnalité intacte.
  ok('la section FORME DES RÉPONSES est ajoutée', /FORME DES RÉPONSES/.test(srv));
  ok('le ton et le style ne sont pas touchés',
     /Direct\. Honnête\. Bienveillant dans la dureté\./.test(srv)
     && /Jamais condescendant\. Jamais flatteur sans raison\. Jamais d'humour\./.test(srv)
     && /Tu tutoies toujours, jamais de vouvoiement\./.test(srv));
  ok('les règles de longueur d\'origine sont conservées',
     /Maximum 2 à 3 phrases pour une question MOTIVATIONNELLE/.test(srv)
     && /jusqu'à 5-6 phrases si le sujet le mérite/.test(srv));
  ok('les exemples de style Titan sont intacts',
     /"Félicitations pour votre séance !" → "Premier pas\. On enregistre\. On continue\."/.test(srv));
  // La section ne doit porter aucune règle de coaching : pas de programme
  // nommé, pas de renvoi au livre, aucune prescription chiffrée.
  {
    const i = srv.indexOf('FORME DES RÉPONSES');
    const sect = srv.slice(i, srv.indexOf('═══════════════════════════════', i + 40));
    ok('la nouvelle section ne porte aucune règle de coaching',
       !/(VERTICAL DUNK|ELITE ATHLETE|SHRED|TRIPHASIQUE|MICROTRAINING|EXPLOSE|page \d|1RM|kcal|RPE|\d+ ?(kg|reps|séries))/i.test(sect),
       sect.slice(0, 80));
    ok('elle ne redéfinit pas la longueur des réponses',
       !/\d+ à \d+ phrases pour une question/i.test(sect));
    ok('elle tient en une vingtaine de lignes', sect.split('\n').length < 26,
       String(sect.split('\n').length));
  }
  ok('elle interdit explicitement les titres et les tableaux',
     /Pas de titres \(#, ##, ###\)\. Pas de tableaux\./.test(srv));
}

const failed = R.filter(x => !x).length;
console.log('\n' + '='.repeat(60));
console.log(failed ? 'RÉSULTAT : ' + failed + ' ÉCHEC(S) sur ' + R.length
                   : 'RÉSULTAT : ' + R.length + '/' + R.length + ' tests passés.');
process.exit(failed ? 1 : 0);
