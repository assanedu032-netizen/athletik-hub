#!/usr/bin/env bash
# scripts/check-apk.sh — vérifie un APK RÉELLEMENT produit, avant de le livrer.
#
#   bash scripts/check-apk.sh android/app/build/outputs/apk/debug/app-debug.apk
#
# Un APK se décompresse comme un zip : tout ce qu'il contient est lisible par
# quiconque le télécharge. On vérifie donc ce qu'il CONTIENT, pas seulement
# qu'il existe :
#   1. c'est un vrai paquet Android, signé, avec le bon identifiant ;
#   2. l'interface est bien embarquée (l'app ne dépend pas de Netlify pour
#      s'afficher) ;
#   3. ni le livre complet, ni les réponses d'activation, ni aucun secret.
set -u
APK="${1:-}"
[ -n "$APK" ] || { echo "Usage : bash scripts/check-apk.sh <chemin de l'APK>"; exit 2; }
ECHECS=0
ko()  { echo "  ÉCHEC  $1"; ECHECS=$((ECHECS+1)); }
okk() { echo "  OK     $1"; }

echo "APK vérifié : $APK"
if [ ! -f "$APK" ]; then echo "  ÉCHEC  le fichier n'existe pas"; exit 1; fi
TAILLE=$(stat -c %s "$APK")
echo "Taille      : $((TAILLE / 1048576)) Mo ($TAILLE octets)"
echo "SHA-256     : $(sha256sum "$APK" | cut -d' ' -f1)"
LISTE="$(mktemp)"; trap 'rm -f "$LISTE"; rm -rf "${X:-}"' EXIT
unzip -Z1 "$APK" > "$LISTE" 2>/dev/null || { echo "  ÉCHEC  ce n'est pas une archive valide"; exit 1; }

echo; echo "── Un vrai paquet Android ──"
[ "$TAILLE" -gt 1048576 ] && okk "plus de 1 Mo" || ko "taille suspecte ($TAILLE octets)"
for f in AndroidManifest.xml classes.dex resources.arsc; do
  grep -qx "$f" "$LISTE" && okk "contient $f" || ko "$f absent"
done
# Outils du SDK : identifiant, version, signature.
BT="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}/build-tools"
if [ -d "$BT" ]; then
  V="$(ls "$BT" | sort -V | tail -1)"
  if "$BT/$V/aapt2" dump badging "$APK" > /tmp/badging.txt 2>/dev/null; then
    PKG="$(grep -o "package: name='[^']*'" /tmp/badging.txt | cut -d"'" -f2)"
    [ "$PKG" = "com.athletikhub.app" ] && okk "identifiant : $PKG" || ko "identifiant inattendu : '$PKG'"
    LABEL="$(grep -o "application-label:'[^']*'" /tmp/badging.txt | head -1 | cut -d"'" -f2)"
    okk "nom affiché : $LABEL"
    grep -o "sdkVersion:'[0-9]*'\|targetSdkVersion:'[0-9]*'" /tmp/badging.txt | sed 's/^/         /'
  else ko "aapt2 n'a pas pu lire le paquet"; fi
  if "$BT/$V/apksigner" verify --print-certs "$APK" > /tmp/sign.txt 2>&1; then
    okk "signature valide ($(grep -m1 'certificate DN' /tmp/sign.txt | sed 's/.*DN: //'))"
  else ko "signature invalide : $(head -c 200 /tmp/sign.txt)"; fi
else
  echo "  (SDK Android introuvable : identifiant et signature non vérifiés)"
fi

echo; echo "── L'interface est embarquée ──"
for f in assets/public/index.html assets/public/data/book-excerpt.js assets/public/data/vertical-dunk-program.js \
         assets/public/ciqual-data.js assets/public/icons/icon-192.png assets/capacitor.config.json; do
  grep -qx "$f" "$LISTE" && okk "$f" || ko "$f absent"
done

echo; echo "── Rien qui ne doive en sortir ──"
for f in data/livre.md data/book-challenges.js CLAUDE.md .env .env.example bookChallengesSeed.json \
         bookChallengesSeed.example.json netlify/functions firestore.rules node_modules scripts/; do
  if grep -q "assets/public/$f" "$LISTE"; then ko "contient $f"; else okk "ne contient pas $f"; fi
done
# Recherche de secrets dans tout ce que l'app embarque (texte).
X="$(mktemp -d)"; unzip -qq "$APK" 'assets/*' -d "$X" 2>/dev/null
MOTIFS='sk-ant-|BEGIN (RSA |EC )?PRIVATE KEY|"type": *"service_account"|"private_key"|ANTHROPIC_API_KEY=|ACCESS_CODE_SECRET=[^ ]'
if grep -rIEl "$MOTIFS" "$X" > /tmp/secrets.txt 2>/dev/null && [ -s /tmp/secrets.txt ]; then
  ko "motif de secret trouvé dans : $(tr '\n' ' ' < /tmp/secrets.txt)"
else okk "aucun motif de secret (clé Anthropic, clé privée, compte de service)"; fi
# Le livre complet tient en 70 000 mots ; l'extrait gratuit, lui, s'arrête page 44.
if grep -rIl "## BIBLIOGRAPHIE" "$X" > /dev/null 2>&1; then ko "le texte complet du livre est embarqué"
else okk "le texte complet du livre n'est pas embarqué"; fi

echo
if [ "$ECHECS" -gt 0 ]; then echo "RÉSULTAT : $ECHECS ÉCHEC(S) — APK REFUSÉ"; exit 1; fi
echo "RÉSULTAT : APK conforme"
