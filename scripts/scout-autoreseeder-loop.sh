#!/usr/bin/env bash
set -u
cd /var/www/feel-the-gap
echo "[autoreseeder] start $(date -Iseconds)"
while true; do
  /root/monitor/cron-heartbeat.sh ftg-scout-autoreseeder -- bash -c '
    set -o pipefail
    out=$(npx --yes tsx agents/scout-autoreseeder.ts --apply --threshold=50 2>&1)
    items=$(echo "$out" | grep -oE "inserted=[0-9]+" | awk -F= "{s+=\$2} END {print s+0}")
    echo "$out" | tail -5
    echo "::items=$items"
  '
  sleep 300
done
