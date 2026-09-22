# Design

## Context

Voir `proposal.md` — Why.

Trois contraintes du projet cadrent tout ce qui suit :

- **Aucune étape de construction.** Tout vit dans `index.html`. Un fichier
  ajouté est un fichier servi tel quel par Netlify.
- **Deux systèmes de navigation** cohabitent : les écrans `.scr` (`go(id)`) et
  les onglets `.view` (`switchTab`). Le piège d'affichage inline documenté dans
  `CLAUDE.md` s'applique : remettre `el.style.display = ''` avant d'ajouter
  `.on`.
- **`index.html` ne charge aujourd'hui AUCUN script externe.** Les seuls appels
  sortants sont des `iframe` YouTube. Un moteur de rendu PDF serait la première
  dépendance de script tierce du projet.

Deux éléments existent déjà et seront réutilisés tels quels :

- `AMAZON_BOOK_URL` + `openAmazonBook()` — l'URL Amazon est déjà centralisée et
  utilisée par trois écrans.
- `BOOK_CHAPTERS` — la table des chapitres du livre, avec leur titre et leur
  page. C'est la seule source de vérité de ce que le livre traite.

### Un fait qui change le texte des cartes

`BOOK_CHAPTERS` situe le **premier chapitre à la page 35**. Les 30 pages de
l'extrait sont donc la **Préface, l'Avant-Propos, « Comment je me suis formé »,
« Pourquoi la détente verticale ? » et « Ma façon de faire »** — ce que
confirme `data/book-challenges.js`, dont les 17 questions portent exactement
sur ces sections.

**L'extrait ne contient aucun chapitre technique.** Conséquence directe : une
carte qui dirait « la réponse à ta question est dans l'extrait » serait
**fausse**. Les libellés doivent promettre ce que l'extrait tient vraiment — la
méthode, le parcours, l'approche — et situer la réponse technique dans le
livre, à sa page.

## Goals / Non-Goals

**Goals :**
- Lire 30 pages confortablement sur un téléphone Android, hors de toute
  connexion au compte.
- N'ajouter aucune seconde source pour l'URL Amazon.
- Décider côté client, et seulement côté client, de l'affichage d'une carte
  promotionnelle.
- Ne rien alourdir au démarrage de l'application.

**Non-Goals :**
- Lire le livre entier dans l'app.
- Suivre les pages lues côté serveur, ou synchroniser la progression entre
  appareils.
- Mesurer un taux de conversion. Ça viendra si le dispositif vit ; ce n'est pas
  cette livraison.
- Toucher au prompt serveur de Titan.

## Decisions

### D1 — Le fichier est coupé à 30 pages, pas affiché à 30 pages

Le découpage est fait **une fois**, hors de l'application, et seul le résultat
entre dans le dépôt.

*Alternative écartée :* servir le PDF complet et borner l'affichage à 30 pages
côté client. Quiconque ouvre les outils de développement, ou récupère
simplement l'URL du fichier, obtient le livre entier. Une limite d'affichage
n'est pas une limite.

`.gitignore` recevra un garde-fou refusant tout PDF sous `book/` autre que
`extrait-30p.pdf`, pour qu'un original déposé par mégarde ne parte jamais.

### D2 — Rendu par pdf.js depuis cdnjs, chargé à la demande

`pdf.js` est chargé au **premier ouverture de l'écran**, jamais avant, depuis
`cdnjs.cloudflare.com` avec une **version épinglée**.

*Alternative écartée — `<iframe src="…pdf">` :* c'est la solution en une ligne,
et elle marche sur Android Chrome. Mais le visualiseur natif d'iOS est
irrégulier en PWA (page unique, ou téléchargement forcé), et le projet porte
déjà du code spécifique iOS (connexion Google, photos iPhone) : il y a des
utilisateurs iOS. On perdrait aussi toute maîtrise de la pagination, donc la
page 30 et son appel à l'achat.

*Alternative écartée — vendoriser pdf.js dans le dépôt :* supprime la
dépendance réseau, au prix d'un à deux mégaoctets de code tiers dans un projet
qui tient en un fichier. L'extrait est une vitrine : le prospect est en ligne.
Le mode hors connexion est couvert par l'exigence « un extrait qui ne charge
pas le dit », pas par la vendorisation.

*À reconsidérer si* les statistiques montrent des échecs de chargement
fréquents.

### D3 — L'écran est un `.scr`, pas un onglet

`bookExcerpt`, ouvert par `go('bookExcerpt')`. C'est un écran qu'on ouvre et
qu'on ferme, pas une destination permanente : il n'a rien à faire dans la barre
du bas, qui porte déjà cinq onglets.

### D4 — Le sujet du livre se détecte avec `BOOK_CHAPTERS`, pas avec une liste inventée

La détection réutilise les **titres de `BOOK_CHAPTERS`**, déjà maintenus et
déjà alignés sur le livre.

*Alternative écartée :* écrire une liste de mots-clés à la main. Elle
divergerait du livre au premier chapitre renommé, et personne ne s'en
apercevrait.

### D5 — La décision d'afficher une carte est prise par le client

Le serveur ne sait pas qu'il existe un extrait. Le client lit la réponse, la
question, l'état de lecture et les plafonds, puis décide.

*Alternative écartée :* demander au modèle de proposer le livre. Un modèle
peut inventer un prix, une promotion, une disponibilité. Et une réponse
commerciale mal placée abîme la confiance dans le coach — on a déjà vu, sur ce
projet, ce que coûte une instruction de prompt qui promet quelque chose que
l'app ne fait pas.

### D6 — Progression et plafonds restent locaux à l'appareil

`ah_book_excerpt` (page atteinte, extrait terminé) et `ah_book_promo` (date de
la dernière carte, date d'un rejet) ne rejoignent **pas** `FB_SYNC_KEYS`.

*Conséquence assumée :* lire l'extrait sur le téléphone puis poser une question
sur la tablette pourra re-proposer l'extrait. C'est un inconvénient mineur face
au coût de l'alternative — une clé synchronisée de plus, écrite à chaque
tournement de page.

### D7 — Le PDF n'entre pas dans le pré-cache du Service Worker

`ASSETS` n'est pas touché. Le fichier est mis en cache **au premier chargement
réussi**, pour qu'une réouverture fonctionne hors connexion.

*Raison :* `ASSETS` est téléchargé à l'installation. Y mettre le PDF ferait
payer son poids à **tous** les utilisateurs, y compris ceux qui possèdent déjà
le livre et n'ouvriront jamais l'extrait.

## Risks / Trade-offs

| Risque | Portée | Traitement |
|---|---|---|
| **Le PDF ne charge pas** (réseau, CDN, fichier absent) | L'extrait est inutilisable | État d'échec explicite + réessai, exigé par la spec et testé |
| **Première dépendance de script externe du projet** | Une panne de cdnjs casse l'extrait — et rien d'autre | Chargement à la demande : une panne n'affecte aucun autre écran |
| **Le poids du PDF** sur mobile en données mobiles | Un extrait de 30 pages illustrées peut dépasser 5 Mo | À mesurer dès réception du fichier. Au-delà d'un seuil, re-compresser |
| **La détection de sujet se trompe** | Une carte hors propos | Plafond d'une carte par 24 h : un faux positif coûte une carte, pas une avalanche |
| **L'extrait ne contient aucun chapitre** | Une promesse trop forte décevrait | Traité par le libellé (voir Context). À valider à la relecture |
| **`hasBookAccess` est un cache local** | Un athlète dont le cache est périmé peut voir une carte d'achat | Défaut hérité, hors périmètre. Documenté dans `acces-premium` |

### Ce qui reste à décider avec l'auteur

1. **Le PDF lui-même** n'est pas encore fourni. Tant qu'il n'est pas là, ni le
   poids ni le nombre réel de pages ne sont connus.
2. **Le découpage** : si le fichier reçu est le livre complet, il est coupé
   localement et **seul l'extrait** est commité.
3. **Les libellés des cartes** doivent être relus, à la lumière du fait que
   l'extrait ne contient aucun chapitre technique.
