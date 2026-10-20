#!/usr/bin/env bash
# scripts/verify-prod.sh — vérifie la production DEPUIS L'EXTÉRIEUR.
#
#   bash scripts/verify-prod.sh https://athletikfondation.netlify.app
#
# Trois familles de contrôles :
#   1. Les fichiers sensibles ne sont PAS servis.
#   2. Les fichiers de l'app SONT servis, avec leur vrai contenu.
#   3. Les fonctions serveur répondent, et refusent un appel sans connexion.
#
# PIÈGE : netlify.toml réécrit toute adresse inconnue vers /index.html avec un
# code 200 (application monopage). Un fichier retiré ne renvoie donc PAS 404 :
# il renvoie la page de l'app. Le code HTTP ne prouve rien — on regarde le
# CONTENU. Un fichier sensible est « exposé » si son contenu caractéristique
# revient ; il est « protégé » si c'est la page de l'app (ou un 404) qui revient.
set -u
BASE="${1:-https://athletikfondation.netlify.app}"
BASE="${BASE%/}"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
ECHECS=0
ligne() { printf '%-8s %-46s %s\n' "$1" "$2" "$3"; }
ko()    { ligne "ÉCHEC" "$1" "$2"; ECHECS=$((ECHECS+1)); }
okk()   { ligne "OK" "$1" "$2"; }

get() {  # get <chemin> → code HTTP ; corps dans $TMP/corps, en-têtes dans $TMP/entetes
  curl -sS -L --max-time 30 -o "$TMP/corps" -D "$TMP/entetes" -w '%{http_code}' "$BASE$1" 2>/dev/null || echo 000
}
est_page_app() { grep -q '<title>ATHLETIK HUB</title>' "$TMP/corps"; }

echo "Production vérifiée : $BASE"
echo "Date (UTC)          : $(date -u '+%Y-%m-%d %H:%M')"
echo

echo "── 1. Fichiers sensibles : ne doivent PAS être servis ──"
# chemin | motif présent dans le VRAI fichier
SENSIBLES=(
  "/data/livre.md|## BIBLIOGRAPHIE"
  "/data/book-challenges.js|accepted"
  "/netlify/functions/check-code.js|LEGACY_CODES"
  "/netlify/functions/titan.js|ANTHROPIC_API_KEY"
  "/CLAUDE.md|This file provides guidance"
  "/.env.example|ACCESS_CODE_SECRET"
  "/docs/ACCES-ET-CODES.md|code"
  "/bookChallengesSeed.example.json|accepted"
  "/firestore.rules|rules_version"
  "/package.json|firebase-admin"
  "/scripts/build-www.js|LISTE D'AUTORISATION"
)
for entree in "${SENSIBLES[@]}"; do
  chemin="${entree%%|*}"; motif="${entree#*|}"
  code="$(get "$chemin")"
  if [ "$code" = "000" ]; then ko "$chemin" "injoignable — rien n'est prouvé"
  elif est_page_app || [ "$code" = "404" ]; then okk "$chemin" "protégé (HTTP $code, page de l'app ou 404)"
  elif grep -qF -- "$motif" "$TMP/corps"; then ko "$chemin" "EXPOSÉ — le vrai fichier est servi (HTTP $code)"
  else okk "$chemin" "protégé (HTTP $code, contenu sans rapport)"; fi
done
echo

echo "── 2. Fichiers de l'app : doivent être servis tels quels ──"
# chemin | motif attendu (vide = binaire, on vérifie le type)
APP=(
  "/|<title>ATHLETIK HUB</title>"
  "/index.html|window.AH_API_BASE"
  "/manifest.json|\"name\""
  "/sw.js|const CACHE"
  "/firebase-messaging-sw.js|onBackgroundMessage"
  "/ciqual-data.js|"
  "/data/book-excerpt.js|BOOK_EXCERPT"
  "/data/book-audio.js|BOOK_AUDIO"
  "/data/vertical-dunk-program.js|"
  "/icons/icon-192.png|"
  "/assets/sounds/timer-beep.mp3|"
  "/landing.html|<html"
  "/download.html|<html"
)
for entree in "${APP[@]}"; do
  chemin="${entree%%|*}"; motif="${entree#*|}"
  code="$(get "$chemin")"
  type="$(grep -i '^content-type:' "$TMP/entetes" | tail -1 | cut -d' ' -f2- | tr -d '\r')"
  if [ "$code" != "200" ]; then ko "$chemin" "HTTP $code"
  elif [ "$chemin" != "/" ] && [ "$chemin" != "/index.html" ] && est_page_app && [[ "$chemin" != *.html ]]; then
    ko "$chemin" "ABSENT — la page de l'app revient à sa place"
  elif [ -n "$motif" ] && ! grep -qF -- "$motif" "$TMP/corps"; then ko "$chemin" "contenu inattendu ($type)"
  else okk "$chemin" "servi ($type, $(wc -c < "$TMP/corps") octets)"; fi
done
echo

echo "── 3. Fonctions serveur ──"
# Préflight CORS depuis l'origine de l'app Android (https://localhost).
for f in titan init-user check-code book-challenge; do
  code="$(curl -sS --max-time 30 -o /dev/null -D "$TMP/entetes" -w '%{http_code}' -X OPTIONS \
    -H 'Origin: https://localhost' -H 'Access-Control-Request-Method: POST' \
    -H 'Access-Control-Request-Headers: content-type,authorization' "$BASE/.netlify/functions/$f" 2>/dev/null || echo 000)"
  if grep -qi '^access-control-allow-origin:' "$TMP/entetes" && [[ "$code" =~ ^20 ]]; then
    okk "OPTIONS $f" "préflight accepté (HTTP $code)"
  else ko "OPTIONS $f" "préflight refusé (HTTP $code)"; fi
done
# Sans jeton de connexion, les fonctions protégées doivent REFUSER : ça prouve
# qu'elles tournent ET que la protection est en place. Aucun appel à l'IA.
# Chaque corps passe la validation de la fonction jusqu'au contrôle de
# connexion : check-code refuse un corps vide en 400 AVANT de regarder le jeton.
for entree in 'titan|{}' 'init-user|{}' 'check-code|{"code":"B-ABCDEF-1234"}' 'book-challenge|{"action":"start"}'; do
  f="${entree%%|*}"; corps="${entree#*|}"
  code="$(curl -sS --max-time 30 -o "$TMP/corps" -w '%{http_code}' -X POST -H 'Content-Type: application/json' \
    -d "$corps" "$BASE/.netlify/functions/$f" 2>/dev/null || echo 000)"
  if [ "$code" = "401" ] || [ "$code" = "403" ]; then okk "POST $f (sans connexion)" "refusé comme prévu (HTTP $code)"
  else ko "POST $f (sans connexion)" "HTTP $code — attendu 401/403 : $(head -c 120 "$TMP/corps")"; fi
done
code="$(get /.netlify/functions/notif-config)"
if [ "$code" = "200" ] && grep -q '{' "$TMP/corps"; then okk "GET notif-config" "répond (HTTP 200)"
else ko "GET notif-config" "HTTP $code"; fi
echo

if [ "$ECHECS" -gt 0 ]; then echo "RÉSULTAT : $ECHECS ÉCHEC(S)"; exit 1; fi
echo "RÉSULTAT : tout est conforme"
