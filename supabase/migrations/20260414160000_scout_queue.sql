-- Feel The Gap — Scout queue
-- File d'attente de jobs scout par (country_iso, sector, product_slug).
-- Un runner (agents/scout-queue-runner.ts) dépile les jobs pending et lance
-- prospect-orchestrator pour chaque triplet. Permet l'autoscale géographique
-- sans forker un cron par pays.

create table if not exists scout_queue (
  id            uuid primary key default gen_random_uuid(),
  country_iso   text not null,
  sector        text not null check (sector in ('agriculture','energy','materials','manufactured','resources','services')),
  product_slug  text,
  priority      int  not null default 5,         -- 1 = high, 10 = low
  status        text not null default 'pending'  -- pending | running | done | failed
                check (status in ('pending','running','done','failed')),
  max_results   int  not null default 30,
  last_error    text,
  created_at    timestamptz not null default now(),
  started_at    timestamptz,
  finished_at   timestamptz,
  source        text default 'manual'            -- manual | autoscale | backfill
);

create index if not exists idx_scout_queue_status_priority
  on scout_queue (status, priority, created_at)
  where status = 'pending';

create index if not exists idx_scout_queue_country
  on scout_queue (country_iso, status);

-- Dedup logique : 1 seul job pending actif par (country, sector, product)
create unique index if not exists uniq_scout_queue_pending_triplet
  on scout_queue (country_iso, sector, coalesce(product_slug, ''))
  where status in ('pending','running');
