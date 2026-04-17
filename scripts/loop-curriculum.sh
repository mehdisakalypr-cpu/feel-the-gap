#!/usr/bin/env bash
# Loop curriculum-builder jusqu'à couverture complète des modes manquants.
set -e
cd /var/www/feel-the-gap
set -a && . ./.env.local && set +a

# Délai entre calls LLM (75s = 1/min pour respecter rate limits Gemini/Groq)
export CURRICULUM_DELAY_MS=75000

for RUN in 1 2 3 4 5; do
  echo "=== [$(date -u +%FT%TZ)] Run $RUN/5 ==="
  npx tsx agents/crop-curriculum-builder.ts 2>&1 | tail -30
  echo "=== [$(date -u +%FT%TZ)] Run $RUN done, sleep 10 min ==="
  sleep 600
done

echo "=== [$(date -u +%FT%TZ)] Curriculum loop complete ==="
