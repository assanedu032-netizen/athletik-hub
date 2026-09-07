// Mission Titan — la boîte de message du coach sur la Home, rendue dans un
// vrai Chromium, dans les états où un athlète la trouve réellement.
// Ce qu'on protège ici :
//   1. la HAUTEUR — la carte occupait 590 px sur 667 (88 % de l'écran) ;
//   2. le MOTEUR — le message reste celui de getTitanDailyRecommendation(),
//      jamais un texte figé ;
//   3. l'HONNÊTETÉ du compteur — il compte les étapes réelles, et l'étape
//      « parler à Titan » se coche quand on parle à Titan.
//   node scripts/test-mission-titan.js [autre.html]
const fs = require('fs'), http = require('http'), path = require('path');
const REPO = path.join(__dirname, '..');
const HTML = process.argv[2] || path.join(REPO, 'index.html');
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) { console.log('Playwright absent — npm i -D playwright --no-save'); process.exit(0); }
const MIME = { '.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.png':'image/png' };

// La carte tenait 590 px. On borne à 400 : au-delà, la section suivante de la
// Home ne respire plus. Le chiffre est un plafond, pas une cible.
const PLAFOND = 400;

(async () => {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]);
    const f = (rel === '/index.html') ? HTML : path.join(REPO, rel);
    if ((f !== HTML && !f.startsWith(REPO)) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  });
  await new Promise(r => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const R = []; const ok = (l, c, d) => { R.push(c); console.log((c ? '  PASS  ' : '  FAIL  ') + l + (d && !c ? '  → ' + String(d) : '')); };

  const KEEP = process.env.KEEP_SHOTS === '1';
  const OUT = path.join(REPO, '.tmp-mission');
  if (KEEP && !fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

  async function ecran(w, hgt) {
    const page = await browser.newPage({ viewport: { width: w, height: hgt }, deviceScaleFactor: 2 });
    const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.goto(base + '/index.html', { waitUntil: 'domcontentloaded' });
    try { await page.waitForFunction(() => typeof window.renderTitanSmartCards === 'function', { timeout: 20000 }); }
    catch (e) { return null; }
    const cdp = await page.context().newCDPSession(page);
    return { page, errs, cdp };
  }

  const P375 = await ecran(375, 667);
  if (!P375) {
    console.log('  FAIL  renderTitanSmartCards est absent de cette base');
    console.log('\n' + '='.repeat(58) + '\nRÉSULTAT : 1 ÉCHEC(S) sur 1');
    await browser.close(); server.close(); process.exit(1);
  }
  const { page, errs, cdp } = P375;
  const shot = async (f) => {
    if (!KEEP) return;
    const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(OUT, f), Buffer.from(data, 'base64'));
  };

  // Pose l'état réel de l'app (profil + historique + mémoire mission), puis
  // laisse le VRAI moteur produire la reco. On ne simule jamais sa sortie.
  async function etat(profil, hist, mission, qLast) {
    await page.evaluate(([profil, hist, mission, qLast]) => {
      document.querySelectorAll('.scr').forEach(v => { v.style.display = 'none'; v.classList.remove('on'); });
      localStorage.setItem('ah_profile', JSON.stringify(profil));
      localStorage.setItem('ah_set_history', JSON.stringify(hist || []));
      localStorage.removeItem('ah_titan_daily');
      if (mission) localStorage.setItem('ah_titan_mission', JSON.stringify(mission));
      else localStorage.removeItem('ah_titan_mission');
      if (qLast) localStorage.setItem('ah_titan_q_last', String(qLast));
      else localStorage.removeItem('ah_titan_q_last');
      window.switchTab('home');
      window.renderTitanSmartCards();
    }, [profil, hist, mission, qLast]);
    await page.waitForTimeout(250);
  }

  const lire = () => page.evaluate(() => {
    const wrap = document.getElementById('titanSmartCards');
    const q = (s) => { const e = wrap.querySelector(s); return e ? e.textContent.replace(/\s+/g, ' ').trim() : null; };
    const msg = wrap.querySelector('.mtn-msg');
    const main = document.getElementById('mainScroll') || document.body;
    return {
      hauteur: Math.round(wrap.getBoundingClientRect().height),
      cartes:  wrap.querySelectorAll('.mtn').length,
      nom:     q('.mtn-name'),
      etat:    q('.mtn-state'),
      compte:  q('.mtn-count'),
      compteDone: !!wrap.querySelector('.mtn-count.done'),
      pulse:   !!wrap.querySelector('.mtn-dot'),
      message: msg ? msg.textContent.replace(/\s+/g, ' ').trim() : null,
      msgLignes: msg ? Math.round(msg.getBoundingClientRect().height / parseFloat(getComputedStyle(msg).lineHeight)) : 0,
      barre:   (() => { const b = wrap.querySelector('.mtn-bar > i'); return b ? b.style.width : null; })(),
      etapes:  Array.from(wrap.querySelectorAll('.mtn-step')).map(e => ({
        txt: (e.querySelector('.mtn-txt') || { textContent: '' }).textContent.trim(),
        sfx: e.querySelector('.mtn-sfx') ? e.querySelector('.mtn-sfx').textContent.trim() : null,
        faite: e.classList.contains('on'),
        h: Math.round(e.getBoundingClientRect().height)
      })),
      cta:     q('.mtn-cta'),
      ctaDone: !!wrap.querySelector('.mtn-cta.done'),
      ctaClic: !!(wrap.querySelector('.mtn-cta') && wrap.querySelector('.mtn-cta').getAttribute('onclick')),
      debordeX: main.scrollWidth - main.clientWidth,
      largeurOk: (() => { const c = wrap.querySelector('.mtn'); return c ? c.getBoundingClientRect().width <= innerWidth : true; })()
    };
  });

  const PROFIL = { prenom:'Alassane', age:25, sexe:'H', poids:75, taille:180, programKey:'vd', program:'Vertical Dunk', streak:3 };

  // ── ÉTAT 1 — journée neuve, rien de fait ────────────────────────────────
  console.log('\n── Journée neuve (rien de fait) ──');
  await etat(PROFIL, [], null, null);
  let v = await lire(); await shot('01-neuve.png');

  ok('la carte est rendue', v.cartes === 1, v.cartes);
  ok('une SEULE carte — la mini-carte lecture qui répétait le chapitre a disparu', v.cartes === 1);
  ok('hauteur ≤ ' + PLAFOND + ' px (était 590)', v.hauteur <= PLAFOND, v.hauteur + 'px');
  ok('l\'identité est « TITAN »', v.nom === 'TITAN', v.nom);
  ok('l\'état dit « Nouveau message »', /nouveau message/i.test(v.etat || ''), v.etat);
  ok('la pastille de notification pulse', v.pulse === true);
  ok('le compteur est à 0 sur le total réel', /^0\/\d+$/.test(v.compte || ''), v.compte);
  ok('le compteur n\'est pas en état « accompli »', v.compteDone === false);
  ok('la barre de progression est à 0%', v.barre === '0%', v.barre);
  ok('un message de Titan est affiché', !!v.message && v.message.length > 20, v.message);
  ok('le message vient du moteur, pas d\'un texte figé', /Alassane/.test(v.message || ''), v.message);
  ok('le message est écrêté à 3 lignes', v.msgLignes <= 3, v.msgLignes + ' lignes');
  ok('il y a des étapes', v.etapes.length >= 2, v.etapes.length);
  ok('chaque étape tient sur une ligne (≤ 40 px)', v.etapes.every(e => e.h <= 40), JSON.stringify(v.etapes.map(e => e.h)));
  ok('l\'étape lecture porte le chapitre recommandé', /Lire\s*:/.test((v.etapes[0]||{}).txt || ''), (v.etapes[0]||{}).txt);
  ok('l\'étape lecture porte la page du livre', /^p\.\d+$/.test((v.etapes[0]||{}).sfx || ''), (v.etapes[0]||{}).sfx);
  ok('l\'étape séance existe', v.etapes.some(e => /séance/i.test(e.txt)), JSON.stringify(v.etapes.map(e => e.txt)));
  ok('l\'étape Titan existe', v.etapes.some(e => /Titan/i.test(e.txt)));
  ok('aucune étape n\'est cochée', v.etapes.every(e => !e.faite));
  ok('un seul CTA', (await page.evaluate(() => document.querySelectorAll('#titanSmartCards .mtn-cta').length)) === 1);
  ok('le CTA est cliquable', v.ctaClic === true);
  ok('le CTA annonce ce que le tap va faire', /ouvrir|lancer|parler|faire/i.test(v.cta || ''), v.cta);
  ok('rien ne déborde horizontalement', v.debordeX === 0, v.debordeX);
  ok('la carte tient dans la largeur', v.largeurOk === true);
  ok('aucune erreur JS', errs.length === 0, errs.join(' | '));

  const H_NEUVE = v.hauteur;

  // ── Le message se déplie au tap ─────────────────────────────────────────
  console.log('\n── Le message long se déplie ──');
  const avant = v.msgLignes;
  try { await page.click('#titanSmartCards .mtn-msg', { timeout: 2000 }); } catch (e) {}
  await page.waitForTimeout(150);
  const apres = await page.evaluate(() => {
    const m = document.querySelector('#titanSmartCards .mtn-msg');
    if (!m) return { lignes: 0, open: false };
    return { lignes: Math.round(m.getBoundingClientRect().height / parseFloat(getComputedStyle(m).lineHeight)), open: m.classList.contains('open') };
  });
  ok('le tap ouvre le message', apres.open === true);
  ok('déplié, il n\'est plus écrêté', apres.lignes >= avant, avant + ' → ' + apres.lignes);

  // ── ÉTAT 2 — séance faite aujourd'hui ───────────────────────────────────
  console.log('\n── Séance faite aujourd\'hui ──');
  const today = new Date().toISOString().slice(0, 10);
  await etat(PROFIL, [{ date: today + 'T10:00:00.000Z', type: 'session', name: 'Séance 1' }], null, null);
  v = await lire(); await shot('02-seance.png');
  const seance = v.etapes.filter(e => /séance/i.test(e.txt))[0];
  ok('l\'étape séance se coche toute seule', !!seance && seance.faite === true, JSON.stringify(seance));
  ok('elle porte le suffixe « Faite »', !!seance && /faite/i.test(seance.sfx || ''), seance && seance.sfx);
  ok('le compteur l\'a comptée', /^[1-9]\/\d+$/.test(v.compte || ''), v.compte);
  ok('la barre a bougé', v.barre !== '0%', v.barre);
  ok('hauteur toujours ≤ ' + PLAFOND, v.hauteur <= PLAFOND, v.hauteur + 'px');

  // ── ÉTAT 3 — l'athlète a parlé à Titan il y a une heure ─────────────────
  // C'est le défaut réparé : `ah_titan_q_last` n'était écrit NULLE PART, donc
  // `Date.now() - 0 > 48 h` était toujours vrai et l'étape ne pouvait jamais
  // se satisfaire d'autre chose qu'une case cochée à la main.
  console.log('\n── L\'athlète a parlé à Titan il y a 1 h ──');
  await etat(PROFIL, [], null, Date.now() - 3600000);
  v = await lire();
  const etTitan = v.etapes.filter(e => /Titan/i.test(e.txt))[0];
  ok('l\'étape Titan est cochée toute seule', !!etTitan && etTitan.faite === true, JSON.stringify(etTitan));
  ok('elle porte le suffixe « Fait »', !!etTitan && /fait/i.test(etTitan.sfx || ''), etTitan && etTitan.sfx);

  console.log('\n── … et il y a 3 jours (> 48 h) ──');
  await etat(PROFIL, [], null, Date.now() - 3 * 86400000);
  v = await lire();
  const etTitan2 = v.etapes.filter(e => /Titan/i.test(e.txt))[0];
  ok('au-delà de 48 h, l\'étape Titan revient à faire', !!etTitan2 && etTitan2.faite === false, JSON.stringify(etTitan2));

  // ── sendMessage écrit bien ah_titan_q_last ──────────────────────────────
  // L'écriture vit dans callAnthropicAPI : c'est le passage obligé de TOUT
  // échange réel avec Titan (chat, nutrition, photo), pas seulement du bouton.
  const ecritQLast = await page.evaluate(() => {
    const src = String(window.callAnthropicAPI || '');
    return /ah_titan_q_last/.test(src) && /setItem/.test(src);
  });
  ok('parler à Titan écrit ah_titan_q_last (sinon l\'étape est ineffaçable)', ecritQLast === true);

  // ── ÉTAT 4 — mission accomplie (3/3) ────────────────────────────────────
  console.log('\n── Mission accomplie ──');
  await etat({ ...PROFIL, satDone: true, vertJump: 62 },
    [{ date: today + 'T10:00:00.000Z', type: 'session', name: 'Séance 1' }],
    null, Date.now() - 3600000);
  v = await lire();
  // Il reste l'étape lecture : on la coche comme l'athlète le ferait.
  await page.evaluate(() => window._missionMarkDone('lecture'));
  await page.waitForTimeout(200);
  v = await lire(); await shot('03-accomplie.png');
  ok('toutes les étapes sont cochées', v.etapes.every(e => e.faite), JSON.stringify(v.etapes));
  ok('le compteur est plein (n/n)', /^(\d+)\/\1$/.test(v.compte || ''), v.compte);
  ok('le compteur passe en état accompli', v.compteDone === true);
  ok('l\'état devient « Mission accomplie »', /accomplie/i.test(v.etat || ''), v.etat);
  ok('la pastille « nouveau message » disparaît', v.pulse === false);
  ok('la barre est pleine', v.barre === '100%', v.barre);
  ok('le CTA passe en état accompli', v.ctaDone === true, v.cta);
  ok('le CTA accompli n\'est plus cliquable', v.ctaClic === false);
  ok('hauteur ≤ ' + PLAFOND, v.hauteur <= PLAFOND, v.hauteur + 'px');

  // ── Le tap sur une étape la bascule ─────────────────────────────────────
  console.log('\n── Cocher / décocher une étape ──');
  await page.evaluate(() => window._missionMarkDone('lecture'));
  await page.waitForTimeout(200);
  v = await lire();
  ok('décocher une étape la remet à faire', v.etapes.some(e => !e.faite));
  ok('le compteur redescend', !/^(\d+)\/\1$/.test(v.compte || ''), v.compte);
  ok('l\'état repasse à « Nouveau message »', /nouveau message/i.test(v.etat || ''), v.etat);
  ok('la mission est persistée dans ah_titan_mission',
    await page.evaluate(() => { try { const s = JSON.parse(localStorage.getItem('ah_titan_mission')); return !!s && !!s.date && typeof s.done === 'object'; } catch(e) { return false; } }));

  // ── Pas de programme → rien du tout ─────────────────────────────────────
  console.log('\n── Aucun programme attribué ──');
  await etat({ prenom: 'Alassane' }, [], null, null);
  const vide = await page.evaluate(() => document.getElementById('titanSmartCards').innerHTML.trim());
  ok('sans programme, la carte ne s\'affiche pas', vide === '', vide.slice(0, 60));

  // ── Le reste de la Home est intact ──────────────────────────────────────
  console.log('\n── Le reste de la Home ──');
  await etat(PROFIL, [], null, null);
  const home = await page.evaluate(() => ({
    teaser: !!document.querySelector('#vHome .art-teaser-card'),
    score: !!document.getElementById('homeScoreboard'),
    journey: !!document.getElementById('journeyCardWrap'),
    trial: !!document.getElementById('trialBanner'),
    ordre: (() => {
      const p = document.getElementById('titanSmartCards');
      const n = p && p.nextElementSibling;
      return n ? n.className : null;
    })()
  }));
  ok('la carte article est toujours là', home.teaser === true);
  ok('le scoreboard est toujours là', home.score === true);
  ok('« Mon parcours » est toujours là', home.journey === true);
  ok('la bannière essai est toujours là', home.trial === true);
  ok('la Mission reste juste au-dessus de la carte article', /art-teaser-card/.test(home.ordre || ''), home.ordre);
  ok('toujours aucune erreur JS', errs.length === 0, errs.join(' | '));

  // ── 320×568 — le plus petit écran réel ──────────────────────────────────
  console.log('\n── 320 × 568 ──');
  await page.setViewportSize({ width: 320, height: 568 });
  await page.evaluate(() => window.renderTitanSmartCards());
  await page.waitForTimeout(250);
  const p320 = await lire(); await shot('04-320.png');
  ok('rien ne déborde en 320 px', p320.debordeX === 0, p320.debordeX);
  ok('la carte tient dans la largeur en 320 px', p320.largeurOk === true);
  ok('les étapes tiennent encore sur une ligne', p320.etapes.every(e => e.h <= 44), JSON.stringify(p320.etapes.map(e => e.h)));
  ok('hauteur ≤ ' + PLAFOND + ' en 320 px', p320.hauteur <= PLAFOND, p320.hauteur + 'px');

  // ── Contraste — le texte doit rester lisible sur le navy ────────────────
  console.log('\n── Contraste sur navy ──');
  await page.setViewportSize({ width: 375, height: 667 });
  await page.evaluate(() => window.renderTitanSmartCards());
  await page.waitForTimeout(200);
  const contraste = await page.evaluate(() => {
    const lum = (c) => {
      const m = c.match(/[\d.]+/g).map(Number);
      const f = m.slice(0, 3).map(v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); });
      return .2126 * f[0] + .7152 * f[1] + .0722 * f[2];
    };
    // Le fond est opaque sur la carte : on le lit sur .mtn.
    const carte = document.querySelector('#titanSmartCards .mtn');
    if (!carte) return { nom: 0, msg: 0, etape: 0, cta: 0 };
    const bg = getComputedStyle(carte).backgroundColor;
    // Les textes sont en rgba sur ce fond : on compose avant de mesurer.
    const compose = (fg, bgc) => {
      const f = fg.match(/[\d.]+/g).map(Number), b = bgc.match(/[\d.]+/g).map(Number);
      const a = f.length > 3 ? f[3] : 1;
      return 'rgb(' + [0, 1, 2].map(i => Math.round(f[i] * a + b[i] * (1 - a))).join(',') + ')';
    };
    const mesure = (sel) => {
      const e = document.querySelector(sel); if (!e) return null;
      const c = compose(getComputedStyle(e).color, bg);
      const l1 = lum(c), l2 = lum(bg);
      return Math.round(((Math.max(l1, l2) + .05) / (Math.min(l1, l2) + .05)) * 100) / 100;
    };
    return { nom: mesure('.mtn-name'), msg: mesure('.mtn-msg'), etape: mesure('.mtn-txt'), cta: mesure('.mtn-cta') };
  });
  ok('« TITAN » ≥ 4.5:1', contraste.nom >= 4.5, contraste.nom);
  ok('le message de Titan ≥ 4.5:1', contraste.msg >= 4.5, contraste.msg);
  ok('le libellé d\'étape ≥ 4.5:1', contraste.etape >= 4.5, contraste.etape);
  ok('le CTA ≥ 4.5:1', contraste.cta >= 4.5, contraste.cta);

  // ── La preuve du gain ───────────────────────────────────────────────────
  console.log('\n── Hauteur ──');
  console.log('  INFO  journée neuve, 4 étapes : ' + H_NEUVE + ' px (avant refonte : 590 px)');
  ok('la carte a bien maigri (< 500 px)', H_NEUVE < 500, H_NEUVE + 'px');

  const echecs = R.filter(x => !x).length;
  console.log('\n' + '='.repeat(58));
  console.log(echecs ? ('RÉSULTAT : ' + echecs + ' ÉCHEC(S) sur ' + R.length)
                     : ('RÉSULTAT : ' + R.length + '/' + R.length + ' — tout est vert'));
  await browser.close(); server.close();
  process.exit(echecs ? 1 : 0);
})();
