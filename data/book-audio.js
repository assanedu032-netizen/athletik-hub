// Lecture audio du livre « Les Secrets de la Détente Verticale ».
// Voix générée sur ElevenLabs, voix choisie par l'auteur.
//
// STRUCTURE PRÉVUE POUR GRANDIR : le livre est mis en audio par parties, au
// fur et à mesure. Ajouter une partie = une entrée ici + un fichier dans
// assets/audio/. Aucun code à toucher.
//
// `sec` est la durée RÉELLE du fichier (4 213 028 octets d'audio à 128 kbps
// mono = 263 s), pas une estimation : le lecteur l'affiche avant même que le
// navigateur ait fini de charger les métadonnées, et il la corrige ensuite
// avec la valeur exacte du décodeur.
//
// `pages` dit ce que la partie couvre VRAIMENT dans le livre. Le lecteur ne
// s'en sert que pour l'annoncer — jamais pour prétendre qu'un passage est
// lu alors qu'il ne l'est pas.
//
// COMMENT LA BORNE A ÉTÉ TROUVÉE — pas estimée depuis la table des matières,
// qui m'avait fait écrire 9 à tort. La transcription fournie par l'auteur
// s'arrête sur « Troisièmement, répétition » ; ce passage (les trois piliers)
// est cherché dans `data/book-excerpt.js`, en ignorant les blocs `toc` de la
// page 2 qui contiennent tous les titres du livre et produisent des faux
// positifs. Il tombe PAGE 7, et la page 8 enchaîne sur du texte absent de la
// transcription. L'audio couvre donc les pages 1 à 7.
window.BOOK_AUDIO = [
  {
    id: 'p1',
    titre: 'Préface et Avant-Propos',
    sous: 'Lu par la voix du livre',
    src: 'assets/audio/livre-01-preface.mp3',
    sec: 263,
    pages: [1, 7]
  }
];
