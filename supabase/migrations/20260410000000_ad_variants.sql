-- Feel The Gap — Ad variants generated from source videos
-- Produces multi-format variants (9:16, 1:1, 16:9, 4:5) for social networks.

do $$ begin
  if not exists (select 1 from pg_type where typname = 'ad_variant_ratio') then
    create type ad_variant_ratio as enum ('9:16', '1:1', '16:9', '4:5');
  end if;
  if not exists (select 1 from pg_type where typname = 'ad_variant_status') then
    create type ad_variant_status as enum ('queued', 'generating', 'ready', 'failed');
  end if;
end $$;

create table if not exists ad_variants (
  id              uuid primary key default gen_random_uuid(),
  product_id      uuid references products_catalog(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  source_video_url text not null,        -- original HeyGen/Arcads/upload URL
  ratio           ad_variant_ratio not null,
  platform_hint   text,                  -- 'instagram_reels' | 'tiktok' | 'yt_shorts' | 'feed' | 'yt_classic' | 'linkedin' | 'stories'
  output_url      text,                  -- Supabase Storage public URL once generated
  duration_sec    numeric,
  width           int,
  height          int,
  file_size_bytes bigint,
  status          ad_variant_status not null default 'queued',
  error_message   text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_ad_variants_product on ad_variants(product_id);
create index if not exists idx_ad_variants_user on ad_variants(user_id);
create index if not exists idx_ad_variants_status on ad_variants(status);

drop trigger if exists trg_ad_variants_updated on ad_variants;
create trigger trg_ad_variants_updated before update on ad_variants
  for each row execute function set_updated_at();

alter table ad_variants enable row level security;

drop policy if exists "ad_variants_owner" on ad_variants;
create policy "ad_variants_owner" on ad_variants
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

comment on table ad_variants is 'Variantes multi-format générées via FFmpeg à partir d''une vidéo source (HeyGen/Arcads/upload). Ratios 9:16 (Reels/Stories/Shorts/TikTok), 1:1 (Feed), 16:9 (YouTube/LinkedIn), 4:5 (Feed alt).';
