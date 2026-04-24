#!/usr/bin/env bash
set -u
cd /var/www/feel-the-gap
echo "[autoreseeder] start $(date -Iseconds)"
while true; do
  npx --yes tsx agents/scout-autoreseeder.ts --apply --threshold=50 2>&1 | tail -5
  sleep 300
done
