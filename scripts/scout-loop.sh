#!/usr/bin/env bash
# scout-loop.sh — LLM mass-generator drainant scout_queue en continu.
set -u
cd /var/www/feel-the-gap
echo "[scout-loop] start $(date -Iseconds)"
while true; do
  /root/monitor/cron-heartbeat.sh ftg-scout-loop -- bash -c '
    set -o pipefail
    out=$(npx --yes tsx agents/mass-generator.ts --max-jobs=8 --per-job=60 --apply 2>&1)
    items=$(echo "$out" | grep -oE "inserted=[0-9]+" | awk -F= "{s+=\$2} END {print s+0}")
    echo "$out" | tail -20
    echo "::items=$items"
  '
  echo "[scout-loop] sleep 60s $(date -Iseconds)"
  sleep 60
done
