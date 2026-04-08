ALTER TABLE countries
  ADD COLUMN IF NOT EXISTS renewable_pct numeric,
  ADD COLUMN IF NOT EXISTS energy_cost_index integer;

COMMENT ON COLUMN countries.renewable_pct IS 'Share of electricity from renewables (%), OWID 2022';
COMMENT ON COLUMN countries.energy_cost_index IS 'Relative energy cost index 0-100 (lower = cheaper), derived from renewable mix and region';
