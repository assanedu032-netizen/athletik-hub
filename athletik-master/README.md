# Athletik Master — PWA de formation (v0.1)

Programme de transformation de 90 jours : un niveau 0, 8 arènes, 50 missions et boss,
8 habitudes, des rangs et des récompenses. Le contenu vient du document
« Athletik Master — Plan du contenu » (2 nov. 2026), transcrit dans
`public/content/program.json` **sans changer un titre ni une action**.

Application **indépendante** d'Athletik Hub : son propre dossier, son propre site
Netlify, ses propres fonctions. Le code et la configuration d'Athletik Hub ne sont
pas modifiés.

---

## 1. Lancer la démo (2 minutes)

```bash
cd athletik-master
node tests/serve.js 8788        # puis ouvrir http://localhost:8788/
```

Cliquer sur **« Découvrir en mode démo »**. Ou bien ajouter `?demo` à l'URL.

- Toutes les données de démo sont **fictives** et restent **sur l'appareil**
  (`localStorage`, clé `am_demo_v1`). Un bandeau rayé les signale en permanence.
- **+24 h** dans le bandeau avance l'horloge de la démo : c'est ce qui permet de
  tester les déblocages sans attendre. Profil → *Outils de démonstration* : +1 h,
  +7 jours, simuler le paiement complet, remettre à zéro.
- Les quiz n'ont pas encore de questions dans le document source. **En démo
  seulement**, ils sont remplis de questions marquées **[DÉMO]** (la bonne réponse
  est « Bonne réponse »). Elles n'existent pas en production.
- L'**espace admin** est ouvert en démo (Profil → Espace administrateur), avec
  trois participants fictifs marqués [DÉMO].

Une fois déployé sur Netlify, la démo marche de la même façon depuis l'URL du site.

## 2. Déployer

1. Netlify → **Add new site** → même dépôt GitHub → **Base directory : `athletik-master`**.
   Le fichier `athletik-master/netlify.toml` est alors utilisé (publish `public`,
   fonctions `netlify/functions`). Le site Athletik Hub n'est pas touché.
2. Variables d'environnement du nouveau site :

| Variable | Rôle |
| --- | --- |
| `FIREBASE_SERVICE_ACCOUNT` | Même JSON que pour Athletik Hub (même projet Firebase). |
| `MASTER_ADMIN_EMAILS` | Emails admin, séparés par des virgules (ex. `assanedu032@gmail.com`). L'email doit être vérifié. |
| `SYSTEMEIO_WEBHOOK_SECRET` | Secret long et aléatoire, à mettre dans l'URL du webhook. |
| `MASTER_OFFER_PLANS` | `{"<id offre Systeme.io>":"one_time","<id offre 3x>":"installments"}` |
| `MASTER_INSTALLMENTS` | Nombre d'échéances du paiement fractionné (défaut 3). |
| `SYSTEMEIO_SIGNING_SECRET` | *Facultatif* : si Systeme.io signe ses envois (`X-Webhook-Signature`). |
| `MASTER_ALLOWED_ORIGIN` | *Facultatif* : origine autorisée (CORS), sinon `*`. |

3. Firebase Console → Authentication → **Authorized domains** : ajouter le domaine
   du nouveau site (sinon la connexion Google est refusée).
4. Compléter `public/js/config.js` : `whatsappNumber` (format `33612345678`) et
   `salesUrl` (page de vente).

## 3. Architecture

```
athletik-master/
├─ public/                    ← servi tel quel (PWA, aucun build)
│  ├─ index.html, manifest.webmanifest, sw.js
│  ├─ content/program.json    ← LE CONTENU (arènes, missions, habitudes, récompenses)
│  ├─ js/engine.js            ← règles du jeu (pur, partagé navigateur / serveur / tests)
│  ├─ js/access.js            ← paiements, kit, rôles, J30/J60 (pur, partagé)
│  ├─ js/demo.js              ← pack démo (quiz [DÉMO], participants fictifs)
│  ├─ js/store.js             ← DemoStore (local) / RemoteStore (Firebase + API)
│  ├─ js/app.js               ← interface (routeur, vues, composants génériques)
│  └─ js/config.js            ← config publique (Firebase web, WhatsApp, URLs)
├─ netlify/functions/
│  ├─ master-api.js           ← toutes les actions du participant
│  ├─ master-admin.js         ← espace admin
│  └─ systemeio-webhook.js    ← preuve de paiement
├─ server-data/quiz-keys.json ← dev local uniquement (voir § 4)
└─ tests/
```

**Un seul moteur, exécuté côté serveur.** En production, le navigateur n'envoie que
des intentions (« coche cet élément », « valide 1.3 »). `master-api` relit l'état,
applique `engine.js` **avec l'heure du serveur** et enregistre. Changer l'heure du
téléphone ou forger une requête ne débloque rien. En démo, le même fichier tourne
dans le navigateur.

**Firebase : même projet, mêmes identifiants, zéro changement côté Hub.**
- Un participant se connecte avec son compte Athletik Hub (email/mot de passe ou
  Google), ou en crée un — c'est le même compte pour les deux apps.
- Master écrit **uniquement** dans trois collections nouvelles, via l'Admin SDK :
  `masterParticipants/{uid}` (progression), `masterAccess/{email}` (paiements),
  `masterPaymentEvents/{id}` (journal des webhooks). Plus `masterConfig/quizKeys`
  en lecture.
- Les règles Firestore actuelles refusent déjà tout accès client à ces collections
  (`match /{document=**} { allow read, write: if false; }`) : **aucune règle à
  modifier**, et le client ne peut pas tricher en écrivant directement dans Firestore.
- `users/{uid}` (Athletik Hub) est **lu** pour connaître le Premium Hub, **jamais écrit**
  (vérifié par `tests/test-functions.js`).

**Droits** (`access.js → roles`) :

| Rôle | Source |
| --- | --- |
| Participant Athletik Master | `masterAccess/{email}` avec au moins un paiement confirmé, non remboursé, **et email vérifié** |
| Athletik Hub Standard | inclus avec l'achat Master |
| Athletik Hub Premium | droits Hub existants (livre, code) **ou** le mois offert au boss Tout Donner |
| Administrateur | email listé dans `MASTER_ADMIN_EMAILS` et vérifié |

**Kit physique** : paiement complet (1 fois, ou 3 échéances) **et** 14 jours après le
premier paiement **et** pas de remboursement. Le participant ne voit qu'un
« Un colis est en route » le moment venu ; l'admin voit le statut exact.

## 4. Compléter le contenu (sans toucher au code)

Tout est dans `public/content/program.json`. Pour chaque mission :

| Champ | Effet |
| --- | --- |
| `video` | URL YouTube, Vimeo ou fichier `.mp4`. Vide → « Vidéo à ajouter ». Dès qu'une URL existe, la vidéo devient une condition de validation (un `.mp4` se coche tout seul à la fin ; YouTube/Vimeo via « J'ai regardé la vidéo »). |
| `body` | Texte de la notion. Vide → « Contenu pédagogique à compléter ». |
| `support` / `challenge` | `checklist` (`items`), `fiche` (`fields` : `text`, `textarea`, `number`, `date`, `check`, `scale`, `recall`) ou `quiz` (`questions`). |
| `durationDays`, `consecutive` | Mission sur plusieurs jours (une coche par jour). |
| `unlockDelayHours` | Délai de déblocage (24 h par défaut, 0 au niveau 0). |
| `draft: true` | Mission visible sur la carte mais hors parcours (cas de 7.x). |
| `_todo` | Ce qui manque encore (ignoré par l'app). |

Format d'une question : `{ "id": "q1", "q": "Texte ?", "options": ["A", "B", "C"] }`.
Un boss a besoin de **exactement 5** questions.

**Les bonnes réponses ne vont jamais dans `program.json`** (fichier public), ni dans
le dépôt : le site Athletik Hub publie tout le dépôt (`publish = "."`), un fichier
commité serait lisible en ligne. Elles vont dans **Firestore → `masterConfig/quizKeys`** :
`{ "boss-a1": { "q1": 2, "q2": 0, … }, "m6.2": { … } }` (index de la bonne option,
0 = la première). Rechargé par le serveur toutes les 5 minutes.

## 5. Ce qui fonctionne

Connexion (email, Google, création de compte, mot de passe oublié, vérification
d'email) · page de début · tableau de bord · carte des 9 étapes (terminée / en cours /
verrouillée) · niveau 0 ouvert d'emblée · 50 missions et boss · page mission
(vidéo ou emplacement, notion, action, support, validation, navigation sans
contournement) · checklist · fiche sauvegardée au fil de la frappe · quiz avec score et
correction · déblocage à 24 h · missions sur plusieurs jours (série cassée → on repart
de zéro, minuit **local** du participant) · boss (défi + 5 questions, 4/5, nouvel
essai le lendemain, défi conservé) · boss final sans condition de performance ·
rangs, 9 récompenses, écrans de félicitations · habitudes débloquées par les missions,
oui / non / « pas de séance », séries · règles du jeu · page de fin, recommencer le
parcours · espace admin (progression, arène, missions, boss, habitudes, J30/J60,
début/fin, accès manuel) · webhook Systeme.io · PWA installable et hors ligne.

**Tests** (`npm test` + navigateur) :

```bash
node tests/test-engine.js      # 39 — règles du jeu
node tests/test-access.js      # 13 — paiements, kit, rôles, webhook, J30/J60
node tests/test-functions.js   # 16 — fonctions serveur contre un Firebase simulé
node tests/test-ui.js          # 14 — parcours réel dans Chromium (375 et 320 px)
```

## 6. En attente (rien n'est simulé comme « fonctionnel »)

| Élément | État | Ce qu'il faut |
| --- | --- | --- |
| **Webhook Systeme.io** | Point d'entrée prêt, sécurisé, idempotent. Le **format exact** des événements Systeme.io n'est pas confirmé : la lecture est tolérante et tout événement non reconnu est journalisé sans effet. | Créer le webhook dans Systeme.io vers `https://<site>/.netlify/functions/systemeio-webhook?key=<SYSTEMEIO_WEBHOOK_SECRET>`, faire une vente test, lire l'événement dans `masterPaymentEvents` et ajuster `normalizeEvent()` si besoin. Renseigner `MASTER_OFFER_PLANS`. En attendant : **accès manuel** depuis l'espace admin. |
| **Email de bienvenue** | Reste à Systeme.io. Le participant crée son compte (ou utilise celui du Hub) avec l'email d'achat. | Mettre le lien du site dans l'email Systeme.io. |
| **Habitudes dans Athletik Hub** | Le déblocage est enregistré côté Master (`masterParticipants/{uid}.state.habits`). Le suivi quotidien tourne **provisoirement dans Master** (écran « Mes habitudes du jour », signalé comme tel). | Côté Hub (non modifié) : lire les habitudes débloquées via une petite fonction serveur, les afficher dans « Mes habitudes du jour » et écrire les coches au même format `{ "AAAA-MM-JJ": "yes"|"no"|"skip" }`. |
| **Hub Standard / mois Premium** | Calculés et affichés côté Master ; le mois Premium est enregistré avec `status: 'pending_hub_integration'`. | Le Hub ne les lit pas encore (son accès repose sur l'essai 3 jours + livre/codes). Il faudra que `hasValidAccess()` du Hub reconnaisse un achat Master — changement du Hub à valider. |
| **Lien WhatsApp** | Bouton affiché « Lien WhatsApp à configurer ». | `whatsappNumber` dans `config.js`. |
| **Vidéos, textes, questions** | Emplacements clairement marqués. | Remplir `program.json` + `masterConfig/quizKeys`. |

## 7. Décisions provisoires à valider

1. **Habitude 1 « Relire son objectif SMART »** : aucune mission du Départ ne
   l'enseigne explicitement → rattachée à **1.1**. **Habitude 7 « Échauffement »** →
   rattachée à **7.2** en attendant la mission échauffement du livre. **Habitude 8** → **8.2**.
2. **Défi du boss** = l'action du boss dans le tableau des missions. La règle
   « habitude tenue 5 jours sur 7 » du document est codée mais **désactivée**
   (`settings.bossHabitRule.enabled`) : sans suivi Hub, elle bloquerait l'arène 7
   (habitude débloquée 2 jours avant le boss).
3. **Durées** : 3.2, 4.4, 6.5, 8.1, boss 3 et 6 = 7 jours d'affilée ; 5.4 = 5 ; 6.1 = 3.
   **8.2 et 8.3 n'ont pas de durée** dans le document → mission d'un jour (à préciser).
4. **Mission 7.x** « Concepts du livre » : marquée `draft`, visible, hors parcours.
5. **Le boss s'ouvre 24 h** après la dernière mission de l'arène, et la première mission
   d'une arène 24 h après le boss (une mission par jour).
6. **« Nouvel essai le lendemain »** = à partir de minuit, heure du participant.
7. **Accès** dès la 1ʳᵉ échéance d'un paiement en 3 fois ; il n'est coupé que par un
   remboursement (les relances d'échéances restent chez Systeme.io).
8. **Boss 1 « Le bilan du Départ »** : le défi affiche le récapitulatif des réponses de
   l'arène + « Ta priorité » ; les 5 questions sont le quiz.
9. **MENER (1.3)** et **les 3 questions d'intention (1.5)** : libellés provisoires
   (« Pilier 1 — M », « Question 1 — à compléter »).
10. **Vidéo d'engagement / de fin** : envoi déclaré par une case à cocher (pas de
    vérification automatique possible côté WhatsApp).
