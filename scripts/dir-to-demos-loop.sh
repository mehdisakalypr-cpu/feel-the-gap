#!/usr/bin/env bash
set -u
cd /var/www/feel-the-gap
echo "[dir-to-demos] start $(date -Iseconds)"
while true; do
  npx --yes tsx agents/directory-to-demos.ts --max=40 --apply 2>&1 | tail -5
  sleep 120
done
