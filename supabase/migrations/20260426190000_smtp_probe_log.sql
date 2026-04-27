-- smtp_probe_log: tracks individual SMTP RCPT TO probe attempts
-- Used by email-permutator to audit probe activity + anti-abuse rate limiting

CREATE TABLE IF NOT EXISTS gapup_leads.smtp_probe_log (
  id        bigserial PRIMARY KEY,
  domain    text          NOT NULL,
  email     text          NOT NULL,
  mx_host   text,
  code      int,
  accepted  boolean       NOT NULL DEFAULT false,
  message   text,
  probed_at timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS smtp_probe_log_domain_probed
  ON gapup_leads.smtp_probe_log (domain, probed_at DESC);

CREATE INDEX IF NOT EXISTS smtp_probe_log_email
  ON gapup_leads.smtp_probe_log (email, probed_at DESC);
