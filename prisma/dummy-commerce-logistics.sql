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

INSERT INTO market_route_costs (
  id,
  from_market_id,
  to_market_id,
  cost,
  currency,
  estimated_minutes,
  is_active,
  created_at,
  updated_at
) VALUES
  ('95cf824f-85bd-4d52-96db-bc01f553de1d', '2a0a85b6-a4c9-4428-b69e-d0951f62db03', '2ea198e0-1bd3-476e-b183-ce295e89a60d', 1200.00, 'NGN', 25, TRUE, NOW(), NOW()),
  ('7ea3da6e-e6b0-43d0-9ea6-f102c0de704b', '2ea198e0-1bd3-476e-b183-ce295e89a60d', '2a0a85b6-a4c9-4428-b69e-d0951f62db03', 1200.00, 'NGN', 25, TRUE, NOW(), NOW()),
  ('686468cb-3dcd-4f3d-a572-0bf669c3fc3a', '2ea198e0-1bd3-476e-b183-ce295e89a60d', '9be04981-32c8-4631-adb9-c752ccc7a33b', 2500.00, 'NGN', 45, TRUE, NOW(), NOW()),
  ('86a35f53-ad5c-4e33-8b35-66801a3d9442', '9be04981-32c8-4631-adb9-c752ccc7a33b', '2ea198e0-1bd3-476e-b183-ce295e89a60d', 2500.00, 'NGN', 45, TRUE, NOW(), NOW()),
  ('ff5b8278-56ad-4691-8198-0a8b05d35dc9', '37fdf118-46b4-47d3-8e64-5fac92f37e6b', '2a0a85b6-a4c9-4428-b69e-d0951f62db03', 3000.00, 'NGN', 55, TRUE, NOW(), NOW()),
  ('d222e2bc-8462-4336-8d48-ee0f13ea551f', '2a0a85b6-a4c9-4428-b69e-d0951f62db03', '37fdf118-46b4-47d3-8e64-5fac92f37e6b', 3000.00, 'NGN', 55, TRUE, NOW(), NOW()),
  ('b65dfd67-8f9a-4393-aa6b-0a5a2e6b2f86', '4f4e46a9-ba20-4b78-8a30-2ed8677c8056', '9be04981-32c8-4631-adb9-c752ccc7a33b', 4000.00, 'NGN', 70, TRUE, NOW(), NOW()),
  ('d15fbcfd-5d5e-442c-b92b-dba0b4e2b6a1', '9be04981-32c8-4631-adb9-c752ccc7a33b', '4f4e46a9-ba20-4b78-8a30-2ed8677c8056', 4000.00, 'NGN', 70, TRUE, NOW(), NOW())
ON CONFLICT (from_market_id, to_market_id) DO NOTHING;

INSERT INTO products (
  id,
  name,
  description,
  sku,
  category,
  image_url,
  status,
  created_at,
  updated_at
) VALUES
  ('d87961e7-e4c4-4031-8678-07574a27084d', 'Fresh Tomatoes', 'Fresh red tomatoes sold by basket.', 'PROD-VEG-TOM-001', 'Vegetables', NULL, 'active', NOW(), NOW()),
  ('30d3f5cc-ac09-4e76-9c21-f5dc51dd0c57', 'Garri Ijebu', 'Clean white garri measured per derica.', 'PROD-GRA-GAR-001', 'Grains', NULL, 'active', NOW(), NOW()),
  ('9a9ad4b1-d4e1-4b81-bd90-a4202a336aa3', 'Palm Oil', 'Quality palm oil measured per litre.', 'PROD-OIL-PAL-001', 'Oils', NULL, 'active', NOW(), NOW()),
  ('1d6b69f8-0084-4fb5-9f29-939d6df6dd71', 'Local Rice', 'Clean local rice sold by bag.', 'PROD-GRA-RIC-001', 'Grains', NULL, 'active', NOW(), NOW()),
  ('0e566a7b-9c7f-4e4a-ae03-8236e77d2d8e', 'Fresh Onions', 'Fresh onions sold by bag.', 'PROD-VEG-ONI-001', 'Vegetables', NULL, 'active', NOW(), NOW()),
  ('30d3f5cc-ac09-4e76-9c21-f5dc51dd0c58', 'Beans Oloyin', 'Sweet honey beans measured per paint bucket.', 'PROD-LEG-BEA-001', 'Legumes', NULL, 'active', NOW(), NOW()),
  ('2d56d7b0-3a31-42e7-a9ef-b860d993ff01', 'Sweet Oranges', 'Fresh sweet oranges sold by basket.', 'PROD-FRU-ORG-001', 'Fruits', NULL, 'active', NOW(), NOW()),
  ('e1547ca5-59d3-445d-b5f6-9228d2e04af9', 'Ripe Plantain', 'Ripe yellow plantain bunches.', 'PROD-TUB-PLA-001', 'Tubers', NULL, 'active', NOW(), NOW()),
  ('6cdd7e76-3244-4417-8bb4-2f1c3db50d0a', 'Red Pepper', 'Fresh red pepper for stew and soups.', 'PROD-VEG-PEP-001', 'Vegetables', NULL, 'active', NOW(), NOW()),
  ('57264733-99b8-46b7-84ee-5a855dc6dc9f', 'Irish Potatoes', 'Clean Irish potatoes sold by bag.', 'PROD-TUB-POT-001', 'Tubers', NULL, 'active', NOW(), NOW())
ON CONFLICT (sku) DO NOTHING;

INSERT INTO market_prices (
  id,
  product_id,
  market_id,
  amount,
  currency,
  unit,
  quantity,
  quality_grade,
  source,
  observed_at,
  notes,
  created_at,
  updated_at
) VALUES
  ('8eb24a3a-f9bd-4229-b7bb-8b5dcfb43890', 'd87961e7-e4c4-4031-8678-07574a27084d', '2a0a85b6-a4c9-4428-b69e-d0951f62db03', 26000.00, 'NGN', 'basket', 1, 'standard', 'manual', '2026-06-04 08:00:00', 'Tomatoes at Mile 12 Market.', NOW(), NOW()),
  ('e31d56ea-38fe-4196-b536-b907aa8a258b', 'd87961e7-e4c4-4031-8678-07574a27084d', '2ea198e0-1bd3-476e-b183-ce295e89a60d', 28000.00, 'NGN', 'basket', 1, 'premium', 'manual', '2026-06-04 08:00:00', 'Tomatoes at Ketu Market.', NOW(), NOW()),
  ('07fe3b5b-01f0-4633-8815-3a35d4c3ff28', 'd87961e7-e4c4-4031-8678-07574a27084d', '9be04981-32c8-4631-adb9-c752ccc7a33b', 25500.00, 'NGN', 'basket', 1, 'low', 'manual', '2026-06-04 08:00:00', 'Tomatoes at Agege Market.', NOW(), NOW()),
  ('b664ef42-06c9-4b7f-a1e5-912ed062f50e', 'd87961e7-e4c4-4031-8678-07574a27084d', '4f4e46a9-ba20-4b78-8a30-2ed8677c8056', 24000.00, 'NGN', 'basket', 1, 'standard', 'manual', '2026-06-04 08:00:00', 'Tomatoes at Ifo Market.', NOW(), NOW()),

  ('07034630-c2a3-48de-bcc6-38cfcd760c1e', '30d3f5cc-ac09-4e76-9c21-f5dc51dd0c57', '37fdf118-46b4-47d3-8e64-5fac92f37e6b', 1200.00, 'NGN', 'derica', 1, 'standard', 'manual', '2026-06-04 08:00:00', 'Garri at Daleko Market.', NOW(), NOW()),
  ('6110f763-e82d-488f-9caa-fd494b016d06', '30d3f5cc-ac09-4e76-9c21-f5dc51dd0c57', '4f4e46a9-ba20-4b78-8a30-2ed8677c8056', 1150.00, 'NGN', 'derica', 1, 'standard', 'manual', '2026-06-04 08:00:00', 'Garri at Ifo Market.', NOW(), NOW()),
  ('71c92359-c794-4e6b-82cd-6d2c6ed75026', '30d3f5cc-ac09-4e76-9c21-f5dc51dd0c57', '9be04981-32c8-4631-adb9-c752ccc7a33b', 1350.00, 'NGN', 'derica', 1, 'premium', 'manual', '2026-06-04 08:00:00', 'Garri at Agege Market.', NOW(), NOW()),

  ('f70575d8-b73c-4e64-8492-3cc10caa615e', '9a9ad4b1-d4e1-4b81-bd90-a4202a336aa3', '2ea198e0-1bd3-476e-b183-ce295e89a60d', 2500.00, 'NGN', 'litre', 1, 'standard', 'manual', '2026-06-04 08:00:00', 'Palm oil at Ketu Market.', NOW(), NOW()),
  ('7f3c721e-ea7b-42e5-8432-65cbf31f1b77', '9a9ad4b1-d4e1-4b81-bd90-a4202a336aa3', '2a0a85b6-a4c9-4428-b69e-d0951f62db03', 2700.00, 'NGN', 'litre', 1, 'premium', 'manual', '2026-06-04 08:00:00', 'Palm oil at Mile 12 Market.', NOW(), NOW()),
  ('fd04a6b1-f1e2-477a-b6f0-cb28e22328e8', '9a9ad4b1-d4e1-4b81-bd90-a4202a336aa3', '37fdf118-46b4-47d3-8e64-5fac92f37e6b', 2400.00, 'NGN', 'litre', 1, 'low', 'manual', '2026-06-04 08:00:00', 'Palm oil at Daleko Market.', NOW(), NOW()),

  ('c8f2d2cb-731d-4af4-b0f2-3f3c118b2997', '1d6b69f8-0084-4fb5-9f29-939d6df6dd71', '37fdf118-46b4-47d3-8e64-5fac92f37e6b', 72000.00, 'NGN', 'bag', 1, 'standard', 'manual', '2026-06-04 08:00:00', 'Local rice at Daleko Market.', NOW(), NOW()),
  ('dcf490c5-cc93-44b4-b8e6-bc7e5c3f7799', '0e566a7b-9c7f-4e4a-ae03-8236e77d2d8e', '2a0a85b6-a4c9-4428-b69e-d0951f62db03', 65000.00, 'NGN', 'bag', 1, 'standard', 'manual', '2026-06-04 08:00:00', 'Onions at Mile 12 Market.', NOW(), NOW()),
  ('4dccca8b-57e3-44da-9e12-7a5ab2ced44f', '30d3f5cc-ac09-4e76-9c21-f5dc51dd0c58', '37fdf118-46b4-47d3-8e64-5fac92f37e6b', 14500.00, 'NGN', 'paint_bucket', 1, 'standard', 'manual', '2026-06-04 08:00:00', 'Beans at Daleko Market.', NOW(), NOW()),
  ('2a9ddacf-26bb-4349-ab4b-e9d814146a62', '2d56d7b0-3a31-42e7-a9ef-b860d993ff01', '9be04981-32c8-4631-adb9-c752ccc7a33b', 18000.00, 'NGN', 'basket', 1, 'standard', 'manual', '2026-06-04 08:00:00', 'Oranges at Agege Market.', NOW(), NOW()),
  ('88b29363-47d7-4970-b3e7-59eb3a0e1219', 'e1547ca5-59d3-445d-b5f6-9228d2e04af9', '9be04981-32c8-4631-adb9-c752ccc7a33b', 8500.00, 'NGN', 'bunch', 1, 'standard', 'manual', '2026-06-04 08:00:00', 'Plantain at Agege Market.', NOW(), NOW()),
  ('ab299b62-df02-4f1d-91bd-c2626a703293', '6cdd7e76-3244-4417-8bb4-2f1c3db50d0a', '4f4e46a9-ba20-4b78-8a30-2ed8677c8056', 22000.00, 'NGN', 'basket', 1, 'standard', 'manual', '2026-06-04 08:00:00', 'Pepper at Ifo Market.', NOW(), NOW()),
  ('5e179073-3977-4471-9ef0-c5c96dfc7f76', '57264733-99b8-46b7-84ee-5a855dc6dc9f', '2a0a85b6-a4c9-4428-b69e-d0951f62db03', 42000.00, 'NGN', 'bag', 1, 'standard', 'manual', '2026-06-04 08:00:00', 'Irish potatoes at Mile 12 Market.', NOW(), NOW())
ON CONFLICT (product_id, market_id, unit, observed_at) DO NOTHING;

INSERT INTO buy_prices (
  id,
  product_id,
  market_id,
  market_price_id,
  base_market_price,
  margin_amount,
  logistics_buffer,
  risk_buffer,
  final_price,
  currency,
  unit,
  strategy_used,
  is_active,
  valid_from,
  valid_until,
  created_at,
  updated_at
) VALUES
  ('a21a9864-d31c-4c4c-935c-663fb61e876e', 'd87961e7-e4c4-4031-8678-07574a27084d', '4f4e46a9-ba20-4b78-8a30-2ed8677c8056', 'b664ef42-06c9-4b7f-a1e5-912ed062f50e', 24000.00, 2000.00, 1500.00, 1000.00, 28500.00, 'NGN', 'basket', 'cheapest', TRUE, '2026-06-04 08:00:00', NULL, NOW(), NOW()),
  ('bbd3df1b-4fb7-4e51-b8ab-21d0cfebd509', '30d3f5cc-ac09-4e76-9c21-f5dc51dd0c57', NULL, NULL, 1233.33, 150.00, 100.00, 50.00, 1533.33, 'NGN', 'derica', 'average', TRUE, '2026-06-04 08:00:00', NULL, NOW(), NOW()),
  ('05fb298b-0d77-448c-a44f-07da3d0b7427', '9a9ad4b1-d4e1-4b81-bd90-a4202a336aa3', '2ea198e0-1bd3-476e-b183-ce295e89a60d', 'f70575d8-b73c-4e64-8492-3cc10caa615e', 2500.00, 350.00, 1500.00, 100.00, 4450.00, 'NGN', 'litre', 'hybrid_landed_cost', TRUE, '2026-06-04 08:00:00', NULL, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;
