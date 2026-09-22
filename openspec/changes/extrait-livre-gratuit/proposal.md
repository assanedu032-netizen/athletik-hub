# Proposal

## Why

Le livre *Les Secrets de la Détente Verticale* est le produit que l'application
sert. Aujourd'hui, un athlète qui ne l'a pas ne peut **rien en voir** : les
trois boutons « Acheter sur Amazon » existants demandent un acte de foi — payer
un livre qu'on n'a jamais ouvert.

Dans le même temps, Titan répond gratuitement à des questions dont les réponses
développées sont **dans le livre**, sans jamais le dire.

On ouvre donc une vitrine : les **44 premières pages**, lisibles dans l'app,
avec l'achat au bout. Et Titan gagne le droit d'y renvoyer — **avec
parcimonie**.

L'extrait s'arrête **juste avant le Cours 1** (p. 45). Il contient donc
« Comment utiliser ce livre ? » (p. 13), « L'Histoire de la Détente Verticale »
(p. 20), l'ouverture de la Partie 1 (p. 34) et, surtout, **les 8 Lois de la
Détente Verticale en entier** (p. 35-44) — ce que l'application elle-même
appelle « le socle de tout ce que tu vas faire ».

Ce découpage est ce qui rend le dispositif honnête : l'extrait livre une vraie
pièce de méthode, donc Titan peut y renvoyer sans rien promettre de faux.

## What Changes

- **Nouvel écran « Extrait du livre »** : les 44 premières pages, lues dans
  l'app, avec la pagination, le zoom et la reprise à la page où l'on s'était
  arrêté.
- **Un appel à l'achat en fin d'extrait**, à la 44ᵉ page, réutilisant
  `openAmazonBook()` et `AMAZON_BOOK_URL` — déjà centralisés, rien de nouveau à
  maintenir.
- **Points d'entrée** vers l'extrait : popup premium (`#premiumOverlay`),
  bannière d'essai et Paramètres, à côté des boutons d'achat qui y sont déjà.
- **Titan peut proposer l'extrait** en fin de réponse, sous forme de carte —
  jamais dans le texte de la bulle.
- **Deux messages distincts selon le sujet** : pour les fondamentaux (les
  8 Lois), l'extrait contient vraiment la réponse et la carte peut le dire ;
  pour un Cours ou un Chapitre, l'extrait ne fait que montrer la méthode et la
  carte situe la réponse dans le livre, à sa page.
- **Titan peut proposer l'achat** quand l'athlète a déjà lu l'extrait en entier.
- **Ces deux propositions sont plafonnées** : une par jour au maximum, jamais
  deux réponses de suite, et **jamais** pour un athlète qui possède déjà le
  livre.
- **NON-OBJECTIF** : servir le livre entier. Seul un fichier limité aux 44
  premières pages sera déposé ; le livre complet n'entre pas dans le dépôt.

## Capabilities

### New Capabilities
- `extrait-livre`: l'écran de lecture des 44 premières pages, sa progression,
  et l'appel à l'achat en fin d'extrait.
- `titan-promotion-livre`: quand et à quelle fréquence Titan a le droit de
  proposer l'extrait ou l'achat, et quand il ne l'a pas.

### Modified Capabilities
<!-- Aucune. `acces-premium` décrit qui peut ouvrir le contenu payant ; l'extrait
     est public et ne modifie aucune de ses exigences. Les boutons d'achat
     existants gagnent un voisin, ce qui est de l'implémentation, pas une
     exigence nouvelle. -->

## Impact

**Code applicatif** (`index.html`)
- Nouvel écran `.scr` `bookExcerpt`, navigué par `go('bookExcerpt')`.
- Le piège d'affichage inline du projet s'applique : remettre
  `el.style.display = ''` avant d'ajouter `.on`.
- Réutilise `AMAZON_BOOK_URL` / `openAmazonBook()` — aucune nouvelle constante
  d'URL.
- Le chat gagne un rendu de carte à côté de `_titanRenderNutriCard`, sur le même
  motif : la carte vit **hors** de la bulle, et rien de promotionnel n'entre
  dans le texte de Titan.

**Serveur** (`netlify/functions/titan.js`)
- Le client décide seul s'il affiche la carte. Le prompt n'a pas à savoir
  vendre : Titan répond, l'app propose. Cela évite qu'un modèle invente une
  promesse commerciale ou un prix.

**Nouveaux fichiers**
- `book/extrait-44p.pdf` — le seul fichier du livre présent dans le dépôt.
- `.gitignore` reçoit un garde-fou contre tout PDF du livre complet.

**Stockage** : `ah_book_excerpt` (page atteinte, extrait terminé) et
`ah_book_promo` (dernière proposition de Titan). Tous deux locaux à l'appareil.

**Poids / hors-ligne** : le PDF ne doit pas être mis en cache par le Service
Worker au premier chargement — l'app doit rester légère à l'installation.

**Dépendance externe** : un moteur de rendu PDF servi par CDN. Choix, version
et repli documentés dans `design.md`.
