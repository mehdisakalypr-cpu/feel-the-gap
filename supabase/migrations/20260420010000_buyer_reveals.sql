-- FTG — Buyer reveals (paywall flou + débit crédits par contact révélé)
--
-- Modèle :
--   - Quota inclus par tier (revealed_buyers_quota_per_country) : N premiers buyers
--     d'un pays sont révélés automatiquement au user (top scoring/verified-first).
--   - Au-delà du quota OU pour récupérer un buyer non-priorisé, le user dépense des
--     crédits Fill-the-Gap (5 pour buyer vérifié, 2 pour basic — calculé côté API).
--   - Les reveals sont persistés ici une fois débités, donc gratuits ad vitam pour ce user.
--
-- Compte tenu que le débit Fill-the-Gap est tracé dans ftg_fillthegap_tx, cette table
-- sert uniquement de set d'autorisation (read-side) pour griser/dégriser les fiches.

create table if not exists public.buyer_reveals (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  buyer_id      uuid not null references public.local_buyers(id) on delete cascade,
  revealed_at   timestamptz not null default now(),
  cost_credits  int not null default 0 check (cost_credits >= 0),
  unique (user_id, buyer_id)
);

create index if not exists idx_buyer_reveals_user on public.buyer_reveals(user_id, revealed_at desc);
create index if not exists idx_buyer_reveals_buyer on public.buyer_reveals(buyer_id);

-- RLS : owner only
alter table public.buyer_reveals enable row level security;

drop policy if exists buyer_reveals_select_owner on public.buyer_reveals;
create policy buyer_reveals_select_owner
  on public.buyer_reveals for select
  to authenticated
  using (user_id = auth.uid());

-- Insert is gated par l'API route (service role). On laisse aussi le owner insérer
-- ses propres reveals pour une éventuelle voie client (UI offline / future), mais
-- la voie canonique reste l'API qui débite d'abord les crédits.
drop policy if exists buyer_reveals_insert_owner on public.buyer_reveals;
create policy buyer_reveals_insert_owner
  on public.buyer_reveals for insert
  to authenticated
  with check (user_id = auth.uid());
