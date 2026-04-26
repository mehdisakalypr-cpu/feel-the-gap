#!/usr/bin/env bash
set -u
cd /var/www/feel-the-gap
echo "[scout-loop-2] start $(date -Iseconds)"
sleep 30  # offset pour eviter claim race
while true; do
  /root/monitor/cron-heartbeat.sh ftg-scout-loop-2 -- bash -c '
    set -o pipefail
    out=$(npx --yes tsx agents/mass-generator.ts --max-jobs=6 --per-job=60 --apply 2>&1)
    items=$(echo "$out" | grep -oE "inserted=[0-9]+" | awk -F= "{s+=\$2} END {print s+0}")
    echo "$out" | tail -20
    echo "::items=$items"
  '
  echo "[scout-loop-2] sleep 75s $(date -Iseconds)"
  sleep 75
done
