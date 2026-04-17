#!/usr/bin/env bash
# Loop batch-enriched-plans sur tous les pays (par batches), survit aux crashes.
# Lancé via pm2 pour persister après disconnect terminal.
set -e
cd /var/www/feel-the-gap
set -a && . ./.env.local && set +a

# ISO codes of countries with opportunities (top producers / emerging markets)
BATCH1="CIV,SEN,MAR,VNM,COL,GIN,GHA,NGA,ETH,TZA"
BATCH2="MOZ,BFA,BEN,EGY,IDN,IND,KEN,UGA,CMR,TCD"
BATCH3="MLI,MDG,ZMB,ZWE,AGO,MRT,NER,DZA,TUN,LBY"

for BATCH in "$BATCH1" "$BATCH2" "$BATCH3"; do
  echo "=== [$(date -u +%FT%TZ)] Running batch: $BATCH ==="
  npx tsx agents/batch-enriched-plans.ts --iso "$BATCH" 2>&1 | tail -40
  echo "=== [$(date -u +%FT%TZ)] Sleeping 5 min between batches ==="
  sleep 300
done

echo "=== [$(date -u +%FT%TZ)] All batches done ==="
