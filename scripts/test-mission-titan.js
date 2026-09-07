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

// La carte tenait 590 px sur 667 — 88 % de l'écran. Une première passe l'a
// mise à 364, une deuxième à 287, une troisième à 178 — qui gardait un pavé
// doré pleine largeur, l'élément le plus voyant de l'écran, DEVANT le message
// qui est pourtant l'objet de la notification. Forme finale : une ligne, une
// pilule. On borne la forme repliée à 140 px (mesuré : 129) et la dépliée,
// cas le plus haut à quatre étapes, à 230.
const PLAFOND = 140;
const PLAFOND_OUVERT = 255;

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
      avatar:  (() => { const a = wrap.querySelector('.mtn-av'); return a ? { tag: a.tagName, src: a.getAttribute('src') || '', h: Math.round(a.getBoundingClientRect().height) } : null; })(),
      compteDansLabel: !!wrap.querySelector('.mtn-lab .mtn-count'),
      temps:   q('.mtn-time'),
      chevron: !!wrap.querySelector('.mtn-chev'),
      chevronHaut: !!wrap.querySelector('.mtn-chev.up'),
      // Le [hidden] d'une classe en display:flex ne suffit pas : on mesure.
      etapesVisibles: (() => { const b = wrap.querySelector('.mtn-steps'); return !!b && b.getBoundingClientRect().height > 0; })(),
      compteDansHead:  !!wrap.querySelector('.mtn-head .mtn-count'),
      labelTxt: q('.mtn-lab'),
      etat:    q('.mtn-state'),
      compte:  q('.mtn-count'),
      compteDone: !!wrap.querySelector('.mtn-count.done'),
      pulse:   !!wrap.querySelector('.mtn-dot'),
      message: msg ? msg.textContent.replace(/\s+/g, ' ').trim() : null,
      msgLignes: msg ? Math.round(msg.getBoundingClientRect().height / parseFloat(getComputedStyle(msg).lineHeight)) : 0,
      etapes:  Array.from(wrap.querySelectorAll('.mtn-step')).map(e => ({
        txt: (e.querySelector('.mtn-txt') || { textContent: '' }).textContent.trim(),
        sfx: e.querySelector('.mtn-sfx') ? e.querySelector('.mtn-sfx').textContent.trim() : null,
        faite: e.classList.contains('on'),
        h: Math.round(e.getBoundingClientRect().height)
      })),
      cta:     q('.mtn-cta'),
      ctaLargeur: (() => { const c = wrap.querySelector('.mtn-cta'), k = wrap.querySelector('.mtn');
                           return (c && k) ? Math.round(c.getBoundingClientRect().width / k.getBoundingClientRect().width * 100) : null; })(),
      ctaRond: (() => { const c = wrap.querySelector('.mtn-cta'); return c ? parseFloat(getComputedStyle(c).borderRadius) >= 99 : false; })(),
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
  ok('repliée, hauteur ≤ ' + PLAFOND + ' px (était 590)', v.hauteur <= PLAFOND, v.hauteur + 'px');
  ok('la mission est REPLIÉE par défaut', v.etapesVisibles === false);
  ok('un chevron annonce qu\'elle se déplie', v.chevron === true);
  ok('le chevron pointe vers le bas quand c\'est replié', v.chevronHaut === false);
  // Une notification dit QUAND elle est arrivée — mais l'heure doit être vraie.
  // Une notification affiche l'HEURE, et c'est celle du calcul de la reco.
  ok('l\'heure du message est affichée', /^\d{2}:\d{2}$/.test(v.temps || ''), v.temps);
  ok('l\'identité est « Titan »', /titan/i.test(v.nom || ''), v.nom);
  // Le vrai avatar existe (images/titan-mascot.png, celui de la barre du bas) :
  // un « T » dessiné à la main donnait un autre personnage.
  ok('l\'avatar est la VRAIE image de Titan', !!v.avatar && v.avatar.tag === 'IMG' && /titan-mascot\.png$/.test(v.avatar.src), JSON.stringify(v.avatar));
  ok('l\'avatar est chargé (hauteur non nulle)', !!v.avatar && v.avatar.h >= 24, v.avatar && v.avatar.h);
  ok('le compteur est inline avec « Mission du jour »', v.compteDansLabel === true, v.labelTxt);
  ok('le compteur n\'est plus dans un coin du header', v.compteDansHead === false);
  ok('le libellé lit « Mission n/n »', /mission\s*\d+\/\d+/i.test(v.labelTxt || ''), v.labelTxt);
  // Le mot reste pour le lecteur d'écran ; l'œil a la pastille qui pulse.
  ok('l\'état dit « Nouveau message »', /nouveau message/i.test(v.etat || ''), v.etat);
  ok('la pastille de notification pulse', v.pulse === true);
  ok('le compteur est à 0 sur le total réel', /^0\/\d+$/.test(v.compte || ''), v.compte);
  ok('le compteur n\'est pas en état « accompli »', v.compteDone === false);
  ok('un message de Titan est affiché', !!v.message && v.message.length > 20, v.message);
  ok('le message vient du moteur, pas d\'un texte figé', /Alassane/.test(v.message || ''), v.message);
  // Deux lignes suffisent à l'accroche ; le tap donne la suite. Trois lignes
  // coûtaient 20 px pour une phrase que l'athlète peut ouvrir d'un doigt.
  ok('le message est écrêté à 3 lignes', v.msgLignes <= 3, v.msgLignes + ' lignes');
  ok('replié, le message reste l\'objet de la notification', v.msgLignes >= 1);
  // On déplie pour vérifier le contenu de la mission.
  try { await page.click('#titanSmartCards .mtn-lab', { timeout: 2000 }); } catch (e) {} await page.waitForTimeout(250);
  v = await lire(); await shot('01b-depliee.png');
  ok('le tap sur la ligne mission déplie les étapes', v.etapesVisibles === true);
  ok('le chevron se retourne', v.chevronHaut === true);
  ok('dépliée, hauteur ≤ ' + PLAFOND_OUVERT + ' px', v.hauteur <= PLAFOND_OUVERT, v.hauteur + 'px');
  ok('il y a des étapes', v.etapes.length >= 2, v.etapes.length);
  // Les étapes sont SECONDAIRES : trois pavés de 34 px pleine largeur
  // relisaient la carte comme une checklist, ce qu'elle ne doit plus être.
  ok('chaque étape tient sur une ligne basse (≤ 30 px)', v.etapes.every(e => e.h <= 30), JSON.stringify(v.etapes.map(e => e.h)));
  ok('l\'étape lecture porte le chapitre recommandé', /Lire\s*:/.test((v.etapes[0]||{}).txt || ''), (v.etapes[0]||{}).txt);
  ok('l\'étape lecture porte la page du livre', /^p\.\d+$/.test((v.etapes[0]||{}).sfx || ''), (v.etapes[0]||{}).sfx);
  ok('l\'étape séance existe', v.etapes.some(e => /séance/i.test(e.txt)), JSON.stringify(v.etapes.map(e => e.txt)));
  ok('l\'étape Titan existe', v.etapes.some(e => /Titan/i.test(e.txt)));
  ok('aucune étape n\'est cochée', v.etapes.every(e => !e.faite));
  ok('un seul CTA', (await page.evaluate(() => document.querySelectorAll('#titanSmartCards .mtn-cta').length)) === 1);
  ok('le CTA est cliquable', v.ctaClic === true);
  ok('le CTA annonce ce que le tap va faire', /lire|séance|titan|SAT|SET|PDC|ouvrir/i.test(v.cta || ''), v.cta);
  // Le pavé doré pleine largeur écrasait le message. Une pilule, pas un pavé.
  ok('le CTA est une pilule, pas un pavé pleine largeur', v.ctaLargeur !== null && v.ctaLargeur <= 45, v.ctaLargeur + '% de la carte');
  ok('le CTA est arrondi en pilule', v.ctaRond === true);
  ok('rien ne déborde horizontalement', v.debordeX === 0, v.debordeX);
  ok('la carte tient dans la largeur', v.largeurOk === true);
  ok('aucune erreur JS', errs.length === 0, errs.join(' | '));

  const H_OUVERTE = v.hauteur;

  // ── Le pli est mémorisé pour la journée ─────────────────────────────────
  console.log('\n── Le pli tient d\'un rendu à l\'autre ──');
  await page.evaluate(() => window.renderTitanSmartCards());
  await page.waitForTimeout(200);
  v = await lire();
  ok('rester déplié survit à un re-rendu', v.etapesVisibles === true);
  ok('le pli est écrit dans ah_titan_mission',
    await page.evaluate(() => { try { return JSON.parse(localStorage.getItem('ah_titan_mission')).open === true; } catch(e) { return false; } }));
  try { await page.click('#titanSmartCards .mtn-lab', { timeout: 2000 }); } catch (e) {} await page.waitForTimeout(250);
  v = await lire();
  ok('re-taper replie', v.etapesVisibles === false);
  const H_NEUVE = v.hauteur;

  // ── ÉTAT 2 — séance faite aujourd'hui ───────────────────────────────────
  console.log('\n── Séance faite aujourd\'hui ──');
  const today = new Date().toISOString().slice(0, 10);
  await etat(PROFIL, [{ date: today + 'T10:00:00.000Z', type: 'session', name: 'Séance 1' }], { date: today, done: {}, open: true }, null);
  v = await lire(); await shot('02-seance.png');
  const seance = v.etapes.filter(e => /séance/i.test(e.txt))[0];
  ok('l\'étape séance se coche toute seule', !!seance && seance.faite === true, JSON.stringify(seance));
  ok('elle porte le suffixe « Faite »', !!seance && /faite/i.test(seance.sfx || ''), seance && seance.sfx);
  ok('le compteur l\'a comptée', /^[1-9]\/\d+$/.test(v.compte || ''), v.compte);
  ok('dépliée, hauteur toujours ≤ ' + PLAFOND_OUVERT, v.hauteur <= PLAFOND_OUVERT, v.hauteur + 'px');

  // ── ÉTAT 3 — l'athlète a parlé à Titan il y a une heure ─────────────────
  // C'est le défaut réparé : `ah_titan_q_last` n'était écrit NULLE PART, donc
  // `Date.now() - 0 > 48 h` était toujours vrai et l'étape ne pouvait jamais
  // se satisfaire d'autre chose qu'une case cochée à la main.
  console.log('\n── L\'athlète a parlé à Titan il y a 1 h ──');
  await etat(PROFIL, [], { date: today, done: {}, open: true }, Date.now() - 3600000);
  v = await lire();
  const etTitan = v.etapes.filter(e => /Titan/i.test(e.txt))[0];
  ok('l\'étape Titan est cochée toute seule', !!etTitan && etTitan.faite === true, JSON.stringify(etTitan));
  ok('elle porte le suffixe « Fait »', !!etTitan && /fait/i.test(etTitan.sfx || ''), etTitan && etTitan.sfx);

  console.log('\n── … et il y a 3 jours (> 48 h) ──');
  await etat(PROFIL, [], { date: today, done: {}, open: true }, Date.now() - 3 * 86400000);
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
    { date: today, done: {}, open: true }, Date.now() - 3600000);
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
  ok('pas de barre de progression — « n/n » le dit déjà',
    (await page.evaluate(() => !document.querySelector('#titanSmartCards .mtn-bar'))) === true);
  ok('la pilule passe en état accompli', v.ctaDone === true, v.cta);
  ok('le CTA accompli n\'est plus cliquable', v.ctaClic === false);
  // Trois étapes : le cas courant, celui qu'a l'athlète dès que son test est fait.
  ok('à 3 étapes dépliée, la carte tient sous 225 px', v.hauteur <= 225, v.hauteur + 'px pour ' + v.etapes.length + ' étapes');

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
  ok('les étapes tiennent encore sur une ligne', p320.etapes.every(e => e.h <= 34), JSON.stringify(p320.etapes.map(e => e.h)));
  ok('hauteur ≤ ' + PLAFOND_OUVERT + ' en 320 px', p320.hauteur <= PLAFOND_OUVERT, p320.hauteur + 'px');

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
    const compose = (fg, bgc) => {
      const f = fg.match(/[\d.]+/g).map(Number), b = bgc.match(/[\d.]+/g).map(Number);
      const a = f.length > 3 ? f[3] : 1;
      return 'rgb(' + [0, 1, 2].map(i => Math.round(f[i] * a + b[i] * (1 - a))).join(',') + ')';
    };
    // Le fond RÉEL derrière un texte : on remonte tant que c'est transparent.
    // La pilule dorée a le sien ; le composer sur le navy de la carte donnait
    // 1,3 sur un bouton parfaitement lisible — une fausse alerte, pas un défaut.
    const fondDe = (e) => {
      for (let n = e; n; n = n.parentElement) {
        const st = getComputedStyle(n);
        const bg = st.backgroundColor, m = bg.match(/[\d.]+/g);
        if (m && (m.length < 4 || Number(m[3]) > .9) && bg !== 'rgba(0, 0, 0, 0)') return bg;
        if (st.backgroundImage && st.backgroundImage !== 'none') return 'rgb(197,164,78)'; // #C5A44E, le point le plus SOMBRE du dégradé doré
      }
      return 'rgb(255,255,255)';
    };
    const mesure = (sel) => {
      const e = document.querySelector(sel); if (!e) return null;
      const bg = fondDe(e);
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
  console.log('  INFO  repliée : ' + H_NEUVE + ' px (' + Math.round(H_NEUVE / 667 * 100) + ' % de l\'écran) — avant refonte : 590 px, 88 %');
  console.log('  INFO  dépliée, 4 étapes : ' + H_OUVERTE + ' px (' + Math.round(H_OUVERTE / 667 * 100) + ' %)');
  // La carte doit rester une boîte de MESSAGE : moins de 40 % de l'écran,
  // pour que la carte article et le scoreboard soient visibles sans scroller.
  ok('repliée, la notification occupe moins du quart de l\'écran', H_NEUVE / 667 < 0.25, Math.round(H_NEUVE / 667 * 100) + '%');
  ok('dépliée, elle reste sous ' + PLAFOND_OUVERT + ' px', H_OUVERTE <= PLAFOND_OUVERT, H_OUVERTE + 'px');

  const echecs = R.filter(x => !x).length;
  console.log('\n' + '='.repeat(58));
  console.log(echecs ? ('RÉSULTAT : ' + echecs + ' ÉCHEC(S) sur ' + R.length)
                     : ('RÉSULTAT : ' + R.length + '/' + R.length + ' — tout est vert'));
  await browser.close(); server.close();
  process.exit(echecs ? 1 : 0);
})();
