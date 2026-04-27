-- EU directory scraper probe log
-- Tracks which companies have been probed on which directory to avoid duplicate requests

create table if not exists gapup_leads.directory_probe_log (
  id bigserial primary key,
  company_id uuid references gapup_leads.lv_companies(id) on delete cascade,
  directory text not null,
  found bool not null default false,
  hits_count int not null default 0,
  probed_at timestamptz not null default now(),
  unique (company_id, directory)
);

create index if not exists directory_probe_log_company_id_idx
  on gapup_leads.directory_probe_log (company_id);

create index if not exists directory_probe_log_directory_idx
  on gapup_leads.directory_probe_log (directory);

comment on table gapup_leads.directory_probe_log is
  'Anti-duplicate tracker: 1 row per (company, directory). Prevents re-querying already probed companies.';
