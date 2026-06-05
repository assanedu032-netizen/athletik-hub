// Endpoint one-shot : chunke le livre, génère les embeddings OpenAI, stocke dans Netlify Blobs.
// Déclenchement : POST avec header X-Admin-Token == process.env.ADMIN_BUILD_TOKEN.

const fs = require('fs');
const path = require('path');
const { getStore } = require('@netlify/blobs');
const { chunkBook } = require('./lib/chunk');

const EMBED_MODEL = 'text-embedding-3-small';

async function embedBatch(texts, key) {
  const r = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
    body: JSON.stringify({ model: EMBED_MODEL, input: texts }),
  });
  if (!r.ok) {
    const err = await r.text();
    throw new Error('OpenAI embeddings ' + r.status + ': ' + err.slice(0, 200));
  }
  const data = await r.json();
  return data.data.map(d => d.embedding);
}

exports.handler = async function(event) {
  const headers = { 'Content-Type': 'application/json' };

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };
  }
  const adminToken = process.env.ADMIN_BUILD_TOKEN;
  if (!adminToken) {
    return { statusCode: 503, headers, body: JSON.stringify({ error: 'ADMIN_BUILD_TOKEN non configuré.' }) };
  }
  const supplied = event.headers['x-admin-token'] || event.headers['X-Admin-Token'];
  if (supplied !== adminToken) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Token admin invalide.' }) };
  }
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    return { statusCode: 503, headers, body: JSON.stringify({ error: 'OPENAI_API_KEY non configurée.' }) };
  }

  let bookText;
  try {
    const bookPath = path.join(__dirname, '..', '..', 'data', 'livre.md');
    bookText = fs.readFileSync(bookPath, 'utf8');
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Livre introuvable: ' + e.message }) };
  }

  const chunks = chunkBook(bookText);
  if (chunks.length === 0) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Aucun chunk généré.' }) };
  }

  // OpenAI accepte jusqu'à 2048 inputs par requête.
  const BATCH = 512;
  const embeddings = [];
  try {
    for (let i = 0; i < chunks.length; i += BATCH) {
      const slice = chunks.slice(i, i + BATCH).map(c => c.text);
      const vecs = await embedBatch(slice, openaiKey);
      embeddings.push(...vecs);
    }
  } catch (e) {
    return { statusCode: 502, headers, body: JSON.stringify({ error: 'Embeddings: ' + e.message }) };
  }

  const index = {
    model: EMBED_MODEL,
    dim: embeddings[0].length,
    builtAt: new Date().toISOString(),
    chunks: chunks.map((c, i) => ({ id: c.id, page: c.page, text: c.text, e: embeddings[i] })),
  };

  try {
    const store = getStore('titan-book-index');
    await store.setJSON('main', index);
  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Blobs write: ' + e.message }) };
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      ok: true,
      chunks: chunks.length,
      dim: index.dim,
      builtAt: index.builtAt,
      sampleFirstChunk: chunks[0].text.slice(0, 200),
    }),
  };
};
