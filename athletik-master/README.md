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
| `TALLY_SIGNING_SECRET` | Secret de signature du webhook Tally (formulaire de livraison). |
| `TALLY_DELIVERY_FORM_ID` | *Facultatif* : id du formulaire de livraison (défaut `4aQp4o`). |

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
│  ├─ js/content-tools.js     ← surcouches de contenu, liens vidéo (pur, partagé)
│  ├─ js/demo.js              ← pack démo (quiz [DÉMO], participants fictifs)
│  ├─ js/store.js             ← DemoStore (local) / RemoteStore (Firebase + API)
│  ├─ js/app.js               ← interface (routeur, vues, composants génériques)
│  └─ js/config.js            ← config publique (Firebase web, WhatsApp, URLs)
├─ netlify/functions/
│  ├─ master-api.js           ← toutes les actions du participant
│  ├─ master-admin.js         ← espace admin (participants)
│  ├─ master-content.js       ← éditeur de contenu (brouillon / publication)
│  ├─ systemeio-webhook.js    ← preuve de paiement
│  └─ tally-webhook.js        ← confirmation de livraison du kit
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

### L'éditeur : Profil → Gérer le contenu (`#/contenu`, admin uniquement)

- **Tableau de bord** : les 51 missions par arène, avec ce qui manque pour chacune
  (🎬 vidéo, 📝 contenu, ❓ questions rédigées / bonnes réponses, intitulés provisoires)
  et des compteurs globaux.
- **Fiche d'une mission** :
  - titre de la mission ;
  - titre de la vidéo + **lien YouTube** (vérifié pendant la saisie, aperçu intégré) ;
  - sujets ;
  - contenu pédagogique ;
  - consignes ;
  - action concrète ;
  - mention de prudence ;
  - durée pour les missions sur plusieurs jours ;
  - le support : éléments de checklist (avec choix), champs de fiche (type, obligatoire,
    texte d'aide), questions de quiz (énoncé, réponses, **bonne réponse**, explication).
- **Arènes et habitudes** : nom, thème, blocage, objectif, livrable, intitulé et fréquence
  de l'habitude.
- **Enregistrer le brouillon → Aperçu → Publier.** Le brouillon n'est jamais visible des
  participants. *Publier* met tout en ligne d'un coup : **aucun redéploiement**. Chaque
  version publiée est archivée (`masterContent/v<n>`). *Annuler le brouillon* et
  *Revenir au contenu d'origine* permettent de revenir en arrière.
- **Ce que l'éditeur ne change pas**, volontairement : l'identifiant, l'ordre, l'arène,
  le type de support et les règles de déblocage d'une mission. Ce sont eux qui portent la
  progression des participants. Les identifiants des éléments existants sont conservés,
  pour que les réponses déjà données restent rattachées.
- **En démo**, l'éditeur fonctionne de la même façon, avec un stockage sur l'appareil.

### Les emplacements livrés

Chaque mission a déjà tous ses champs : `videoTitle` (le titre de la mission par
défaut), `video`, `body`, `instructions`, `action` et le support. Chaque quiz a ses
emplacements de questions : **5 par boss**, 3 par quiz de mission (on peut en ajouter ou
en retirer).

**Rien n'est inventé.** Quand un emplacement est vide, l'app affiche
« Vidéo bientôt disponible », « Contenu pédagogique bientôt disponible »,
« Question n — à rédiger » ou « intitulé à compléter ». Un quiz ou un boss dont les
questions ne sont pas rédigées **ne peut pas être validé** : il le devient dès la
publication des questions et de leurs réponses.

### Où vivent les données

| Quoi | Où |
| --- | --- |
| Contenu de base | `public/content/program.json` (livré avec l'app) |
| Modifications publiées | Firestore `masterContent/published` (surcouche, lue par tous) |
| Brouillon | Firestore `masterContent/draft` |
| **Bonnes réponses** | Firestore `masterConfig/quizKeys` (**serveur uniquement**) |

Les bonnes réponses ne vont jamais dans `program.json` ni dans le dépôt : le site
Athletik Hub publie tout le dépôt (`publish = "."`), un fichier commité serait donc
lisible en ligne. Après une publication, les serveurs prennent le nouveau contenu en
**une minute au plus**.

On peut toujours éditer `program.json` à la main (pour ajouter une mission, par
exemple). Les surcouches s'appliquent par-dessus, et une mission ajoutée dans le fichier
apparaît automatiquement.

## 4 bis. Livraison du kit (formulaire Tally)

Quand le kit est dû (paiement complet + 14 jours), la carte « Un colis est en route » propose
**Confirmer ma livraison**. Ce bouton ouvre le formulaire Tally **https://tally.so/r/4aQp4o**
(prénom, nom, email, téléphone, adresse, point relais préféré facultatif, case de confirmation),
avec `uid`, `email` et `prenom` passés en champs cachés.

- **Brancher la confirmation** : dans Tally → formulaire → *Integrations* → *Webhooks*, ajouter
  `https://<site>/.netlify/functions/tally-webhook` avec un *signing secret*, et mettre ce secret
  dans `TALLY_SIGNING_SECRET`. Tant que ce n'est pas fait, la carte reste « à confirmer » : elle
  n'affiche jamais « confirmée » sur un simple clic.
- **Données** : l'app n'enregistre que la date de confirmation (`masterParticipants/{uid}.shipping`).
  **L'adresse reste dans Tally** (une seule copie) : l'admin la lit dans les réponses du formulaire,
  et l'espace admin indique qui a confirmé ou non.
- Les informations de paiement ne sont pas redemandées : elles restent chez Systeme.io.

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
node tests/test-content.js     # 11 — surcouches de l'éditeur, liens vidéo, protections
node tests/test-functions.js   # 21 — fonctions serveur contre un Firebase simulé
node tests/test-ui.js          # 14 — parcours réel dans Chromium (375 et 320 px)
node tests/test-editor.js      # 12 — éditeur : brouillon, aperçu, publication, YouTube
```

## 6. En attente (rien n'est simulé comme « fonctionnel »)

| Élément | État | Ce qu'il faut |
| --- | --- | --- |
| **Webhook Systeme.io** | Point d'entrée prêt, sécurisé, idempotent. Le **format exact** des événements Systeme.io n'est pas confirmé : la lecture est tolérante et tout événement non reconnu est journalisé sans effet. | Créer le webhook dans Systeme.io vers `https://<site>/.netlify/functions/systemeio-webhook?key=<SYSTEMEIO_WEBHOOK_SECRET>`, faire une vente test, lire l'événement dans `masterPaymentEvents` et ajuster `normalizeEvent()` si besoin. Renseigner `MASTER_OFFER_PLANS`. En attendant : **accès manuel** depuis l'espace admin. |
| **Email de bienvenue** | Reste à Systeme.io. Le participant crée son compte (ou utilise celui du Hub) avec l'email d'achat. | Mettre le lien du site dans l'email Systeme.io. |
| **Habitudes dans Athletik Hub** | Le déblocage est enregistré côté Master (`masterParticipants/{uid}.state.habits`). Le suivi quotidien tourne **provisoirement dans Master** (écran « Mes habitudes du jour », signalé comme tel). | Côté Hub (non modifié) : lire les habitudes débloquées via une petite fonction serveur, les afficher dans « Mes habitudes du jour » et écrire les coches au même format `{ "AAAA-MM-JJ": "yes"|"no"|"skip" }`. |
| **Hub Standard / mois Premium** | Calculés et affichés côté Master ; le mois Premium est enregistré avec `status: 'pending_hub_integration'`. | Le Hub ne les lit pas encore (son accès repose sur l'essai 3 jours + livre/codes). Il faudra que `hasValidAccess()` du Hub reconnaisse un achat Master — changement du Hub à valider. |
| **Lien WhatsApp** | Bouton affiché « Lien WhatsApp à configurer ». | `whatsappNumber` dans `config.js`. |
| **Vidéos, textes, questions** | Tous les emplacements existent et sont clairement marqués. | Les remplir dans l'éditeur (Profil → Gérer le contenu), puis Publier. |

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
