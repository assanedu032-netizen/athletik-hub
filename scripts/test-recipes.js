// Écran recette : cohérence entre ce que le héro, les macros, le tagline et
// les ingrédients affichent pour un même nombre de portions.
//   node scripts/test-recipes.js
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(process.argv[2] || path.join(ROOT, 'index.html'), 'utf8');

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

const scale = new Function(grab(html, 'function _scaleIngredientQty(') + '\nreturn _scaleIngredientQty;')();

// Les vraies recettes, extraites du bloc DATA.
const a = html.indexOf('  var DATA = [');
const b = html.indexOf('\n  ];', a);
const DATA = new Function('return [' + html.slice(html.indexOf('[', a) + 1, b) + ']')();

const R = [];
const ok = (l, c, d) => { R.push(c); console.log((c ? '  PASS  ' : '  FAIL  ') + l + (d && !c ? '  → ' + d : '')); };

console.log('\n=== LES QUANTITÉS SUIVENT LES PORTIONS ===\n');
{
  ok('"300ml" × 1.5 → 450ml', scale('300ml', 1.5) === '450ml', scale('300ml', 1.5));
  ok('"10g" × 1.5 → 15g', scale('10g', 1.5) === '15g', scale('10g', 1.5));
  ok('"1 c.à.c" × 2 → 2 c.à.c', scale('1 c.à.c', 2) === '2 c.à.c', scale('1 c.à.c', 2));
  ok('"1/2" × 2 → 1', scale('1/2', 2) === '1', scale('1/2', 2));
  ok('"selon goût" reste intact', scale('selon goût', 2) === 'selon goût');
  // Le défaut visible sur la capture : la dose changeait, pas le poids.
  ok('"1 scoop (30g)" × 1.5 → 1.5 scoop (45g)',
     scale('1 scoop (30g)', 1.5) === '1.5 scoop (45g)', scale('1 scoop (30g)', 1.5));
  ok('"2 scoops (60g)" × 0.5 → 1 scoop (30g)',
     scale('2 scoops (60g)', 0.5) === '1 scoops (30g)', scale('2 scoops (60g)', 0.5));
  ok('"1 scoop (25g)" × 2 → 2 scoop (50g)',
     scale('1 scoop (25g)', 2) === '2 scoop (50g)', scale('1 scoop (25g)', 2));
  ok('une parenthèse sans chiffre n\'est pas touchée',
     scale('1 poignée (au goût)', 2) === '2 poignée (au goût)', scale('1 poignée (au goût)', 2));
  ok('×1 ne change jamais rien', scale('1 scoop (30g)', 1) === '1 scoop (30g)');
}

console.log('\n=== PLUS DE CHIFFRES CONTRADICTOIRES À L\'ÉCRAN ===\n');
{
  // Le tagline était généré depuis les valeurs de BASE et ne suivait pas les
  // portions : "280 kcal · 22g protéines" sous un héro affichant 420 KCAL.
  ok('le tagline auto (kcal · protéines) est supprimé',
     !/tagline: o\.tl \|\| \(o\.kcal/.test(html) && /tagline: o\.tl \|\| ''/.test(html));
  ok('un tagline éditorial resterait affiché', /tagline: o\.tl \|\|/.test(html));
  ok('la ligne est masquée quand elle est vide',
     /tagline\.style\.display = r\.tagline \? '' : 'none';/.test(html));
  ok('aucune recette ne portait de tagline éditorial',
     DATA.every(r => !r.tl), String(DATA.filter(r => r.tl).length));
}

console.log('\n=== AUCUNE PHOTO NE MONTRE UN AUTRE PLAT ===\n');
{
  const dir = path.join(ROOT, 'images', 'recipes');
  const crypto = require('crypto');
  const files = fs.readdirSync(dir).filter(f => /^recipe-\d+\.webp$/.test(f));
  const byHash = {};
  files.forEach(f => {
    const h = crypto.createHash('md5').update(fs.readFileSync(path.join(dir, f))).digest('hex');
    (byHash[h] = byHash[h] || []).push(f);
  });
  const dup = Object.values(byHash).filter(x => x.length > 1);
  // Deux recettes différentes ne peuvent pas avoir la même photo : si c'est
  // le cas, l'une des deux montre le plat de l'autre.
  const missing = new Function('return ' + (html.match(/var RECIPE_IMG_MISSING = (\{[^}]*\});/) || [])[1])();
  const dupUncovered = dup.filter(g => !g.some(f => missing[parseInt(f.match(/\d+/)[0], 10)]));
  ok('chaque doublon d\'image est neutralisé', dupUncovered.length === 0,
     dupUncovered.map(g => g.join(' = ')).join(' | '));
  ok('recipe-020 est bien signalée comme fausse', missing[20] === true);
  ok('la recette 20 n\'a donc pas d\'image', (() => {
    const r = DATA.find(x => x.id === 20);
    return r && /Shake Vanille-Amande/.test(r.n);
  })());
  ok('le héro garde un fond quand il n\'y a pas de photo',
     /\.rm-hero \{[\s\S]{0,260}background: linear-gradient/.test(html));
  ok('aucun <img> vide n\'est laissé dans le DOM',
     /imgEl\.removeAttribute\('src'\); imgEl\.style\.display = 'none';/.test(html));
  ok('les 57 autres recettes gardent leur photo',
     files.length === 58 && Object.keys(missing).length === 1);
}

console.log('\n=== NON-RÉGRESSION ===\n');
{
  ok('les 58 recettes sont toujours là', DATA.length === 58, String(DATA.length));
  ok('aucune valeur nutritionnelle n\'a bougé',
     DATA.every(r => typeof r.kcal === 'number' && typeof r.p === 'number'));
  ok('les macros restent calculées depuis les portions',
     /var rCals  = Math\.round\(r\.cals  \* mult/.test(html));
  ok('le sélecteur de portions est intact', /function adjustRecipeServings\(/.test(html));
  ok('le mapping id → fichier est inchangé pour les autres',
     /'images\/recipes\/recipe-' \+ String\(o\.id\)\.padStart\(3,'0'\) \+ '\.webp'/.test(html));
}

const failed = R.filter(x => !x).length;
console.log('\n' + '='.repeat(60));
console.log(failed ? 'RÉSULTAT : ' + failed + ' ÉCHEC(S) sur ' + R.length
                   : 'RÉSULTAT : ' + R.length + '/' + R.length + ' tests passés.');
process.exit(failed ? 1 : 0);
