#!/usr/bin/env bash
set -u
cd /var/www/feel-the-gap
echo "[scout-loop-2] start $(date -Iseconds)"
sleep 30  # offset pour eviter claim race
while true; do
  npx --yes tsx agents/mass-generator.ts --max-jobs=6 --per-job=60 --apply 2>&1 | tail -20
  echo "[scout-loop-2] sleep 75s $(date -Iseconds)"
  sleep 75
done
