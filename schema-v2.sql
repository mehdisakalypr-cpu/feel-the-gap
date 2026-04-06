-- Feel The Gap — Schema v2
-- Run this AFTER schema.sql in Supabase SQL editor

-- ── TRACKING EVENTS ───────────────────────────────────────────────────────────
create table if not exists tracking_events (
  id           uuid primary key default uuid_generate_v4(),
  session_id   text not null,
  user_id      uuid references profiles(id) on delete set null,
  event_type   text not null,   -- 'page_view'|'filter'|'country_click'|'search'|'plan_view'|'upgrade_click'|'signup'
  event_data   jsonb,           -- { country:'MAR', product:'wheat', filter:'agriculture', ... }
  page         text,
  created_at   timestamptz default now()
);

create index idx_te_session   on tracking_events(session_id);
create index idx_te_user      on tracking_events(user_id);
create index idx_te_type      on tracking_events(event_type);
create index idx_te_created   on tracking_events(created_at desc);
create index idx_te_country   on tracking_events((event_data->>'country'));

-- ── USER SESSIONS ─────────────────────────────────────────────────────────────
create table if not exists user_sessions (
  id           text primary key,  -- client-generated uuid
  user_id      uuid references profiles(id) on delete set null,
  ip_hash      text,
  user_agent   text,
  referrer     text,
  started_at   timestamptz default now(),
  last_seen_at timestamptz default now(),
  page_count   int default 1,
  events_count int default 0,
  country_iso  text,  -- visitor's country (from IP, optional)
  converted    boolean default false
);

create index idx_sessions_user    on user_sessions(user_id);
create index idx_sessions_started on user_sessions(started_at desc);

-- ── SAVED SEARCHES ────────────────────────────────────────────────────────────
create table if not exists saved_searches (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid not null references profiles(id) on delete cascade,
  name         text not null,
  filters      jsonb not null,  -- { category, subcategory, region, country_iso, ... }
  last_result  jsonb,           -- cached last result summary
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

create index idx_ss_user on saved_searches(user_id);

-- ── CMS PAGES (editable content) ─────────────────────────────────────────────
create table if not exists cms_pages (
  id           text primary key,  -- slug: 'home', 'about', 'pricing', 'demo'
  title        text not null,
  sections     jsonb not null default '[]',  -- array of { id, type, content, order }
  published    boolean default true,
  updated_at   timestamptz default now(),
  updated_by   text
);

-- Default CMS content
insert into cms_pages (id, title, sections) values
('home', 'Home', '[
  {"id":"hero_title","type":"text","label":"Hero Title","content":"Identify global trade gaps.\nBuild your next business."},
  {"id":"hero_subtitle","type":"text","label":"Hero Subtitle","content":"Real-time import/export intelligence for 189 countries. AI-powered business plans in 3 strategies."},
  {"id":"hero_video","type":"video","label":"Demo Video","content":""},
  {"id":"how_it_works","type":"richtext","label":"How It Works","content":"<p>Feel The Gap scans global trade flows to identify where demand exceeds supply...</p>"},
  {"id":"cta_text","type":"text","label":"CTA Button Text","content":"Start for Free"}
]'),
('demo', 'Demo Page', '[
  {"id":"demo_title","type":"text","label":"Demo Title","content":"See Feel The Gap in action"},
  {"id":"demo_intro","type":"text","label":"Intro Text","content":"Explore real trade data for 189 countries. Click any marker to discover business opportunities."},
  {"id":"demo_video","type":"video","label":"Full Demo Video","content":""}
]')
on conflict (id) do nothing;

-- ── CMS MEDIA ────────────────────────────────────────────────────────────────
create table if not exists cms_media (
  id           uuid primary key default uuid_generate_v4(),
  type         text not null check (type in ('video_url','video_upload','image')),
  url          text not null,
  title        text,
  description  text,
  thumbnail    text,
  duration_s   int,
  created_at   timestamptz default now()
);

-- ── RLS ───────────────────────────────────────────────────────────────────────
alter table tracking_events enable row level security;
alter table user_sessions   enable row level security;
alter table saved_searches  enable row level security;
alter table cms_pages       enable row level security;
alter table cms_media       enable row level security;

-- Tracking events: insert from anon (for non-auth visitors too)
create policy "anon_insert_events" on tracking_events for insert using (true);
create policy "own_read_events"    on tracking_events for select using (auth.uid() = user_id);

-- Sessions: insert from anon
create policy "anon_insert_sessions" on user_sessions for insert using (true);
create policy "anon_update_sessions" on user_sessions for update using (true);

-- Saved searches: own rows only
create policy "own_saved_searches" on saved_searches for all using (auth.uid() = user_id);

-- CMS: public read, service role write
create policy "public_read_cms"   on cms_pages for select using (published = true);
create policy "public_read_media" on cms_media for select using (true);

-- ── ANALYTICS VIEWS (for admin dashboard) ─────────────────────────────────────
create or replace view admin_analytics as
select
  date_trunc('day', te.created_at) as day,
  te.event_type,
  te.event_data->>'country' as country,
  te.event_data->>'category' as category,
  count(*) as event_count,
  count(distinct te.session_id) as unique_sessions
from tracking_events te
group by 1,2,3,4;

create or replace view admin_top_searches as
select
  te.event_data->>'country' as country,
  te.event_data->>'category' as category,
  te.event_data->>'query' as query,
  count(*) as search_count,
  count(distinct te.session_id) as unique_users
from tracking_events te
where te.event_type in ('search', 'country_click', 'filter')
  and te.created_at > now() - interval '30 days'
group by 1,2,3
order by search_count desc
limit 100;

create or replace view admin_conversion_funnel as
select
  count(distinct case when event_type='page_view'     then session_id end) as total_visitors,
  count(distinct case when event_type='country_click'  then session_id end) as clicked_country,
  count(distinct case when event_type='plan_view'      then session_id end) as viewed_plan,
  count(distinct case when event_type='upgrade_click'  then session_id end) as clicked_upgrade,
  count(distinct case when event_type='signup'         then session_id end) as signed_up
from tracking_events
where created_at > now() - interval '30 days';
