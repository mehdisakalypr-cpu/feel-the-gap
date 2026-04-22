#!/usr/bin/env bash
# FTG i18n coverage guard — warns (not blocks) when visible French strings
# land in public user-facing pages without going through t().
#
# Part of the locale-consistency contract (feedback_locale_consistency_rule.md):
# a user on /en must never see mixed-language UI. This script helps catch
# regressions early; the real enforcement is reviewer diligence + the
# locale-consistency rule in memory.
#
# Usage:
#   ./scripts/check-i18n-coverage.sh                 → scans changed files (pre-push)
#   ./scripts/check-i18n-coverage.sh --all           → scans the whole repo
#   ./scripts/check-i18n-coverage.sh --strict        → exit 1 on any finding
#
# Noise is OK; this is a signal, not a gate. False positives are expected
# (brand names, technical keywords). The threshold is: "is this a SENTENCE
# or a LABEL that a non-French user should see translated?"

set -u
cd "$(git rev-parse --show-toplevel)"

STRICT=0
ALL=0
for arg in "$@"; do
  [[ "$arg" == "--strict" ]] && STRICT=1
  [[ "$arg" == "--all" ]] && ALL=1
done

# Scope — exclude admin / API / generated / vendored / remotion
EXCLUDES=(':!app/admin' ':!app/api' ':!**/node_modules' ':!.next' ':!remotion'
          ':!graphify-out' ':!messages/**' ':!lib/i18n/**/*.json' ':!scripts/**'
          ':!public/**' ':!supabase/**')

if [[ $ALL -eq 1 ]]; then
  FILES=$(git ls-files -- 'app/**/*.tsx' 'components/**/*.tsx' "${EXCLUDES[@]}")
else
  # Only changed .tsx in staged + unstaged + pushed-pending
  FILES=$(git diff --name-only HEAD -- 'app/**/*.tsx' 'components/**/*.tsx' "${EXCLUDES[@]}" 2>/dev/null || true)
  FILES+=$'\n'$(git diff --cached --name-only -- 'app/**/*.tsx' 'components/**/*.tsx' "${EXCLUDES[@]}" 2>/dev/null || true)
  FILES=$(echo "$FILES" | sort -u | grep -v '^$' || true)
fi

if [[ -z "$FILES" ]]; then
  echo "ℹ i18n guard — no relevant TSX files changed."
  exit 0
fi

# Patterns that hint at untranslated French visible to users.
#   1. JSX text content with accented capital + lowercase sequence > 5 chars
#   2. Common French function-word starters: Aucun, Débloque, Connexion, Besoin, Voir, Parle, Basculer
PATTERN='>[[:space:]]*([A-ZÉÀÊÎÔÛ][a-zéàêëèôöùûçï][^<>{}]{4,}|Aucun|Débloque|Connexion|Besoin|Voir|Parle|Basculer|Commencer|Choisir|Créer|Ajouter|Supprimer|Valider|Annuler|Envoyer|Rechercher|Découvrir|Détails|Tarifs)'

COUNT=0
while IFS= read -r f; do
  [[ -z "$f" ]] && continue
  [[ -f "$f" ]] || continue
  HITS=$(grep -nE "$PATTERN" "$f" 2>/dev/null || true)
  if [[ -n "$HITS" ]]; then
    FILE_COUNT=$(echo "$HITS" | wc -l)
    COUNT=$((COUNT + FILE_COUNT))
    echo "⚠ $f ($FILE_COUNT hit$([ $FILE_COUNT -gt 1 ] && echo s))"
    echo "$HITS" | head -5 | sed 's/^/    /'
  fi
done <<< "$FILES"

if [[ $COUNT -eq 0 ]]; then
  echo "✅ i18n guard — no French residue detected in changed pages."
  exit 0
fi

echo ""
echo "─────────────────────────────────────────────────────"
echo "  $COUNT potentially-untranslated French snippet(s) found."
echo "  Rule: feedback_locale_consistency_rule.md — every user-visible"
echo "  string must go through t() to stay consistent across locales."
echo "─────────────────────────────────────────────────────"

if [[ $STRICT -eq 1 ]]; then
  exit 1
fi
exit 0
