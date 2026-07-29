-- Seed: Indian species catalogue extension (BR-PLT-01). Plants commonly grown
-- in Indian homes, balconies and gardens — sacred, medicinal, flowering, fruit
-- and kitchen-garden species. Same reference conditions as 001: base interval
-- assumes BRIGHT_INDIRECT light, ceramic-glazed pot, standard potting soil.
-- Stable ids (a0…0011 onward) so a re-seed upserts rather than duplicating.

begin;

insert into species (id, scientific_name, common_name, base_interval_days, min_interval_days, max_interval_days, default_light, default_soil, care_notes) values
  ('a0000000-0000-4000-8000-000000000011', 'Ocimum tenuiflorum',        'Tulsi (Holy Basil)',        2,  1,  5, 'DIRECT_SUN',      'STANDARD_POTTING', 'Sacred basil. Loves sun and regular water; pinch flower spikes to keep leaves coming.'),
  ('a0000000-0000-4000-8000-000000000012', 'Azadirachta indica',        'Neem',                      7,  4, 21, 'DIRECT_SUN',      'GARDEN_SOIL',      'Hardy once established. Young pot-grown neem wants deep, infrequent watering.'),
  ('a0000000-0000-4000-8000-000000000013', 'Murraya koenigii',          'Curry Leaf (Kadi Patta)',   4,  3, 10, 'DIRECT_SUN',      'STANDARD_POTTING', 'Feed monthly in the growing season; drops leaves in winter — water less then.'),
  ('a0000000-0000-4000-8000-000000000014', 'Hibiscus rosa-sinensis',    'Hibiscus (Gudhal)',         2,  1,  5, 'DIRECT_SUN',      'STANDARD_POTTING', 'Blooms on new wood. Daily water in summer heat; buds drop if the soil dries fully.'),
  ('a0000000-0000-4000-8000-000000000015', 'Tagetes erecta',            'Marigold (Genda)',          2,  1,  5, 'DIRECT_SUN',      'GARDEN_SOIL',      'Festival staple. Deadhead spent blooms for continuous flowering.'),
  ('a0000000-0000-4000-8000-000000000016', 'Jasminum sambac',           'Mogra (Arabian Jasmine)',   3,  2,  6, 'DIRECT_SUN',      'STANDARD_POTTING', 'Fragrant summer bloomer. Prune after each flush; keep evenly moist, never soggy.'),
  ('a0000000-0000-4000-8000-000000000017', 'Ficus religiosa',           'Peepal',                    5,  3, 12, 'DIRECT_SUN',      'GARDEN_SOIL',      'Sacred fig. Vigorous — root-prune yearly if bonsai-potted.'),
  ('a0000000-0000-4000-8000-000000000018', 'Ficus benghalensis',        'Banyan (Bargad)',           6,  4, 14, 'BRIGHT_INDIRECT', 'GARDEN_SOIL',      'National tree; superb bonsai. Let the top few cm dry between waterings.'),
  ('a0000000-0000-4000-8000-000000000019', 'Polyalthia longifolia',     'Ashoka',                    5,  3, 10, 'DIRECT_SUN',      'GARDEN_SOIL',      'Columnar avenue tree. Steady moisture while young; tolerant later.'),
  ('a0000000-0000-4000-8000-00000000001a', 'Bougainvillea glabra',      'Bougainvillea',             8,  5, 18, 'DIRECT_SUN',      'GARDEN_SOIL',      'Blooms hardest when slightly stressed — water deeply but rarely.'),
  ('a0000000-0000-4000-8000-00000000001b', 'Plumeria rubra',            'Champa (Frangipani)',      10,  6, 21, 'DIRECT_SUN',      'CACTUS_SUCCULENT', 'Thick succulent stems. Rot-prone in wet soil; dry side always.'),
  ('a0000000-0000-4000-8000-00000000001c', 'Nyctanthes arbor-tristis',  'Parijat (Night Jasmine)',   4,  2,  8, 'DIRECT_SUN',      'GARDEN_SOIL',      'Night-blooming, flowers carpet the ground at dawn. Average water.'),
  ('a0000000-0000-4000-8000-00000000001d', 'Aegle marmelos',            'Bel (Bael)',                8,  5, 18, 'DIRECT_SUN',      'GARDEN_SOIL',      'Sacred to Shiva. Very drought-hardy once established.'),
  ('a0000000-0000-4000-8000-00000000001e', 'Phyllanthus emblica',       'Amla (Indian Gooseberry)',  6,  4, 14, 'DIRECT_SUN',      'GARDEN_SOIL',      'Vitamin-C powerhouse. Deep weekly soak beats frequent sprinkles.'),
  ('a0000000-0000-4000-8000-00000000001f', 'Piper betle',               'Paan (Betel Leaf)',         2,  1,  4, 'MEDIUM',          'PEAT_BASED',       'Shade-loving vine. Wants humidity and consistently moist soil.'),
  ('a0000000-0000-4000-8000-000000000020', 'Cymbopogon citratus',       'Lemongrass',                3,  2,  6, 'DIRECT_SUN',      'STANDARD_POTTING', 'Thirsty grass for chai and curries. Divide clumps yearly.'),
  ('a0000000-0000-4000-8000-000000000021', 'Mentha spicata',            'Pudina (Mint)',             2,  1,  4, 'MEDIUM',          'STANDARD_POTTING', 'Invasive spreader — keep potted. Never let it dry fully.'),
  ('a0000000-0000-4000-8000-000000000022', 'Coriandrum sativum',        'Dhania (Coriander)',        2,  1,  4, 'BRIGHT_INDIRECT', 'STANDARD_POTTING', 'Quick from seed; bolts in heat. Sow fresh every few weeks.'),
  ('a0000000-0000-4000-8000-000000000023', 'Coleus amboinicus',         'Ajwain Patta (Indian Borage)', 6, 4, 12, 'BRIGHT_INDIRECT', 'CACTUS_SUCCULENT', 'Fleshy aromatic leaves. Semi-succulent — light hand with water.'),
  ('a0000000-0000-4000-8000-000000000024', 'Clitoria ternatea',         'Aparajita (Butterfly Pea)', 3,  2,  7, 'DIRECT_SUN',      'GARDEN_SOIL',      'Blue-flowered climber for tea and pooja. Fixes its own nitrogen.'),
  ('a0000000-0000-4000-8000-000000000025', 'Crossandra infundibuliformis', 'Kanakambaram (Firecracker)', 3, 2, 6, 'BRIGHT_INDIRECT', 'STANDARD_POTTING', 'South-Indian hair-flower classic. Steady moisture, no cold drafts.'),
  ('a0000000-0000-4000-8000-000000000026', 'Lawsonia inermis',          'Mehendi (Henna)',           7,  4, 16, 'DIRECT_SUN',      'GARDEN_SOIL',      'Tough shrub; the fresh leaves grind into henna paste. Drought-tolerant.'),
  ('a0000000-0000-4000-8000-000000000027', 'Ixora coccinea',            'Ixora (Rugmini)',           3,  2,  7, 'DIRECT_SUN',      'PEAT_BASED',       'Acid-loving. Yellow leaves usually mean alkaline water — try rainwater.'),
  ('a0000000-0000-4000-8000-000000000028', 'Polianthes tuberosa',       'Rajnigandha (Tuberose)',    3,  2,  7, 'DIRECT_SUN',      'STANDARD_POTTING', 'Grown from bulbs for heady evening fragrance. Moist in bloom, dry in dormancy.'),
  ('a0000000-0000-4000-8000-000000000029', 'Delonix regia',             'Gulmohar',                  8,  5, 18, 'DIRECT_SUN',      'GARDEN_SOIL',      'Flame tree. Only for large gardens or bold bonsai projects.'),
  ('a0000000-0000-4000-8000-00000000002a', 'Tamarindus indica',         'Imli (Tamarind)',           7,  4, 16, 'DIRECT_SUN',      'GARDEN_SOIL',      'Slow, graceful, superb bonsai. Let topsoil dry between waterings.'),
  ('a0000000-0000-4000-8000-00000000002b', 'Carica papaya',             'Papita (Papaya)',           3,  2,  6, 'DIRECT_SUN',      'GARDEN_SOIL',      'Fast fruiter, hungry and thirsty. Hates waterlogged roots — raise the bed.'),
  ('a0000000-0000-4000-8000-00000000002c', 'Psidium guajava',           'Amrood (Guava)',            5,  3, 12, 'DIRECT_SUN',      'GARDEN_SOIL',      'Forgiving fruit tree; fruits in pots too. Deep-water when the top dries.'),
  ('a0000000-0000-4000-8000-00000000002d', 'Punica granatum',           'Anar (Pomegranate)',        6,  4, 14, 'DIRECT_SUN',      'GARDEN_SOIL',      'Loves heat, tolerates drought; overwatering splits ripening fruit.'),
  ('a0000000-0000-4000-8000-00000000002e', 'Moringa oleifera',          'Sahjan (Drumstick)',        7,  4, 16, 'DIRECT_SUN',      'GARDEN_SOIL',      'Grows absurdly fast. Very drought-hardy; pods and leaves both edible.'),
  ('a0000000-0000-4000-8000-00000000002f', 'Curcuma longa',             'Haldi (Turmeric)',          3,  2,  6, 'BRIGHT_INDIRECT', 'PEAT_BASED',       'Plant rhizomes after last cold snap; harvest when leaves yellow in autumn.'),
  ('a0000000-0000-4000-8000-000000000030', 'Zingiber officinale',       'Adrak (Ginger)',            3,  2,  6, 'MEDIUM',          'PEAT_BASED',       'Shade-tolerant rhizome. Rich loose soil, steady moisture, no direct noon sun.'),
  ('a0000000-0000-4000-8000-000000000031', 'Capsicum annuum',           'Hari Mirch (Chilli)',       2,  1,  5, 'DIRECT_SUN',      'STANDARD_POTTING', 'Balcony staple. Even moisture prevents flower drop; feed at fruiting.'),
  ('a0000000-0000-4000-8000-000000000032', 'Solanum lycopersicum',      'Tamatar (Tomato)',          2,  1,  4, 'DIRECT_SUN',      'STANDARD_POTTING', 'Deep, regular watering stops blossom-end rot. Stake early.'),
  ('a0000000-0000-4000-8000-000000000033', 'Trigonella foenum-graecum', 'Methi (Fenugreek)',         2,  1,  4, 'DIRECT_SUN',      'STANDARD_POTTING', 'Sow thick, harvest greens in 3–4 weeks. Quick winter crop.'),
  ('a0000000-0000-4000-8000-000000000034', 'Spinacia oleracea',         'Palak (Spinach)',           2,  1,  4, 'BRIGHT_INDIRECT', 'STANDARD_POTTING', 'Cut-and-come-again greens. Bolts in heat — part shade in summer.'),
  ('a0000000-0000-4000-8000-000000000035', 'Musa acuminata',            'Kela (Banana)',             2,  1,  5, 'DIRECT_SUN',      'GARDEN_SOIL',      'Giant herb, giant appetite. Water and feed generously in warm months.'),
  ('a0000000-0000-4000-8000-000000000036', 'Mangifera indica',          'Aam (Mango)',               6,  4, 14, 'DIRECT_SUN',      'GARDEN_SOIL',      'Dwarf grafts fruit in large pots. Withhold water before flowering to trigger bloom.'),
  ('a0000000-0000-4000-8000-000000000037', 'Catharanthus roseus',       'Sadabahar (Periwinkle)',    4,  2,  8, 'DIRECT_SUN',      'STANDARD_POTTING', 'Flowers all year, thrives on neglect. Overwatering is the only way to kill it.'),
  ('a0000000-0000-4000-8000-000000000038', 'Adenium obesum',            'Desert Rose (Adenium)',    12,  7, 30, 'DIRECT_SUN',      'CACTUS_SUCCULENT', 'Caudex stores water. Bone-dry winters; blooms with summer heat.'),
  ('a0000000-0000-4000-8000-000000000039', 'Codiaeum variegatum',       'Croton',                    4,  3,  8, 'BRIGHT_INDIRECT', 'STANDARD_POTTING', 'Loud foliage needs bright light to stay loud. Drops leaves if moved or chilled.'),
  ('a0000000-0000-4000-8000-00000000003a', 'Dypsis lutescens',          'Areca Palm',                4,  3,  8, 'BRIGHT_INDIRECT', 'STANDARD_POTTING', 'Classic Indian living-room palm. Likes moist soil and misting; salts brown the tips.'),
  ('a0000000-0000-4000-8000-00000000003b', 'Dracaena reflexa',          'Song of India',             8,  5, 16, 'MEDIUM',          'STANDARD_POTTING', 'Variegated canes; easy-going. Let the top half dry out first.'),
  ('a0000000-0000-4000-8000-00000000003c', 'Ocimum basilicum',          'Sweet Basil',               2,  1,  5, 'DIRECT_SUN',      'STANDARD_POTTING', 'For pesto and pizza rather than pooja. Pinch constantly, never let it flower.'),
  ('a0000000-0000-4000-8000-00000000003d', 'Rosa indica',               'Desi Gulab (Rose)',         3,  2,  6, 'DIRECT_SUN',      'GARDEN_SOIL',      'Morning sun, airflow, deep soaks at the roots — wet leaves invite black spot.'),
  ('a0000000-0000-4000-8000-00000000003e', 'Euphorbia milii',           'Crown of Thorns',          10,  6, 21, 'DIRECT_SUN',      'CACTUS_SUCCULENT', 'Blooms nearly year-round on a dry regime. Milky sap irritates — gloves on.'),
  ('a0000000-0000-4000-8000-00000000003f', 'Jasminum grandiflorum',     'Chameli (Spanish Jasmine)', 3,  2,  7, 'DIRECT_SUN',      'STANDARD_POTTING', 'The attar jasmine of perfumery. Train on a trellis; prune hard after winter.'),
  ('a0000000-0000-4000-8000-000000000040', 'Aloe vera',                 'Gwarpatha (Aloe)',         14,  9, 28, 'DIRECT_SUN',      'CACTUS_SUCCULENT', 'Same aloe, desi name. Deep soak, then forget it for two weeks.')
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
