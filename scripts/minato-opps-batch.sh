#!/usr/bin/env bash
# Minato — scoring opps en boucle jusqu'à cible 29000.
# Argument: batch number (1..7) — 30 pays par batch, 7 batches = 210 pays
set -e
BATCH=${1:-1}
cd /var/www/feel-the-gap
set -a && . ./.env.local && set +a

for LOOP in $(seq 1 20); do
  echo "=== [$(date -u +%FT%TZ)] Batch $BATCH — Loop $LOOP/20 ==="
  npx tsx agents/opportunity-matrix.ts --batch=$BATCH --batch-size=30 --products=150 --delay=300 2>&1 | tail -60
  echo "=== [$(date -u +%FT%TZ)] Sleep 60s ==="
  sleep 60
done

echo "=== [$(date -u +%FT%TZ)] Batch $BATCH done ==="
