#!/usr/bin/env bash
# scout-loop.sh — LLM mass-generator drainant scout_queue en continu.
set -u
cd /var/www/feel-the-gap
echo "[scout-loop] start $(date -Iseconds)"
while true; do
  npx --yes tsx agents/mass-generator.ts --max-jobs=8 --per-job=60 --apply 2>&1 | tail -20
  echo "[scout-loop] sleep 60s $(date -Iseconds)"
  sleep 60
done
