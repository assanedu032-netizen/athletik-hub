/* Configuration PUBLIQUE d'Athletik Master (aucun secret ici).
 * La config Firebase web est publique par conception : la sécurité repose sur
 * Firebase Auth + les fonctions serveur + les règles Firestore. C'est le MÊME
 * projet qu'Athletik Hub → mêmes identifiants pour les deux produits. */
window.AM_CONFIG = {
  firebase: {
    apiKey: 'AIzaSyBMeuLan21LGxUKB5XCmLN1110VJWvyM5s',
    authDomain: 'athletik-hub.firebaseapp.com',
    projectId: 'athletik-hub',
    storageBucket: 'athletik-hub.firebasestorage.app',
    messagingSenderId: '106927728638',
    appId: '1:106927728638:web:976000a60011dc4004c2af'
  },
  apiBase: '/.netlify/functions',
  hubUrl: 'https://athletikhub.netlify.app',
  // À COMPLÉTER — numéro WhatsApp d'Alassane au format international sans « + »
  // ni espace (ex. '33612345678'). Vide = bouton « Lien WhatsApp à configurer ».
  whatsappNumber: '',
  // À COMPLÉTER — page de vente Systeme.io (affichée si l'accès n'est pas actif).
  salesUrl: '',
  // Formulaire Tally de confirmation de livraison (kit physique).
  // Le participant y arrive avec uid / email / prénom en paramètres cachés.
  deliveryFormUrl: 'https://tally.so/r/4aQp4o',
  deliveryFormAdminUrl: 'https://tally.so/forms/4aQp4o/submissions'
};
