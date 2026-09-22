# Accès premium Specification

## Purpose

Décrit qui peut ouvrir le contenu payant d'Athletik Hub, par quelles voies, et
ce que l'app fait quand l'accès manque.

Cette spec est **reconstituée depuis le code existant** (`hasValidAccess`,
`getTrialInfo`, `hasAccessTier`, `_bootstrapAccessFromServer`,
`_showAccessRequired`, `firestore.rules`). Elle décrit ce que l'application
**fait aujourd'hui**, pas ce qu'on aimerait qu'elle fasse. Les écarts connus
entre l'intention et le comportement réel sont écrits comme tels, dans la
section « Limites connues » — jamais camouflés en exigences satisfaites.

## Requirements

### Requirement: Trois voies d'accès, et trois seulement

Le système SHALL accorder l'accès au contenu premium si et seulement si l'une
de ces trois conditions est vraie :

1. `ah_profile.hasBookAccess === true` (activation post-livre validée serveur) ;
2. un palier d'accès **BETA, VIP ou MASTER** est actif et non expiré ;
3. l'essai de **3 jours** est encore en cours.

Aucune autre condition SHALL ouvrir l'accès.

#### Scenario: Accès par le livre
- **WHEN** `ah_profile.hasBookAccess` vaut `true`
- **THEN** `hasValidAccess()` retourne `true`
- **AND** aucun compteur d'essai n'est affiché

#### Scenario: Accès par code spécial
- **WHEN** `ah_access_tier` vaut `BETA`, `VIP` ou `MASTER`
- **AND** `ah_access_data.expiresAt` est absent ou dans le futur
- **THEN** `hasValidAccess()` retourne `true`

#### Scenario: Code expiré
- **WHEN** `ah_access_data.expiresAt` est dans le passé
- **THEN** le palier ne compte plus
- **AND** l'accès retombe sur l'essai, puis sur le refus

#### Scenario: Aucune des trois voies
- **WHEN** aucune des trois conditions n'est remplie
- **THEN** `hasValidAccess()` retourne `false`

### Requirement: L'essai dure 72 heures

L'essai SHALL durer `TRIAL_MS` = 3 × 86 400 000 ms. Sa fin SHALL être lue dans
`ah_profile.trialEndsAt` **en priorité** — c'est la valeur posée par le serveur
— et seulement à défaut calculée comme `trialStartedAt + TRIAL_MS`.

#### Scenario: Le serveur fait foi sur la date de fin
- **WHEN** `ah_profile.trialEndsAt` existe
- **THEN** cette valeur est la fin de l'essai
- **AND** `trialStartedAt + TRIAL_MS` n'est pas utilisé

#### Scenario: Repli hors ligne
- **WHEN** `trialEndsAt` est absent mais `trialStartedAt` existe
- **THEN** la fin de l'essai vaut `trialStartedAt + TRIAL_MS`

#### Scenario: Le livre convertit l'essai
- **WHEN** `hasBookAccess` vaut `true`
- **THEN** `getTrialInfo()` retourne `{ active: true, remaining: Infinity, converted: true }`
- **AND** l'écran n'affiche plus de décompte

### Requirement: Le serveur est la source de vérité de l'accès livre

À chaque connexion, le système SHALL appeler
`POST /.netlify/functions/init-user` avec le jeton Firebase de l'athlète, et
SHALL écraser `ah_profile.hasBookAccess` par la valeur renvoyée par le serveur.

L'écriture SHALL être `hasBookAccess = (réponse.hasBookAccess === true)` — une
affectation, **pas** un OU logique avec la valeur locale : le serveur doit
pouvoir **retirer** un accès, pas seulement en donner un.

Un seul bootstrap SHALL être en vol à la fois (`_bootstrapInflight`).

#### Scenario: Le serveur accorde l'accès
- **WHEN** `init-user` renvoie `access.hasBookAccess = true`
- **THEN** le cache local passe à `true`
- **AND** la bannière d'essai et l'écran d'accueil sont rafraîchis

#### Scenario: Le serveur retire l'accès
- **WHEN** le cache local porte `hasBookAccess = true`
- **AND** `init-user` renvoie `access.hasBookAccess = false`
- **THEN** le cache local repasse à `false`

#### Scenario: Le serveur est injoignable
- **WHEN** l'appel à `init-user` échoue
- **THEN** le cache local est laissé intact
- **AND** l'athlète garde l'accès que son cache décrit
- **AND** aucune erreur n'est montrée à l'écran

#### Scenario: Connexions en rafale
- **WHEN** un bootstrap est déjà en cours
- **THEN** le second appel retourne immédiatement sans requête réseau

### Requirement: Le client ne peut pas s'accorder l'accès lui-même

Les Règles Firestore SHALL refuser toute écriture cliente sur `hasBookAccess`,
`accessMethod`, `bookAccessVerifiedAt`, `trialStartedAt`, `trialEndsAt`,
`trialStatus`, `createdAt` et `bookVersionUsed`, à la création comme à la mise
à jour.

Ces champs SHALL n'être écrits que par le serveur, via l'Admin SDK.

#### Scenario: Le client tente d'écrire un champ verrouillé
- **WHEN** le client écrit `users/{uid}` avec `hasBookAccess` dans la charge
- **THEN** Firestore refuse l'écriture entière

#### Scenario: Le client met à jour son profil normalement
- **WHEN** le client écrit `users/{uid}` sans toucher aux champs verrouillés
- **THEN** l'écriture est acceptée

### Requirement: Trois portes, une seule réponse

Le système SHALL vérifier l'accès sur exactement trois entrées :
`launchTodaySession()`, `startSessionGuarded()` et `switchTab('chat')`.

Quand l'accès manque, chacune SHALL appeler `_showAccessRequired()` et
**interrompre** son action — jamais la laisser se poursuivre en arrière-plan.

#### Scenario: Lancer la séance du jour sans accès
- **WHEN** l'athlète tape « Lancer la séance » et `hasValidAccess()` est faux
- **THEN** le popup premium s'ouvre
- **AND** aucune séance ne démarre

#### Scenario: Ouvrir le chat Titan sans accès
- **WHEN** l'athlète tape l'onglet Titan et `hasValidAccess()` est faux
- **THEN** le popup premium s'ouvre
- **AND** l'onglet ne change pas

### Requirement: Le refus est une carte, pas un toast

`_showAccessRequired()` SHALL ouvrir `#premiumOverlay` — une carte portant les
bénéfices et trois actions hiérarchisées : activer son accès, acheter le livre,
saisir un code.

Si `#premiumOverlay` est absent du DOM (cache périmé), le système SHALL
retomber sur un message puis l'ouverture de la saisie de code, plutôt que de ne
rien faire.

#### Scenario: Popup présent
- **WHEN** `#premiumOverlay` existe
- **THEN** il s'affiche avec son animation
- **AND** aucun toast n'est montré

#### Scenario: Popup absent du DOM
- **WHEN** `#premiumOverlay` est introuvable
- **THEN** un message est affiché
- **AND** la saisie de code s'ouvre ensuite

### Requirement: La bannière d'essai dit le temps qui reste, sans mentir

La bannière `#trialBanner` SHALL être **masquée** quand `hasBookAccess` est
vrai. Sinon elle SHALL changer de ton selon le restant réel : discrète au-delà
de 24 h, urgente en dessous, bloquante une fois l'essai expiré.

#### Scenario: Accès livre acquis
- **WHEN** `hasBookAccess` vaut `true`
- **THEN** aucune bannière d'essai n'est affichée

#### Scenario: Moins de 24 h restantes
- **WHEN** le restant est strictement inférieur à 24 h et positif
- **THEN** la bannière passe en ton urgent

## Limites connues

Écrites ici parce qu'elles sont **vraies**, pas parce qu'elles sont
souhaitables. Une spec qui les tait donne une fausse assurance.

1. **Le début d'essai peut naître côté client.** Quand `trialStartedAt` est
   absent, `getTrialInfo()` le pose à `Date.now()` et l'écrit en localStorage
   avant tout passage serveur. Un athlète qui efface son stockage local
   redémarre donc un essai, tant qu'il n'est pas connecté. Le verrou serveur
   (`init-user` + Règles Firestore) ne referme ce trou qu'**à la connexion**.

2. **`hasValidAccess()` lit le cache local.** C'est ce qui permet à l'app de
   fonctionner hors ligne, et c'est aussi ce qui rend le cache falsifiable
   entre deux connexions. La source de vérité reste
   `users/{uid}.hasBookAccess`.

3. **Un palier sans `expiresAt` ne périme jamais.** `hasAccessTier()` ne
   refuse que sur une date passée ; un code écrit sans date d'expiration donne
   un accès permanent.
