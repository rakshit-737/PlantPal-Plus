-- Seed: species catalogue (BR-PLT-01). Base intervals are for the reference
-- condition the factor tables assume: BRIGHT_INDIRECT light, ceramic-glazed pot,
-- standard potting soil. min/max are the species safe bounds the algorithm
-- clamps to. Stable ids so a re-seed upserts rather than duplicating.

begin;

insert into species (id, scientific_name, common_name, base_interval_days, min_interval_days, max_interval_days, default_light, default_soil, care_notes) values
  ('a0000000-0000-4000-8000-000000000001', 'Monstera deliciosa',        'Monstera',            7,  4, 14, 'BRIGHT_INDIRECT', 'STANDARD_POTTING', 'Let the top 2–3 cm dry out. Loves humidity and a moss pole.'),
  ('a0000000-0000-4000-8000-000000000002', 'Epipremnum aureum',         'Pothos',              7,  4, 14, 'MEDIUM',          'STANDARD_POTTING', 'Very forgiving. Droops visibly when thirsty, then perks up fast.'),
  ('a0000000-0000-4000-8000-000000000003', 'Sansevieria trifasciata',   'Snake Plant',        14,  7, 30, 'LOW',             'CACTUS_SUCCULENT', 'Drought-tolerant. Overwatering rots the rhizome — err dry.'),
  ('a0000000-0000-4000-8000-000000000004', 'Ficus lyrata',              'Fiddle Leaf Fig',     7,  5, 12, 'BRIGHT_INDIRECT', 'STANDARD_POTTING', 'Hates being moved and hates soggy roots. Consistency wins.'),
  ('a0000000-0000-4000-8000-000000000005', 'Zamioculcas zamiifolia',    'ZZ Plant',           17, 10, 30, 'LOW',             'CACTUS_SUCCULENT', 'Rhizomes store water. When in doubt, do not water.'),
  ('a0000000-0000-4000-8000-000000000006', 'Spathiphyllum wallisii',    'Peace Lily',          5,  3,  9, 'MEDIUM',          'STANDARD_POTTING', 'Tells you when thirsty by drooping. Sensitive to tap-water fluoride.'),
  ('a0000000-0000-4000-8000-000000000007', 'Chlorophytum comosum',      'Spider Plant',        7,  4, 12, 'MEDIUM',          'STANDARD_POTTING', 'Produces pups on runners. Brown tips usually mean fluoride.'),
  ('a0000000-0000-4000-8000-000000000008', 'Aloe barbadensis',          'Aloe Vera',          14,  9, 28, 'DIRECT_SUN',      'CACTUS_SUCCULENT', 'Succulent — deep, infrequent soaks. Full sun.'),
  ('a0000000-0000-4000-8000-000000000009', 'Ficus elastica',            'Rubber Plant',        8,  5, 14, 'BRIGHT_INDIRECT', 'STANDARD_POTTING', 'Wipe leaves to keep them glossy and photosynthesising.'),
  ('a0000000-0000-4000-8000-00000000000a', 'Dracaena marginata',        'Dragon Tree',        12,  7, 21, 'MEDIUM',          'STANDARD_POTTING', 'Sensitive to fluoride and salts. Rainwater if you can.'),
  ('a0000000-0000-4000-8000-00000000000b', 'Calathea orbifolia',        'Calathea',            4,  3,  7, 'MEDIUM',          'PEAT_BASED',       'Fussy about humidity and never lets the soil fully dry.'),
  ('a0000000-0000-4000-8000-00000000000c', 'Philodendron hederaceum',   'Heartleaf Philodendron', 7, 4, 13, 'MEDIUM',       'STANDARD_POTTING', 'Fast, trailing, forgiving. A great first plant.'),
  ('a0000000-0000-4000-8000-00000000000d', 'Echeveria elegans',         'Echeveria',          16, 10, 30, 'DIRECT_SUN',      'CACTUS_SUCCULENT', 'Rosette succulent. Water the soil, never the rosette.'),
  ('a0000000-0000-4000-8000-00000000000e', 'Nephrolepis exaltata',      'Boston Fern',         3,  2,  6, 'MEDIUM',          'PEAT_BASED',       'Wants to stay evenly moist. Loves a humid bathroom.'),
  ('a0000000-0000-4000-8000-00000000000f', 'Crassula ovata',            'Jade Plant',         18, 11, 30, 'DIRECT_SUN',      'CACTUS_SUCCULENT', 'Tree succulent. Wrinkled leaves mean thirsty.'),
  ('a0000000-0000-4000-8000-000000000010', 'Hedera helix',              'English Ivy',         6,  4, 11, 'MEDIUM',          'STANDARD_POTTING', 'Keep lightly moist; prone to spider mites when too dry.')
on conflict (id) do update set
  scientific_name    = excluded.scientific_name,
  common_name        = excluded.common_name,
  base_interval_days = excluded.base_interval_days,
  min_interval_days  = excluded.min_interval_days,
  max_interval_days  = excluded.max_interval_days,
  default_light      = excluded.default_light,
  default_soil       = excluded.default_soil,
  care_notes         = excluded.care_notes,
  updated_at         = now();

commit;
