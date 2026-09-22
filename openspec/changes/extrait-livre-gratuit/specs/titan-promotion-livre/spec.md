# Spec Delta

## Purpose

Quand Titan a le droit de proposer l'extrait du livre ou son achat, à quelle
fréquence, et — surtout — quand il ne l'a pas. Un coach qui vend à chaque
message cesse d'être un coach.

## ADDED Requirements

### Requirement: La promotion vit hors de la bulle de Titan

Une proposition SHALL être rendue comme une **carte distincte**, sous la
réponse de Titan. Le texte de la réponse SHALL NOT contenir de message
promotionnel, de lien d'achat ni de prix.

Le client SHALL décider seul de l'affichage de la carte. Le modèle SHALL NOT
être chargé de la produire : il pourrait inventer un prix, une promesse ou une
disponibilité.

#### Scenario: Une carte est proposée
- **WHEN** les conditions d'affichage sont réunies
- **THEN** la réponse de Titan reste inchangée
- **AND** une carte distincte apparaît sous elle

#### Scenario: Le modèle glisse une promotion dans son texte
- **WHEN** la réponse de Titan contient malgré tout un lien d'achat
- **THEN** ce lien n'est pas rendu cliquable dans la bulle

### Requirement: Jamais à quelqu'un qui possède le livre

Quand `ah_profile.hasBookAccess` vaut `true`, aucune carte de promotion du
livre SHALL être affichée — ni pour l'extrait, ni pour l'achat.

#### Scenario: Athlète ayant activé son accès livre
- **WHEN** `hasBookAccess` vaut `true`
- **THEN** aucune carte n'est affichée, quelle que soit la question posée

### Requirement: Une proposition par jour au maximum, jamais deux de suite

Au plus **une** carte de promotion SHALL être affichée par période de 24 h.

Deux réponses consécutives de Titan SHALL NOT porter chacune une carte, même
si la fenêtre de 24 h le permettrait.

La date de la dernière proposition SHALL être mémorisée localement.

#### Scenario: Deuxième question dans la même journée
- **WHEN** une carte a déjà été affichée il y a 3 heures
- **THEN** aucune carte n'est affichée

#### Scenario: Le lendemain
- **WHEN** la dernière carte remonte à plus de 24 h
- **AND** les autres conditions sont réunies
- **THEN** une carte peut être affichée

#### Scenario: Deux réponses d'affilée
- **WHEN** la réponse précédente portait une carte
- **THEN** la réponse suivante n'en porte pas

### Requirement: Proposer l'extrait seulement quand le sujet est dans le livre

La carte « lire l'extrait » SHALL être proposée uniquement quand l'échange
porte sur un sujet **traité par le livre**.

Une question hors sujet — matériel, problème technique de l'application,
organisation personnelle — SHALL NOT déclencher de carte.

#### Scenario: Question sur un sujet du livre
- **WHEN** l'athlète interroge Titan sur un sujet traité par le livre
- **AND** les plafonds de fréquence le permettent
- **THEN** une carte propose de lire l'extrait

#### Scenario: Question hors sujet
- **WHEN** l'athlète signale un bug de l'application
- **THEN** aucune carte n'est affichée

### Requirement: La carte ne promet que ce que l'extrait contient vraiment

L'extrait s'arrête avant le Cours 1. Il contient les 8 Lois de la Détente
Verticale **en entier**, et **aucun Cours ni Chapitre**.

La carte SHALL donc porter **deux messages distincts** :

1. **Sujet couvert par l'extrait** (les 8 Lois, les fondamentaux) — la carte
   MAY annoncer que la réponse s'y trouve.
2. **Sujet couvert par le livre mais hors extrait** (tout Cours, tout
   Chapitre, tout Programme) — la carte SHALL NOT annoncer que la réponse est
   dans l'extrait. Elle SHALL situer la réponse **dans le livre**, à sa page,
   et présenter l'extrait pour ce qu'il est : un aperçu de la méthode.

Aucune carte SHALL affirmer que l'extrait contient un contenu qu'il ne
contient pas.

#### Scenario: Question sur les fondamentaux
- **WHEN** la question porte sur un sujet des 8 Lois
- **THEN** la carte peut annoncer que la réponse est dans l'extrait

#### Scenario: Question sur un Cours
- **WHEN** la question porte sur un Cours du livre — Pliométrie, Force,
  Nutrition ou autre
- **THEN** la carte situe la réponse dans le livre, avec sa page
- **AND** elle ne dit pas que la réponse est dans l'extrait

#### Scenario: Question sur un Programme
- **WHEN** la question porte sur un Programme, qui commence page 295
- **THEN** la carte ne prétend pas que l'extrait en parle

### Requirement: Proposer l'achat seulement après l'extrait

La carte « acheter le livre » SHALL être proposée uniquement à un athlète qui
a **atteint la fin de l'extrait**.

Tant que l'extrait n'a pas été parcouru, la seule proposition possible SHALL
être l'extrait lui-même — on ne demande pas d'acheter un livre qu'on n'a pas
laissé feuilleter.

#### Scenario: Extrait terminé
- **WHEN** l'athlète a atteint la page 44
- **AND** les plafonds de fréquence le permettent
- **THEN** la carte proposée est celle de l'achat

#### Scenario: Extrait jamais ouvert
- **WHEN** l'athlète n'a jamais ouvert l'extrait
- **THEN** aucune carte d'achat n'est proposée

#### Scenario: Extrait commencé mais non terminé
- **WHEN** l'athlète s'est arrêté à la page 20
- **THEN** la carte proposée reste celle de l'extrait

### Requirement: Une carte se referme et ne revient pas le jour même

L'athlète SHALL pouvoir écarter une carte. Une carte écartée SHALL NOT
réapparaître dans les 24 h qui suivent.

#### Scenario: L'athlète écarte la carte
- **WHEN** l'athlète ferme la carte
- **THEN** elle disparaît
- **AND** aucune autre carte n'apparaît avant 24 h
