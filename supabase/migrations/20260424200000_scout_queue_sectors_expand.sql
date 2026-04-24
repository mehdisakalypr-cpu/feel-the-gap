-- Expand scout_queue.sector enum to accept textile, food_processing, artisan,
-- aquaculture, technology, logistics, renewable_energy (aligns with entrepreneur-scout SECTORS).
alter table scout_queue drop constraint if exists scout_queue_sector_check;
alter table scout_queue add constraint scout_queue_sector_check check (
  sector in (
    'agriculture','energy','materials','manufactured','resources','services',
    'food_processing','artisan','aquaculture','technology','textile','logistics','renewable_energy'
  )
);
