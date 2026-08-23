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

// Trois fenêtres de rappel — le cron tourne toutes les 10 min, chaque fenêtre
// fait 10 min de large pour ne toucher qu'une fois chaque séance.
//
//   1. PRELECTURE (H-60) : ~1h avant → suggère la lecture du livre adaptée.
//   2. PREP (H-30)       : ~30 min avant → "prépare-toi, la séance arrive".
//   3. POST (H+5)        : ~5 min après → micro-engagement, note ton ressenti.
const PRELECTURE_LO = 55;
const PRELECTURE_HI = 65;
const PREP_LO       = 30;
const PREP_HI       = 40;
const POST_LO       = -10;  // 10 min après l'heure programmée
const POST_HI       = 0;    // jusqu'à pile à l'heure

// Fenêtre nocturne — pas de push entre 22h et 7h locales. Évite de réveiller
// l'utilisateur si sa session est planifiée en début/fin de journée pile à
// cheval sur cette plage.
const NIGHT_START = 22 * 60;  // 22:00
const NIGHT_END   = 7  * 60;  // 07:00
function isNightWindow(localMinutes) {
  return localMinutes >= NIGHT_START || localMinutes < NIGHT_END;
}

// ════════════════════════════════════════════════════════════════════════════
// RÈGLES D'ENVOI  —  brique 6
// ────────────────────────────────────────────────────────────────────────────
// Quatre garde-fous, tous adossés à des données réelles du profil :
//   1. heures de silence choisies par l'utilisateur (brique 3), avec la
//      fenêtre 22h-7h en repli pour qui n'a rien défini ;
//   2. une seule notification par jour, quelle que soit la catégorie ;
//   3. après 3 notifications ignorées d'affilée, passage en mode réduit
//      (1 par semaine) — détecté en comparant lastNotifAt à profile.lastActive ;
//   4. relances d'inactivité J+3 / J+7 / J+14, puis plus rien du tout.
// L'état vit dans un champ Firestore SÉPARÉ (notifState) : patcher `profile`
// écraserait la map entière et ferait perdre des champs.
// ════════════════════════════════════════════════════════════════════════════
const IGNORED_THRESHOLD = 3;               // passages sans ouverture avant mode réduit
const REDUCED_MIN_GAP_MS = 7 * 86400000;   // mode réduit : 1 push / semaine
const INACTIVITY_STAGES = [3, 7, 14];      // jours d'absence déclenchant une relance
const INACTIVITY_HOUR_LO = 18 * 60;        // relance envoyée entre 18h et 19h locales
const INACTIVITY_HOUR_HI = 19 * 60;

function toMin(hhmm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || ''));
  return m ? (+m[1]) * 60 + (+m[2]) : null;
}

// Heures de silence de l'utilisateur, sinon la fenêtre nocturne historique.
// Gère le passage à minuit (22:00 → 07:00).
function isQuietFor(prof, localMinutes) {
  const q = prof && prof.quietHours;
  const s = q && toMin(q.start), e = q && toMin(q.end);
  if (s == null || e == null) return isNightWindow(localMinutes);
  return (s <= e) ? (localMinutes >= s && localMinutes < e)
                  : (localMinutes >= s || localMinutes < e);
}

function daysBetween(aIso, bIso) {
  const a = Date.parse(aIso), b = Date.parse(bIso);
  if (isNaN(a) || isNaN(b)) return null;
  return Math.floor((b - a) / 86400000);
}

// Une notification est « ignorée » si l'app n'a pas été ouverte depuis son
// envoi. profile.lastActive est écrit par saveData() côté client et remonte
// dans Firestore via fbSaveProfile.
function wasIgnored(prof, st) {
  if (!st || !st.lastNotifAt) return false;
  const sent = Date.parse(st.lastNotifAt);
  const seen = Date.parse(prof && prof.lastActive);
  if (isNaN(sent)) return false;
  return isNaN(seen) ? true : seen < sent;
}

// Décide si on a le droit d'envoyer maintenant. Renvoie null si autorisé,
// sinon la raison du blocage (pour les logs).
function sendBlockedReason(prof, st, nowIso, localMinutes) {
  if (isQuietFor(prof, localMinutes)) return 'quiet';
  const last = st && st.lastNotifAt;
  if (last) {
    // Plafond absolu : 1 par jour, toutes catégories confondues.
    if (String(last).slice(0, 10) === String(nowIso).slice(0, 10)) return 'daily_cap';
    // Mode réduit après 3 passages sans ouverture.
    const ignored = (st.ignoredCount || 0);
    if (ignored >= IGNORED_THRESHOLD) {
      const gap = Date.parse(nowIso) - Date.parse(last);
      if (!isNaN(gap) && gap < REDUCED_MIN_GAP_MS) return 'reduced_mode';
    }
  }
  return null;
}

// Étape de relance à envoyer, ou null. Ne se répète jamais : chaque palier
// n'est franchi qu'une fois, et après J+14 on n'envoie plus rien.
function inactivityStageFor(prof, st, nowIso, localMinutes) {
  if (localMinutes < INACTIVITY_HOUR_LO || localMinutes >= INACTIVITY_HOUR_HI) return null;
  const last = prof && (prof.lastSessionDay || prof.lastActive);
  if (!last) return null;
  const d = daysBetween(String(last).length === 10 ? last + 'T00:00:00Z' : last, nowIso);
  if (d == null) return null;
  const done = st && st.inactivityStage ? +st.inactivityStage : 0;
  for (let i = INACTIVITY_STAGES.length - 1; i >= 0; i--) {
    const stage = INACTIVITY_STAGES[i];
    if (d >= stage && done < stage) return stage;
  }
  return null;
}

// Messages de relance — aucun reproche, aucune urgence fabriquée (§19).
function inactivityMessage(stage, prof) {
  if (stage === 3) {
    return { title: 'Athletik Hub',
             body: 'Semaine chargée ? 10 sauts, 2 minutes, ça compte quand même.' };
  }
  if (stage === 7) {
    const v = prof && prof.vertJump;
    return { title: 'Athletik Hub',
             body: v ? ('Ta détente est à ' + v + ' cm. Tes données t\'attendent quand tu veux.')
                     : 'Tes données t\'attendent quand tu veux.' };
  }
  return { title: 'Athletik Hub',
           body: 'On arrête les rappels ici. Ton historique reste intact si tu reviens.' };
}

// Écrit l'état de notification dans un champ SÉPARÉ. On ne touche jamais à
// `profile` : un PATCH sur une map la remplace entièrement.
async function saveNotifState(docName, accessToken, st) {
  const url = 'https://firestore.googleapis.com/v1/' + docName
            + '?updateMask.fieldPaths=notifState';
  const fields = {};
  if (st.lastNotifAt)    fields.lastNotifAt    = { stringValue: String(st.lastNotifAt) };
  if (st.ignoredCount != null)    fields.ignoredCount    = { integerValue: String(st.ignoredCount) };
  if (st.inactivityStage != null) fields.inactivityStage = { integerValue: String(st.inactivityStage) };
  try {
    const res = await fetch(url, {
      method: 'PATCH',
      headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: { notifState: { mapValue: { fields: fields } } } }),
    });
    if (!res.ok) console.warn('[reminders] notifState PATCH', res.status);
  } catch (e) {
    // Couche secondaire : un échec d'écriture ne doit jamais empêcher l'envoi.
    console.warn('[reminders] notifState:', e.message);
  }
}

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
        name: doc.name,                       // chemin complet, requis pour le PATCH
        planning: fsValue(fields.planning),
        profile: fsValue(fields.profile),
        notifState: fsValue(fields.notifState) || {},
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

  let sent = 0, checked = 0, blocked = 0, revived = 0;
  const nowIso = new Date().toISOString();

  for (const u of users) {
    const pl = u.planning;
    const prof = u.profile || {};
    const st = u.notifState || {};
    const token = prof.fcmToken;
    if (!token) continue;

    const tz = (pl && pl.tz) || 'Europe/Paris';
    const nowL = localNowParts(tz);
    if (!nowL) continue;

    // ── Comptage des notifications ignorées ──
    // Évalué à chaque passage, AVANT toute décision d'envoi : si la
    // précédente n'a pas été suivie d'une ouverture, on incrémente. Une
    // ouverture remet le compteur à zéro.
    let ignoredCount = st.ignoredCount || 0;
    if (st.lastNotifAt) {
      ignoredCount = wasIgnored(prof, st) ? ignoredCount : 0;
    }

    // ── Relances d'inactivité (J+3 / J+7 / J+14, puis plus rien) ──
    // Indépendantes du planning : un utilisateur absent n'a souvent plus de
    // séance programmée. Soumises aux mêmes garde-fous.
    const stage = inactivityStageFor(prof, st, nowIso, nowL.minutes);
    if (stage) {
      const why = sendBlockedReason(prof, Object.assign({}, st, { ignoredCount }), nowIso, nowL.minutes);
      if (why) { blocked++; continue; }
      const msg = inactivityMessage(stage, prof);
      try {
        const okSent = await sendPush(sa.project_id, accessToken, token, msg.title, msg.body);
        if (okSent) {
          revived++;
          await saveNotifState(u.name, accessToken, {
            lastNotifAt: nowIso,
            ignoredCount: ignoredCount + 1,   // pas encore ouverte
            inactivityStage: stage
          });
        }
      } catch (e) { console.warn('[reminders] relance :', e.message); }
      continue;   // une relance remplace le rappel de séance du jour
    }

    if (!pl || !Array.isArray(pl.days) || !pl.days.length) continue;
    checked++;
    if (pl.days.indexOf(nowL.day) === -1) continue; // pas un jour de séance

    const times = pl.times || {};
    const planned = times[nowL.day] != null ? times[nowL.day] : times[String(nowL.day)];
    // L'ancrage (brique 3) prime sur le planning quand il est défini : c'est
    // le moment naturel déclaré par l'athlète, pas un horaire théorique.
    // Le planning reste le repli pour qui n'a pas défini de déclencheur.
    const timeStr = (prof.anchorTime && /^\d{1,2}:\d{2}$/.test(prof.anchorTime))
                    ? prof.anchorTime : planned;
    if (!timeStr || !/^\d{1,2}:\d{2}$/.test(timeStr)) continue;

    // Garde-fous : heures de silence de l'utilisateur, plafond d'1 par jour,
    // mode réduit après 3 notifications ignorées. Vérifiés AVANT le calcul de
    // fenêtre pour couper même un match légitime.
    const why = sendBlockedReason(prof, Object.assign({}, st, { ignoredCount }), nowIso, nowL.minutes);
    if (why) { blocked++; continue; }

    const hm = timeStr.split(':');
    const sessionMin = (+hm[0]) * 60 + (+hm[1]);
    const diff = sessionMin - nowL.minutes;

    // Détermine quelle fenêtre on touche — préséance (H-60), prep (H-30) ou
    // post-séance (H+5). Si on est en dehors des trois, on saute ce user.
    let kind = null;
    if (diff >= PRELECTURE_LO && diff < PRELECTURE_HI) kind = 'prelecture';
    else if (diff >= PREP_LO  && diff < PREP_HI)       kind = 'prep';
    else if (diff <= POST_HI  && diff > POST_LO)       kind = 'post';
    if (!kind) continue;

    // Préférences par catégorie. Default ON pour prelecture/post/weekly,
    // OFF pour prep (anti-spam). Master switch (notifToggle côté front)
    // n'enlève PAS le fcmToken — on s'appuie sur la valeur explicite du
    // toggle, donc on ne peut respecter que ce qui est dans notifPrefs.
    const np = prof.notifPrefs || {};
    const onByDefault = { prelecture:true, prep:false, post:true };
    const isOn = (np[kind] === undefined) ? onByDefault[kind] : !!np[kind];
    if (!isOn) continue;

    // Construit le payload selon la fenêtre.
    let title, body;
    const prenom = prof.prenom || '';
    if (kind === 'prelecture') {
      const lec = lectureFor(prof.programKey);
      title = (prenom ? prenom + ', ' : '') + 'lecture du jour 📖';
      body  = lec.titre + ' (' + lec.page + ') — ' + lec.focus + ' Séance à ' + timeStr + '.';
    } else if (kind === 'prep') {
      title = 'Séance dans ' + diff + ' min 🏋️';
      body  = (prenom ? prenom + ', ta' : 'Ta') + ' séance de ' + timeStr + ' approche. Prépare-toi — Titan.';
    } else {
      // POST H+5 : micro-engagement, court, sans charge.
      title = (prenom ? prenom + ', bien joué' : 'Bien joué') + ' 💪';
      body  = 'Note ton ressenti pendant que c\'est frais. La progression se mesure aussi à ta lucidité.';
    }

    try {
      const ok = await sendPush(
        sa.project_id, accessToken, token, title, body
      );
      if (ok) {
        sent++;
        // On repart d'un palier d'inactivité vierge : l'utilisateur a de
        // nouveau une séance planifiée, la relance n'a plus lieu d'être.
        await saveNotifState(u.name, accessToken, {
          lastNotifAt: nowIso,
          ignoredCount: ignoredCount + 1,   // remis à 0 dès la prochaine ouverture
          inactivityStage: 0
        });
      }
    } catch (e) {
      console.warn('[reminders] push échoué :', e.message);
    }
  }

  console.log('[reminders] ' + sent + ' rappel(s) + ' + revived + ' relance(s) envoyé(s), ' +
              blocked + ' bloqué(s) par les garde-fous — ' +
              checked + ' planning(s) actif(s) sur ' + users.length + ' user(s).');
  return { statusCode: 200, body: 'ok sent=' + sent + ' revived=' + revived + ' blocked=' + blocked };
};
