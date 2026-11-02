// ════════════════════════════════════════════════════════════════════════════
// /.netlify/functions/master-content — contenu éditable sans redéploiement
// ────────────────────────────────────────────────────────────────────────────
// GET  (public)  → { version, ov } : la surcouche PUBLIÉE (jamais les réponses)
// POST (admin)   → éditeur :
//   { action:'get' }                                   brouillon + publié + réponses
//   { action:'saveMission', id, data, keys }           enregistre dans le brouillon
//   { action:'revertMission', id }                     revient au contenu d'origine
//   { action:'saveArena'|'saveHabit', id, data }
//   { action:'publish' }                               brouillon → en ligne
//   { action:'discard' }                               brouillon ← en ligne
// Stockage (Admin SDK, collections refusées au client par firestore.rules) :
//   masterContent/draft      { json, keysJson, updatedAt, updatedBy }
//   masterContent/published  { json, version, publishedAt, publishedBy }
//   masterConfig/quizKeys    { <missionId>: { <qid>: index } }
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const C = require('./lib/common');

async function readDraft(db, published, keys) {
  const s = await db.collection('masterContent').doc('draft').get();
  if (!s.exists) return { ov: published.ov || C.Content.emptyOverrides(), keys: keys };
  const d = s.data();
  return { ov: JSON.parse(d.json || 'null') || C.Content.emptyOverrides(), keys: JSON.parse(d.keysJson || '{}'), updatedAt: d.updatedAt || null };
}

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') return C.resp(204, '');
  if (!C.initFirebase()) return C.resp(503, { error: 'not_configured' });
  const db = C.admin.firestore();

  if (event.httpMethod === 'GET') {
    try {
      const p = await C.loadPublished();
      const r = C.resp(200, { version: p.version, publishedAt: p.publishedAt || null, ov: p.ov });
      r.headers['Cache-Control'] = 'public, max-age=30';
      return r;
    } catch (e) {
      console.error('[master-content] GET', e);
      return C.resp(500, { error: 'server_error' });
    }
  }
  if (event.httpMethod !== 'POST') return C.resp(405, { error: 'method_not_allowed' });

  const user = await C.verifyUser(event);
  if (!user) return C.resp(401, { error: 'auth_required' });
  if (!C.isAdmin(user)) return C.resp(403, { error: 'forbidden' });
  const body = C.parseBody(event) || {};
  const now = Date.now();

  try {
    const published = await C.loadPublished();
    const keys = await C.loadKeys();
    let draft = await readDraft(db, published, keys);

    if (body.action === 'get') {
      return C.resp(200, {
        published: { ov: published.ov, version: published.version, publishedAt: published.publishedAt || null, keys },
        draft: { ov: draft.ov, keys: draft.keys, updatedAt: draft.updatedAt || null }
      });
    }

    if (['saveMission', 'revertMission', 'saveArena', 'saveHabit'].includes(body.action)) {
      draft = C.Content.draftOp(C.baseProgram, draft, body);
      await db.collection('masterContent').doc('draft').set({
        json: JSON.stringify(draft.ov), keysJson: JSON.stringify(draft.keys), updatedAt: now, updatedBy: user.email
      });
      return C.resp(200, { ok: true, draft: { ov: draft.ov, keys: draft.keys, updatedAt: now } });
    }

    if (body.action === 'publish') {
      const version = (published.version || 0) + 1;
      await db.collection('masterContent').doc('published').set({ json: JSON.stringify(draft.ov), version, publishedAt: now, publishedBy: user.email });
      await db.collection('masterConfig').doc('quizKeys').set({ keysJson: JSON.stringify(draft.keys), updatedAt: now });
      // Historique : chaque publication est conservée (retour arrière possible à la main)
      await db.collection('masterContent').doc('v' + version).set({ json: JSON.stringify(draft.ov), keysJson: JSON.stringify(draft.keys), publishedAt: now, publishedBy: user.email });
      C.resetEngine();
      return C.resp(200, { ok: true, version, publishedAt: now });
    }

    if (body.action === 'discard') {
      await db.collection('masterContent').doc('draft').set({
        json: JSON.stringify(published.ov || C.Content.emptyOverrides()), keysJson: JSON.stringify(keys), updatedAt: now, updatedBy: user.email
      });
      return C.resp(200, { ok: true });
    }

    return C.resp(400, { error: 'bad_action' });
  } catch (e) {
    if (e && e.isEngineError) return C.resp(400, { error: e.code, message: e.message });
    console.error('[master-content]', e);
    return C.resp(500, { error: 'server_error' });
  }
};
