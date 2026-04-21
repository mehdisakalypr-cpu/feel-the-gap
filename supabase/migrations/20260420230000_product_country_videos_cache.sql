-- Dedup videos cache keyed on (product_id, country_iso) — language-agnostic.
-- Replaces per-opportunity caching: videos are intrinsically tied to the commodity
-- and the country, not to individual market opportunities. Subtitle translation
-- is delegated to the YouTube player via cc_lang_pref embed param at render time.
--
-- Dedup factor: ~25× fewer generations vs the old (opp × country × lang) scheme.

create table if not exists ftg_product_country_videos (
  product_id text not null references products(id) on delete cascade,
  country_iso text not null,

  -- Rock Lee v2 payload: { videos: Video[], generated_queries: string[], total_searched: number }
  -- Each video in the array has: videoId, title, channelTitle, description, publishedAt,
  -- durationSeconds, viewCount, likeCount, commentCount, thumbnailUrl, hasCaptions (boolean).
  payload jsonb,

  status text not null default 'pending' check (status in ('pending','generating','ready','stale','failed')),
  generated_at timestamptz,
  stale_at timestamptz,
  cost_eur numeric(10,4) default 0,
  attempt_count int default 0,
  last_error text,
  agent_version text default 'rock-lee-v2',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  primary key (product_id, country_iso)
);

create index if not exists idx_ftg_pcv_status on ftg_product_country_videos (status) where status != 'ready';
create index if not exists idx_ftg_pcv_ready_country on ftg_product_country_videos (country_iso) where status = 'ready';

-- updated_at autotouch
create or replace function ftg_pcv_touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
drop trigger if exists trg_ftg_pcv_touch on ftg_product_country_videos;
create trigger trg_ftg_pcv_touch before update on ftg_product_country_videos
for each row execute function ftg_pcv_touch_updated_at();

-- RLS: public SELECT only when ready. Writes via service_role only.
alter table ftg_product_country_videos enable row level security;

drop policy if exists "public read ready videos" on ftg_product_country_videos;
create policy "public read ready videos" on ftg_product_country_videos
  for select using (status = 'ready');

-- Queue helper: returns distinct (product_id, country_iso) pairs from opportunities
-- that are not yet in the cache. Used by the enqueue-missing admin action.
create or replace function ftg_missing_product_country_pairs(limit_count int default 500)
returns table(product_id text, country_iso text) language sql stable as $$
  select distinct o.product_id, o.country_iso
    from opportunities o
    left join ftg_product_country_videos v
      on v.product_id = o.product_id and v.country_iso = o.country_iso
   where v.product_id is null
   limit limit_count;
$$;

comment on table ftg_product_country_videos is
  'Rock Lee v2 cache keyed on (product_id, country_iso). Videos are language-agnostic; CC subtitles handle translation at player render time.';
