// Parcours réel dans Chromium (mode démo) : node tests/test-ui.js
// Playwright n'est pas une dépendance du projet (même parti pris qu'Athletik Hub) :
//   npm i --no-save playwright   (déjà présent dans l'environnement cloud)
'use strict';
const assert = require('assert');
const { chromium } = require('playwright');
const { start } = require('./serve.js');

const PORT = 8793, URL = 'http://localhost:' + PORT + '/';
let passed = 0, failed = 0;
async function t(name, fn) {
  try { await fn(); passed++; }
  catch (e) { failed++; console.error('✗ ' + name + '\n   ' + (e && e.stack || e).split('\n').slice(0, 4).join('\n   ')); }
}

(async () => {
  const srv = await start(PORT);
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 375, height: 667 } });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(e.message));
  p.on('dialog', d => d.accept());
  await p.route(/fonts\.(googleapis|gstatic)/, r => r.fulfill({ status: 200, body: '' }));

  const noOverflow = async () => {
    const o = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert.ok(o <= 0, 'débordement horizontal de ' + o + ' px sur ' + await p.evaluate(() => location.hash));
  };
  const goto = async (hash) => { await p.evaluate(h => { location.hash = h; }, hash); await p.waitForTimeout(80); };
  const closeOverlays = async () => {
    for (let i = 0; i < 6 && await p.$('.overlay'); i++) { await p.click('.overlay [data-act=closeCelebrate]'); await p.waitForTimeout(80); }
  };
  const clickAll = async (sel) => { for (const el of await p.$$(sel)) { await el.click(); await p.waitForTimeout(40); } };
  const validate = async () => { await p.click('[data-act=validate]'); await p.waitForTimeout(120); };

  await p.goto(URL);
  await p.waitForSelector('.login');

  await t('écran de connexion + entrée en démo', async () => {
    await noOverflow();
    await p.click('[data-act=demo]');
    await p.waitForSelector('.demo-bar');
    assert.ok((await p.textContent('main')).includes('Début du programme'), 'page de début affichée au premier lancement');
  });

  await t('page de début → mission 0.1', async () => {
    await p.click('[data-act=startProgram]');
    await p.waitForTimeout(100);
    assert.ok((await p.evaluate(() => location.hash)).includes('m0.1'));
    assert.ok(await p.$('.video.empty'), 'emplacement « Vidéo à ajouter »');
    assert.ok((await p.textContent('main')).includes('Contenu pédagogique à compléter'));
    await noOverflow();
  });

  await t('checklist : validation impossible tant qu\'elle n\'est pas complète', async () => {
    assert.ok(await p.$eval('[data-act=validate]', b => b.disabled));
    await p.click('[data-act=check][data-item=dl]');
    await p.waitForTimeout(60);
    assert.ok(await p.$eval('[data-act=validate]', b => b.disabled));
    await p.click('[data-act=check][data-item=account]');
    await p.waitForTimeout(60);
    assert.ok(!(await p.$eval('[data-act=validate]', b => b.disabled)));
    await validate();
    assert.ok((await p.textContent('main')).includes('Mission validée'));
  });

  await t('niveau 0 complet le jour même → carte Rookie célébrée', async () => {
    await goto('#/mission/m0.2'); await clickAll('[data-act=check]'); await validate();
    await goto('#/mission/m0.3'); await clickAll('[data-act=check]'); await validate();
    await goto('#/mission/m0.4');
    await p.fill('input[data-field=date]', '2026-11-02');
    await p.fill('input[data-field=detente]', '56');
    await p.fill('textarea[data-field=results]', 'Sprint 30 m : 4,6 s');
    await p.waitForTimeout(900);
    await validate();
    await goto('#/mission/m0.5');
    assert.ok((await p.textContent('main')).includes('Lien WhatsApp à configurer'), 'pas de faux lien WhatsApp');
    await p.fill('textarea[data-field=smart]', 'Gagner 10 cm de détente en 90 jours');
    await p.click('[data-act=ficheCheck][data-item=sent]');
    await p.waitForTimeout(150);
    await validate();
    await goto('#/mission/m0.6');
    await p.click('[data-act=choice][data-val="Personnalisée"]');
    await p.waitForTimeout(60);
    await validate();
    assert.ok(await p.$('.overlay'), 'écran de félicitations');
    assert.ok((await p.textContent('.overlay')).includes('Carte Rookie'));
    await closeOverlays();
    assert.ok((await p.textContent('.topbar')).includes('Rookie'));
  });

  await t('arène 1 : 1.1 bloquée 24 h, ouverte après', async () => {
    await goto('#/');
    assert.ok((await p.textContent('.next-card')).includes('Se débloque'));
    await goto('#/mission/m1.1');
    assert.ok(!(await p.$('textarea[data-field=habit]')), 'pas de saisie sur une mission verrouillée');
    await p.click('.demo-bar [data-act=travel]');
    await p.waitForTimeout(120);
    await goto('#/mission/m1.1');
    assert.ok(await p.$('textarea[data-field=habit]'));
  });

  await t('fiche : réponses sauvegardées et retrouvées après rechargement', async () => {
    await p.fill('textarea[data-field=habit]', 'Me coucher avant 23 h');
    await p.waitForTimeout(1000);
    await p.reload();
    await p.waitForSelector('textarea[data-field=habit]');
    assert.strictEqual(await p.inputValue('textarea[data-field=habit]'), 'Me coucher avant 23 h');
    await validate();
    await closeOverlays(); // habitude débloquée
    assert.ok(await p.evaluate(() => !!AMApp.session.state.habits.h1));
  });

  await t('habitude du jour : oui → série 1', async () => {
    await goto('#/habitudes');
    await p.click('[data-act=habit][data-id=h1][data-val=yes]');
    await p.waitForTimeout(80);
    assert.ok((await p.textContent('.habit .streak')).includes('1'));
    await noOverflow();
  });

  const travel = async () => { await p.evaluate(() => { AMApp.store.travel(864e5); }); await p.reload(); await p.waitForSelector('.page'); };

  await t('échelle 1-10 (1.2, 1.3) et quiz (1.4)', async () => {
    await travel();
    await goto('#/mission/m1.2');
    await p.fill('textarea[data-field=now]', 'Je stagne à 56 cm');
    await p.fill('textarea[data-field=goal]', 'Dunker');
    await p.waitForTimeout(900);
    await validate();
    await travel();
    await goto('#/mission/m1.3');
    for (const k of ['p1', 'p2', 'p3', 'p4', 'p5']) { await p.click(`[data-act=scale][data-item=${k}][data-val="7"]`); await p.waitForTimeout(50); }
    await validate();
    await travel();
    await goto('#/mission/m1.4');
    assert.ok((await p.textContent('main')).includes('[DÉMO]'), 'questions de démo clairement étiquetées');
    for (const q of await p.$$eval('[data-act=quizPick][data-o="0"]', els => els.map(e => e.dataset.q))) {
      await p.click(`[data-act=quizPick][data-q=${q}][data-o="0"]`); await p.waitForTimeout(30);
    }
    await p.click('[data-act=quizSubmit]');
    await p.waitForTimeout(100);
    assert.ok((await p.textContent('main')).includes('Quiz terminé'));
    await validate();
    await travel();
    await goto('#/mission/m1.5');
    for (const k of ['q1', 'q2', 'q3']) await p.fill(`textarea[data-field=${k}]`, 'réponse');
    await p.waitForTimeout(900);
    await validate();
  });

  await t('boss : rappel des réponses, échec 3/5, essai bloqué jusqu\'au lendemain, puis victoire', async () => {
    await travel();
    await goto('#/mission/boss-a1');
    assert.ok((await p.textContent('.recall')).includes('Me coucher avant 23 h'), 'récapitulatif des réponses de l\'arène');
    assert.ok((await p.textContent('main')).includes('Termine le défi pratique'));
    await p.fill('textarea[data-field=priority]', 'Le sommeil');
    await p.waitForTimeout(900);
    await p.reload(); await p.waitForSelector('.page');
    const qs = await p.$$eval('[data-act=quizPick][data-o="1"]', els => els.map(e => e.dataset.q));
    assert.strictEqual(qs.length, 5);
    for (let i = 0; i < 5; i++) { await p.click(`[data-act=quizPick][data-q=${qs[i]}][data-o="${i < 3 ? 1 : 0}"]`); await p.waitForTimeout(30); }
    await p.click('[data-act=bossSubmit]');
    await p.waitForTimeout(150);
    const txt = await p.textContent('main');
    assert.ok(txt.includes('3 / 5'), 'score affiché');
    assert.ok(txt.includes('sans pénalité'));
    assert.ok(!(await p.$('[data-act=bossSubmit]')), 'pas de second essai le même jour');
    await travel();
    await goto('#/mission/boss-a1');
    for (const q of qs) { await p.click(`[data-act=quizPick][data-q=${q}][data-o="1"]`); await p.waitForTimeout(30); }
    await p.click('[data-act=bossSubmit]');
    await p.waitForTimeout(150);
    assert.ok((await p.textContent('.overlay')).includes('Badge de victoire'));
    await closeOverlays();
  });

  await t('carte : statuts terminée / en cours / verrouillée', async () => {
    await goto('#/carte');
    const cls = await p.$$eval('.map-node', els => els.map(e => e.className));
    assert.ok(cls[0].includes('done') && cls[1].includes('done'));
    assert.ok(cls[2].includes('current'));
    assert.ok(cls[3].includes('locked'));
    await noOverflow();
  });

  await t('mission multi-jours (3.2) : une coche par jour, validable au 7ᵉ', async () => {
    // Avance jusqu'à 3.2 en jouant les missions (moteur direct, même règles)
    await p.evaluate(() => {
      const S = AMApp.store, E = S.engine;
      const fill = (id) => {
        const m = E.mission(id), sup = E.supportOf(m), data = {};
        if (sup.type === 'checklist' && !sup.daily) sup.items.forEach(i => { data[i.id] = i.choices ? i.choices[0] : true; });
        if (sup.type === 'fiche') sup.fields.forEach(f => { if (f.type !== 'recall') data[f.id] = f.type === 'check' ? true : 'x'; });
        if (Object.keys(data).length) S.data.state = E.apply(S.data.state, { type: 'support', id, data }, S.now()).state;
      };
      for (const id of ['m2.1', 'm2.2', 'm2.3', 'm2.4', 'm2.5', 'boss-a2', 'm3.1']) {
        let v = E.view(S.data.state, S.now()).items[id];
        if (v.status === 'waiting') S.travel(v.unlockAt - S.now() + 1000);
        fill(id);
        if (id.startsWith('boss')) {
          const ans = {}; E.mission(id).quiz.questions.forEach(q => { ans[q.id] = 1; });
          S.data.state = E.apply(S.data.state, { type: 'boss', id, answers: ans }, S.now()).state;
        } else S.data.state = E.apply(S.data.state, { type: 'validate', id }, S.now()).state;
      }
      const v = E.view(S.data.state, S.now()).items['m3.2'];
      S.travel(v.unlockAt - S.now() + 1000);
      S.save();
    });
    await p.reload(); await p.waitForSelector('.page');
    await goto('#/mission/m3.2');
    for (let d = 1; d <= 7; d++) {
      await p.click('[data-act=dayCheck][data-item=streak]');
      await p.waitForTimeout(40);
      await p.click('[data-act=checkin]');
      await p.waitForTimeout(80);
      if (d < 7) {
        assert.ok(await p.$eval('[data-act=validate]', b => b.disabled), 'jour ' + d + ' : pas encore validable');
        assert.ok(!(await p.$('[data-act=checkin]')), 'une seule coche par jour');
        await travel(); await goto('#/mission/m3.2');
      }
    }
    assert.ok(!(await p.$eval('[data-act=validate]', b => b.disabled)));
    await validate();
  });

  await t('récompenses, règles, profil, fin, admin : rendus sans débordement', async () => {
    for (const h of ['#/recompenses', '#/regles', '#/profil', '#/fin', '#/', '#/arene/a3']) { await goto(h); await noOverflow(); }
    await goto('#/admin');
    await p.waitForTimeout(150);
    const txt = await p.textContent('main');
    assert.ok(txt.includes('[DÉMO] Inès K.'), 'participants fictifs étiquetés');
    assert.ok(txt.includes('À contacter'), 'échéance J30 repérée');
    await p.click('[data-act=adminFilter][data-f=touch]');
    await p.waitForTimeout(80);
    const n = await p.$$eval('.adm-row', els => els.length);
    assert.ok(n >= 1);
    await noOverflow();
  });

  await t('320 px : aucun débordement', async () => {
    await p.setViewportSize({ width: 320, height: 568 });
    for (const h of ['#/', '#/carte', '#/mission/m3.2', '#/mission/boss-a1', '#/habitudes', '#/recompenses', '#/admin']) { await goto(h); await p.waitForTimeout(60); await noOverflow(); }
  });

  await t('aucune erreur JavaScript', async () => {
    assert.deepStrictEqual(errors, []);
  });

  await browser.close(); srv.close();
  console.log((failed ? '✗' : '✓') + ' test-ui : ' + passed + ' réussis, ' + failed + ' échoués');
  process.exit(failed ? 1 : 0);
})();
