-- Feel The Gap — Commerce Pipeline (Web Builder + Entrepreneur Scout)
-- Tables pour identifier des commerces, générer leurs sites, et les onboarder

-- ── Commerce Leads (identifiés par web-scout.ts) ──────────────────────────────
create table if not exists commerce_leads (
  id              uuid primary key default gen_random_uuid(),
  -- Business info
  business_name   text not null,
  slug            text unique not null,
  country_iso     text,
  city            text,
  address         text,
  phone           text,
  email           text,
  website_url     text,              -- null = pas de site (notre cible)
  -- Categorization
  category        text not null,     -- 'restaurant', 'artisan', 'agriculture', 'retail', 'services'
  subcategory     text,
  products        text[],            -- produits/services identifiés
  -- Source
  source          text not null,     -- 'google_maps', 'linkedin', 'directory', 'manual', 'ai_generated'
  source_id       text,              -- ID dans la source (place_id Google, etc.)
  source_url      text,
  -- Scoring
  potential_score int default 50 check (potential_score between 0 and 100),
  has_website     boolean default false,
  website_quality text check (website_quality in ('none', 'poor', 'basic', 'good', 'excellent')),
  -- Pipeline status
  status          text not null default 'identified' check (status in (
    'identified',       -- trouvé par le scout
    'site_generated',   -- site vitrine créé
    'pitched',          -- email/message envoyé
    'responded',        -- a répondu
    'onboarded',        -- rejoint FTG
    'active',           -- produits listés, actif
    'declined',         -- a refusé
    'unresponsive'      -- pas de réponse après 3 tentatives
  )),
  -- Generated site
  generated_site_url text,           -- URL du site vitrine généré
  generated_site_data jsonb,         -- contenu du site (sections, textes, images)
  -- Outreach
  pitch_sent_at   timestamptz,
  pitch_template  text,              -- template utilisé
  response_at     timestamptz,
  follow_up_count int default 0,
  -- Onboarding
  user_id         uuid,              -- FK profiles si onboardé
  onboarded_at    timestamptz,
  -- Meta
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_commerce_leads_status on commerce_leads(status);
create index if not exists idx_commerce_leads_country on commerce_leads(country_iso);
create index if not exists idx_commerce_leads_category on commerce_leads(category);
create index if not exists idx_commerce_leads_source on commerce_leads(source);
create index if not exists idx_commerce_leads_score on commerce_leads(potential_score desc);

-- ── Generated Sites (contenu des sites vitrines) ─────────────────────────────
create table if not exists generated_sites (
  id              uuid primary key default gen_random_uuid(),
  lead_id         uuid references commerce_leads(id) on delete cascade,
  slug            text unique not null,
  -- Site content
  business_name   text not null,
  tagline         text,
  description     text,
  lang            text not null default 'en',
  -- Sections
  hero_title      text,
  hero_subtitle   text,
  about_text      text,
  products_json   jsonb default '[]'::jsonb,  -- [{name, description, price, image_prompt}]
  contact_info    jsonb default '{}'::jsonb,
  testimonials    jsonb default '[]'::jsonb,
  -- SEO
  meta_title      text,
  meta_description text,
  keywords        text[],
  -- Design
  color_primary   text default '#C9A84C',
  color_secondary text default '#07090F',
  template        text default 'standard',    -- 'standard', 'restaurant', 'artisan', 'agriculture'
  -- Analytics
  views_count     int default 0,
  clicks_to_ftg   int default 0,              -- clics vers FTG depuis le site
  -- Status
  status          text not null default 'draft' check (status in ('draft', 'published', 'claimed', 'archived')),
  published_at    timestamptz,
  claimed_at      timestamptz,                -- entrepreneur a revendiqué le site
  created_at      timestamptz not null default now()
);

create index if not exists idx_generated_sites_lead on generated_sites(lead_id);
create index if not exists idx_generated_sites_status on generated_sites(status);

-- ── Pitch Templates (templates email/WhatsApp par langue) ─────────────────────
create table if not exists pitch_templates (
  id              uuid primary key default gen_random_uuid(),
  lang            text not null,
  channel         text not null check (channel in ('email', 'whatsapp', 'linkedin', 'sms')),
  target          text not null check (target in ('no_website', 'poor_website', 'has_products', 'investor')),
  subject         text,                -- email subject line
  body            text not null,       -- template avec {{business_name}}, {{site_url}}, etc.
  cta_text        text,
  -- Performance
  sent_count      int default 0,
  open_rate       numeric default 0,
  response_rate   numeric default 0,
  conversion_rate numeric default 0,
  -- Meta
  status          text default 'active' check (status in ('active', 'paused', 'archived')),
  created_at      timestamptz not null default now(),
  unique(lang, channel, target)
);

-- ── Commerce Pipeline Metrics (daily tracking) ───────────────────────────────
create table if not exists commerce_pipeline_metrics (
  id              uuid primary key default gen_random_uuid(),
  date            date not null unique,
  leads_identified int default 0,
  sites_generated  int default 0,
  pitches_sent     int default 0,
  responses        int default 0,
  onboarded        int default 0,
  products_imported int default 0,
  deals_created    int default 0,
  revenue_from_pipeline numeric default 0,
  created_at      timestamptz not null default now()
);

-- RLS
alter table commerce_leads enable row level security;
create policy "commerce_leads_admin" on commerce_leads for all using (true);

alter table generated_sites enable row level security;
create policy "generated_sites_public_read" on generated_sites for select using (true);

alter table pitch_templates enable row level security;
create policy "pitch_templates_admin" on pitch_templates for all using (true);

alter table commerce_pipeline_metrics enable row level security;
create policy "pipeline_metrics_admin" on commerce_pipeline_metrics for all using (true);

comment on table commerce_leads is 'Pipeline commerces identifiés par web-scout. Status: identified → site_generated → pitched → onboarded.';
comment on table generated_sites is 'Sites vitrines générés par web-builder pour convaincre les commerces de rejoindre FTG.';
comment on table pitch_templates is 'Templates email/WhatsApp multilingues pour pitcher les commerces.';
comment on table commerce_pipeline_metrics is 'Métriques quotidiennes du pipeline commerce (leads → sites → pitches → onboarding).';
