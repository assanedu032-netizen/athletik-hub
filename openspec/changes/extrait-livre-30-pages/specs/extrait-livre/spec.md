# Spec Delta

## Purpose

L'écran de lecture des 30 premières pages du livre *Les Secrets de la Détente
Verticale*, la mémoire de l'endroit où l'athlète s'est arrêté, et l'appel à
l'achat une fois l'extrait parcouru.

## ADDED Requirements

### Requirement: L'extrait ne contient que 30 pages, et c'est le fichier qui le garantit

Le fichier servi par l'application SHALL contenir **exactement** les 30
premières pages du livre. La limite SHALL être portée par le **contenu du
fichier**, jamais par une règle d'affichage côté client.

Le livre complet SHALL NOT être déposé dans le dépôt, ni servi par
l'application, sous aucune forme.

#### Scenario: Le fichier est récupéré directement
- **WHEN** quelqu'un télécharge le fichier servi par l'application
- **THEN** il obtient 30 pages
- **AND** aucune page 31 ou au-delà n'est accessible

#### Scenario: Quelqu'un contourne l'interface
- **WHEN** quelqu'un modifie le code de la page dans son navigateur pour lever
  une limite d'affichage
- **THEN** il n'obtient aucune page supplémentaire, parce qu'il n'y en a pas

### Requirement: L'extrait est lisible sans compte et sans accès premium

L'écran SHALL être accessible à **tout** visiteur, y compris hors connexion au
compte et sans accès premium. `hasValidAccess()` SHALL NOT conditionner
l'ouverture de l'extrait.

C'est une vitrine : la verrouiller supprimerait sa raison d'être.

#### Scenario: Athlète sans accès
- **WHEN** `hasValidAccess()` est faux et l'athlète ouvre l'extrait
- **THEN** l'extrait s'affiche
- **AND** aucun popup premium ne s'ouvre

### Requirement: La lecture reprend où elle s'est arrêtée

L'application SHALL mémoriser la page atteinte et SHALL y revenir à la
réouverture de l'écran. Cette mémoire SHALL être locale à l'appareil.

#### Scenario: Reprise
- **WHEN** l'athlète a quitté l'extrait à la page 12
- **AND** il rouvre l'écran
- **THEN** la page 12 s'affiche

#### Scenario: Première ouverture
- **WHEN** aucune page n'est mémorisée
- **THEN** la page 1 s'affiche

### Requirement: La page atteinte est toujours annoncée

L'écran SHALL afficher en permanence la position de lecture sous la forme
« page courante / 30 », et SHALL permettre d'aller à la page suivante et
précédente.

La position affichée SHALL correspondre à la page réellement à l'écran.

#### Scenario: Avancer
- **WHEN** l'athlète est à la page 5 et demande la suivante
- **THEN** la page 6 s'affiche
- **AND** le compteur affiche 6 / 30

#### Scenario: Butée haute
- **WHEN** l'athlète est à la page 30 et demande la suivante
- **THEN** il reste à la page 30
- **AND** aucune page vide n'est affichée

#### Scenario: Butée basse
- **WHEN** l'athlète est à la page 1 et demande la précédente
- **THEN** il reste à la page 1

### Requirement: L'appel à l'achat arrive au bout de l'extrait

Quand l'athlète atteint la **dernière page**, l'écran SHALL présenter un appel
à l'achat menant à la fiche Amazon du livre.

Cet appel SHALL utiliser l'URL Amazon **déjà centralisée** dans l'application,
et SHALL NOT en introduire une seconde.

Il SHALL NOT être affiché avant la dernière page : l'extrait doit d'abord
tenir sa promesse.

#### Scenario: Fin de l'extrait
- **WHEN** la page 30 est affichée
- **THEN** l'appel à l'achat est visible
- **AND** il ouvre la fiche Amazon dans un nouvel onglet

#### Scenario: Milieu de l'extrait
- **WHEN** une page entre 1 et 29 est affichée
- **THEN** aucun appel à l'achat pleine largeur n'est affiché

### Requirement: L'athlète qui a déjà le livre ne se voit pas vendre le livre

Quand `ah_profile.hasBookAccess` vaut `true`, l'écran SHALL remplacer l'appel à
l'achat par un renvoi vers le contenu de l'application.

Proposer d'acheter un livre déjà acheté est une faute, pas une occasion
manquée.

#### Scenario: Le livre est déjà acquis
- **WHEN** `hasBookAccess` vaut `true` et la page 30 est affichée
- **THEN** aucun bouton d'achat n'est affiché

### Requirement: Le poids de l'extrait ne pèse pas sur le démarrage

Le fichier de l'extrait SHALL NOT être téléchargé tant que l'athlète n'ouvre
pas l'écran, et SHALL NOT faire partie des ressources mises en cache à
l'installation de l'application.

#### Scenario: Démarrage de l'application
- **WHEN** l'application démarre et que l'extrait n'a jamais été ouvert
- **THEN** le fichier de l'extrait n'est pas téléchargé

### Requirement: Un extrait qui ne charge pas le dit

Si le fichier ne peut pas être affiché — réseau coupé, fichier absent, moteur
de rendu indisponible — l'écran SHALL afficher un message explicite et SHALL
proposer de réessayer.

Il SHALL NOT rester sur un écran vide ni sur un chargement sans fin.

#### Scenario: Hors connexion, extrait jamais ouvert
- **WHEN** l'athlète ouvre l'extrait sans réseau et sans copie locale
- **THEN** un message dit que l'extrait n'a pas pu être chargé
- **AND** une action permet de réessayer

#### Scenario: Le moteur de rendu ne se charge pas
- **WHEN** la bibliothèque de rendu ne peut pas être récupérée
- **THEN** le même message d'échec est affiché, avec la même action
