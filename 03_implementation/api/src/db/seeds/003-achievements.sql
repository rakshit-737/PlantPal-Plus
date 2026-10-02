-- Seed: achievement catalogue (BR-GAM-10). Declarative criteria so the
-- evaluator is data-driven rather than a switch per badge. Stable ids for
-- idempotent re-seed, mirroring 001-species and 002-exercises.

begin;

insert into achievements (id, code, name, description, module, criteria, icon, tier, points) values
  -- Plant care
  ('c0000000-0000-4000-8000-000000000001', 'FIRST_PLANT',        'First Sprout',      'Add your first plant.',                                  'PLANT_CARE', '{"metric":"plants_added","gte":1}',        '🌱', 'BRONZE',   10),
  ('c0000000-0000-4000-8000-000000000002', 'FIRST_WATERING',     'First Drop',        'Log your first watering.',                               'PLANT_CARE', '{"metric":"waterings_logged","gte":1}',    '💧', 'BRONZE',   10),
  ('c0000000-0000-4000-8000-000000000003', 'PLANT_STREAK_7',     'Green Week',        'Keep a 7-day plant-care streak.',                        'PLANT_CARE', '{"metric":"plant_care_streak","gte":7}',   '🌿', 'SILVER',   25),
  ('c0000000-0000-4000-8000-000000000004', 'PLANT_STREAK_30',    'Green Thumb',       'Keep a 30-day plant-care streak.',                       'PLANT_CARE', '{"metric":"plant_care_streak","gte":30}',  '🌳', 'GOLD',    100),
  ('c0000000-0000-4000-8000-000000000005', 'PLANT_COLLECTION_5', 'Growing Family',    'Care for five plants at once.',                          'PLANT_CARE', '{"metric":"active_plants","gte":5}',       '🪴', 'SILVER',   25),
  -- Fitness
  ('c0000000-0000-4000-8000-000000000006', 'FIRST_WORKOUT',      'Off the Couch',     'Log your first workout.',                                'FITNESS',    '{"metric":"workouts_logged","gte":1}',     '🏃', 'BRONZE',   10),
  ('c0000000-0000-4000-8000-000000000007', 'FITNESS_STREAK_7',   'One Solid Week',    'Keep a 7-day fitness streak.',                           'FITNESS',    '{"metric":"fitness_streak","gte":7}',      '💪', 'SILVER',   25),
  ('c0000000-0000-4000-8000-000000000008', 'FITNESS_STREAK_30',  'Iron Habit',        'Keep a 30-day fitness streak.',                          'FITNESS',    '{"metric":"fitness_streak","gte":30}',     '🏋️', 'GOLD',    100),
  ('c0000000-0000-4000-8000-000000000009', 'STEPS_10K_DAY',      'Ten Thousand',      'Hit 10,000 steps in a single day.',                      'FITNESS',    '{"metric":"steps_in_day","gte":10000}',    '👟', 'SILVER',   25),
  ('c0000000-0000-4000-8000-00000000000a', 'VOLUME_10T',         'Heavy Lifter',      'Move 10,000 kg of total volume across all workouts.',    'FITNESS',    '{"metric":"total_volume_kg","gte":10000}', '🔩', 'GOLD',    100),
  -- Nutrition
  ('c0000000-0000-4000-8000-00000000000b', 'FIRST_MEAL',         'Food Diary Open',   'Log your first meal.',                                   'NUTRITION',  '{"metric":"meals_logged","gte":1}',        '🍽️', 'BRONZE',   10),
  ('c0000000-0000-4000-8000-00000000000c', 'NUTRITION_STREAK_7', 'Mindful Week',      'Log meals seven days in a row.',                         'NUTRITION',  '{"metric":"nutrition_streak","gte":7}',    '🥗', 'SILVER',   25),
  ('c0000000-0000-4000-8000-00000000000d', 'HYDRATION_GOAL_7',   'Well Watered',      'Meet your hydration goal seven times.',                  'NUTRITION',  '{"metric":"hydration_goals_met","gte":7}', '🚰', 'SILVER',   25),
  -- Shared
  ('c0000000-0000-4000-8000-00000000000e', 'OVERALL_STREAK_7',   'Habit Forming',     'Keep the overall streak alive for a week.',              'SHARED',     '{"metric":"overall_streak","gte":7}',      '🔥', 'SILVER',   50),
  ('c0000000-0000-4000-8000-00000000000f', 'OVERALL_STREAK_100', 'Century',           'Keep the overall streak alive for 100 days.',            'SHARED',     '{"metric":"overall_streak","gte":100}',    '🏆', 'PLATINUM', 500),
  ('c0000000-0000-4000-8000-000000000010', 'ALL_THREE_ONE_DAY',  'Triple Play',       'Log plant care, a workout and a meal on the same day.',  'SHARED',     '{"metric":"all_modules_in_day","gte":1}',  '🎯', 'GOLD',    100)
on conflict (id) do update set
  code        = excluded.code,
  name        = excluded.name,
  description = excluded.description,
  module      = excluded.module,
  criteria    = excluded.criteria,
  icon        = excluded.icon,
  tier        = excluded.tier,
  points      = excluded.points,
  updated_at  = now();

commit;
