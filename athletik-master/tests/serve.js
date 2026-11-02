// Petit serveur statique pour tester la PWA en local : node tests/serve.js [port]
// Sert public/ (l'équivalent de ce que Netlify publie). Les fonctions serveur
// ne tournent pas ici : seul le mode démo est utilisable.
'use strict';
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', 'public');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
function start(port) {
  const srv = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p.endsWith('/')) p += 'index.html';
    const file = path.normalize(path.join(ROOT, p));
    if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
    fs.readFile(file, (err, buf) => {
      if (err) { res.writeHead(404); return res.end('404'); }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
      res.end(buf);
    });
  });
  return new Promise(r => srv.listen(port, () => r(srv)));
}
if (require.main === module) {
  const port = Number(process.argv[2] || 8788);
  start(port).then(() => console.log('Athletik Master → http://localhost:' + port + '/'));
}
module.exports = { start };
