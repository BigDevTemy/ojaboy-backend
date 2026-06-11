BEGIN;

INSERT INTO delivery_zones (
  id,
  name,
  description,
  delivery_cost,
  is_active,
  created_at,
  updated_at
) VALUES
  ('b2b8a6b9-7df7-4ff3-8bd7-64d6cd9f3121', 'Yaba', 'Mainland zone covering Yaba, Akoka, Sabo, Onike and nearby communities.', 1500, TRUE, NOW(), NOW()),
  ('d1c1e9e7-84e6-4591-bb68-a58337c30e4f', 'Ikeja', 'Central mainland zone covering Ikeja, Opebi, Allen, Alausa and Maryland.', 1750, TRUE, NOW(), NOW()),
  ('fd822824-ffcc-4c19-9e9f-bf6e32f03f25', 'Lekki', 'Island zone covering Lekki Phase 1, Ikate, Marwa and nearby communities.', 2500, TRUE, NOW(), NOW()),
  ('84e771bb-c33e-48ae-9f88-b34618dc1db9', 'Surulere', 'Mainland zone covering Surulere, Aguda, Bode Thomas and Ojuelegba.', 1750, TRUE, NOW(), NOW()),
  ('4ce7b765-9716-4521-93c8-fda2636461e8', 'Ajah', 'Island corridor zone covering Ajah, Sangotedo, Badore and Abraham Adesanya.', 3000, TRUE, NOW(), NOW()),
  ('1ddf588e-bb89-4aa7-90a8-0ff450848b61', 'Victoria Island', 'Island business district covering Victoria Island, Oniru and Eko Atlantic.', 2500, TRUE, NOW(), NOW()),
  ('a1cd219a-0a1b-4b96-8761-75a02991fec5', 'Ikoyi', 'Island zone covering Ikoyi, Banana Island, Osborne and Parkview.', 2750, TRUE, NOW(), NOW()),
  ('5d14dc1a-12bc-46cc-a337-85a4de7ef629', 'Lagos Island', 'Central island zone covering Marina, CMS, Obalende and Idumota.', 2250, TRUE, NOW(), NOW()),
  ('da058c15-77ae-437c-99d3-edb8fdf94ad7', 'Gbagada', 'Mainland zone covering Gbagada, Ifako, Soluyi and Medina Estate.', 1750, TRUE, NOW(), NOW()),
  ('66871b94-f7fc-40ac-a27c-fd2bc258f05f', 'Kosofe', 'Mainland zone covering Ogudu, Ojota, Ketu, Mile 12 and Alapere.', 1750, TRUE, NOW(), NOW()),
  ('375f5376-3030-44a7-a472-4a47cc8c4ff1', 'Amuwo Odofin', 'Western mainland zone covering Festac, Amuwo Odofin, Apple Junction and Mile 2.', 2500, TRUE, NOW(), NOW()),
  ('a528de87-c509-408b-a438-d5d46a341a17', 'Alimosho', 'Mainland zone covering Egbeda, Akowonjo, Idimu, Ipaja and Ikotun.', 2500, TRUE, NOW(), NOW())
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  delivery_cost = EXCLUDED.delivery_cost,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

INSERT INTO delivery_areas (
  id,
  delivery_zone_id,
  name,
  normalized_name,
  aliases,
  locality,
  state,
  country,
  is_active,
  created_at,
  updated_at
) VALUES
  ('31f2fb08-bb75-46a2-840b-314c4e9c08d1', 'b2b8a6b9-7df7-4ff3-8bd7-64d6cd9f3121', 'Yaba', 'yaba', ARRAY['akoka', 'sabo yaba', 'onike', 'unilag', 'abule oja', 'ebute metta'], 'Lagos', 'Lagos', 'Nigeria', TRUE, NOW(), NOW()),
  ('f13a7d47-d630-4f77-96ce-27d7a53d8e55', 'd1c1e9e7-84e6-4591-bb68-a58337c30e4f', 'Ikeja', 'ikeja', ARRAY['opebi', 'allen', 'alausa', 'maryland', 'computer village', 'adeniyi jones'], 'Lagos', 'Lagos', 'Nigeria', TRUE, NOW(), NOW()),
  ('a67158ae-f843-4b60-b4b1-59d24983ba60', 'fd822824-ffcc-4c19-9e9f-bf6e32f03f25', 'Lekki', 'lekki', ARRAY['lekki phase 1', 'ikate', 'marwa', 'osapa london', 'chevron', 'jakande lekki'], 'Lagos', 'Lagos', 'Nigeria', TRUE, NOW(), NOW()),
  ('f0acd9e4-0801-40e2-a9cf-c7931a105c52', '84e771bb-c33e-48ae-9f88-b34618dc1db9', 'Surulere', 'surulere', ARRAY['aguda', 'bode thomas', 'ojuelegba', 'adeniran ogunsanya', 'lawanson', 'itire'], 'Lagos', 'Lagos', 'Nigeria', TRUE, NOW(), NOW()),
  ('3dcc68c3-a9fa-4466-bcd2-3f38ad63f34c', '4ce7b765-9716-4521-93c8-fda2636461e8', 'Ajah', 'ajah', ARRAY['sangotedo', 'badore', 'abraham adesanya', 'ado road', 'langbasa', 'awoyaya'], 'Lagos', 'Lagos', 'Nigeria', TRUE, NOW(), NOW()),
  ('e60c170a-3cb0-4a74-ac08-366ae24f230b', '1ddf588e-bb89-4aa7-90a8-0ff450848b61', 'Victoria Island', 'victoria island', ARRAY['vi', 'oniru', 'eko atlantic', 'bar beach', 'ozumba mbadiwe'], 'Lagos', 'Lagos', 'Nigeria', TRUE, NOW(), NOW()),
  ('75d8d681-39a0-497e-a740-fbb98b0425c9', 'a1cd219a-0a1b-4b96-8761-75a02991fec5', 'Ikoyi', 'ikoyi', ARRAY['banana island', 'osborne', 'parkview estate', 'dolphin estate', 'old ikoyi'], 'Lagos', 'Lagos', 'Nigeria', TRUE, NOW(), NOW()),
  ('d055bce6-ad99-49ea-a4b5-978f4253c54d', '5d14dc1a-12bc-46cc-a337-85a4de7ef629', 'Lagos Island', 'lagos island', ARRAY['marina', 'cms', 'obalende', 'idumota', 'broad street'], 'Lagos', 'Lagos', 'Nigeria', TRUE, NOW(), NOW()),
  ('b08f489f-52c7-4b05-bfcb-ce5ad7ffae59', 'da058c15-77ae-437c-99d3-edb8fdf94ad7', 'Gbagada', 'gbagada', ARRAY['ifako gbagada', 'soluyi', 'medina estate', 'phase 1 gbagada', 'phase 2 gbagada'], 'Lagos', 'Lagos', 'Nigeria', TRUE, NOW(), NOW()),
  ('7d58812e-dd13-415c-a67e-3f7ea9951b2a', '66871b94-f7fc-40ac-a27c-fd2bc258f05f', 'Kosofe', 'kosofe', ARRAY['ogudu', 'ojota', 'ketu', 'mile 12', 'alapere', 'magodo'], 'Lagos', 'Lagos', 'Nigeria', TRUE, NOW(), NOW()),
  ('2b6c2c56-5c24-4555-aa0f-764059ca3d0b', '375f5376-3030-44a7-a472-4a47cc8c4ff1', 'Amuwo Odofin', 'amuwo odofin', ARRAY['festac', 'festac town', 'apple junction', 'mile 2', 'satellite town'], 'Lagos', 'Lagos', 'Nigeria', TRUE, NOW(), NOW()),
  ('eff9cd23-d732-433b-afda-07970a41ad9f', 'a528de87-c509-408b-a438-d5d46a341a17', 'Alimosho', 'alimosho', ARRAY['egbeda', 'akowonjo', 'idimu', 'ipaja', 'ikotun', 'iyana ipaja'], 'Lagos', 'Lagos', 'Nigeria', TRUE, NOW(), NOW())
ON CONFLICT (normalized_name, state, country) DO UPDATE SET
  delivery_zone_id = EXCLUDED.delivery_zone_id,
  name = EXCLUDED.name,
  aliases = EXCLUDED.aliases,
  locality = EXCLUDED.locality,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

DELETE FROM market_delivery_costs;

WITH fixture_markets (market_id, market_rank) AS (
  VALUES
    ('2a0a85b6-a4c9-4428-b69e-d0951f62db03', 0),
    ('2ea198e0-1bd3-476e-b183-ce295e89a60d', 1),
    ('37fdf118-46b4-47d3-8e64-5fac92f37e6b', 2),
    ('4f4e46a9-ba20-4b78-8a30-2ed8677c8056', 3),
    ('9be04981-32c8-4631-adb9-c752ccc7a33b', 4)
),
fixture_zones (delivery_zone_id, zone_rank) AS (
  VALUES
    ('b2b8a6b9-7df7-4ff3-8bd7-64d6cd9f3121', 0),
    ('d1c1e9e7-84e6-4591-bb68-a58337c30e4f', 1),
    ('fd822824-ffcc-4c19-9e9f-bf6e32f03f25', 2),
    ('84e771bb-c33e-48ae-9f88-b34618dc1db9', 3),
    ('4ce7b765-9716-4521-93c8-fda2636461e8', 4),
    ('1ddf588e-bb89-4aa7-90a8-0ff450848b61', 5),
    ('a1cd219a-0a1b-4b96-8761-75a02991fec5', 6),
    ('5d14dc1a-12bc-46cc-a337-85a4de7ef629', 7),
    ('da058c15-77ae-437c-99d3-edb8fdf94ad7', 8),
    ('66871b94-f7fc-40ac-a27c-fd2bc258f05f', 9),
    ('375f5376-3030-44a7-a472-4a47cc8c4ff1', 10),
    ('a528de87-c509-408b-a438-d5d46a341a17', 11)
)
INSERT INTO market_delivery_costs (
  id,
  market_id,
  delivery_zone_id,
  cost,
  currency,
  estimated_minutes,
  is_active,
  created_at,
  updated_at
)
SELECT
  (
    SUBSTRING(MD5(market_id::text || ':' || delivery_zone_id::text), 1, 8) || '-' ||
    SUBSTRING(MD5(market_id::text || ':' || delivery_zone_id::text), 9, 4) || '-' ||
    SUBSTRING(MD5(market_id::text || ':' || delivery_zone_id::text), 13, 4) || '-' ||
    SUBSTRING(MD5(market_id::text || ':' || delivery_zone_id::text), 17, 4) || '-' ||
    SUBSTRING(MD5(market_id::text || ':' || delivery_zone_id::text), 21, 12)
  ),
  market_id,
  delivery_zone_id,
  (1000 + (((market_rank * 3 + zone_rank * 2) % 9) * 250))::numeric(12, 2),
  'NGN',
  30 + (((market_rank * 11 + zone_rank * 7) % 13) * 5),
  TRUE,
  NOW(),
  NOW()
FROM fixture_markets
CROSS JOIN fixture_zones;

COMMIT;
