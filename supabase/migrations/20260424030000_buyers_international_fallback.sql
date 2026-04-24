-- Fallback buyers internationaux : quand aucun buyer local n'existe pour
-- (country_iso, product_slug), on sauvegarde le top 5-10 importateurs
-- internationaux pour que les prochaines visites affichent un contenu non-vide.
alter table if exists local_buyers
  add column if not exists scope text not null default 'local'
    check (scope in ('local','international'));

alter table if exists local_buyers
  add column if not exists buyer_source_country text;

comment on column local_buyers.scope is
  '''local'' = buyer basé dans country_iso (real local).
   ''international'' = top importateur international ajouté en fallback quand aucun buyer local n''existe pour country_iso+product_slug.';

comment on column local_buyers.buyer_source_country is
  'Pour scope=international, code ISO réel du pays du buyer (ex: DE, US, JP). country_iso reste le pays cible (ISO du marché scout).';

create index if not exists idx_local_buyers_scope_country_product
  on local_buyers(country_iso, scope)
  where scope = 'international';
