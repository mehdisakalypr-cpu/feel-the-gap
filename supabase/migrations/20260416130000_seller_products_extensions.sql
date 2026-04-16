-- Extensions seller_products: views_count, quotes_requested_count, trigger updated_at, indexes,
-- bucket storage seller-products + policies (public read pour images publiées, write owner-only).

alter table public.seller_products
  add column if not exists views_count int not null default 0,
  add column if not exists quotes_requested_count int not null default 0;

create index if not exists idx_seller_products_seller_status on public.seller_products(seller_id, status);
create index if not exists idx_seller_products_origin on public.seller_products(origin_country);

create or replace function public.touch_seller_products_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists trg_seller_products_updated on public.seller_products;
create trigger trg_seller_products_updated before update on public.seller_products
  for each row execute function public.touch_seller_products_updated_at();

-- Storage bucket public (read pour produits actifs) — création idempotente
insert into storage.buckets (id, name, public)
values ('seller-products', 'seller-products', true)
on conflict (id) do nothing;

-- Policies storage: tout le monde peut lire, seller authentifié peut writer dans son préfixe seller_id/
drop policy if exists seller_products_storage_read on storage.objects;
create policy seller_products_storage_read on storage.objects for select
  using (bucket_id = 'seller-products');

drop policy if exists seller_products_storage_owner_write on storage.objects;
create policy seller_products_storage_owner_write on storage.objects for insert
  with check (
    bucket_id = 'seller-products'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists seller_products_storage_owner_update on storage.objects;
create policy seller_products_storage_owner_update on storage.objects for update
  using (
    bucket_id = 'seller-products'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists seller_products_storage_owner_delete on storage.objects;
create policy seller_products_storage_owner_delete on storage.objects for delete
  using (
    bucket_id = 'seller-products'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
