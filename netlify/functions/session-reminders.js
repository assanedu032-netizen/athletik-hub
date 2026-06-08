// Fonction PLANIFIÉE : envoie un rappel push ~30 min avant chaque séance.
// Cron configuré dans netlify.toml ([functions."session-reminders"]).
//
// Principe : lit le planning de chaque utilisateur dans Firestore, calcule
// qui a une séance dans la fenêtre de rappel (30–40 min), et envoie une
// notification FCM v1.
//
// Zéro dépendance npm : JWT signé à la main + OAuth + REST, comme send-notif.js.
// Nécessite FIREBASE_SERVICE_ACCOUNT (Service Account Firebase) côté Netlify.

const crypto = require('crypto');

let _cachedToken = null;
let _cachedTokenExp = 0;

// Deux fenêtres de rappel — le cron tourne toutes les 10 min, chaque fenêtre
// fait 10 min de large pour ne toucher qu'une fois chaque séance.
//
//   1. PRELECTURE (H-60) : ~1h avant → suggère la lecture du livre adaptée
//      au programme. C'est la lecture du jour que Titan recommande sur la Home.
//   2. PREP (H-30)       : ~30 min avant → "prépare-toi, la séance arrive".
const PRELECTURE_LO = 55;
const PRELECTURE_HI = 65;
const PREP_LO       = 30;
const PREP_HI       = 40;

// Lecture recommandée par programme. Aligné avec BOOK_CHAPTERS / lecture_*
// côté front (TITAN_SMART_RULES). Pas inventé — chapitres confirmés du livre.
const LECTURE_BY_PROGRAM = {
  ea: { titre: 'Cours sur la Périodisation', page: 'p.180', focus: 'comprendre pourquoi cette phase MAINTENANT.' },
  vd: { titre: 'Cours sur la Triple Extension', page: 'p.55',  focus: 'la mécanique exacte du saut vertical.' },
  se: { titre: 'Cours sur la Nutrition', page: 'p.125', focus: 'cale ton apport avant la séance.' },
  mt: { titre: 'Chapitre Méthode MENER', page: 'p.207', focus: 'exécuter proprement, pas piloter à l\'ego.' },
  tri:{ titre: 'Cours sur la Force', page: 'p.80',  focus: 'comprendre ce que tu construis aujourd\'hui.' },
  ep: { titre: 'Les Fondations que Personne ne Voit', page: 'p.142', focus: 'les briques invisibles qui font la diff.' }
};
function lectureFor(programKey) {
  if (!programKey) return LECTURE_BY_PROGRAM.ea;
  const k = String(programKey).toLowerCase();
  return LECTURE_BY_PROGRAM[k] || LECTURE_BY_PROGRAM.ea;
}

function base64UrlEncode(input) {
  const b64 = (Buffer.isBuffer(input) ? input : Buffer.from(input)).toString('base64');
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function parseServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT || process.env.FIREBASE_SERVER_KEY;
  if (!raw) return null;
  try {
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch (e) {
    console.error('[reminders] Service Account JSON invalide:', e.message);
    return null;
  }
}

async function getAccessToken(sa) {
  const now = Math.floor(Date.now() / 1000);
  if (_cachedToken && _cachedTokenExp > now + 60) return _cachedToken;
  const header = base64UrlEncode(JSON.stringify({
    alg: 'RS256', typ: 'JWT', kid: sa.private_key_id,
  }));
  const claims = base64UrlEncode(JSON.stringify({
    iss: sa.client_email,
    // Deux scopes : envoi FCM + lecture Firestore.
    scope: 'https://www.googleapis.com/auth/firebase.messaging https://www.googleapis.com/auth/datastore',
    aud: sa.token_uri || 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }));
  const unsigned = header + '.' + claims;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(unsigned);
  const jwt = unsigned + '.' + base64UrlEncode(signer.sign(sa.private_key));

  const res = await fetch(sa.token_uri || 'https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }).toString(),
  });
  const json = await res.json();
  if (!res.ok || !json.access_token) {
    throw new Error('Token OAuth refusé : ' + JSON.stringify(json));
  }
  _cachedToken = json.access_token;
  _cachedTokenExp = now + (json.expires_in || 3600);
  return _cachedToken;
}

// Convertit une valeur typée Firestore REST en valeur JS simple.
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
  if ('arrayValue' in v) {
    return (((v.arrayValue && v.arrayValue.values) || [])).map(fsValue);
  }
  return null;
}

async function listUsers(projectId, accessToken) {
  const users = [];
  let pageToken = '';
  const base = 'https://firestore.googleapis.com/v1/projects/' + projectId +
               '/databases/(default)/documents/users?pageSize=300';
  do {
    const url = base + (pageToken ? '&pageToken=' + encodeURIComponent(pageToken) : '');
    const res = await fetch(url, { headers: { Authorization: 'Bearer ' + accessToken } });
    const json = await res.json();
    if (!res.ok) throw new Error('Firestore list : ' + JSON.stringify(json));
    (json.documents || []).forEach(function (doc) {
      const fields = doc.fields || {};
      users.push({
        planning: fsValue(fields.planning),
        profile: fsValue(fields.profile),
      });
    });
    pageToken = json.nextPageToken || '';
  } while (pageToken);
  return users;
}

// Heure locale dans un fuseau : { day: 0=Lun..6=Dim, minutes: depuis minuit }.
function localNowParts(tz) {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(new Date());
    const get = function (t) {
      const p = parts.find(function (x) { return x.type === t; });
      return p ? p.value : '';
    };
    const y = +get('year'), mo = +get('month'), da = +get('day');
    const hh = +get('hour'), mm = +get('minute');
    const jsDow = new Date(Date.UTC(y, mo - 1, da)).getUTCDay(); // 0=Dimanche
    return { day: (jsDow + 6) % 7, minutes: hh * 60 + mm };       // 0=Lundi
  } catch (e) {
    return null;
  }
}

async function sendPush(projectId, accessToken, token, title, body) {
  const payload = {
    message: {
      token: token,
      notification: { title: title, body: body },
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
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + accessToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    }
  );
  return res.ok;
}

exports.handler = async function () {
  const sa = parseServiceAccount();
  if (!sa || !sa.private_key || !sa.client_email || !sa.project_id) {
    console.error('[reminders] Service Account manquant ou invalide — abandon.');
    return { statusCode: 200, body: 'sa_missing' };
  }

  let accessToken, users;
  try {
    accessToken = await getAccessToken(sa);
    users = await listUsers(sa.project_id, accessToken);
  } catch (e) {
    console.error('[reminders]', e.message);
    return { statusCode: 200, body: 'error' };
  }

  let sent = 0, checked = 0;
  for (const u of users) {
    const pl = u.planning;
    const prof = u.profile || {};
    const token = prof.fcmToken;
    if (!pl || !token || !Array.isArray(pl.days) || !pl.days.length) continue;
    checked++;

    const tz = pl.tz || 'Europe/Paris';
    const nowL = localNowParts(tz);
    if (!nowL) continue;
    if (pl.days.indexOf(nowL.day) === -1) continue; // pas un jour de séance

    const times = pl.times || {};
    const timeStr = times[nowL.day] != null ? times[nowL.day] : times[String(nowL.day)];
    if (!timeStr || !/^\d{1,2}:\d{2}$/.test(timeStr)) continue;

    const hm = timeStr.split(':');
    const sessionMin = (+hm[0]) * 60 + (+hm[1]);
    const diff = sessionMin - nowL.minutes;

    // Détermine quelle fenêtre on touche — préséance (H-60) ou prep (H-30).
    // Si on est en dehors des deux, on saute ce user.
    let kind = null;
    if (diff >= PRELECTURE_LO && diff < PRELECTURE_HI) kind = 'prelecture';
    else if (diff >= PREP_LO   && diff < PREP_HI)      kind = 'prep';
    if (!kind) continue;

    // Construit le payload selon la fenêtre.
    let title, body;
    const prenom = prof.prenom || '';
    if (kind === 'prelecture') {
      const lec = lectureFor(prof.programKey);
      title = (prenom ? prenom + ', ' : '') + 'lecture du jour 📖';
      body  = lec.titre + ' (' + lec.page + ') — ' + lec.focus + ' Séance à ' + timeStr + '.';
    } else {
      title = 'Séance dans ' + diff + ' min 🏋️';
      body  = (prenom ? prenom + ', ta' : 'Ta') + ' séance de ' + timeStr + ' approche. Prépare-toi — Titan.';
    }

    try {
      const ok = await sendPush(
        sa.project_id, accessToken, token, title, body
      );
      if (ok) sent++;
    } catch (e) {
      console.warn('[reminders] push échoué :', e.message);
    }
  }

  console.log('[reminders] ' + sent + ' rappel(s) envoyé(s) — ' +
              checked + ' planning(s) actif(s) sur ' + users.length + ' user(s).');
  return { statusCode: 200, body: 'ok sent=' + sent };
};
