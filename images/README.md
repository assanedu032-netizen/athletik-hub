# Images des programmes — onglet Train

Place ici les 6 images de programmes. Chemins référencés dans `index.html`
(cartes `#progList` + champ `img` de `PROGRAMS_V2`).

## Fichiers attendus (noms EXACTS, sensibles à la casse)

| Fichier | Programme | Statut |
|---------|-----------|--------|
| `vertical-dunk.png`  | Vertical Dunk   | ✅ disponible (image individuelle) |
| `elite-athlete.png`  | Elite Athlete   | ✅ disponible (image individuelle) |
| `microtraining.png`  | Microtraining   | ✅ disponible (image individuelle) |
| `triphasique.png`    | Triphasique     | ⏳ à découper depuis l'image globale |
| `shred-explose.png`  | Shred Explose   | ⏳ à découper depuis l'image globale |
| `explose-plus.png`   | Explose+        | ⏳ à découper depuis l'image globale |

## Recommandations

- Format paysage ~3:2 (ex: 900×600 px). Les cartes utilisent `object-fit:cover`,
  donc tout ratio marche, mais 3:2 évite les rognages agressifs.
- PNG ou JPG. JPG conseillé pour les photos (fichier plus léger).
- Tant qu'un fichier est absent, la carte affiche un dégradé navy
  (`onerror` dans `index.html`) — pas de casse visuelle.

## Découpe des 3 images manquantes

L'image globale contient les 6 programmes. Découpe 3 vignettes individuelles
(une par programme : Triphasique, Shred Explose, Explose+), recadrées propres
sans le texte du montage global, et enregistre-les avec les noms ci-dessus.
