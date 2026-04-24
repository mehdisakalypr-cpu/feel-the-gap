-- Replace partial unique index with full unique constraint — ON CONFLICT
-- does not accept partial predicates via Supabase client upsert().
-- Confirmed 0 rows with name IS NULL in prod entrepreneurs_directory (2026-04-24).
-- If a null name ever lands, insert will fail rather than silently dedup, which
-- is the correct behavior for this table (rows without a name have no use).

drop index if exists idx_entrepreneurs_directory_name_country;

alter table entrepreneurs_directory
  drop constraint if exists entrepreneurs_directory_name_country_uq;

alter table entrepreneurs_directory
  add constraint entrepreneurs_directory_name_country_uq unique (name, country_iso);

comment on constraint entrepreneurs_directory_name_country_uq on entrepreneurs_directory is
  'Required by /api/admin/outreach-enrichment upsert. Partial index was tried first but PostgreSQL ON CONFLICT only accepts full unique constraints via Supabase client.';
