-- Unique index on (name, country_iso) to enable upsert from admin outreach enrichment.
-- Partial index: skips rows where name is null (shouldn't happen but defensive).
-- Confirmed zero duplicate groups via admin audit before creating this migration.

create unique index if not exists idx_entrepreneurs_directory_name_country
  on entrepreneurs_directory (name, country_iso)
  where name is not null;

comment on index idx_entrepreneurs_directory_name_country is
  'Upsert target for /api/admin/outreach-enrichment — matches outreach-engine ilike(name, country) lookup shape.';
