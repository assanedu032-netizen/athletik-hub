# Compiler Athletik Hub pour Android et iOS

L'app mobile est faite avec **Capacitor 8** : elle reprend `index.html` tel quel et
l'**embarque dans le paquet**. Seules les fonctions serveur (Titan, codes, activation,
essai) sont appelées sur Internet, à l'adresse gravée dans `index.html`
(`AH_API_BASE`, premier script de la page).

Le dossier embarqué est **`www/`**, produit par `scripts/build-www.js` à partir d'une
liste d'autorisation — le même que celui publié sur le web. Le livre complet et les
réponses d'activation n'y entrent jamais.

**Règle absolue : aucun secret dans le dépôt ni dans l'app.** Tout ce qui signe ou
publie vit dans les **secrets GitHub** (Settings → Secrets and variables → Actions),
jamais dans un fichier commité.

---

## 1. Android — APK de débogage (en place)

Workflow : `.github/workflows/android-debug.yml`. Il se lance seul à chaque push qui
touche l'app ou le projet Android, et à la main depuis l'onglet **Actions**.

1. Node 22 + Java 21, `npm install`
2. `node scripts/build-www.js` → `www/`
3. `npx cap sync android`
4. `./gradlew assembleDebug`
5. `scripts/check-apk.sh` — vérifie le fichier **réellement produit** : identifiant
   `com.athletikhub.app`, signature, interface embarquée, et **absence** du livre, des
   réponses et de tout motif de secret. Un APK qui échoue n'est pas livré.
6. L'APK est déposé comme **artefact** (conservé 14 jours) : Actions → l'exécution →
   section *Artifacts*.

Un APK de **débogage** s'installe à la main sur un téléphone (« sources inconnues »).
Il n'est **pas** publiable sur Google Play.

En local : Android Studio (il installe le SDK), puis
`npm install && npm run cap:sync && cd android && ./gradlew assembleDebug`.

## 2. Android — version publiable (à faire)

Google Play exige un **AAB** (`./gradlew bundleRelease`) signé avec **ta clé d'envoi**.

1. Créer la clé, **une fois, sur ta machine**, et la garder précieusement (la perdre
   empêche de mettre l'app à jour si Play App Signing n'est pas activé) :
   `keytool -genkeypair -v -keystore athletik-upload.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000`
2. Secrets GitHub : `ANDROID_KEYSTORE_BASE64` (`base64 -w0 athletik-upload.jks`),
   `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`.
3. Un workflow séparé (manuel) décode la clé dans le runner, compile `bundleRelease`
   et dépose l'AAB en artefact. **Il ne publie rien** : l'envoi sur la Play Console
   reste un geste manuel.
4. Compte Google Play Console (25 $, une fois), fiche de l'app, politique de
   confidentialité, formulaire « Sécurité des données », **suppression de compte**.

## 3. iOS — compilation de contrôle (en place, manuelle)

Workflow : `.github/workflows/ios-simulator.yml` (macOS + Xcode, **sans signature**).
Il prouve que le projet compile ; il ne produit **pas** d'app installable sur un iPhone.
GitHub ne propose un workflow manuel qu'une fois présent sur `main`.

## 4. iOS — version installable et publiable (à faire)

**Prérequis impossibles à contourner :**
- un **compte Apple Developer** (99 $/an) ;
- **macOS + Xcode** : soit un Mac, soit une machine macOS GitHub Actions ;
- l'identifiant `com.athletikhub.app` déclaré dans le portail Apple Developer.

**Signature sans Mac (GitHub Actions)** — secrets à créer :
- `IOS_CERT_P12_BASE64` + `IOS_CERT_PASSWORD` : certificat de distribution ;
- `IOS_PROFILE_BASE64` : profil de provisionnement App Store ;
- `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_KEY_P8_BASE64` : clé d'API App Store Connect,
  pour envoyer la version sur **TestFlight**.

Le workflow importerait le certificat dans un trousseau temporaire, installerait le
profil, puis `xcodebuild archive` + `-exportArchive` → `.ipa`. L'envoi sur TestFlight
reste une étape distincte et volontaire ; la soumission à l'App Store, un geste manuel.

**Avec un Mac** : `npm install && npm run cap:sync && npx cap open ios`, puis dans
Xcode : équipe de signature → Product → Archive → Distribute.

## 5. Avant toute publication sur les stores

- **Modèle d'accès** : le premium se débloque par codes, par la question du livre ou
  par l'essai. Apple (règle 3.1.1) et Google exigent en principe leur système de
  paiement pour débloquer des fonctionnalités numériques. Décision à prendre avant
  de soumettre.
- **Suppression du compte depuis l'app** : exigée par Apple et Google, absente
  aujourd'hui.
- **Connexion Google** : bloquée par Google dans les vues d'app → module natif
  `@capacitor-firebase/authentication`.
- **Notifications** : le push web n'existe pas dans une app → module natif
  `@capacitor-firebase/messaging` (FCM sur Android, APNs + clé APNs dans Firebase sur iOS).
- **Restrictions de la clé Firebase** : si la clé Web est restreinte par domaine dans
  Google Cloud, ajouter `https://localhost` (Android) et `capacitor://localhost` (iOS).
