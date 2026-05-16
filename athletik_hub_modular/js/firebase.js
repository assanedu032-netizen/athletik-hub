/* ═══════════════════════════════════════
   FIREBASE.JS — Auth + Firestore sync
   Depends on window.fb populated by the module script in index.html
═══════════════════════════════════════ */

// Called by the SDK whenever auth state changes (signin / signout / reload).
function onFirebaseAuthChange(fbUser) {
  if (fbUser) {
    if (typeof user !== 'undefined') {
      user.email = fbUser.email || user.email || '';
      if (fbUser.displayName && !user.name) user.name = fbUser.displayName;
    }
    fbLoadFirestoreToLocal(fbUser).then(function(loaded) {
      if (loaded && loaded.programKey) {
        // Skip onboarding — go straight to home
        document.querySelectorAll('.scr').forEach(function(e){
          e.classList.remove('on','out'); e.style.display='none';
        });
        var nav = document.getElementById('mainNav'); if (nav) nav.style.display='flex';
        if (typeof switchTab === 'function') switchTab('home');
        if (typeof renderUserData === 'function') renderUserData();
      } else {
        // First login — let onboarding run
        if (typeof go === 'function' && document.getElementById('q0')) go('q0');
      }
    });
  } else {
    // Signed out — UI handled by logoutUser() / boot logic
  }
  fbRefreshAccountSection(fbUser);
}

// Load /users/{uid} from Firestore into the local user object + storage.
async function fbLoadFirestoreToLocal(fbUser) {
  if (!window.fb || !fbUser) return null;
  try {
    var ref = window.fb.doc(window.fb.db, 'users', fbUser.uid);
    var snap = await window.fb.getDoc(ref);
    if (!snap.exists()) return null;
    var data = snap.data() || {};
    var profile = data.profile || {};
    // Merge into local user
    if (typeof user !== 'undefined') {
      Object.keys(profile).forEach(function(k){ user[k] = profile[k]; });
    }
    if (typeof R !== 'undefined') {
      ['prenom','age','sexe','q4','sport','program','programName','poste','freq','compet']
        .forEach(function(k){ if (profile[k] != null) R[k] = profile[k]; });
    }
    try { if (typeof saveData === 'function') saveData(); } catch(e) {}
    return profile;
  } catch (e) {
    console.warn('fbLoadFirestoreToLocal:', e);
    return null;
  }
}

// Save the current user profile to Firestore (merge).
async function fbSaveProfile() {
  if (!window.fb || !window.fbUser) return false;
  try {
    var ref = window.fb.doc(window.fb.db, 'users', window.fbUser.uid);
    var profile = Object.assign({}, (typeof user !== 'undefined' ? user : {}));
    // Pull a few onboarding answers too
    if (typeof R !== 'undefined') {
      ['prenom','age','sexe','q4','sport','program','programName','poste','freq','compet']
        .forEach(function(k){ if (R[k] != null) profile[k] = R[k]; });
    }
    await window.fb.setDoc(ref, { profile: profile, updatedAt: window.fb.serverTimestamp() }, { merge: true });
    return true;
  } catch (e) {
    console.warn('fbSaveProfile:', e);
    return false;
  }
}

// Email/Password sign-up
async function obCreateAccount() {
  var email = (document.getElementById('aEmail') || {}).value;
  var pass  = (document.getElementById('aPass')  || {}).value;
  var msgEl = document.getElementById('authMsg');
  email = (email || '').trim();
  pass  = pass || '';
  if (!email || !pass) { fbShowMsg('Email et mot de passe requis.', 'err'); return; }
  if (pass.length < 6) { fbShowMsg('6 caractères minimum.', 'err'); return; }
  if (!window.fb) { fbShowMsg('Firebase non chargé.', 'err'); return; }
  try {
    var cred = await window.fb.createUserWithEmailAndPassword(window.fb.auth, email, pass);
    if (typeof user !== 'undefined') { user.email = email; user.name = email.split('@')[0].toUpperCase(); }
    if (typeof R !== 'undefined' && R.programName) user.program = R.programName;
    await fbSaveProfile();
    fbShowMsg('Compte créé ! Bienvenue.', 'ok');
    setTimeout(function(){ if (typeof enterApp === 'function') enterApp(); }, 600);
  } catch (e) {
    var m = (e && e.code) ? e.code.replace('auth/','').replace(/-/g,' ') : 'Erreur inconnue.';
    fbShowMsg('Échec : ' + m, 'err');
  }
}

// Email/Password sign-in
async function fbSignIn() {
  var email = (document.getElementById('aEmail') || {}).value;
  var pass  = (document.getElementById('aPass')  || {}).value;
  email = (email || '').trim();
  pass  = pass || '';
  if (!email || !pass) { fbShowMsg('Email et mot de passe requis.', 'err'); return; }
  if (!window.fb) { fbShowMsg('Firebase non chargé.', 'err'); return; }
  try {
    await window.fb.signInWithEmailAndPassword(window.fb.auth, email, pass);
    fbShowMsg('Connecté !', 'ok');
    // onAuthStateChanged handles the redirect.
  } catch (e) {
    var m = (e && e.code) ? e.code.replace('auth/','').replace(/-/g,' ') : 'Erreur';
    fbShowMsg('Échec : ' + m, 'err');
  }
}

// Google sign-in (popup)
async function fbGoogleSignIn() {
  if (!window.fb) { fbShowMsg('Firebase non chargé.', 'err'); return; }
  try {
    await window.fb.signInWithPopup(window.fb.auth, window.fb.googleProvider);
    fbShowMsg('Connecté via Google !', 'ok');
  } catch (e) {
    var m = (e && e.code) ? e.code.replace('auth/','').replace(/-/g,' ') : 'Erreur';
    fbShowMsg('Échec Google : ' + m, 'err');
  }
}

// Full sign-out: Firebase + local + caches + reload
async function fbSignOut() {
  try { if (window.fb && window.fb.auth) await window.fb.signOut(window.fb.auth); } catch(e) {}
  try {
    localStorage.clear();
    sessionStorage.clear();
  } catch(e) {}
  try {
    if (window.caches) {
      var keys = await caches.keys();
      await Promise.all(keys.map(function(k){ return caches.delete(k); }));
    }
  } catch(e) {}
  location.replace(location.origin + location.pathname + '?logout=' + Date.now());
}

function fbShowMsg(msg, type) {
  var el = document.getElementById('authMsg');
  if (!el) { console.log('[auth]', type, msg); return; }
  el.textContent = msg;
  el.className = 'msg ' + (type === 'ok' ? 'ok' : 'err');
}

function fbRefreshAccountSection(fbUser) {
  // Optional: update the profile section to show connected email
  var emailEl = document.getElementById('profileEmail');
  if (emailEl) emailEl.textContent = fbUser ? (fbUser.email || '—') : 'Non connecté';
}

// Replace legacy localStorage createAccount + logoutUser with Firebase versions
window.createAccount = function() { obCreateAccount(); };
window.logoutUser = function() {
  if (!confirm('Se déconnecter ? Tes données restent enregistrées en cloud, tu pourras les retrouver à la prochaine connexion.')) return;
  fbSignOut();
};
