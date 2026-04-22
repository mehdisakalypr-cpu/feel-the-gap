-- FTG — Anti-regression trigger for countries.flag
--
-- Bug history (5+ regressions):
--   * 2026-04-17 commit 0f2d494 backfilled all flags via iso2_to_flag() but did
--     NOT fix the JS isoToFlag() helpers in agents/data-collector.ts and
--     agents/free-collector.ts which both used 0x1F1E0 instead of 0x1F1E6
--     (a -6 offset that lands BEFORE the Regional Indicator Symbol range).
--   * Each agent run re-corrupted newly upserted countries → broken flags
--     reappeared in the UI as tofu boxes ("01F 1E0", "01F 1E1", ...).
--
-- Permanent fix: a BEFORE INSERT/UPDATE trigger that always re-derives
-- `flag` from `iso2`. Application code can no longer corrupt this column,
-- regardless of which agent/script writes it.

-- Sanity-check: helper must exist (created in 20260417230000_fix_flags_iso2_helper.sql).
do $$
begin
  if not exists (select 1 from pg_proc where proname = 'iso2_to_flag') then
    raise exception 'iso2_to_flag() helper missing — apply 20260417230000_fix_flags_iso2_helper.sql first';
  end if;
end $$;

create or replace function public.enforce_flag_from_iso2() returns trigger as $$
begin
  if new.iso2 is not null and length(new.iso2) = 2 then
    new.flag := public.iso2_to_flag(new.iso2);
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists countries_flag_from_iso2 on public.countries;
create trigger countries_flag_from_iso2
  before insert or update of iso2, flag on public.countries
  for each row execute function public.enforce_flag_from_iso2();

-- One-shot backfill: repair every row whose flag does not match what the
-- helper would derive from iso2. Catches both:
--   * out-of-range corruptions (the original -6 offset bug)
--   * in-range desyncs (a row whose iso2 is RU but flag is some other valid pair)
-- The no-op write `set iso2 = iso2` fires the trigger above which recomputes flag.
update public.countries
set iso2 = iso2
where iso2 is not null
  and length(iso2) = 2
  and (flag is distinct from public.iso2_to_flag(iso2));
