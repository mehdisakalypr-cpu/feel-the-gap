-- FTG DB index audit — EXPLAIN ANALYZE sur requêtes hot-path.
-- Usage : psql postgres://... -f scripts/db-index-audit.sql
-- Ou : Supabase SQL editor → copier-coller section par section.
-- Cible : p95 < 200ms sur chaque requête, zero seq scan sur tables > 10k rows.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. pg_stat_statements — top 20 slowest queries sur 24h
-- ─────────────────────────────────────────────────────────────────────────────
select
  substring(query, 1, 80) as query_preview,
  calls,
  round(total_exec_time::numeric, 0) as total_ms,
  round(mean_exec_time::numeric, 1) as mean_ms,
  round(stddev_exec_time::numeric, 1) as stddev_ms,
  rows
from pg_stat_statements
where mean_exec_time > 100
  and query not like '%pg_%'
  and query not like '%information_schema%'
order by total_exec_time desc
limit 20;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Seq scans sur grandes tables (> 10k rows) — indicateur d'indexes manquants
-- ─────────────────────────────────────────────────────────────────────────────
select
  schemaname,
  relname as table_name,
  n_live_tup as row_count,
  seq_scan as seq_scans,
  seq_tup_read as seq_tuples_read,
  idx_scan as idx_scans,
  round(100.0 * seq_scan / nullif(seq_scan + idx_scan, 0), 1) as pct_seq_scan
from pg_stat_user_tables
where n_live_tup > 10000
  and seq_scan > 100
order by seq_tup_read desc
limit 20;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. EXPLAIN ANALYZE sur 6 requêtes hot-path FTG
-- ─────────────────────────────────────────────────────────────────────────────

-- 3.1 Marketplace list — volumes récents par pays
explain (analyze, buffers, format text)
select v.id, v.country_iso, v.product_slug, v.product_label, v.qty_kg, v.floor_price_eur, v.created_at
from production_volumes v
where v.status = 'active'
  and v.created_at > now() - interval '30 days'
order by v.created_at desc
limit 50;

-- 3.2 Marketplace list — demandes récentes
explain (analyze, buffers, format text)
select d.id, d.product_slug, d.product_label, d.qty_min_kg, d.qty_max_kg, d.ceiling_price_eur, d.created_at
from purchase_demands d
where d.status = 'active'
  and d.created_at > now() - interval '30 days'
order by d.created_at desc
limit 50;

-- 3.3 Reports pays — opportunités top-score
explain (analyze, buffers, format text)
select o.id, o.product_id, o.country_iso, o.score, o.total_usd
from opportunities o
where o.country_iso = 'CIV'
  and o.score is not null
order by o.score desc, o.total_usd desc
limit 100;

-- 3.4 Market Pulse — matview lecture (doit être < 10ms)
explain (analyze, buffers, format text)
select * from ftg_product_country_pair_agg
where origin_iso = 'CIV'
order by total_gap_usd desc
limit 50;

-- 3.5 Entrepreneurs directory — filtre par pays + email present
explain (analyze, buffers, format text)
select id, name, website, linkedin, email, phone
from entrepreneurs_directory
where country_iso = 'CIV'
  and email is not null
order by updated_at desc
limit 50;

-- 3.6 Auth — session check (critique, exécutée sur chaque requête authentifiée)
explain (analyze, buffers, format text)
select p.id, p.email, p.role, p.tier, p.is_admin
from profiles p
where p.id = '00000000-0000-0000-0000-000000000000'::uuid
limit 1;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Index bloat détection — indexes > 100MB peu utilisés (candidats REINDEX)
-- ─────────────────────────────────────────────────────────────────────────────
select
  schemaname,
  relname as table_name,
  indexrelname as index_name,
  idx_scan,
  pg_size_pretty(pg_relation_size(indexrelid)) as index_size
from pg_stat_user_indexes
where pg_relation_size(indexrelid) > 100 * 1024 * 1024
order by pg_relation_size(indexrelid) desc
limit 10;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Tables sans index primaire (anomalie)
-- ─────────────────────────────────────────────────────────────────────────────
select t.table_schema, t.table_name
from information_schema.tables t
left join information_schema.table_constraints c
  on c.table_schema = t.table_schema
  and c.table_name = t.table_name
  and c.constraint_type = 'PRIMARY KEY'
where t.table_schema = 'public'
  and t.table_type = 'BASE TABLE'
  and c.constraint_name is null
order by t.table_name;
