-- Common Crawl ingest v2 — progress / resume / heartbeat tracking
-- Used by lib/leads-core/connectors/common-crawl.ts (runCommonCrawlIngestV2)

CREATE TABLE IF NOT EXISTS gapup_leads.cc_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL,
  crawl text NOT NULL,
  tld text NOT NULL,
  url_pattern text,
  last_url text,
  last_offset bigint,
  domains_seen integer DEFAULT 0,
  rows_inserted integer DEFAULT 0,
  rows_skipped integer DEFAULT 0,
  errors_count integer DEFAULT 0,
  rate_limited_count integer DEFAULT 0,
  status text DEFAULT 'running',  -- running | finished | aborted | error
  started_at timestamptz DEFAULT now(),
  heartbeat_at timestamptz DEFAULT now(),
  finished_at timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS cc_progress_crawl_tld ON gapup_leads.cc_progress(crawl, tld);
CREATE INDEX IF NOT EXISTS cc_progress_run ON gapup_leads.cc_progress(run_id);
CREATE INDEX IF NOT EXISTS cc_progress_status ON gapup_leads.cc_progress(status, heartbeat_at DESC);

-- Helper to fetch the most recent finished checkpoint for a (crawl, tld) pair
-- so a new run can resume from `last_url`.
CREATE OR REPLACE VIEW gapup_leads.cc_progress_last_checkpoint AS
SELECT DISTINCT ON (crawl, tld)
  crawl,
  tld,
  url_pattern,
  last_url,
  last_offset,
  rows_inserted,
  domains_seen,
  finished_at,
  metadata
FROM gapup_leads.cc_progress
WHERE status IN ('finished', 'aborted')
ORDER BY crawl, tld, COALESCE(finished_at, heartbeat_at) DESC;

GRANT SELECT, INSERT, UPDATE ON gapup_leads.cc_progress TO service_role;
GRANT SELECT ON gapup_leads.cc_progress_last_checkpoint TO service_role;
