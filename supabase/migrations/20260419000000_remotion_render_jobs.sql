-- Remotion render queue — VPS daemon dépile et pushes MP4 vers Supabase Storage.
-- Usage : INSERT via app ou agent, daemon VPS poll status='pending' order by priority DESC.

CREATE TABLE IF NOT EXISTS remotion_render_jobs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  composition_id  text NOT NULL,                    -- ex. 'SovereignPitch', 'OpportunitySpotlight'
  props           jsonb NOT NULL DEFAULT '{}'::jsonb,
  status          text NOT NULL DEFAULT 'pending',  -- pending | running | done | failed
  priority        int  NOT NULL DEFAULT 0,          -- higher = dépilé en premier
  output_url      text,                             -- Supabase public URL après upload
  duration_s      numeric,                          -- durée render côté VPS
  size_bytes      bigint,
  error           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  started_at      timestamptz,
  finished_at     timestamptz,
  requested_by    uuid,                             -- user_id (nullable pour cron système)
  metadata        jsonb DEFAULT '{}'::jsonb         -- country_iso, product_slug, campaign_id, etc.
);

CREATE INDEX IF NOT EXISTS idx_remotion_jobs_pending
  ON remotion_render_jobs (priority DESC, created_at ASC)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_remotion_jobs_status
  ON remotion_render_jobs (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_remotion_jobs_requested_by
  ON remotion_render_jobs (requested_by, created_at DESC);

-- RLS : owner-only sur SELECT, service role pour tout le reste
ALTER TABLE remotion_render_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS remotion_jobs_owner_select ON remotion_render_jobs;
CREATE POLICY remotion_jobs_owner_select ON remotion_render_jobs
  FOR SELECT USING (
    requested_by = auth.uid()
    OR (SELECT is_admin FROM profiles WHERE id = auth.uid()) = true
  );
