# Athletik Hub — Manuel des accès et des codes

> Document de référence propriétaire. Décrit **le comportement réel du code**,
> pas l'intention. Dernière vérification : branche `claude/continue-project-W12qw`.
>
> ⚠️ Ce fichier contient des codes d'accès actifs. Il vit dans le dépôt privé.
> Ne le colle pas dans un outil public, un Google Doc partagé ou un ticket.

---

## 1. Vue d'ensemble — les 3 voies d'accès

L'app est gratuite à l'installation. Tout se joue sur une seule fonction :
`hasValidAccess()`. Elle renvoie `true` si **au moins une** des 3 conditions
est remplie :

| # | Voie | Comment on l'obtient | Durée |
|---|------|----------------------|-------|
| 1 | **Accès livre** (`hasBookAccess`) | Numéro de commande Amazon + question sur le livre | À vie |
| 2 | **Code d'accès** (`accessTier`) | Tu donnes un code BETA / VIP / MASTER | 14 jours ou à vie |
| 3 | **Essai gratuit** | Automatique à l'inscription | 3 jours (72 h) |

Si les trois sont épuisées → écran « Accès requis » (`#premiumOverlay`).

**Ordre de priorité en cas de cumul :** l'accès livre l'emporte sur tout. Un
utilisateur qui active le livre pendant son essai voit le compteur disparaître.

---

## 2. Se connecter (avant toute question d'accès)

Un compte Firebase est **obligatoire** — sans lui, aucun accès n'est possible
et rien ne se synchronise entre appareils.

**Trois méthodes :**
- Email + mot de passe (6 caractères minimum, email de vérification envoyé)
- Google (bouton « Continuer avec Google »)
- Mot de passe oublié → lien de réinitialisation par email

**Ce qu'il faut savoir :**
- La session est persistante (`browserLocalPersistence`) : l'utilisateur reste
  connecté d'une ouverture à l'autre.
- À chaque connexion, `init-user.js` crée ou synchronise le document
  `users/{uid}` avec les vraies dates serveur.
- Sur iPhone en PWA installée, la connexion Google recharge parfois la page
  entièrement — c'est une limite de WebKit, pas un bug. Le flag
  `ah_auth_intent_pending` gère ce cas.

---

## 3. L'essai gratuit — 3 jours

- **Durée :** 72 heures (`TRIAL_MS = 3 * 86400000`)
- **Départ :** au premier `init-user` (à la première connexion)
- **Source de vérité :** `users/{uid}.trialEndsAt` — un `serverTimestamp`
  Firestore. **L'utilisateur ne peut pas le trafiquer** : `firestore.rules`
  interdit toute écriture client sur ce champ.
- Repli hors-ligne : `trialStartedAt + 72 h` mis en cache dans `ah_profile`.

**La bannière sur l'accueil** (`#trialBanner`) :

| État | Apparence |
|------|-----------|
| Accès livre validé | cachée |
| Plus de 24 h restantes | discrète, ambre / or |
| Moins de 24 h | urgente, orange |
| Expiré | bloquante, rouge |

---

## 4. Activation post-livre — la voie principale

C'est le parcours prévu pour l'acheteur du livre. Assistant en 2 étapes
(`#bookActivationModal`).

**Comment ça marche :**
1. L'utilisateur ouvre « J'ai le livre »
2. Le serveur tire **une question au hasard** parmi 17, portant sur les pages
   d'introduction du livre
3. L'utilisateur répond **et** donne son numéro de commande Amazon
4. Le serveur vérifie les deux, puis écrit `hasBookAccess = true`

**Les 17 questions** couvrent : Préface · Avant-Propos · Pourquoi tu devrais me
croire · Comment je me suis formé · Pourquoi la détente verticale ? · Ma façon
de faire. Banque : `data/book-challenges.js` (version `LDV_V1_STABLE_INTRO`).

**Les protections en place :**
- La bonne réponse **ne quitte jamais le serveur** — impossible de la lire dans
  le navigateur
- Chaque numéro de commande Amazon n'est utilisable **qu'une seule fois**
  (empreinte hachée stockée dans Netlify Blobs)
- La session de question expire au bout de **10 minutes**
- **5 tentatives maximum par IP toutes les 15 minutes**
- Connexion obligatoire (jeton Firebase)

**Régénérer la banque de questions :**
```bash
node scripts/gen-book-challenges.js
# --hash pour passer les réponses en HMAC avant mise en production
```
Le fichier source `bookChallengesSeed.json` est volontairement hors dépôt.

---

## 5. Les codes d'accès — BETA / VIP / MASTER

### Ce que chaque niveau donne réellement

| | BETA | VIP | MASTER |
|---|---|---|---|
| Séances, tests, nutrition, Titan | ✅ | ✅ | ✅ |
| Durée | **14 jours** | À vie | À vie |
| Workout Builder débloqué d'office | ❌ | ✅ | ✅ |
| Quota Titan | 20 msg/jour | 20 msg/jour | 20 msg/jour |

> **⚠️ Écart à connaître.** Le message affiché pour MASTER dit « Titan illimité
> + tout débloqué ». **Le code ne fait pas ça** : `RATE_LIMIT = 20` dans
> `titan.js` s'applique à tout le monde, MASTER compris. Aujourd'hui VIP et
> MASTER sont **fonctionnellement identiques**. Soit on corrige le message,
> soit on implémente le quota illimité — dis-moi lequel tu veux.

### Format d'un code

```
LETTRE - RANDOM6 - CHECK4
   B        7KQM2P     A31F
```
- `B` = BETA · `V` = VIP · `M` = MASTER
- `RANDOM6` : 6 caractères, alphabet sans `0 O 1 I L` (évite les confusions)
- `CHECK4` : signature HMAC-SHA256 tronquée, calculée avec `ACCESS_CODE_SECRET`

**Conséquence importante :** les codes ne sont stockés nulle part. Ils sont
*vérifiables mathématiquement*. On peut en générer 10 000 sans base de données —
mais on ne peut pas non plus en révoquer un individuellement (voir §9).

### Générer des codes

```bash
ACCESS_CODE_SECRET="<le secret Netlify>" node scripts/gen-codes.js beta 100
ACCESS_CODE_SECRET="<le secret Netlify>" node scripts/gen-codes.js vip 50
ACCESS_CODE_SECRET="<le secret Netlify>" node scripts/gen-codes.js master 10
```

Le secret doit être **exactement** celui défini sur Netlify. S'il diffère, les
codes générés seront rejetés à la validation.

### Les 3 codes historiques

Toujours acceptés, en dur dans `check-code.js` :

| Code | Niveau |
|------|--------|
| `AL-88ND89` | BETA |
| `KEVIN-JEAN2478` | VIP |
| `ONANDULU78` | MASTER |

> Ces trois codes sont **permanents et non révocables** sans modifier le code
> source et redéployer. `ONANDULU78` donne un accès MASTER à vie à quiconque le
> connaît. Si tu l'as diffusé largement, il faut le retirer de `LEGACY_CODES`.

### Protection anti-force-brute
5 tentatives par IP / 15 minutes, puis **blocage 1 heure**. Le compteur se
remet à zéro dès qu'un code correct est saisi.

---

## 6. Ton accès à toi — compte fondateur

**`assanedu032@gmail.com`** bénéficie d'un traitement à part, codé en dur à
**deux endroits** :

- `index.html` → `BUILDER_FOUNDER_EMAILS` (côté navigateur)
- `netlify/functions/titan.js` → `FOUNDER_EMAILS` (côté serveur)

**Ce que ça te donne :** accès complet à tout, **sans essai actif, sans code,
sans accès livre**. Y compris le Workout Builder et Titan.

**Ce que ça ne change pas :** le quota Titan de 20 messages/jour s'applique
aussi à toi.

> Les deux listes doivent rester identiques. Si tu ajoutes un email à l'une
> sans l'autre, l'app te laissera entrer mais Titan te refusera — ou l'inverse.

---

## 7. Ce qui est verrouillé exactement

Trois portes appellent `_showAccessRequired()` :

| Fonctionnalité | Où |
|---|---|
| Lancer la séance du jour | `launchTodaySession()` |
| Lancer une séance depuis un programme | `startSessionGuarded()` |
| Onglet Titan (chat IA) | `switchTab('chat')` |

**Reste accessible même sans accès :** consulter les programmes, la librairie
d'exercices, la nutrition, les tests, ton profil et ta progression.

### Le Workout Builder — verrou séparé

Il ne dépend **pas** de `hasValidAccess()`. Il s'ouvre si **l'une** de ces
conditions est vraie :
- 2 programmes terminés (`programsDone >= 2`)
- niveau VIP ou MASTER
- compte fondateur

---

## 8. Où vit la vérité

Tout ce qui touche à l'accès est écrit **par le serveur uniquement**, via
l'Admin SDK qui contourne les règles Firestore. Le navigateur ne fait que lire
et mettre en cache.

**Champs verrouillés dans `firestore.rules`** — toute écriture depuis le
navigateur est rejetée :

```
hasBookAccess · accessMethod · bookAccessVerifiedAt
trialStartedAt · trialEndsAt · trialStatus
createdAt · bookVersionUsed
accessTier · accessGrantedAt · accessExpiresAt
```

**Pourquoi c'est important :** avant ce durcissement, on pouvait ouvrir la
console du navigateur, écrire `accessTier: 'MASTER'` et le faire persister sur
tous ses appareils. Ce n'est plus possible.

Le cache local (`ah_profile`) sert uniquement à ce que l'app fonctionne
hors-ligne. Le modifier ne donne aucun accès réel : le serveur revérifie.

---

## 9. Procédures courantes

**Donner un accès à quelqu'un**
→ Générer un code du niveau voulu (§5) et le lui envoyer. Il le saisit dans
Réglages → « J'ai un code ».

**Débloquer un acheteur du livre bloqué**
→ Le plus simple : lui envoyer un code VIP. L'activation Amazon peut échouer si
son numéro de commande a déjà servi ou s'il se trompe de question.

**Retirer un accès à quelqu'un**
→ Dans la console Firebase : `users/{uid}` → mettre `accessTier` à `null` et
`hasBookAccess` à `false`. C'est le seul moyen, car les codes ne sont pas
stockés individuellement.

**Invalider TOUS les codes d'un coup**
→ Changer `ACCESS_CODE_SECRET` sur Netlify. Tous les codes HMAC déjà distribués
deviennent invalides d'un coup. Les 3 codes historiques survivent (ils ne
dépendent pas du secret) et les accès déjà accordés restent en place.

**Retirer un code historique**
→ Supprimer la ligne dans `LEGACY_CODES` (`check-code.js`), commiter, déployer.

---

## 10. Variables d'environnement Netlify

Aucune ne doit apparaître dans le code. Site config → Environment variables.

| Variable | Sert à | Si elle manque |
|---|---|---|
| `ACCESS_CODE_SECRET` | Signer et vérifier les codes | Codes HMAC rejetés (503) |
| `FIREBASE_SERVICE_ACCOUNT` | Écrire les accès, envoyer les push | Aucune activation possible |
| `ANTHROPIC_API_KEY` | Titan | Titan hors service |
| `FIREBASE_VAPID_KEY` | Notifications push | Timer muet en arrière-plan |
| `SECRETS_SCAN_SMART_DETECTION_ENABLED=false` | Débloquer le build | Build en échec |

> La dernière est nécessaire parce que le scanner Netlify prend la clé Firebase
> Web (`AIzaSy…`) pour un secret. Elle est **publique par conception** — la
> sécurité repose sur les règles Firestore, l'authentification et les domaines
> autorisés.

---

## 11. Dépannage

| Symptôme | Cause probable |
|---|---|
| « Code invalide » sur un code fraîchement généré | `ACCESS_CODE_SECRET` différent entre ta machine et Netlify |
| « Trop de tentatives » | 5 essais ratés — attendre 1 h ou changer de réseau |
| Activation livre refusée sur un vrai achat | Numéro de commande déjà utilisé, ou plus de 10 min sur la question |
| Accès perdu au changement de téléphone | Normal si non connecté — l'accès suit le compte, pas l'appareil |
| Accès accordé mais toujours bloqué | Le cache local est en retard : se déconnecter / reconnecter force `init-user` |
| Titan refuse alors que l'app laisse entrer | Les deux listes d'emails fondateur ont divergé (§6) |

---

## 12. Points ouverts

1. **MASTER n'apporte rien de plus que VIP.** Le message promet un Titan
   illimité qui n'existe pas dans le code.
2. **`ONANDULU78` donne MASTER à vie**, sans limite de diffusion et sans moyen
   de révocation autre qu'un redéploiement.
3. **Aucune traçabilité par code.** On sait *qu'un* code a été utilisé
   (collection `accessRedemptions`) mais pas *lequel* — impossible de savoir si
   un code a fuité et circule.
