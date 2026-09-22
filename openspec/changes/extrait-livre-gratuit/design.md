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

### Ce que l'extrait contient exactement

Le découpage a été arrêté avec l'auteur : **pages 1 à 44**, l'extrait s'arrête
juste avant le Cours 1 (p. 45).

| Pages | Contenu | Dans l'extrait |
|---|---|---|
| 1-12 | Couverture, sommaire | ✅ |
| 13 | Comment utiliser ce livre ? | ✅ |
| 20 | L'Histoire de la Détente Verticale | ✅ |
| 34 | Ouverture Partie 1 — La Science du Saut | ✅ |
| **35-44** | **Les 8 Lois de la Détente Verticale** | ✅ **en entier** |
| 45+ | Cours 1 à 12, Chapitres, Programmes | ❌ |

Deux conséquences directes sur la conception :

**L'extrait porte enfin du contenu technique.** Les 8 Lois sont, selon les
mots de l'application elle-même, « le socle de tout ce que tu vas faire ». Une
carte qui dit « ce sujet est développé dans l'extrait » devient **vraie** — à
condition que le sujet en soit un.

**Mais il s'arrête avant tout le reste.** `BOOK_CHAPTERS` situe le Cours 1 en
p. 45 et le premier Programme en p. 295. Une question sur la pliométrie, la
nutrition ou un programme ne trouve **rien** dans l'extrait. La carte doit
alors situer la réponse dans le livre, à sa page, et présenter l'extrait pour
ce qu'il est : un aperçu de la méthode.

C'est le sens de l'exigence « La carte ne promet que ce que l'extrait contient
vraiment ». Une seule formulation pour les deux cas serait fausse dans l'un des
deux.

**`BOOK_CHAPTERS` suffit à trancher** : tout ce qui y figure avec une page
≥ 45 est hors extrait ; `intro_8_lois` (p. 35) est dedans. Aucune liste à
maintenir en parallèle.

## Goals / Non-Goals

**Goals :**
- Lire 44 pages confortablement sur un téléphone Android, hors de toute
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

### D1 — Le fichier est coupé à 44 pages, pas affiché à 44 pages

Le découpage est fait **une fois**, hors de l'application, et seul le résultat
entre dans le dépôt.

*Alternative écartée :* servir le PDF complet et borner l'affichage à 44 pages
côté client. Quiconque ouvre les outils de développement, ou récupère
simplement l'URL du fichier, obtient le livre entier. Une limite d'affichage
n'est pas une limite.

`.gitignore` recevra un garde-fou refusant tout PDF sous `book/` autre que
`extrait-44p.pdf`, pour qu'un original déposé par mégarde ne parte jamais.

### D2 — Rendu par pdf.js depuis cdnjs, chargé à la demande

`pdf.js` est chargé au **premier ouverture de l'écran**, jamais avant, depuis
`cdnjs.cloudflare.com` avec une **version épinglée**.

*Alternative écartée — `<iframe src="…pdf">` :* c'est la solution en une ligne,
et elle marche sur Android Chrome. Mais le visualiseur natif d'iOS est
irrégulier en PWA (page unique, ou téléchargement forcé), et le projet porte
déjà du code spécifique iOS (connexion Google, photos iPhone) : il y a des
utilisateurs iOS. On perdrait aussi toute maîtrise de la pagination, donc la
page 44 et son appel à l'achat.

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
déjà alignés sur le livre. La **page** qui y figure sert en plus à décider
laquelle des deux formulations employer : page < 45, le sujet est dans
l'extrait ; page ≥ 45, il est dans le livre seulement.

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
| **Le poids du PDF** sur mobile en données mobiles | Un extrait de 44 pages illustrées peut dépasser 5 Mo | À mesurer dès réception du fichier. Au-delà d'un seuil, re-compresser |
| **La détection de sujet se trompe** | Une carte hors propos | Plafond d'une carte par 24 h : un faux positif coûte une carte, pas une avalanche |
| **Une carte promet ce que l'extrait n'a pas** | Une promesse fausse abîme la confiance | Deux formulations, arbitrées par la page de `BOOK_CHAPTERS`. Exigence dédiée, testée |
| **`hasBookAccess` est un cache local** | Un athlète dont le cache est périmé peut voir une carte d'achat | Défaut hérité, hors périmètre. Documenté dans `acces-premium` |

### Ce qui reste à décider avec l'auteur

1. **Le PDF lui-même** n'est pas encore fourni. Tant qu'il n'est pas là, ni le
   poids ni le nombre réel de pages ne sont connus.
2. **Le découpage** : si le fichier reçu est le livre complet, il est coupé
   localement et **seul l'extrait** est commité.
3. **Les libellés des deux cartes** doivent être relus : celle qui annonce que
   la réponse est dans l'extrait (8 Lois), et celle qui la situe dans le livre
   (tout le reste).
4. **La numérotation du PDF peut différer de celle du livre.** Les pages
   liminaires décalent souvent le compte : « page 44 du livre » peut être la
   page 48 du fichier. À vérifier sur le fichier reçu, avant de couper.
