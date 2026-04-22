-- FTG — Add `lang` column to every table that stores LLM-generated user-visible text.
--
-- Context (feedback_locale_consistency_rule.md):
--   A user on /en must never see French LLM-generated text and vice versa.
--   Tables that store cached LLM output without a `lang` column cannot serve
--   locale-appropriate content — they just return whatever was generated first.
--
--   7 tables already have `lang` (seo_pages, social_posts, ftg_opportunity_content,
--   ftg_product_country_content, email_templates, ftg_ad_variants, ai_influencer_personas).
--   This migration brings the remaining 13 tables up to the same standard.
--
-- Strategy:
--   * Add `lang text not null default 'fr'` with CHECK (lang in ('fr','en','es')).
--   * Backfill existing rows implicitly via the default (current content IS French).
--   * NO unique (entity, lang) constraint here — that's a V2 refactor to allow
--     per-locale cached copies; doing it now risks breaking existing selects.
--   * Callers will start passing `lang` on new inserts; read paths stay
--     backward-compatible (implicit 'fr' filter until call sites opt in).

-- 1. CRITICAL user-facing tables
alter table if exists public.reports
  add column if not exists lang text not null default 'fr';
alter table if exists public.reports
  drop constraint if exists reports_lang_check;
alter table if exists public.reports
  add constraint reports_lang_check check (lang in ('fr','en','es'));

alter table if exists public.opportunities
  add column if not exists lang text not null default 'fr';
alter table if exists public.opportunities
  drop constraint if exists opportunities_lang_check;
alter table if exists public.opportunities
  add constraint opportunities_lang_check check (lang in ('fr','en','es'));

alter table if exists public.business_plans
  add column if not exists lang text not null default 'fr';
alter table if exists public.business_plans
  drop constraint if exists business_plans_lang_check;
alter table if exists public.business_plans
  add constraint business_plans_lang_check check (lang in ('fr','en','es'));

alter table if exists public.country_studies
  add column if not exists lang text not null default 'fr';
alter table if exists public.country_studies
  drop constraint if exists country_studies_lang_check;
alter table if exists public.country_studies
  add constraint country_studies_lang_check check (lang in ('fr','en','es'));

alter table if exists public.cached_business_plans
  add column if not exists lang text not null default 'fr';
alter table if exists public.cached_business_plans
  drop constraint if exists cached_business_plans_lang_check;
alter table if exists public.cached_business_plans
  add constraint cached_business_plans_lang_check check (lang in ('fr','en','es'));

-- 2. HIGH user-facing tables
alter table if exists public.deal_rooms
  add column if not exists lang text not null default 'fr';
alter table if exists public.deal_rooms
  drop constraint if exists deal_rooms_lang_check;
alter table if exists public.deal_rooms
  add constraint deal_rooms_lang_check check (lang in ('fr','en','es'));

alter table if exists public.entrepreneur_demos
  add column if not exists lang text not null default 'fr';
alter table if exists public.entrepreneur_demos
  drop constraint if exists entrepreneur_demos_lang_check;
alter table if exists public.entrepreneur_demos
  add constraint entrepreneur_demos_lang_check check (lang in ('fr','en','es'));

alter table if exists public.market_trends
  add column if not exists lang text not null default 'fr';
alter table if exists public.market_trends
  drop constraint if exists market_trends_lang_check;
alter table if exists public.market_trends
  add constraint market_trends_lang_check check (lang in ('fr','en','es'));

alter table if exists public.journey_section_summaries
  add column if not exists lang text not null default 'fr';
alter table if exists public.journey_section_summaries
  drop constraint if exists journey_section_summaries_lang_check;
alter table if exists public.journey_section_summaries
  add constraint journey_section_summaries_lang_check check (lang in ('fr','en','es'));

-- 3. MEDIUM tables (rarely surfaced raw but still contain LLM text)
alter table if exists public.production_methods
  add column if not exists lang text not null default 'fr';
alter table if exists public.production_methods
  drop constraint if exists production_methods_lang_check;
alter table if exists public.production_methods
  add constraint production_methods_lang_check check (lang in ('fr','en','es'));

alter table if exists public.production_cost_benchmarks
  add column if not exists lang text not null default 'fr';
alter table if exists public.production_cost_benchmarks
  drop constraint if exists production_cost_benchmarks_lang_check;
alter table if exists public.production_cost_benchmarks
  add constraint production_cost_benchmarks_lang_check check (lang in ('fr','en','es'));

alter table if exists public.logistics_corridors
  add column if not exists lang text not null default 'fr';
alter table if exists public.logistics_corridors
  drop constraint if exists logistics_corridors_lang_check;
alter table if exists public.logistics_corridors
  add constraint logistics_corridors_lang_check check (lang in ('fr','en','es'));

-- 4. Index for the hottest read paths so per-locale selects stay fast
create index if not exists idx_reports_lang on public.reports(lang);
create index if not exists idx_opportunities_country_lang on public.opportunities(country_iso, lang);
create index if not exists idx_business_plans_lang on public.business_plans(lang);
create index if not exists idx_country_studies_country_lang on public.country_studies(country_iso, lang);
create index if not exists idx_deal_rooms_lang on public.deal_rooms(lang);
create index if not exists idx_entrepreneur_demos_lang on public.entrepreneur_demos(lang);
