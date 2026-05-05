/* ═══════════════════════════════════════
   STORAGE.JS — Validation + localStorage
   Athletik Hub V8
═══════════════════════════════════════ */

// ═══════════════════════════════════════════════════════════════
// ROBUSTESSE V8 — Persistance blindée
// Pourquoi : localStorage peut être corrompu, tronqué ou vide.
// Sans validation, l'app crashe silencieusement et le testeur perd tout.
// ═══════════════════════════════════════════════════════════════

var AH_KEY = 'athletik_hub_v8';
var AH_BACKUP_KEY = 'athletik_hub_backup';
var AH_LAST_SAVE = 'athletik_hub_last_save';

// ── SCHÉMA DE VALIDATION ──
// Définit la structure attendue de chaque propriété.
// Si une clé manque ou a le mauvais type, on la recrée proprement.
var DATA_SCHEMA = {
  user: {
    name: { type: 'string', default: 'ATHLÈTE' },
    email: { type: 'string', default: '' },
    program: { type: 'string', default: 'ELITE ATHLETE' },
    programKey: { type: 'string', default: 'ea' },
    programObj: { type: 'string', default: 'Explosivité globale' },
    phase: { type: 'number', default: 1 },
    weekNum: { type: 'number', default: 1 },
    totalWeeks: { type: 'number', default: 20 },
    progressPct: { type: 'number', default: 0 },
    streak: { type: 'number', default: 0 },
    athScore: { type: 'any', default: null },
    vertJump: { type: 'any', default: null },
    level: { type: 'string', default: 'Rookie' },
    satDone: { type: 'boolean', default: false },
    sport: { type: 'string', default: '' },
    age: { type: 'any', default: '' },
    sexe: { type: 'string', default: '' },
    appMode: { type: 'string', default: 'guided' },
    lastActive: { type: 'any', default: null }
  }
};

// ── VALIDATION D'UN OBJET CONTRE UN SCHÉMA ──
// Pourquoi : si une clé est undefined ou du mauvais type,
// on la remet à sa valeur par défaut plutôt que de planter.
function validateSchema(obj, schema) {
  if (!obj || typeof obj !== 'object') return false;
  var repaired = false;
  var keys = Object.keys(schema);
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    var rule = schema[key];
    if (!(key in obj) || obj[key] === undefined) {
      obj[key] = rule.default;
      repaired = true;
    } else if (rule.type !== 'any') {
      var actualType = typeof obj[key];
      if (actualType !== rule.type) {
        // Essayer de convertir plutôt que d'écraser
        if (rule.type === 'number' && !isNaN(parseFloat(obj[key]))) {
          obj[key] = parseFloat(obj[key]);
        } else if (rule.type === 'boolean') {
          obj[key] = Boolean(obj[key]);
        } else if (rule.type === 'string') {
          obj[key] = String(obj[key] || rule.default);
        } else {
          obj[key] = rule.default;
          repaired = true;
        }
      }
    }
  }
  return !repaired; // true = données propres, false = réparation effectuée
}

// ── VALIDATION DES HABITUDES ──
function validateHabits(habits) {
  if (!Array.isArray(habits)) return [];
  return habits.filter(function(h) {
    // Une habitude valide doit avoir au moins ces 4 champs
    return h && typeof h.id === 'number'
      && typeof h.name === 'string' && h.name.length > 0
      && typeof h.duration === 'number'
      && typeof h.daysCompleted === 'number';
  }).map(function(h) {
    // Compléter les champs manquants
    h.streak = typeof h.streak === 'number' ? h.streak : 0;
    h.lastChecked = h.lastChecked || null;
    h.cat = h.cat || 'Mental';
    h.startDate = h.startDate || new Date().toISOString();
    return h;
  });
}

// ── VALIDATION DE L'HISTORIQUE SAT ──
function validateHistory(history) {
  if (!Array.isArray(history)) return [];
  return history.filter(function(entry) {
    return entry && typeof entry.date === 'string' && typeof entry.score === 'number';
  }).slice(-50); // Garder les 50 dernières entrées max pour éviter un localStorage trop lourd
}

// ── SAUVEGARDE AVEC VALIDATION ──
// Pourquoi : on valide AVANT d'écrire pour ne jamais corrompre le localStorage.
function saveData() {
  try {
    // Mettre à jour la date de dernière activité
    user.lastActive = new Date().toISOString();
    
    var data = {
      v: 8,
      savedAt: new Date().toISOString(),
      user: user,
      activeHabits: activeHabits,
      trainingDays: Array.from(trainingDays),
      satHistory: window.satHistory || [],
      trackHistory: window.trackHistory || []
    };
    
    // Valider avant d'écrire
    validateSchema(data.user, DATA_SCHEMA.user);
    data.activeHabits = validateHabits(data.activeHabits);
    data.satHistory = validateHistory(data.satHistory);
    
    var serialized = JSON.stringify(data);
    
    // Vérifier que la sérialisation est valide en la re-parsant
    // Pourquoi : JSON.stringify peut produire des données invalides avec des objets circulaires
    JSON.parse(serialized);
    
    localStorage.setItem(AH_KEY, serialized);
    localStorage.setItem(AH_LAST_SAVE, new Date().toISOString());
    
    // Backup automatique une fois par jour
    var lastBackup = localStorage.getItem('ah_last_backup');
    var today = new Date().toDateString();
    if (lastBackup !== today) {
      localStorage.setItem(AH_BACKUP_KEY, serialized);
      localStorage.setItem('ah_last_backup', today);
    }
    
    return true;
  } catch(e) {
    console.warn('AH saveData error:', e.message);
    return false;
  }
}

// ── CHARGEMENT AVEC AUTO-RÉPARATION ──
// Pourquoi : si les données sont corrompues, on essaie de récupérer
// ce qui est lisible plutôt que de tout effacer.
function loadData() {
  // Essayer d'abord les données principales
  var raw = tryLoadRaw(AH_KEY);
  
  // Si ça échoue, essayer le backup
  if (!raw) {
    console.warn('AH: données principales corrompues, tentative backup...');
    raw = tryLoadRaw(AH_BACKUP_KEY);
    if (raw) {
      console.warn('AH: backup récupéré');
      // Restaurer le backup comme données principales
      localStorage.setItem(AH_KEY, JSON.stringify(raw));
    }
  }
  
  if (!raw) return false;
  
  // Appliquer les données avec validation et réparation
  var repaired = false;
  
  if (raw.user) {
    var isClean = validateSchema(raw.user, DATA_SCHEMA.user);
    if (!isClean) repaired = true;
    Object.keys(raw.user).forEach(function(k) { user[k] = raw.user[k]; });
  }
  
  if (raw.activeHabits !== undefined) {
    activeHabits = validateHabits(raw.activeHabits);
    if (activeHabits.length !== (raw.activeHabits || []).length) repaired = true;
  }
  
  if (Array.isArray(raw.trainingDays)) {
    raw.trainingDays.forEach(function(d) {
      if (typeof d === 'number' && d >= 0 && d <= 6) trainingDays.add(d);
    });
  }
  
  window.satHistory = validateHistory(raw.satHistory);
  window.trackHistory = validateHistory(raw.trackHistory);
  
  // Si on a réparé des données, re-sauvegarder immédiatement
  if (repaired) {
    console.warn('AH: données réparées, re-sauvegarde...');
    saveData();
  }
  
  return true;
}

// ── HELPER : TENTER DE LIRE UN RAW ──
function tryLoadRaw(key) {
  try {
    var raw = localStorage.getItem(key);
    if (!raw || raw === 'undefined' || raw === 'null') return null;
    var parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    if (!parsed.v || parsed.v < 6) return null; // Version trop ancienne
    return parsed;
  } catch(e) {
    return null; // JSON invalide
  }
}

// ── EXPORT JSON ──
function exportData() {
  try {
    var raw = localStorage.getItem(AH_KEY);
    if (!raw) { alert('Aucune donnée à exporter.'); return; }
    var data = JSON.parse(raw);
    var filename = 'athletik_hub_' + (user.name || 'backup') + '_' + new Date().toISOString().slice(0,10) + '.json';
    var blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function() { URL.revokeObjectURL(a.href); }, 1000);
  } catch(e) {
    alert('Export impossible sur cet appareil. Essaie depuis un ordinateur.');
  }
}

// ── IMPORT JSON ──
function importData(input) {
  var file = input.files[0];
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function(e) {
    try {
      var data = JSON.parse(e.target.result);
      // Valider avant d'importer
      if (!data || typeof data !== 'object' || !data.user) {
        alert('Fichier invalide. Il doit contenir un champ "user".');
        return;
      }
      // Backup des données actuelles avant d'écraser
      var current = localStorage.getItem(AH_KEY);
      if (current) localStorage.setItem('ah_before_import', current);
      
      localStorage.setItem(AH_KEY, JSON.stringify(data));
      alert('Données importées avec succès. Rechargement...');
      location.reload();
    } catch(err) {
      alert('Fichier JSON invalide : ' + err.message);
    }
  };
  reader.readAsText(file);
}

// ── EFFACER LES DONNÉES ──
function clearData() {
  if (confirm('Supprimer toutes tes données ? Cette action est irréversible.')) {
    // Garder un backup avant d'effacer
    var current = localStorage.getItem(AH_KEY);
    if (current) {
      localStorage.setItem('ah_before_clear', current);
      localStorage.setItem('ah_clear_date', new Date().toISOString());
    }
    localStorage.removeItem(AH_KEY);
    localStorage.removeItem(AH_BACKUP_KEY);
    location.reload();
  }
}

// ── AUTO-SAVE ──
// Pourquoi : sauvegarder toutes les 30 secondes ET à chaque action clé
setInterval(saveData, 30000);

// ═══════════════════════════════════════════════════════════════
// TITAN CONTEXTUELS — Messages basés sur l'historique
// Pourquoi : un Titan qui répète toujours la même chose est ignoré.
// Un Titan qui sait ce que tu n'as pas fait depuis 2 jours, tu l'écoutes.
// ═══════════════════════════════════════════════════════════════

function getTitanContextualMessage() {
  var now = new Date();
  var today = now.toDateString();
  
  // 1. Habitude non cochée depuis 2+ jours
  for (var i = 0; i < activeHabits.length; i++) {
    var h = activeHabits[i];
    if (h.lastChecked) {
      var lastDate = new Date(h.lastChecked);
      var diffDays = Math.floor((now - lastDate) / (1000 * 60 * 60 * 24));
      if (diffDays >= 2) {
        return "Tu n'as pas coché \"" + h.name + "\" depuis " + diffDays + " jours. "
          + "Le streak est à " + h.streak + ". Tu veux vraiment tout recommencer à 0 ?";
      }
    } else if (h.startDate) {
      // Habitude jamais cochée
      var startDate = new Date(h.startDate);
      var daysSinceStart = Math.floor((now - startDate) / (1000 * 60 * 60 * 24));
      if (daysSinceStart >= 1) {
        return "T'as pris l'engagement de \"" + h.name + "\" il y a "
          + daysSinceStart + " jour" + (daysSinceStart > 1 ? 's' : '')
          + ". Tu l'as pas encore coché une seule fois. C'est le moment.";
      }
    }
  }
  
  // 2. Pas de SAT
  if (!user.satDone) {
    var daysSinceInstall = 0;
    if (user.lastActive) {
      var firstSave = localStorage.getItem(AH_LAST_SAVE);
      if (firstSave) {
        daysSinceInstall = Math.floor((now - new Date(firstSave)) / (1000 * 60 * 60 * 24));
      }
    }
    if (daysSinceInstall >= 1) {
      return "Ça fait " + (daysSinceInstall || 'plusieurs') + " jour" + (daysSinceInstall > 1 ? 's' : '')
        + " et ton SAT est pas fait. Sans données, je travaille à l'aveugle. Ça prend 20 minutes.";
    }
    return "T'as pas de données. Fais ton SAT maintenant — 20 minutes. Sans ça ton programme c'est du hasard.";
  }
  
  // 3. Bonne streak
  if (user.streak >= 7) {
    return user.streak + " jours sans lâcher. C'est là que les autres s'arrêtent. La différence c'est toi.";
  }
  
  // 4. Streak cassé (streak = 0 mais satDone)
  if (user.streak === 0 && user.satDone) {
    return "Streak à 0. Ça arrive. Ce qui compte c'est ce que tu fais maintenant. Pas hier.";
  }
  
  // 5. Message par défaut basé sur la progression
  var msgs = [
    "La discipline n'est pas une option. C'est la base. Séance aujourd'hui.",
    "Chaque jour sans progresser, tu régresses. Lance ta séance.",
    "Ton programme est là. Ta séance est là. Il manque juste toi.",
    "Les champions font le travail même quand ils n'en ont pas envie. Surtout quand ils n'en ont pas envie."
  ];
  return msgs[Math.floor(now.getDate() % msgs.length)];
}



