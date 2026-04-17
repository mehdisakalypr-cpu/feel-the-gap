-- FTG — Fix corrupted flags + `iso2_to_flag` helper
-- Tous les drapeaux de `countries` étaient décalés de -6 sur les regional indicators
-- (ex: CIV stocké "BC" au lieu de "CI" → 🇨🇮). Backfill depuis `iso2`.

create or replace function public.iso2_to_flag(iso2 text) returns text as $$
begin
  if iso2 is null or length(iso2) <> 2 then return null; end if;
  return chr(127397 + ascii(upper(substring(iso2 from 1 for 1)))) ||
         chr(127397 + ascii(upper(substring(iso2 from 2 for 1))));
end;
$$ language plpgsql immutable;

update public.countries
set flag = public.iso2_to_flag(iso2)
where iso2 is not null and length(iso2) = 2;
