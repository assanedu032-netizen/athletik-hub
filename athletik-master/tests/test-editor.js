// Éditeur de contenu dans Chromium (mode démo) : node tests/test-editor.js
// Brouillon → aperçu → publication, sans toucher au code ; vidéo YouTube ;
// questions et bonnes réponses ; tous les emplacements présents.
'use strict';
const assert = require('assert');
const { chromium } = require('playwright');
const { start } = require('./serve.js');
const program = require('../public/content/program.json');

const PORT = 8796, URL = 'http://localhost:' + PORT + '/';
let passed = 0, failed = 0;
async function t(name, fn) {
  try { await fn(); passed++; }
  catch (e) { failed++; console.error('✗ ' + name + '\n   ' + (e && e.stack || e).split('\n').slice(0, 4).join('\n   ')); }
}

(async () => {
  // ─── Contrôle statique : aucun emplacement oublié ─────────────────────────
  await t('chaque mission a titre, titre vidéo, emplacement vidéo, contenu, consignes, action et support', () => {
    program.missions.forEach(m => {
      ['title', 'videoTitle', 'video', 'body', 'instructions', 'action'].forEach(k => assert.ok(k in m, m.id + ' : champ ' + k));
      assert.ok(m.videoTitle.trim(), m.id + ' : titre vidéo');
      const sup = m.kind === 'boss' ? m.challenge : m.support;
      assert.ok(sup, m.id + ' : support');
      if (m.kind === 'boss' && !m.final) assert.strictEqual(m.quiz.questions.length, 5, m.id + ' : 5 emplacements de questions');
      if (sup.type === 'quiz') assert.ok(sup.questions.length >= 1, m.id + ' : emplacements de questions');
    });
  });
  await t('aucune vidéo ni question inventée dans le contenu livré', () => {
    program.missions.forEach(m => {
      assert.strictEqual(m.video, '', m.id);
      assert.strictEqual(m.body, '', m.id);
      const qs = [].concat((m.quiz && m.quiz.questions) || [], (m.support && m.support.questions) || []);
      qs.forEach(q => { assert.strictEqual(q.q, '', m.id + ' ' + q.id); assert.ok(q.options.every(o => o === ''), m.id); });
    });
  });

  const srv = await start(PORT);
  const browser = await chromium.launch();
  const p = await (await browser.newContext({ viewport: { width: 375, height: 667 } })).newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(e.message));
  p.on('dialog', d => d.accept());
  await p.route(/fonts\.(googleapis|gstatic)|youtube-nocookie/, r => r.fulfill({ status: 200, body: '' }));
  const goto = async (h) => { await p.evaluate(x => { location.hash = x; }, h); await p.waitForTimeout(120); };
  const noOverflow = async () => {
    const o = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert.ok(o <= 0, 'débordement de ' + o + ' px');
  };

  await p.goto(URL);
  await p.click('[data-act=demo]');
  await p.waitForSelector('.demo-bar');
  await p.click('[data-act=startProgram]');
  await p.waitForTimeout(100);

  await t('tableau de bord du contenu : 51 fiches, compteurs à zéro', async () => {
    await goto('#/contenu');
    await p.waitForSelector('.mrow');
    assert.strictEqual(await p.$$eval('.mrow', e => e.length), 51);
    const txt = await p.textContent('main');
    assert.ok(txt.includes('0 / 51') && txt.includes('vidéos renseignées'));
    assert.ok(txt.includes('Tout est publié'));
    await noOverflow();
  });

  await t('mission 0.1 : titre, vidéo YouTube, texte, consignes → brouillon (pas encore en ligne)', async () => {
    await goto('#/contenu/m0.1');
    await p.fill('[data-ed=videoTitle]', 'Bienvenue : les règles en 2 minutes');
    await p.fill('[data-ed=video]', 'pas une url');
    assert.ok((await p.textContent('#vidHint')).includes('non reconnu'));
    await p.fill('[data-ed=video]', 'https://youtu.be/dQw4w9WgXcQ');
    assert.ok((await p.textContent('#vidHint')).includes('YouTube'));
    assert.ok(await p.$('#vidPrev iframe[src*="youtube-nocookie.com/embed/dQw4w9WgXcQ"]'), 'aperçu intégré');
    await p.fill('[data-ed=body]', 'Texte pédagogique écrit par Alassane.');
    await p.fill('[data-ed=instructions]', 'Étape 1 : télécharge l\'app.');
    assert.ok(await p.isVisible('#edDirty'));
    await noOverflow();
    await p.click('[data-act=edSave]');
    await p.waitForTimeout(150);
    // pas encore publié : la mission côté participant n'a pas changé
    await goto('#/mission/m0.1');
    assert.ok((await p.textContent('main')).includes('Vidéo bientôt disponible'));
  });

  await t('aperçu du brouillon : vidéo intégrée et textes visibles, actions inactives', async () => {
    await goto('#/apercu/m0.1');
    await p.waitForSelector('.notice');
    const txt = await p.textContent('main');
    assert.ok(txt.includes('Aperçu du brouillon'));
    assert.ok(txt.includes('Texte pédagogique écrit par Alassane.') && txt.includes('Étape 1'));
    assert.ok(await p.$('.video iframe[src*="dQw4w9WgXcQ"]'));
    await p.click('[data-act=check][data-item=dl]');
    await p.waitForTimeout(80);
    assert.ok((await p.textContent('.toast')).includes('Aperçu'));
    assert.strictEqual(await p.evaluate(() => !!(AMApp.session.state.missions['m0.1'] || {}).support), false, 'aucune écriture en aperçu');
  });

  await t('boss : 5 questions rédigées + bonnes réponses, checklist modifiée', async () => {
    await goto('#/contenu/boss-a2');
    for (let i = 0; i < 5; i++) {
      await p.fill(`[data-ed="quiz.questions.${i}.q"]`, 'Question réelle ' + (i + 1) + ' ?');
      for (let o = 0; o < 3; o++) await p.fill(`[data-ed="quiz.questions.${i}.options.${o}"]`, 'Option ' + 'ABC'[o]);
      await p.click(`[data-act=edKey][data-q=q${i + 1}][data-o="2"]`);
    }
    await p.click('[data-act=edAdd][data-path="challenge.items"]');
    await p.waitForTimeout(80);
    await p.fill('[data-ed="challenge.items.3.label"]', 'Noter ton ressenti');
    await p.click('[data-act=edSave]');
    await p.waitForTimeout(150);
    const d = await p.evaluate(() => AMApp.contentData.draft);
    assert.strictEqual(d.ov.missions['boss-a2'].quiz.questions[0].q, 'Question réelle 1 ?');
    assert.deepStrictEqual(d.keys['boss-a2'], { q1: 2, q2: 2, q3: 2, q4: 2, q5: 2 });
    assert.ok(!JSON.stringify(d.ov).includes('"correct"'), 'les réponses ne sont pas dans la surcouche publique');
  });

  await t('lien invalide refusé à l\'enregistrement', async () => {
    await goto('#/contenu/m0.2');
    await p.fill('[data-ed=video]', 'javascript:alert(1)');
    await p.click('[data-act=edSave]');
    await p.waitForTimeout(120);
    assert.ok((await p.textContent('.toast')).includes('Lien vidéo non reconnu'));
    await p.fill('[data-ed=video]', '');
    await p.click('[data-act=edSave]');
    await p.waitForTimeout(120);
  });

  await t('arène et habitude modifiables', async () => {
    await goto('#/contenu/arene/a1');
    await p.fill('[data-ed="habit.frequency"]', 'Chaque matin, au réveil');
    await p.click('[data-act=edSaveArena]');
    await p.waitForTimeout(150);
    assert.strictEqual((await p.evaluate(() => AMApp.contentData.draft.ov.habits.h1)).frequency, 'Chaque matin, au réveil');
  });

  await t('publier : les participants voient la vidéo, les textes et les vraies questions', async () => {
    await goto('#/contenu');
    assert.ok((await p.textContent('main')).includes('modifications non publiées'));
    await p.click('[data-act=cPublish]');
    await p.click('.ask [data-ask="1"]');
    await p.waitForTimeout(200);
    await goto('#/mission/m0.1');
    assert.ok(await p.$('.video iframe[src*="dQw4w9WgXcQ"]'));
    const txt = await p.textContent('main');
    assert.ok(txt.includes('Bienvenue : les règles en 2 minutes'));
    assert.ok(txt.includes('Texte pédagogique écrit par Alassane.') && txt.includes('Consignes'));
    // le moteur de la démo utilise les vraies questions et réponses publiées
    const ok = await p.evaluate(() => {
      const m = AMApp.engine.mission('boss-a2');
      return m.quiz.questions[0].q === 'Question réelle 1 ?' && AMApp.engine.bossQuizReady(m);
    });
    assert.ok(ok);
    await goto('#/contenu');
    assert.ok((await p.textContent('main')).includes('Tout est publié'));
  });

  await t('revenir au contenu d\'origine', async () => {
    await goto('#/contenu/m0.1');
    await p.click('details.more summary');
    await p.click('[data-act=edRevert]');
    assert.ok(await p.$('.ask'), 'confirmation dans la page');
    await p.click('.ask [data-ask="1"]');
    await p.waitForTimeout(150);
    assert.strictEqual(await p.inputValue('[data-ed=video]'), '');
  });

  await t('publier directement depuis l\'éditeur, puis retour sur la mission', async () => {
    await goto('#/contenu/m0.2');
    await p.fill('[data-ed=body]', 'Texte publié en un geste.');
    await p.click('[data-act=edPublish]');
    await p.click('.ask [data-ask="1"]');
    await p.waitForTimeout(250);
    assert.ok((await p.evaluate(() => location.hash)).includes('#/mission/m0.2'));
    assert.ok((await p.textContent('main')).includes('Texte publié en un geste.'));
  });

  await t('annuler une confirmation ne fait rien', async () => {
    await goto('#/contenu/m0.3');
    await p.fill('[data-ed=body]', 'brouillon');
    await p.click('[data-act=edSave]'); await p.waitForTimeout(150);
    await goto('#/contenu');
    await p.click('[data-act=cDiscard]');
    await p.click('.ask [data-ask="0"]'); await p.waitForTimeout(100);
    assert.ok((await p.textContent('main')).includes('modifications non publiées'));
    await p.click('[data-act=cDiscard]');
    await p.click('.ask [data-ask="1"]'); await p.waitForTimeout(150);
    assert.ok((await p.textContent('main')).includes('Tout est publié'));
  });

  await t('320 px : éditeur sans débordement', async () => {
    await p.setViewportSize({ width: 320, height: 568 });
    for (const h of ['#/contenu', '#/contenu/boss-a2', '#/contenu/m1.3', '#/contenu/arene/a3', '#/apercu/m6.1', '#/mission/m0.1']) { await goto(h); await noOverflow(); }
  });

  await t('aucune erreur JavaScript', async () => { assert.deepStrictEqual(errors, []); });

  await browser.close(); srv.close();
  console.log((failed ? '✗' : '✓') + ' test-editor : ' + passed + ' réussis, ' + failed + ' échoués');
  process.exit(failed ? 1 : 0);
})();
