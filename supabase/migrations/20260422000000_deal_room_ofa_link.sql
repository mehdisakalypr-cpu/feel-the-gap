-- © 2025-2026 Feel The Gap — Deal Room → OFA standalone migration (phase 2)
-- 1-click handoff: une deal room publiée devient un site OFA indépendant (generated_sites row).
-- La deal room d'origine passe en status 'migrated_to_standalone' et garde un pointeur vers le site OFA.

alter table public.deal_rooms
  add column if not exists generated_site_id uuid references public.generated_sites(id) on delete set null,
  add column if not exists migrated_at timestamptz;

create index if not exists idx_deal_rooms_generated_site
  on public.deal_rooms(generated_site_id)
  where generated_site_id is not null;

comment on column public.deal_rooms.generated_site_id is
  'OFA generated_sites.id créé lors de la migration 1-click vers site standalone (phase 2)';
comment on column public.deal_rooms.migrated_at is
  'Timestamp de la bascule vers OFA standalone (status → migrated_to_standalone)';
