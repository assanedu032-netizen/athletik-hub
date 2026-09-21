# Athletik Hub — Journal des décisions

**Document préparé le 12 septembre 2026** · Alassane Dia

---

## À propos de ce document

Ce document recense les décisions prises sur l'application Athletik Hub, dans l'ordre
chronologique, avec leur date, leur heure et leur type.

**D'où viennent les dates.** Elles sont lues dans l'historique Git du projet — 173 livraisons
entre le **6 juin 2026** et le **7 septembre 2026**. Une date marque donc le moment où la
décision a été **livrée**, pas toujours celui où elle a été prise : l'écart est généralement de
quelques minutes à quelques heures, jamais plus d'une journée.

**Trois limites à connaître.**

1. **L'historique disponible ne remonte pas à la création de l'application.** La première
   livraison enregistrée (6 juin 2026, 23 h 57) s'intitule *« refonte design premium écran
   Train > Builder »* : l'app, le Builder et les écrans existaient déjà. Les décisions
   antérieures à juin 2026 ne sont pas traçables ici. Elles ne sont pas dans ce document plutôt
   que d'être reconstituées de mémoire.
2. **Toutes les heures sont celles enregistrées par Git.** Aucune n'a été estimée ni arrondie.
3. Les décisions listées sont celles qui ont **changé le produit**. Les corrections purement
   techniques sans effet visible (bumps de cache, refactos internes) sont écartées.

L'**Annexe A** rassemble à part les décisions dont la formulation exacte est conservée.

---

## Récapitulatif

| Type | Nombre |
|---|---|
| 🎯 **Produit** — ce que l'app fait | 23 |
| 🎨 **Design / UX** — comment elle le présente | 22 |
| 📚 **Contenu** — fidélité au livre et aux programmes | 13 |
| 🐛 **Correction** — un défaut constaté, décision de le traiter | 13 |
| 🤖 **Titan** — le coach IA | 10 |
| 🔒 **Sécurité / Accès** — qui entre et comment | 9 |
| ⚙️ **Technique** — fondations invisibles mais structurantes | 4 |
| **Total** | **94** |

**Période couverte :** 6 juin 2026 → 7 septembre 2026 (94 jours).

---

## Juin 2026 — Les fondations

| N° | Date | Heure | Type | Décision |
|---|---|---|---|---|
| 1 | 06/06/2026 | 23:57 | 🎨 Design | Refondre l'écran **Train › Builder** en direction « premium ». |
| 2 | 07/06/2026 | 00:06 | 🎯 Produit | Le **son du timer doit passer en arrière-plan**, écouteurs compris — pas seulement quand l'écran est allumé. |
| 3 | 07/06/2026 | 00:09 | 🎨 Design | Splash premium navy : carte logo, espacement, sous-titre doré. |
| 4 | 08/06/2026 | 19:49 | 🎯 Produit | L'athlète peut créer un **exercice perso**, avoir des **presets de timer**, et retrouver ses exos trackés dans l'historique. |
| 5 | 08/06/2026 | 19:54 | 🤖 Titan | **Débrider Titan sur le livre** : accès plus large au contenu, prompt technique plus généreux. |
| 6 | 08/06/2026 | 20:08 | 🐛 Correction | Les photos physio (face / profil / dos) doivent être **uploadables depuis un mobile**. |
| 7 | 08/06/2026 | 20:51 | 🎯 Produit | Créer la carte **« MON PARCOURS »** et **verrouiller « Lancer la séance »** tant que l'onboarding n'est pas complet. |
| 8 | 09/06/2026 | 02:51 | 🐛 Correction | Le sélecteur de portions doit aussi recalculer les **quantités d'ingrédients**, pas seulement les calories. |
| 9 | 09/06/2026 | 02:55 | 🎯 Produit | Afficher le **cumul des répétitions par séance**, en plus du meilleur score. |
| 10 | 09/06/2026 | 03:04 | 🐛 Correction | Le bouton **« Tracker cet exercice »** de la librairie était un placeholder : le brancher pour de vrai. |
| 11 | 09/06/2026 | 13:36 | 🎨 Design | La **Vue d'ensemble** des Tests devient un **tableau d'action**, plus un doublon du Journal. |
| 12 | 09/06/2026 | 13:52 | 🎯 Produit | Créer un **système de 7 guides vidéo**, volontairement minimaliste. |
| 13 | 09/06/2026 | 14:37 | 🎨 Design | Ajouter des **accès contextuels « ? »** et **retirer Titan Engine des Paramètres**. |
| 14 | 09/06/2026 | 15:33 | 📚 Contenu | **Fidélité au livre** : les 8 lois, les 12 cours, MENER et les règles de sécurité entrent dans Titan. |
| 15 | 09/06/2026 | 15:37 | 🎯 Produit | Ajouter **« Refaire l'onboarding complet »** — pour pouvoir se remettre dans la peau du client. |
| 16 | 09/06/2026 | 15:52 | 🎨 Design | Barre de progression Home en **3 segments** + CTA qui connaît son état : **plus de téléportation surprise**. |
| 17 | 09/06/2026 | 16:15 | 🐛 Correction | Le libellé **« LANCER LA SÉANCE » était mensonger** — il faisait un retour arrière. |
| 18 | 10/06/2026 | 22:55 | 🐛 Correction | Le plan repas manquait de **diversité réelle** : élargir le pool de 6 à 20 recettes. |
| 19 | 10/06/2026 | 23:16 | 🎨 Design | **Librairie V2** : page dédiée, cartes compactes, séance perso. |
| 20 | 11/06/2026 | 04:17 | 🎯 Produit | On peut **décocher un ingrédient** d'une recette — kcal et macros se recalculent en direct. |
| 21 | 11/06/2026 | 04:23 | 🎨 Design | Filtres de la librairie **discrets** : 3 chips visibles + le reste dans une feuille du bas. |
| 22 | 11/06/2026 | 04:35 | 🔒 Accès | Créer l'**activation post-livre** : popup premium + wizard en 2 étapes. |
| 23 | 11/06/2026 | 04:44 | 🔒 Sécurité | L'**essai gratuit est décidé par le serveur**, pas par le téléphone, et les Règles Firestore sont verrouillées. |
| 24 | 11/06/2026 | 05:11 | 🎨 Design | Refonte des popups d'accès en direction artistique **sport-luxe**, avec une variante thème clair. |
| 25 | 11/06/2026 | 10:29 | 🎯 Produit | **Échanger un ingrédient** contre une alternative, avec confirmation et recalcul. |
| 26 | 12/06/2026 | 09:06 | 📚 Contenu | Créer une **source de vérité** pour le programme **Elite Athlète** (EA_SOT_V1) — le programme fait foi, pas le code. |
| 27 | 12/06/2026 | 10:09 | 📚 Contenu | Intégrer Elite Athlète **de façon chirurgicale**, sans reconstruire l'app autour. |
| 28 | 12/06/2026 | 10:17 | 📚 Contenu | Rétablir le **nom officiel de la Phase 1** : « Fondation Athlétique », pas « Vertical Test ». |
| 29 | 12/06/2026 | 19:45 | 📚 Contenu | Étendre la source de vérité aux **5 programmes**. |
| 30 | 12/06/2026 | 22:56 | 📚 Contenu | **Microtraining complet** : bilan, jeûne, timer de sprint, intégration Titan. |
| 31 | 13/06/2026 | 00:14 | 🎨 Design | Le timer de jeûne ne se lance plus tout seul : il devient une **bannière non-intrusive**. |
| 32 | 24/06/2026 | 20:12 | ⚙️ Technique | **Retirer l'intégration Playwright en CI** (workflow, tests, config). |
| 33 | 24/06/2026 | 20:57 | 🐛 Correction | La modale recette se fermait seule après 2-3 s : le rechargement du Service Worker est **différé tant qu'une modale est ouverte**. |

---

## Juillet 2026 — Titan devient contextuel

| N° | Date | Heure | Type | Décision |
|---|---|---|---|---|
| 34 | 03/07/2026 | 23:23 | 🐛 Correction | L'app **redémarrait au retour d'une autre application**. Corriger, et recadrer l'onglet TRAIN. |
| 35 | 05/07/2026 | 22:45 | 🎯 Produit | L'alerte de fin de timer doit être **fiable même app fermée** (push FCM différé) + **durée personnalisée**. |
| 36 | 07/07/2026 | 14:04 | 🤖 Titan | Créer un **moteur de recommandations contextuel** : l'engagement du jour et la lecture du jour viennent de la **même** analyse. |
| 37 | 08/07/2026 | 13:48 | 🤖 Titan | Ajouter une **couche mémoire** : Titan tient compte du parcours récent, pas seulement de l'instant. |
| 38 | 10/07/2026 | 10:04 | 🔒 Sécurité | **Verrouiller le niveau d'accès** et vérifier l'accès à Titan **côté serveur**. |
| 39 | 13/07/2026 | 18:34 | 🎯 Produit | Ajouter un **Conseil Titan** en nutrition. Débloquer la **connexion Google sur PWA iOS**. |
| 40 | 14/07/2026 | 15:09 | 🔒 Sécurité | L'**accès fondateur** au Builder se vérifie côté serveur. Le micro doit dire pourquoi il échoue. |
| 41 | 26/07/2026 | 13:19 | 🎯 Produit | **49 vidéos d'exercices**, saisie du temps en **min:sec**, recherche dans le journal. |
| 42 | 26/07/2026 | 14:37 | 🎨 Design | La vidéo passe **en bas** de la fiche exercice. |
| 43 | 26/07/2026 | 14:44 | 🎨 Design | Un **filtre se désactive** quand on re-tape dessus. |
| 44 | 26/07/2026 | 15:21 | 🎨 Design | Le **swipe marche sur toute la page** de séance, pas seulement sur la vidéo. |
| 45 | 27/07/2026 | 05:47 | 🎯 Produit | **Marquer les séances faites** d'un ✓ vert sur la grille du programme. |
| 46 | 27/07/2026 | 06:09 | 🎨 Design | **Fusionner Engagement + Lecture** en une carte unique : la **« Mission Titan du jour »**. |
| 47 | 27/07/2026 | 21:17 | 🎯 Produit | Créer une **landing page complète** — UX, copywriting, conversion. |

---

## Août 2026 — Le comportement, la conformité, la séance

| N° | Date | Heure | Type | Décision |
|---|---|---|---|---|
| 48 | 10/08/2026 | 17:59 | 🐛 Correction | Après restauration du compte, l'athlète doit **arriver sur Home**, pas rester bloqué en onboarding. |
| 49 | 13/08/2026 | 19:26 | 🎯 Produit | Créer une **page `/download.html`** + une bannière d'installation PWA vers le tutoriel. |
| 50 | 17/08/2026 | 18:57 | 🐛 Correction | Les **tests physiques (SAT/SET) étaient redemandés à chaque connexion**. C'est la correction la plus reprise du projet — trois passes. |
| 51 | 18/08/2026 | 21:23 | ⚙️ Technique | Le **programme attribué doit être écrit en base**, et les champs critiques protégés à la synchronisation. |
| 52 | 18/08/2026 | 21:34 | ⚙️ Technique | Mettre en place un **harnais de non-régression** sur la persistance de l'onboarding. Première pierre de la suite de tests. |
| 53 | 18/08/2026 | 22:52 | 🎨 Design | Refonte **chirurgicale** de l'écran de bilan post-séance — le mot est important : pas de reconstruction. |
| 54 | 22/08/2026 | 16:13 | 📚 Contenu | Intégrer le tutoriel **« Tester sa détente verticale à partir de la planche »**. |
| 55 | 22/08/2026 | 17:55 | 🐛 Correction | La couche push n'était **jamais armée** : aucune alerte quand l'app était fermée. |
| 56 | 22/08/2026 | 18:23 | 🔒 Accès | **« J'ai le livre » menait à l'écran qui ignore le livre.** Corriger le parcours. |
| 57 | 22/08/2026 | 18:25 | 🔒 Accès | **Le livre ne contient aucun code** — reformuler tous les textes qui le laissaient croire. |
| 58 | 22/08/2026 | 18:55 | 🔒 Accès | Saisie du n° Amazon : bon clavier, validation stricte, **empreinte à usage unique**. |
| 59 | 22/08/2026 | 19:06 | 🤖 Titan | **Quotas Titan par niveau d'accès**, et colmater les fuites entre les questions du livre. |
| 60 | 22/08/2026 | 19:10 | 🔒 Sécurité | **Retirer les codes d'accès historiques** `AL-88ND89` et `ONANDULU78`. |
| 61 | 22/08/2026 | 19:25 | 🤖 Titan | On peut **envoyer une photo à Titan** dans le chat. |
| 62 | 22/08/2026 | 19:57 | 🤖 Titan | **Prendre une photo en direct**, et supporter le format des photos iPhone. |
| 63 | 22/08/2026 | 20:10 | 🎯 Produit | **Système comportemental, brique 1** — la célébration post-séance. |
| 64 | 22/08/2026 | 22:15 | 🎯 Produit | **Brique 2** — boucle de progression, anticipation, jalons. |
| 65 | 22/08/2026 | 22:21 | 🎯 Produit | **Brique 3** — ancrage comportemental. |
| 66 | 23/08/2026 | 10:53 | 🎯 Produit | **Brique 4** — jokers de série, micro-actions, semaines de présence. |
| 67 | 23/08/2026 | 10:59 | 🎯 Produit | **Brique 5** — récompense variable, **« sans aucun hasard »**. La formule est explicite : la variabilité est pilotée, jamais aléatoire. |
| 68 | 23/08/2026 | 11:06 | 🎯 Produit | **Brique 6** — règles de notification. |
| 69 | 23/08/2026 | 13:25 | 🐛 Correction | La carte de progression **doit être visible même sans test SAT fait**. |
| 70 | 23/08/2026 | 16:31 | 🎯 Produit | **Rappel proactif des préférences d'entraînement** — proactif, mais jamais bloquant. |
| 71 | 24/08/2026 | 19:37 | 🤖 Titan | Créer la couche **« Athlete State »** : Titan voit enfin les vraies données d'entraînement. |
| 72 | 24/08/2026 | 19:45 | 🎯 Produit | **Saisir sa charge pendant la séance** — sinon Titan ne voit jamais les performances. |
| 73 | 24/08/2026 | 19:56 | 🐛 Correction | Titan **disait ne pas recevoir les images** alors qu'il les recevait. |
| 74 | 25/08/2026 | 20:55 | 🎨 Design | **Refonte complète de l'écran de séance live** : 8 modes d'exécution, **zéro scroll**, vérifié au navigateur. |
| 75 | 26/08/2026 | 12:07 | 🎨 Design | L'écran de séance a un **fond bleu, jamais noir** — c'est l'identité de marque. Le bloc vidéo ne disparaît jamais. |
| 76 | 26/08/2026 | 20:10 | 📚 Contenu | **Mise en conformité des données** avec les programmes sources : séries, valeurs, repos, enchaînements. |
| 77 | 26/08/2026 | 21:38 | 📚 Contenu | **SHRED EXPLOSE** rendu conforme à son programme source. |
| 78 | 26/08/2026 | 21:40 | 📚 Contenu | **TRIPHASIQUE** rendu conforme. |
| 79 | 26/08/2026 | 21:44 | 📚 Contenu | **EXPLOSE+** rendu conforme, et les 4 programmes comparables alignés entre eux. |
| 80 | 26/08/2026 | 23:05 | 📚 Contenu | **ELITE ATHLETE et MICROTRAINING audités** ; la recherche de vidéo devient tolérante à la casse et aux variantes de nom. |
| 81 | 28/08/2026 | 16:58 | 🎨 Design | Les **réponses de Titan doivent être lisibles sur mobile** — gras, listes et sauts de ligne rendus, plus un bloc compact. |
| 82 | 29/08/2026 | 10:56 | 🐛 Correction | Écran recette : **trois chiffres se contredisaient** à l'écran. |
| 83 | 29/08/2026 | 12:49 | 🤖 Titan | Titan doit connaître le **poids et le journal nutritionnel** — il redemandait une donnée déjà saisie à l'onboarding. |
| 84 | 29/08/2026 | 19:15 | ⚙️ Technique | Créer un **moteur central des méthodes d'entraînement** : une méthode = une définition, partagée par les programmes, le Builder, Titan et l'écran live. |
| 85 | 29/08/2026 | 19:21 | 🤖 Titan | **Titan peut prescrire une méthode, pas en inventer une** — tout ce qui sort du schéma est refusé avant d'atteindre l'app. |
| 86 | 29/08/2026 | 19:28 | 📚 Contenu | Les méthodes des programmes deviennent des **données déclarées**, plus une devinette sur du texte. |

---

## Septembre 2026 — Titan agit, et la Home s'allège

| N° | Date | Heure | Type | Décision |
|---|---|---|---|---|
| 87 | 04/09/2026 | 20:36 | 🤖 Titan | Titan est **connecté au journal nutrition** ; les messages se mettent en **favoris** ; la conversation se **synchronise** entre appareils. |
| 88 | 04/09/2026 | 20:46 | 🔒 Sécurité | Le **scan photo passe par le proxy sécurisé** : plus aucune clé API dans le navigateur. |
| 89 | 05/09/2026 | 10:27 | 🎨 Design | Le **Suivi devient une lecture de la performance**, pas un tableau de chiffres : état → progression → priorité → action. |
| 90 | 05/09/2026 | 10:27 | 🎯 Produit | Un **repas s'analyse en photo** depuis le chat, et s'enregistre au journal sur un tap. |
| 91 | 07/09/2026 | 14:34 | 🎨 Design | La **Mission Titan devient une boîte de message**, pas un tableau de bord. |
| 92 | 07/09/2026 | 16:00 | 🎨 Design | La Mission Titan devient une **notification, repliée par défaut**. |
| 93 | 07/09/2026 | 16:29 | 🎨 Design | **Le plus simple et minimaliste** : notification d'une ligne, message entier, bouton en pilule. Le pavé doré pleine largeur disparaît. |
| 94 | 07/09/2026 | 16:29 | 🎨 Design | Supprimer la **croix pour masquer** et la **barre de progression** de la notification — un état de moins à maintenir. |

---

## Annexe A — Les décisions dont la formulation exacte est conservée

Ces quatre décisions de la Mission Titan (7 septembre 2026) sont rapportées telles qu'elles ont
été exprimées, et non reconstituées.

| N° | Formulation | Conséquence |
|---|---|---|
| 91 | *« Ne reconstruis PAS la Home. Avant de modifier le code, explique-moi où se trouve le bloc, quelles données il utilise, et ce que tu vas modifier. »* | Un audit préalable a été rendu avant toute modification. La carte est passée de 590 px à 364 px. |
| 92 | *« C'est pas encore ça, tu vois pas ? »* | Constat juste : la carte occupait encore 46 % de l'écran. Descendue à 287, puis 178 px. |
| 93 | *« Je pensais qu'on allait faire comme un gadget / widget notification. »* | Changement de forme : la carte devient une vraie notification, repliée par défaut. |
| 93 | *« Choisis pour moi le plus simple et minimaliste. »* | Choix délégué après présentation de trois variantes rendues dans l'app. Résultat : 129 px, soit **19 % de l'écran contre 88 % au départ**. |

---

## Annexe B — Trois principes qui reviennent dans toutes les décisions

Ils ne sont pas datés parce qu'ils n'ont jamais fait l'objet d'une décision isolée : ils sont
répétés d'un bout à l'autre du projet.

**1. Ne jamais inventer une donnée.** Une mesure absente s'affiche `—`, pas zéro. Un total
s'affiche seulement si le détail qui le compose est affiché à côté. Une heure de notification est
celle du calcul réel, ou rien. Ce principe a été rappelé explicitement sur la nutrition, sur le
Suivi et sur la Mission Titan.

**2. Le livre fait autorité.** Quand l'app et le programme source divergent, c'est la source qui
gagne : on corrige le fichier source et on régénère. Audit final : **710 exercices source = 710
exercices affichés**, zéro écart de séries.

**3. Modifier chirurgicalement, jamais reconstruire.** La consigne revient mot pour mot sur le
bilan de séance (18 août) et sur la Mission Titan (7 septembre).

---

## Annexe C — Décisions encore ouvertes

| Sujet | État |
|---|---|
| **Vidéos d'exercices** | Le système est prêt et les liens se remplissent au fil de l'eau. À ce jour, une large part des exercices reste à filmer. |
| **Publication App Store / Play Store** | Écartée du périmètre MVP. Décision à reprendre. |
| **« Titan-cerveau » (base de connaissances)** | Écartée du périmètre MVP. |
| **Croix « masquer » sur la notification Titan** | Supprimée le 7 septembre. Peut être rétablie. |
| **Code d'accès historique `KEVIN-JEAN2478`** | À retirer une fois les bêta-testeurs activés. |
| **Configuration hors code** | Variables d'environnement, règles Firestore et domaines autorisés : à appliquer côté propriétaire. |

---

*Document généré à partir de l'historique Git du dépôt `athletik-hub`, branche `main`,
173 livraisons entre le 6 juin et le 7 septembre 2026. Aucune date n'a été estimée.*
