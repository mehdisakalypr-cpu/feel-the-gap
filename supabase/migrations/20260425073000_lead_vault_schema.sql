-- Lead Vault — brique partagée multi-projets
-- Ingestion centralisée Sirene/CH/OSM/CommonCrawl/GMaps
-- Consumers : FTG, OFA, CC, Estate, Shift, futurs LLCs (Saints)

CREATE SCHEMA IF NOT EXISTS gapup_leads;

-- ─── lv_companies ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gapup_leads.lv_companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Identifiants normalisés (un seul peut suffire à dédupliquer)
  siren text UNIQUE,
  crn text UNIQUE,
  eori text UNIQUE,
  vat_number text,
  duns text,
  -- Métadonnées de base
  legal_name text NOT NULL,
  trade_name text,
  domain text,
  country_iso text NOT NULL,
  region text,
  city text,
  postal_code text,
  address text,
  -- Classification industrie
  nace_code text,
  sic_code text,
  industry_tags text[] DEFAULT '{}',
  is_import_export boolean DEFAULT false,
  size_bucket text,
  employees_estimate int,
  revenue_estimate_eur bigint,
  founded_year int,
  status text DEFAULT 'active',
  -- Provenance
  primary_source text NOT NULL,
  source_ids jsonb DEFAULT '{}'::jsonb,
  enrichment_score int DEFAULT 0,
  last_verified_at timestamptz,
  -- Audit
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lv_companies_country_nace ON gapup_leads.lv_companies(country_iso, nace_code) WHERE is_import_export = true;
CREATE INDEX IF NOT EXISTS idx_lv_companies_domain ON gapup_leads.lv_companies(domain) WHERE domain IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lv_companies_industry_tags ON gapup_leads.lv_companies USING GIN (industry_tags);
CREATE INDEX IF NOT EXISTS idx_lv_companies_country_size ON gapup_leads.lv_companies(country_iso, size_bucket);

-- ─── lv_persons ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gapup_leads.lv_persons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES gapup_leads.lv_companies(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  first_name text,
  last_name text,
  role text,
  role_seniority text,
  decision_maker_score int DEFAULT 0,
  linkedin_url text,
  primary_source text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lv_persons_company ON gapup_leads.lv_persons(company_id);
CREATE INDEX IF NOT EXISTS idx_lv_persons_role_seniority ON gapup_leads.lv_persons(role_seniority) WHERE decision_maker_score >= 50;

-- ─── lv_contacts ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gapup_leads.lv_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid REFERENCES gapup_leads.lv_persons(id) ON DELETE CASCADE,
  company_id uuid REFERENCES gapup_leads.lv_companies(id) ON DELETE CASCADE,
  contact_type text NOT NULL CHECK (contact_type IN ('email','phone','linkedin','other')),
  contact_value text NOT NULL,
  is_personal boolean DEFAULT false,
  verify_status text DEFAULT 'unverified',
  verify_provider text,
  verify_score int,
  last_verified_at timestamptz,
  primary_source text NOT NULL,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT lv_contacts_value_type_unique UNIQUE (contact_value, contact_type)
);

CREATE INDEX IF NOT EXISTS idx_lv_contacts_company ON gapup_leads.lv_contacts(company_id);
CREATE INDEX IF NOT EXISTS idx_lv_contacts_person ON gapup_leads.lv_contacts(person_id);
CREATE INDEX IF NOT EXISTS idx_lv_contacts_verify ON gapup_leads.lv_contacts(verify_status);

-- ─── lv_sources ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gapup_leads.lv_sources (
  id text PRIMARY KEY,
  name text NOT NULL,
  license text NOT NULL,
  base_url text,
  rate_limit_per_min int,
  last_full_pull_at timestamptz,
  last_delta_pull_at timestamptz,
  total_records bigint DEFAULT 0,
  status text DEFAULT 'active',
  enabled boolean DEFAULT true,
  notes text
);

INSERT INTO gapup_leads.lv_sources (id, name, license, base_url, status, enabled, notes) VALUES
  ('sirene', 'INSEE Sirene FR', 'CC-BY 2.0', 'https://www.data.gouv.fr/datasets/base-sirene-des-entreprises-et-de-leurs-etablissements-siren-siret', 'active', true, 'Bulk CSV monthly stock + daily delta'),
  ('companies_house', 'Companies House UK', 'OGL v3.0', 'https://download.companieshouse.gov.uk/en_output.html', 'active', true, 'Monthly bulk CSV ~5M companies'),
  ('osm', 'OpenStreetMap (Geofabrik)', 'ODbL', 'https://download.geofabrik.de/', 'active', true, 'Quarterly PBF dump, Overpass for office/industrial'),
  ('common_crawl', 'Common Crawl', 'fair-use', 'https://commoncrawl.org/', 'active', true, 'Quarterly parse pass for mailto + schema.org Organization'),
  ('gmaps', 'Google Maps (gosom scraper)', 'public-data', 'https://github.com/gosom/google-maps-scraper', 'active', true, 'Top cities I/E, residential proxies'),
  ('mailscout', 'Mailscout SMTP verify', 'MIT', 'https://github.com/batuhanaky/mailscout', 'active', true, 'Verify pipeline, port 25 SMTP'),
  ('hunter', 'Hunter.io', 'commercial', 'https://hunter.io/', 'active', false, 'Premium verify, disabled until Scenario B trigger'),
  ('apollo', 'Apollo.io', 'commercial', 'https://apollo.io/', 'inactive', false, 'Decommissioned 2026-04-25 — replaced by stack legal OSS'),
  ('phantombuster', 'PhantomBuster LinkedIn', 'commercial', 'https://phantombuster.com/', 'active', false, 'Optional Scenario B+, not enabled by default')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  license = EXCLUDED.license,
  base_url = EXCLUDED.base_url,
  status = EXCLUDED.status,
  notes = EXCLUDED.notes;

-- ─── lv_project_filters ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gapup_leads.lv_project_filters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project text NOT NULL,
  name text NOT NULL,
  sql_filter text NOT NULL,
  target_table text,
  is_active boolean DEFAULT true,
  last_sync_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(project, name)
);

INSERT INTO gapup_leads.lv_project_filters (project, name, sql_filter, target_table) VALUES
  ('ftg', 'import-export-eu', 'is_import_export = true AND country_iso IN (''FRA'',''DEU'',''ESP'',''ITA'',''GBR'',''NLD'',''BEL'',''POL'') AND nace_code LIKE ''46%''', 'public.commerce_leads'),
  ('ftg', 'import-export-global', 'is_import_export = true', 'public.commerce_leads'),
  ('ofa', 'smb-website-needed', 'size_bucket IN (''micro'',''small'') AND domain IS NULL', 'public.commerce_leads'),
  ('cc', 'admin-full-readonly', 'TRUE', NULL),
  ('estate', 'hospitality-chains', 'nace_code LIKE ''55%'' AND size_bucket IN (''medium'',''large'')', 'public.estate_leads')
ON CONFLICT (project, name) DO UPDATE SET
  sql_filter = EXCLUDED.sql_filter,
  target_table = EXCLUDED.target_table,
  updated_at = now();

-- ─── lv_sync_log ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gapup_leads.lv_sync_log (
  id bigserial PRIMARY KEY,
  source_id text REFERENCES gapup_leads.lv_sources(id),
  project text,
  operation text NOT NULL,
  rows_processed int DEFAULT 0,
  rows_inserted int DEFAULT 0,
  rows_updated int DEFAULT 0,
  rows_skipped int DEFAULT 0,
  error text,
  duration_ms int,
  started_at timestamptz DEFAULT now(),
  finished_at timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_lv_sync_log_source ON gapup_leads.lv_sync_log(source_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_lv_sync_log_project ON gapup_leads.lv_sync_log(project, started_at DESC) WHERE project IS NOT NULL;

-- ─── Trigger updated_at ────────────────────────────────────────
CREATE OR REPLACE FUNCTION gapup_leads.set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS lv_companies_updated_at ON gapup_leads.lv_companies;
CREATE TRIGGER lv_companies_updated_at BEFORE UPDATE ON gapup_leads.lv_companies
  FOR EACH ROW EXECUTE FUNCTION gapup_leads.set_updated_at();

DROP TRIGGER IF EXISTS lv_persons_updated_at ON gapup_leads.lv_persons;
CREATE TRIGGER lv_persons_updated_at BEFORE UPDATE ON gapup_leads.lv_persons
  FOR EACH ROW EXECUTE FUNCTION gapup_leads.set_updated_at();

DROP TRIGGER IF EXISTS lv_project_filters_updated_at ON gapup_leads.lv_project_filters;
CREATE TRIGGER lv_project_filters_updated_at BEFORE UPDATE ON gapup_leads.lv_project_filters
  FOR EACH ROW EXECUTE FUNCTION gapup_leads.set_updated_at();
