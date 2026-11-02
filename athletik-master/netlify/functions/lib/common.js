// Outils partagés des fonctions Athletik Master.
// Firebase : MÊME projet qu'Athletik Hub (même FIREBASE_SERVICE_ACCOUNT), mais
// Master n'écrit QUE dans ses propres collections :
//   masterParticipants/{uid}   état de progression (moteur), nom, email, suivi admin
//   masterAccess/{email}       droits issus des paiements (webhook Systeme.io / admin)
//   masterPaymentEvents/{id}   journal brut des webhooks (audit, idempotence)
// Ces collections tombent sous la règle « tout le reste : refusé » de
// firestore.rules : le client ne peut ni les lire ni les écrire, seul l'Admin
// SDK de ces fonctions y accède. Aucune modification des règles d'Athletik Hub
// n'est nécessaire. users/{uid} (Hub) n'est que LU, jamais écrit.
'use strict';
const admin = require('firebase-admin');
const Engine = require('../../../public/js/engine.js');
const Access = require('../../../public/js/access.js');
const baseProgram = require('../../../public/content/program.json');
const Content = require('../../../public/js/content-tools.js');
// Les BONNES RÉPONSES ne sont pas dans le dépôt : le site Athletik Hub publie
// tout le dépôt (publish = "."), un fichier commité serait donc lisible en
// ligne. Elles vivent dans Firestore masterConfig/quizKeys (collection
// serveur uniquement). server-data/quiz-keys.json ne sert qu'au dev local et
// doit rester sans vraie réponse.
const localKeys = require('../../../server-data/quiz-keys.json');

let ready = false;
function initFirebase() {
  if (ready) return true;
  const sa = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!sa) return false;
  try {
    if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(JSON.parse(sa)) });
    ready = true;
    return true;
  } catch (e) {
    console.error('[master] firebase init failed:', e.message);
    return false;
  }
}

// Contenu publié depuis l'éditeur admin : masterContent/published.json (surcouche
// sérialisée en chaîne — Firestore refuse les tableaux imbriqués du programme).
async function loadPublished() {
  const s = await admin.firestore().collection('masterContent').doc('published').get();
  if (!s.exists) return { ov: null, version: 0 };
  const d = s.data();
  try { return { ov: JSON.parse(d.json || 'null'), version: d.version || 0, publishedAt: d.publishedAt || null }; }
  catch (e) { console.error('[master] contenu publié illisible'); return { ov: null, version: 0 }; }
}
async function loadKeys() {
  let keys = Object.assign({}, localKeys);
  const s = await admin.firestore().collection('masterConfig').doc('quizKeys').get();
  if (s.exists) {
    const d = s.data();
    // Écrit par l'éditeur sous forme de chaîne (keysJson) ; saisie manuelle possible en objet.
    if (typeof d.keysJson === 'string') { try { Object.assign(keys, JSON.parse(d.keysJson)); } catch (e) {} }
    else Object.assign(keys, d);
  }
  delete keys._comment;
  delete keys.keysJson;
  return keys;
}

let engine = null, engineAt = 0;
const TTL = 60 * 1000;
async function getEngine() {
  if (engine && Date.now() - engineAt < TTL) return engine;
  let ov = null, keys = Object.assign({}, localKeys);
  delete keys._comment;
  try { ov = (await loadPublished()).ov; } catch (e) { console.warn('[master] contenu publié indisponible:', e.message); }
  try { keys = await loadKeys(); } catch (e) { console.warn('[master] quizKeys indisponibles:', e.message); }
  engine = Engine.createEngine(Content.merge(baseProgram, ov), { quizKeys: keys });
  engineAt = Date.now();
  return engine;
}
function resetEngine() { engine = null; }

function resp(statusCode, payload) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': process.env.MASTER_ALLOWED_ORIGIN || '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
    },
    body: payload === '' ? '' : JSON.stringify(payload)
  };
}

async function verifyUser(event) {
  const h = event.headers || {};
  const ah = h.authorization || h.Authorization;
  if (!ah || !ah.startsWith('Bearer ')) return null;
  try {
    const d = await admin.auth().verifyIdToken(ah.slice(7));
    return { uid: d.uid, email: d.email || null, emailVerified: !!d.email_verified, name: d.name || null };
  } catch (e) {
    return null;
  }
}

function adminEmails() {
  return String(process.env.MASTER_ADMIN_EMAILS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
}
function isAdmin(user) {
  return !!(user && user.email && user.emailVerified && adminEmails().includes(user.email.toLowerCase()));
}

function parseBody(event) {
  try { return JSON.parse(event.body || '{}'); } catch (e) { return null; }
}

// Firestore interdit '/' dans un id de document : on encode l'email.
function accessDocId(email) {
  return encodeURIComponent(Access.emailKey(email));
}

module.exports = { admin, initFirebase, getEngine, resetEngine, loadPublished, loadKeys, baseProgram, Content, resp, verifyUser, isAdmin, parseBody, accessDocId, Access, Engine };
