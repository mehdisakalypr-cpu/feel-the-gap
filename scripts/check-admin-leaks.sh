#!/usr/bin/env bash
# check-admin-leaks.sh — empêche les mentions des outils admin internes (cc/ofa/estate)
# d'apparaître dans les pages/composants client-facing.
#
# Run automatique : pre-push hook + CI (GitHub Actions à venir).
# Bypass : ajouter le marker `// @admin-leak-allowed` sur la ligne juste avant
#          la mention, OU wrapper la mention dans un block conditionnel
#          `{isFounder && ...}` / `if (isFounder)`.
#
# Files scannés : app/**/*.tsx (page/layout), components/**/*.tsx
# Exclus : app/api/** (server-side JSON, content contrôlé)
#         lib/** (server-side helpers)
#         auth-pools.ts (canonical config, mention légitime)
#
# Patterns interdits (literal strings côté client) :
#   - "Command Center" / command-center / cc-dashboard
#   - "The Estate" / the-estate
#   - "One For All" / one-for-all / OFA / site-factory
set -euo pipefail

REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
cd "$REPO_ROOT"

PATTERNS=(
  "Command Center"
  "command-center"
  "cc-dashboard"
  "The Estate"
  "the-estate"
  "One For All"
  "one-for-all"
  "site-factory"
)

# Glob client-facing files (anything that ends up in browser HTML/JS bundle)
FILES=$(find app components -type f \( -name "*.tsx" -o -name "*.ts" -o -name "*.jsx" -o -name "*.js" \) 2>/dev/null \
  | grep -vE '^app/api/' \
  | grep -vE '/(node_modules|\.next|dist)/' \
  || true)

if [ -z "$FILES" ]; then
  echo "[check-admin-leaks] no client files to scan, OK"
  exit 0
fi

violations=0
violation_details=""

for f in $FILES; do
  for pat in "${PATTERNS[@]}"; do
    # grep with line numbers
    matches=$(grep -nF "$pat" "$f" 2>/dev/null || true)
    if [ -z "$matches" ]; then continue; fi

    while IFS= read -r line; do
      lineno=$(echo "$line" | cut -d: -f1)
      content=$(echo "$line" | cut -d: -f2-)

      # Allow if line has marker, OR any of the 5 previous lines has marker
      # (multi-line comment blocks supported).
      marker_start=$((lineno > 5 ? lineno - 5 : 1))
      window=$(sed -n "${marker_start},${lineno}p" "$f")
      if echo "$window" | grep -q "@admin-leak-allowed"; then
        continue
      fi

      # Allow if inside a block that mentions isFounder (heuristic : look back 30 lines for isFounder &&)
      start=$((lineno > 30 ? lineno - 30 : 1))
      context=$(sed -n "${start},${lineno}p" "$f")
      if echo "$context" | grep -qE "isFounder\s*&&|if\s*\(\s*isFounder|FOUNDER_EMAILS"; then
        continue
      fi

      # Allow if it's a comment line (starts with // or *)
      trimmed=$(echo "$content" | sed 's/^[[:space:]]*//')
      if [[ "$trimmed" == //* ]] || [[ "$trimmed" == \** ]] || [[ "$trimmed" == /\** ]]; then
        continue
      fi

      violations=$((violations + 1))
      violation_details="$violation_details
  ❌ $f:$lineno → mention de '$pat' visible client-side
     $(echo "$content" | head -c 100)"
    done <<< "$matches"
  done
done

if [ "$violations" -gt 0 ]; then
  echo "[check-admin-leaks] ❌ $violations leak(s) potentiel(s) détecté(s) :"
  echo "$violation_details"
  echo ""
  echo "Pour autoriser une occurrence légitime :"
  echo "  - Ajoute le commentaire '// @admin-leak-allowed' sur la ligne juste avant"
  echo "  - OU wrap dans un block {isFounder && ...} / if (isFounder)"
  echo "  - OU déplace dans app/api/ ou lib/ (server-side only)"
  exit 1
fi

echo "[check-admin-leaks] ✅ aucun leak admin-pool détecté"
exit 0
