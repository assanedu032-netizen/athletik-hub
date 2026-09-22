# Tasks

## 0. Bloqué — en attente de l'auteur

- [ ] 0.1 Recevoir le PDF du livre. **Rien en aval ne peut démarrer sans lui.**
- [ ] 0.2 Si le fichier reçu est le livre complet : installer `pypdf` en local
      (aucun outil PDF n'est présent sur la machine, vérifié), extraire les 30
      premières pages, et **ne commiter que l'extrait**.
- [ ] 0.3 Mesurer le poids de l'extrait. Au-delà de 5 Mo, re-compresser avant
      d'aller plus loin — un extrait de 12 Mo ne se lit pas en données mobiles.
- [ ] 0.4 Faire relire les libellés des cartes Titan à l'auteur : l'extrait ne
      contient aucun chapitre technique (premier chapitre = p. 35), donc aucune
      carte ne doit promettre que la réponse s'y trouve.

## 1. Le fichier et ses garde-fous

- [ ] 1.1 Déposer `book/extrait-30p.pdf`.
- [ ] 1.2 Ajouter à `.gitignore` une règle qui ignore `book/*.pdf` puis
      ré-autorise explicitement `!book/extrait-30p.pdf` — pour qu'un livre
      complet déposé par mégarde ne parte jamais.
- [ ] 1.3 Vérifier que le fichier commité contient **exactement 30 pages**, en
      le relisant après commit (pas avant).
- [ ] 1.4 Vérifier que `sw.js` `ASSETS` n'a **pas** été modifié.

## 2. L'écran de lecture

- [ ] 2.1 Ajouter l'écran `.scr` `bookExcerpt` : en-tête avec titre et
      fermeture, zone de rendu, barre de pagination.
- [ ] 2.2 Ouvrir par `go('bookExcerpt')`. **Remettre `el.style.display = ''`
      avant d'ajouter `.on`** — le piège d'affichage inline du projet.
- [ ] 2.3 Charger pdf.js depuis cdnjs, **version épinglée**, à la première
      ouverture seulement, jamais au démarrage.
- [ ] 2.4 Rendre la page courante, avec la pagination précédent / suivant et le
      compteur « n / 30 ».
- [ ] 2.5 Buter proprement aux deux extrémités : pas de page 0, pas de page 31,
      jamais de page vide.
- [ ] 2.6 Mémoriser la page atteinte dans `ah_book_excerpt` et y revenir à la
      réouverture.
- [ ] 2.7 Marquer l'extrait comme terminé quand la dernière page est atteinte.
- [ ] 2.8 État d'échec explicite — message + réessai — pour les trois causes :
      réseau coupé, fichier absent, pdf.js indisponible. **Jamais d'écran vide
      ni de chargement sans fin.**
- [ ] 2.9 Mettre le PDF en cache au premier chargement réussi, pour qu'une
      réouverture marche hors connexion.

## 3. L'appel à l'achat

- [ ] 3.1 Afficher l'appel à l'achat **uniquement** sur la dernière page.
- [ ] 3.2 Utiliser `openAmazonBook()`. **Ne pas réintroduire d'URL Amazon.**
- [ ] 3.3 Quand `hasBookAccess` est vrai, remplacer l'achat par un renvoi vers
      le contenu de l'app.

## 4. Les portes d'entrée

- [ ] 4.1 Ajouter « Lire un extrait » dans `#premiumOverlay`, à côté de
      « Acheter le livre ».
- [ ] 4.2 Ajouter le même accès depuis la bannière d'essai et les Paramètres.
- [ ] 4.3 Vérifier qu'aucun de ces accès n'est verrouillé par
      `hasValidAccess()` — l'extrait est public, c'est une vitrine.

## 5. Les cartes de Titan

- [ ] 5.1 Détecter le sujet à partir des titres de `BOOK_CHAPTERS`. **Ne pas
      écrire de liste de mots-clés à la main.**
- [ ] 5.2 Rendre la carte **hors** de la bulle, sur le motif de
      `_titanRenderNutriCard`.
- [ ] 5.3 Choisir la carte : extrait si l'extrait n'est pas terminé, achat s'il
      l'est.
- [ ] 5.4 Appliquer les plafonds : une carte par 24 h, jamais deux réponses de
      suite, jamais si `hasBookAccess` est vrai. État dans `ah_book_promo`.
- [ ] 5.5 Permettre d'écarter une carte, et ne plus rien proposer pendant 24 h.
- [ ] 5.6 Vérifier qu'**aucun texte promotionnel n'entre dans la bulle** et que
      le prompt serveur n'est pas touché.

## 6. Tests

- [ ] 6.1 Écrire `scripts/test-book-excerpt.js` — vrai Chromium, 375×667 et
      320×568, sur le motif des suites existantes.
- [ ] 6.2 Couvrir l'écran : reprise à la bonne page, compteur juste, les deux
      butées, l'achat seulement en page 30, rien pour qui a le livre.
- [ ] 6.3 Couvrir les trois causes d'échec, en simulant chacune.
- [ ] 6.4 Couvrir les cartes : les plafonds, le rejet, le sujet hors livre,
      `hasBookAccess`, et l'absence de promotion dans la bulle.
- [ ] 6.5 Vérifier le contraste AA sur le fond réel de chaque élément.
- [ ] 6.6 Vérifier que le PDF n'est **pas** demandé au démarrage.
- [ ] 6.7 **Contre-épreuve** : la suite doit échouer sur le commit précédent.
      Sinon elle ne prouve rien.
- [ ] 6.8 Rejouer les 26 suites existantes.

## 7. Livraison

- [ ] 7.1 Contrôler la syntaxe des blocs `<script>` non-module.
- [ ] 7.2 Monter le cache du Service Worker.
- [ ] 7.3 Documenter la fonctionnalité dans `CLAUDE.md`.
- [ ] 7.4 Ouvrir la PR, rejouer la suite complète **après** le rebase.
- [ ] 7.5 `/opsx:archive` une fois mergé.
