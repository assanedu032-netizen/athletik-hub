// Firebase Messaging Service Worker
// Doit être à la racine du site (https://athletikhub.netlify.app/firebase-messaging-sw.js)
// pour que Firebase puisse l'enregistrer automatiquement.
// Reçoit les push notifications quand l'app est fermée ou en arrière-plan.

importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyBMeuLan21LGxUKB5XCmLN1110VJWvyM5s",
  authDomain: "athletik-hub.firebaseapp.com",
  projectId: "athletik-hub",
  storageBucket: "athletik-hub.firebasestorage.app",
  messagingSenderId: "106927728638",
  appId: "1:106927728638:web:976000a60011dc4004c2af",
});

const messaging = firebase.messaging();

// Notif reçue en arrière-plan : on construit la notification système.
messaging.onBackgroundMessage(function(payload) {
  const title = (payload.notification && payload.notification.title) || 'Titan';
  const options = {
    body: (payload.notification && payload.notification.body) || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: 'athletik-titan',
    vibrate: [120, 60, 120],
    data: payload.data || {},
  };
  self.registration.showNotification(title, options);
});

// Click sur la notif → on focus / ouvre l'app
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(list) {
      for (let i = 0; i < list.length; i++) {
        const c = list[i];
        if (c.url.indexOf(self.location.origin) === 0 && 'focus' in c) return c.focus();
      }
      if (clients.openWindow) return clients.openWindow('/');
    })
  );
});
