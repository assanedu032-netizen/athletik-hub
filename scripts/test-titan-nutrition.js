// Titan doit connaître le poids et le journal de l'athlète.
// Bug remonté : "Tu pèses combien ?" alors que le poids est saisi à
// l'onboarding, et une estimation de calories faite de tête alors que l'app
// tient le compte exact. Rien de tout ça ne partait dans le contexte.
//   node scripts/test-titan-nutrition.js
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

// _titanNutritionCtx reçoit le profil déjà parsé (comme dans callAnthropicAPI)
// et relit le journal depuis localStorage.
function client(store) {
  const fn = new Function('localStorage', 'window', 'console',
    grab(html, 'function _titanNutritionCtx(') + '\nreturn _titanNutritionCtx;')(
      { getItem: k => (k in store ? store[k] : null), setItem() {}, removeItem() {} },
      {}, console);
  let prof = {};
  try { prof = JSON.parse(store.ah_profile || '{}'); } catch (e) {}
  return () => fn(prof);
}
const render = new Function(grab(srv, 'function buildNutritionContext(') + '\nreturn buildNutritionContext;')();
const full = new Function(grab(srv, 'function buildNutritionContext(') + '\n'
  + grab(srv, 'function buildAthleteContext(') + '\nreturn buildAthleteContext;')();

const R = [];
const ok = (l, c, d) => { R.push(c); console.log((c ? '  PASS  ' : '  FAIL  ') + l + (d && !c ? '  → ' + d : '')); };

const today = new Date().toISOString().slice(0, 10);
const hier  = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

console.log('\n=== LE POIDS PART, TITAN NE LE REDEMANDE PLUS ===\n');
{
  const n = client({ ah_profile: JSON.stringify({ poids: 78, taille: 182, age: 24, sexe: 'homme' }) })();
  ok('le poids est dans le contexte', n && n.poids === 78, JSON.stringify(n));
  ok('la taille aussi', n.taille === 182);
  ok('âge et sexe suivent', n.age === 24 && n.sexe === 'homme');
  const txt = render(n);
  ok('et il arrive dans le prompt', /Morphologie : 78 kg · 182 cm · 24 ans · homme/.test(txt), txt);
  ok('avec la consigne de ne pas redemander',
     /Tu ne redemandes\s*\n?jamais une donnée qui est écrite ici/.test(txt));
}
{
  // Le poids peut avoir été saisi côté nutrition plutôt que profil.
  const n = client({ ah_profile: JSON.stringify({ nutriPoids: 82, nutriTaille: 178 }) })();
  ok('le poids saisi dans l\'écran Nutrition compte aussi', n.poids === 82 && n.taille === 178,
     JSON.stringify(n));
}

console.log('\n=== LE JOURNAL DU JOUR REMPLACE L\'ESTIMATION DE TÊTE ===\n');
{
  const journal = [
    { date: today, name: 'Attiéké poulet', totals: { cal: 650, p: 38, g: 70, l: 18 } },
    { date: today, name: 'Shake vanille',  totals: { cal: 280, p: 22, g: 20, l: 12 } },
    { date: hier,  name: 'Riz poulet',     totals: { cal: 700, p: 45, g: 80, l: 15 } }
  ];
  const n = client({
    ah_profile: JSON.stringify({ poids: 78, taille: 182, nutriCal: 3100, nutriProt: 170,
                                 nutriGluc: 380, nutriLip: 90, nutriObj: 'priseMuscle' }),
    ah_nutri_journal: JSON.stringify(journal)
  })();
  ok('seuls les repas du jour sont comptés', n.aujourdhui.repas === 2, String(n.aujourdhui.repas));
  ok('les totaux sont exacts',
     n.aujourdhui.kcal === 930 && n.aujourdhui.prot === 60, JSON.stringify(n.aujourdhui));
  ok('les repas sont nommés',
     n.aujourdhui.noms.join(', ') === 'Attiéké poulet, Shake vanille', n.aujourdhui.noms.join(', '));
  ok('les cibles calculées par l\'app sont transmises',
     n.cibles.kcal === 3100 && n.cibles.prot === 170, JSON.stringify(n.cibles));
  const txt = render(n);
  ok('le prompt donne le chiffre exact, pas une fourchette',
     /Aujourd'hui : 2 repas enregistrés — 930 kcal/.test(txt), txt);
  ok('et la cible en face', /Cibles quotidiennes : 3100 kcal · 170g prot/.test(txt));
  ok('la moyenne sur la semaine est calculée', n.moyenne7j.jours === 2, JSON.stringify(n.moyenne7j));
}
{
  const n = client({
    ah_profile: JSON.stringify({ poids: 78, nutriCal: 3100 }),
    ah_nutri_journal: JSON.stringify([{ date: hier, totals: { cal: 700 } }])
  })();
  ok('un jour sans repas est dit explicitement', n.aujourdhui.repas === 0);
  ok('le prompt le dit aussi',
     /Aujourd'hui : aucun repas enregistré dans le journal\./.test(render(n)));
  ok('un seul jour ne fait pas une moyenne', n.moyenne7j === undefined);
}

console.log('\n=== RIEN N\'EST INVENTÉ ===\n');
{
  ok('profil vide → aucune section', client({ ah_profile: '{}' })() === null);
  ok('pas de profil du tout → aucune section', client({})() === null);
  ok('et le prompt ne porte aucune ligne nutrition', render(null) === '' && render({}) === '');
  const n = client({ ah_profile: JSON.stringify({ poids: 78 }) })();
  ok('poids seul → pas de cibles inventées', n.cibles === undefined && n.poids === 78);
  ok('ni de journal inventé', n.aujourdhui === undefined);
  ok('le prompt n\'affiche que ce qui existe',
     render(n).indexOf('Cibles') < 0 && /Morphologie : 78 kg/.test(render(n)), render(n));
  const cassé = client({ ah_profile: JSON.stringify({ poids: 78 }), ah_nutri_journal: 'CASSÉ{{' })();
  ok('un journal corrompu ne fait pas planter le contexte', cassé && cassé.poids === 78);
}

console.log('\n=== LE PROFIL EXISTANT N\'EST PAS TOUCHÉ ===\n');
{
  const base = full({ name: 'Alassane', program: 'SHRED EXPLOSE', programKey: 'se',
                      weekNum: 3, totalWeeks: 16, streak: 5, satDone: true, athScore: 62 });
  ok('les 11 champs d\'origine sont toujours là',
     /PROFIL ATHLÈTE/.test(base) && /Prénom : Alassane/.test(base)
     && /Programme : SHRED EXPLOSE \(se\)/.test(base) && /Semaine : 3 \/ 16/.test(base)
     && /Streak : 5 jours/.test(base) && /Score SAT : 62\/100/.test(base), base);
  ok('sans nutrition, le bloc est identique à avant', base.indexOf('NUTRITION') < 0);
  const avec = full({ name: 'Alassane', nutrition: { poids: 78 } });
  ok('avec nutrition, la section s\'ajoute à la fin',
     /PROFIL ATHLÈTE[\s\S]*NUTRITION[\s\S]*Morphologie : 78 kg/.test(avec));
  ok('le contexte est envoyé par le client',
     /ctx\.nutrition = _titanNutritionCtx\(prof\);/.test(html));
  ok('la construction est isolée en try/catch',
     /try \{\s*ctx\.nutrition = _titanNutritionCtx\(prof\);\s*\} catch/.test(html));
  ok('l\'état athlète (séances, exercices) est toujours envoyé',
     /ctx\.athleteState = window\._ahBuildAthleteState\(\);/.test(html));
  // La section n'apporte que des données. Aucune prescription, aucun seuil,
  // aucune recommandation : ces règles-là vivent dans STATIC_SYSTEM.
  {
    const i = srv.indexOf('function buildNutritionContext(');
    const sect = srv.slice(i, srv.indexOf('function buildAthleteContext(', i));
    ok('la fonction n\'ajoute aucune règle de coaching',
       !/(tu dois|il faut|recommande|conseille|augmente|réduis|vise \d|minimum \d|par kg)/i.test(sect),
       sect.slice(0, 80));
    ok('elle ne fixe aucun seuil chiffré',
       !/\b\d+\s*(kcal|g)\b(?![^\n]*\+)/.test(sect.replace(/'[^']*'/g, '')));
  }
}

const failed = R.filter(x => !x).length;
console.log('\n' + '='.repeat(60));
console.log(failed ? 'RÉSULTAT : ' + failed + ' ÉCHEC(S) sur ' + R.length
                   : 'RÉSULTAT : ' + R.length + '/' + R.length + ' tests passés.');
process.exit(failed ? 1 : 0);
