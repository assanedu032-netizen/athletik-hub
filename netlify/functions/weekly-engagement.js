// Fonction PLANIFIÉE : push "engagement de la semaine" le lundi matin.
//
// Cron configuré dans netlify.toml :
//   [functions."weekly-engagement"]
//   schedule = "0 8 * * 1"   # lundi 08:00 UTC
//
// L'heure réelle du push pour chaque utilisateur dépend de son fuseau. On
// pousse uniquement si on est actuellement entre 08:00 et 09:00 LOCAL pour
// ce user — le cron tourne 1×/h en théorie, mais on est généreux côté
// fenêtre (1h pleine) pour éviter de rater les fuseaux extrêmes.
//
// Zéro dépendance npm — même pattern que send-notif.js / session-reminders.js.

const crypto = require('crypto');

let _cachedToken = null;
let _cachedTokenExp = 0;

// Banque d'engagements hebdo. Aligné avec TITAN_SMART_RULES (engagement)
// côté front. Tirage déterministe basé sur le numéro de semaine ISO de
// l'année, donc chaque utilisateur reçoit le MÊME message la même semaine
// (un seul message par semaine, pas de tirage random qui pourrait varier
// si le cron rejoue).
const ENGAGEMENTS = [
  {
    title:  'Engagement de la semaine 🎯',
    body:   'Cette semaine, tu exécutes proprement. Pas de répétition molle. Chaque rep doit avoir un objectif clair.',
    bookRef:'Chapitre 2 — La Méthode MENER — p.207'
  },
  {
    title:  'Engagement de la semaine 🎯',
    body:   'Pas d\'ego, pas d\'excuse. Tu fais ta séance même quand tu n\'as pas envie. C\'est exactement ces jours-là qui construisent un athlète.',
    bookRef:'Chapitre 1 — Le Mental — p.201'
  },
  {
    title:  'Engagement de la semaine 🎯',
    body:   'Mission : intensité propre, technique avant charge. Tu sors de chaque séance fier de ton exécution.',
    bookRef:'Chapitre 2 — La Méthode MENER — p.207'
  },
  {
    title:  'Engagement de la semaine 🎯',
    body:   'Note ton ressenti avant ET après chaque séance. La progression se mesure aussi à ta lucidité.',
    bookRef:'Chapitre 3 — Comment calculer son NPI — p.236'
  },
  {
    title:  'Engagement de la semaine 🎯',
    body:   'Cette semaine, tu travailles la qualité d\'exécution, pas la quantité. Une rep parfaite > 10 reps moyennes.',
    bookRef:'Cours sur la Triple Extension — p.55'
  },
  {
    title:  'Engagement de la semaine 🎯',
    body:   'Cette semaine, le mental compte autant que le physique. Visualisation 5 min avant chaque séance.',
    bookRef:'Chapitre 1 — Le Mental — p.201'
  }
];

function pickEngagement() {
  // Numéro de semaine ISO grossier : (jour de l'année / 7). Même message
  // pour toute la semaine, peu importe quand le cron tourne.
  const d = new Date();
  const start = new Date(d.getFullYear(), 0, 1);
  const doy = Math.floor((d - start) / 86400000);
  const week = Math.floor(doy / 7);
  return ENGAGEMENTS[week % ENGAGEMENTS.length];
}

function base64UrlEncode(input) {
  const b64 = (Buffer.isBuffer(input) ? input : Buffer.from(input)).toString('base64');
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function parseServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) return null;
  try { return typeof raw === 'string' ? JSON.parse(raw) : raw; }
  catch (e) { console.error('[weekly] SA invalide:', e.message); return null; }
}

async function getAccessToken(sa) {
  const now = Math.floor(Date.now() / 1000);
  if (_cachedToken && _cachedTokenExp > now + 60) return _cachedToken;
  const header = base64UrlEncode(JSON.stringify({ alg:'RS256', typ:'JWT', kid:sa.private_key_id }));
  const claims = base64UrlEncode(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging https://www.googleapis.com/auth/datastore',
    aud: sa.token_uri || 'https://oauth2.googleapis.com/token',
    iat: now, exp: now + 3600,
  }));
  const unsigned = header + '.' + claims;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(unsigned);
  const jwt = unsigned + '.' + base64UrlEncode(signer.sign(sa.private_key));
  const res = await fetch(sa.token_uri || 'https://oauth2.googleapis.com/token', {
    method:'POST',
    headers:{ 'Content-Type':'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion:jwt
    }).toString(),
  });
  const json = await res.json();
  if (!res.ok || !json.access_token) throw new Error('OAuth refusé : ' + JSON.stringify(json));
  _cachedToken = json.access_token;
  _cachedTokenExp = now + (json.expires_in || 3600);
  return _cachedToken;
}

function fsValue(v) {
  if (v == null) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return parseInt(v.integerValue, 10);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('nullValue' in v) return null;
  if ('timestampValue' in v) return v.timestampValue;
  if ('mapValue' in v) {
    const o = {};
    const f = (v.mapValue && v.mapValue.fields) || {};
    Object.keys(f).forEach(function (k) { o[k] = fsValue(f[k]); });
    return o;
  }
  if ('arrayValue' in v) return (((v.arrayValue && v.arrayValue.values) || [])).map(fsValue);
  return null;
}

async function listUsers(projectId, accessToken) {
  const users = [];
  let pageToken = '';
  const base = 'https://firestore.googleapis.com/v1/projects/' + projectId +
               '/databases/(default)/documents/users?pageSize=300';
  do {
    const url = base + (pageToken ? '&pageToken=' + encodeURIComponent(pageToken) : '');
    const res = await fetch(url, { headers:{ Authorization:'Bearer ' + accessToken } });
    const json = await res.json();
    if (!res.ok) throw new Error('Firestore list : ' + JSON.stringify(json));
    (json.documents || []).forEach(function (doc) {
      const fields = doc.fields || {};
      users.push({
        planning: fsValue(fields.planning),
        profile:  fsValue(fields.profile),
      });
    });
    pageToken = json.nextPageToken || '';
  } while (pageToken);
  return users;
}

function localHour(tz) {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: tz, hour:'2-digit', hourCycle:'h23',
    }).formatToParts(new Date());
    const p = parts.find(x => x.type === 'hour');
    return p ? parseInt(p.value, 10) : null;
  } catch (e) { return null; }
}

function localWeekday(tz) {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: tz, year:'numeric', month:'2-digit', day:'2-digit',
    }).formatToParts(new Date());
    const get = t => parts.find(x => x.type === t).value;
    const dow = new Date(Date.UTC(+get('year'), +get('month')-1, +get('day'))).getUTCDay();
    return (dow + 6) % 7; // 0=Lundi
  } catch (e) { return null; }
}

async function sendPush(projectId, accessToken, token, title, body) {
  const payload = {
    message: {
      token: token,
      notification: { title:title, body:body },
      webpush: {
        notification: {
          icon: '/icons/icon-192.png',
          badge: '/icons/icon-192.png',
          vibrate: [120, 60, 120],
        },
        fcm_options: { link: '/' },
      },
    },
  };
  const res = await fetch(
    'https://fcm.googleapis.com/v1/projects/' + projectId + '/messages:send',
    {
      method:'POST',
      headers:{ Authorization:'Bearer ' + accessToken, 'Content-Type':'application/json' },
      body: JSON.stringify(payload),
    }
  );
  return res.ok;
}

exports.handler = async function () {
  const sa = parseServiceAccount();
  if (!sa || !sa.private_key || !sa.client_email || !sa.project_id) {
    console.error('[weekly] SA manquant — abandon.');
    return { statusCode: 200, body: 'sa_missing' };
  }

  let accessToken, users;
  try {
    accessToken = await getAccessToken(sa);
    users = await listUsers(sa.project_id, accessToken);
  } catch (e) {
    console.error('[weekly]', e.message);
    return { statusCode: 200, body: 'error' };
  }

  const engagement = pickEngagement();
  let sent = 0;
  for (const u of users) {
    const prof = u.profile || {};
    const token = prof.fcmToken;
    if (!token) continue;

    const tz = (u.planning && u.planning.tz) || 'Europe/Paris';
    // Sécurité : on n'envoie que si on est lundi entre 8h et 9h LOCAL.
    if (localWeekday(tz) !== 0) continue;
    const h = localHour(tz);
    if (h == null || h < 8 || h >= 9) continue;

    const prenom = prof.prenom || '';
    const title = engagement.title;
    const body  = (prenom ? prenom + ' — ' : '') + engagement.body
                + (engagement.bookRef ? ' (' + engagement.bookRef + ')' : '');
    try {
      const ok = await sendPush(sa.project_id, accessToken, token, title, body);
      if (ok) sent++;
    } catch (e) {
      console.warn('[weekly] push échoué :', e.message);
    }
  }

  console.log('[weekly] ' + sent + ' engagement(s) envoyé(s) sur ' + users.length + ' user(s).');
  return { statusCode: 200, body: 'ok sent=' + sent };
};
