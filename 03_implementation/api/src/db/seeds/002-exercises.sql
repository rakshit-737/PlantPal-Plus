-- Seed: exercise catalogue. MET values from the 2011 Compendium of Physical
-- Activities, clamped to the 1.0–23.0 range workoutEnergyKcal accepts. Strength
-- movements set is_strength so the UI collects sets/reps/weight; cardio collects
-- duration. Stable ids for idempotent re-seed.

begin;

insert into exercises (id, name, activity_type, met_value, is_strength, muscle_group) values
  -- Cardio (duration-based)
  ('b0000000-0000-4000-8000-000000000001', 'Walking (brisk)',        'WALK',   4.3,  false, null),
  ('b0000000-0000-4000-8000-000000000002', 'Running (9.7 km/h)',     'RUN',    9.8,  false, null),
  ('b0000000-0000-4000-8000-000000000003', 'Cycling (moderate)',     'CYCLE',  7.5,  false, null),
  ('b0000000-0000-4000-8000-000000000004', 'Swimming (freestyle)',   'SWIM',   8.3,  false, null),
  ('b0000000-0000-4000-8000-000000000005', 'Yoga (Hatha)',           'YOGA',   2.5,  false, null),
  ('b0000000-0000-4000-8000-000000000006', 'HIIT circuit',           'HIIT',   8.0,  false, null),
  ('b0000000-0000-4000-8000-000000000007', 'Rowing (moderate)',      'SPORT',  7.0,  false, null),
  ('b0000000-0000-4000-8000-000000000008', 'Elliptical trainer',     'SPORT',  5.0,  false, null),
  ('b0000000-0000-4000-8000-000000000009', 'Jump rope',              'HIIT',  11.8,  false, null),
  ('b0000000-0000-4000-8000-00000000000a', 'Hiking (cross-country)', 'WALK',   6.0,  false, null),
  -- Strength (set/rep/weight-based). MET ~6.0 for vigorous free-weight effort.
  ('b0000000-0000-4000-8000-00000000000b', 'Barbell Back Squat',     'STRENGTH', 6.0, true, 'Legs'),
  ('b0000000-0000-4000-8000-00000000000c', 'Barbell Deadlift',       'STRENGTH', 6.0, true, 'Back'),
  ('b0000000-0000-4000-8000-00000000000d', 'Barbell Bench Press',    'STRENGTH', 5.0, true, 'Chest'),
  ('b0000000-0000-4000-8000-00000000000e', 'Overhead Press',         'STRENGTH', 5.0, true, 'Shoulders'),
  ('b0000000-0000-4000-8000-00000000000f', 'Bent-over Row',          'STRENGTH', 5.0, true, 'Back'),
  ('b0000000-0000-4000-8000-000000000010', 'Pull-up',                'STRENGTH', 8.0, true, 'Back'),
  ('b0000000-0000-4000-8000-000000000011', 'Dumbbell Lunge',         'STRENGTH', 5.0, true, 'Legs'),
  ('b0000000-0000-4000-8000-000000000012', 'Bicep Curl',             'STRENGTH', 3.5, true, 'Arms'),
  ('b0000000-0000-4000-8000-000000000013', 'Plank',                  'STRENGTH', 3.8, true, 'Core'),
  ('b0000000-0000-4000-8000-000000000014', 'Leg Press',              'STRENGTH', 5.0, true, 'Legs')
on conflict (id) do update set
  name          = excluded.name,
  activity_type = excluded.activity_type,
  met_value     = excluded.met_value,
  is_strength   = excluded.is_strength,
  muscle_group  = excluded.muscle_group,
  updated_at    = now();

commit;
