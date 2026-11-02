// Construit une version de DÉMONSTRATION en un seul fichier HTML (CSS, JS,
// contenu et logo intégrés), pour la partager sans déploiement :
//   node scripts/build-demo.js <sortie.html>
// Elle s'ouvre directement en mode démo (données fictives, sur l'appareil).
// La connexion réelle, l'API et l'installation PWA n'y sont pas disponibles.
'use strict';
const fs = require('fs'), path = require('path');
const P = p => path.join(__dirname, '..', 'public', p);
const out = process.argv[2] || path.join(__dirname, '..', 'athletik-master-demo.html');
const logo = 'data:image/png;base64,' + fs.readFileSync(P('icons/icon-192.png')).toString('base64');
const safe = s => s.replace(/<\/script/gi, '<\\/script');
let css = fs.readFileSync(P('css/app.css'), 'utf8');
css += '\n:root{color-scheme:dark}\n.topbar{top:env(safe-area-inset-top,0px)}\nbody::before{content:"";position:fixed;inset:0 0 auto;height:env(safe-area-inset-top,0px);z-index:25;background:var(--bg)}\n';
let config = fs.readFileSync(P('js/config.js'), 'utf8') + '\nwindow.AM_CONFIG.demoOnly = true;\n';
const program = JSON.parse(fs.readFileSync(P('content/program.json'), 'utf8'));
const js = ['engine', 'access', 'content-tools', 'demo', 'store', 'app'].map(n => fs.readFileSync(P('js/' + n + '.js'), 'utf8')).join('\n;\n')
  .split('icons/icon-192.png').join(logo);
const html = `<title>Athletik Master</title>
<meta name="theme-color" content="#0F1A33">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Outfit:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
${css}
</style>
<div id="app" aria-live="polite"></div>
<script>
${safe(config)}
window.AM_PROGRAM = ${safe(JSON.stringify(program))};
</script>
<script>
${safe(js)}
</script>
`;
fs.writeFileSync(out, html);
console.log('Démo en un fichier → ' + out + ' (' + Math.round(html.length / 1024) + ' Ko)');
