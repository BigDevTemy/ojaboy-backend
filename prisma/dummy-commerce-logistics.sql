INSERT INTO delivery_zones (
  id,
  name,
  description,
  is_active,
  created_at,
  updated_at
) VALUES
  ('b2b8a6b9-7df7-4ff3-8bd7-64d6cd9f3121', 'Yaba', 'Mainland delivery zone covering Yaba and nearby areas.', TRUE, NOW(), NOW()),
  ('d1c1e9e7-84e6-4591-bb68-a58337c30e4f', 'Ikeja', 'Delivery zone covering Ikeja and nearby areas.', TRUE, NOW(), NOW()),
  ('fd822824-ffcc-4c19-9e9f-bf6e32f03f25', 'Lekki', 'Island delivery zone covering Lekki Phase 1 and nearby areas.', TRUE, NOW(), NOW()),
  ('84e771bb-c33e-48ae-9f88-b34618dc1db9', 'Surulere', 'Delivery zone covering Surulere and nearby areas.', TRUE, NOW(), NOW()),
  ('4ce7b765-9716-4521-93c8-fda2636461e8', 'Ajah', 'Delivery zone covering Ajah and nearby areas.', TRUE, NOW(), NOW())
ON CONFLICT (name) DO NOTHING;

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
) VALUES
  ('45d29820-e35d-46fb-9c5e-8d5d5272ec58', '2a0a85b6-a4c9-4428-b69e-d0951f62db03', 'b2b8a6b9-7df7-4ff3-8bd7-64d6cd9f3121', 3000.00, 'NGN', 55, TRUE, NOW(), NOW()),
  ('f24c4a42-5cb7-47ad-aa2f-f2006f35a321', '2a0a85b6-a4c9-4428-b69e-d0951f62db03', 'd1c1e9e7-84e6-4591-bb68-a58337c30e4f', 3500.00, 'NGN', 50, TRUE, NOW(), NOW()),
  ('07fa6893-463e-4f7c-86d8-b7f41f8bbf87', '2a0a85b6-a4c9-4428-b69e-d0951f62db03', 'fd822824-ffcc-4c19-9e9f-bf6e32f03f25', 6000.00, 'NGN', 95, TRUE, NOW(), NOW()),
  ('dd96f269-51c9-4a0e-9fcb-ff05e3b20107', '2a0a85b6-a4c9-4428-b69e-d0951f62db03', '84e771bb-c33e-48ae-9f88-b34618dc1db9', 4000.00, 'NGN', 70, TRUE, NOW(), NOW()),
  ('12da40e0-daf1-46f6-bdf8-703b1f133f21', '2a0a85b6-a4c9-4428-b69e-d0951f62db03', '4ce7b765-9716-4521-93c8-fda2636461e8', 7500.00, 'NGN', 115, TRUE, NOW(), NOW()),

  ('8063f0d8-690b-4cd3-b46e-82978d85992a', '2ea198e0-1bd3-476e-b183-ce295e89a60d', 'b2b8a6b9-7df7-4ff3-8bd7-64d6cd9f3121', 1500.00, 'NGN', 35, TRUE, NOW(), NOW()),
  ('a8028c07-2d41-4d66-a4a0-5f176493045e', '2ea198e0-1bd3-476e-b183-ce295e89a60d', 'd1c1e9e7-84e6-4591-bb68-a58337c30e4f', 2500.00, 'NGN', 45, TRUE, NOW(), NOW()),
  ('ed70a50b-1e2c-4d67-bbcc-f058342b7263', '2ea198e0-1bd3-476e-b183-ce295e89a60d', 'fd822824-ffcc-4c19-9e9f-bf6e32f03f25', 4500.00, 'NGN', 80, TRUE, NOW(), NOW()),
  ('1ef49726-b901-4f4d-b8c8-8fc1e42f05ff', '2ea198e0-1bd3-476e-b183-ce295e89a60d', '84e771bb-c33e-48ae-9f88-b34618dc1db9', 3000.00, 'NGN', 60, TRUE, NOW(), NOW()),
  ('17c15d1d-29d5-4e1f-9319-61d83e1e848e', '2ea198e0-1bd3-476e-b183-ce295e89a60d', '4ce7b765-9716-4521-93c8-fda2636461e8', 6500.00, 'NGN', 105, TRUE, NOW(), NOW()),

  ('1b628071-26b8-4f8f-998f-e65d9e85f88c', '37fdf118-46b4-47d3-8e64-5fac92f37e6b', 'b2b8a6b9-7df7-4ff3-8bd7-64d6cd9f3121', 4500.00, 'NGN', 85, TRUE, NOW(), NOW()),
  ('f4c13c2b-066f-45c3-9b90-609e90955025', '37fdf118-46b4-47d3-8e64-5fac92f37e6b', 'd1c1e9e7-84e6-4591-bb68-a58337c30e4f', 5000.00, 'NGN', 90, TRUE, NOW(), NOW()),
  ('1cd85963-8344-45f3-9d07-9c669d4829c7', '37fdf118-46b4-47d3-8e64-5fac92f37e6b', 'fd822824-ffcc-4c19-9e9f-bf6e32f03f25', 5500.00, 'NGN', 100, TRUE, NOW(), NOW()),
  ('774c2bbe-17a8-428d-94e1-53f113174c8b', '37fdf118-46b4-47d3-8e64-5fac92f37e6b', '84e771bb-c33e-48ae-9f88-b34618dc1db9', 3500.00, 'NGN', 70, TRUE, NOW(), NOW()),
  ('5b0f59c5-6a72-424d-8431-832cba578aca', '37fdf118-46b4-47d3-8e64-5fac92f37e6b', '4ce7b765-9716-4521-93c8-fda2636461e8', 7000.00, 'NGN', 115, TRUE, NOW(), NOW()),

  ('56032966-eea3-4d89-9f2d-f26e41db156c', '9be04981-32c8-4631-adb9-c752ccc7a33b', 'b2b8a6b9-7df7-4ff3-8bd7-64d6cd9f3121', 3500.00, 'NGN', 65, TRUE, NOW(), NOW()),
  ('163c99e0-8315-4fe3-83fc-8bc7da0a7af2', '9be04981-32c8-4631-adb9-c752ccc7a33b', 'd1c1e9e7-84e6-4591-bb68-a58337c30e4f', 2000.00, 'NGN', 35, TRUE, NOW(), NOW()),
  ('eb68210f-72a8-4077-93b9-175a737ca962', '9be04981-32c8-4631-adb9-c752ccc7a33b', 'fd822824-ffcc-4c19-9e9f-bf6e32f03f25', 6500.00, 'NGN', 105, TRUE, NOW(), NOW()),
  ('d8fa2a0b-3846-46fc-9ce4-01f4f070b5fa', '9be04981-32c8-4631-adb9-c752ccc7a33b', '84e771bb-c33e-48ae-9f88-b34618dc1db9', 4500.00, 'NGN', 80, TRUE, NOW(), NOW()),
  ('d6fc3af0-ec8c-4959-9907-d3e5377c7c54', '9be04981-32c8-4631-adb9-c752ccc7a33b', '4ce7b765-9716-4521-93c8-fda2636461e8', 8000.00, 'NGN', 130, TRUE, NOW(), NOW()),

  ('a0a8cb52-bf63-4f55-9d98-744ea9c9a0d5', '4f4e46a9-ba20-4b78-8a30-2ed8677c8056', 'b2b8a6b9-7df7-4ff3-8bd7-64d6cd9f3121', 7000.00, 'NGN', 125, TRUE, NOW(), NOW()),
  ('f7297fce-c7c8-45ee-9c7e-76fc261fb66d', '4f4e46a9-ba20-4b78-8a30-2ed8677c8056', 'd1c1e9e7-84e6-4591-bb68-a58337c30e4f', 6000.00, 'NGN', 105, TRUE, NOW(), NOW()),
  ('3f7d3381-aee5-4111-b4e7-b81fd947a8d3', '4f4e46a9-ba20-4b78-8a30-2ed8677c8056', 'fd822824-ffcc-4c19-9e9f-bf6e32f03f25', 9000.00, 'NGN', 145, TRUE, NOW(), NOW()),
  ('cece8f80-3914-4107-87f0-54fa1f15f609', '4f4e46a9-ba20-4b78-8a30-2ed8677c8056', '84e771bb-c33e-48ae-9f88-b34618dc1db9', 7500.00, 'NGN', 130, TRUE, NOW(), NOW()),
  ('7e05bb02-72d8-4617-af78-57825159df4b', '4f4e46a9-ba20-4b78-8a30-2ed8677c8056', '4ce7b765-9716-4521-93c8-fda2636461e8', 9500.00, 'NGN', 160, TRUE, NOW(), NOW())
ON CONFLICT (market_id, delivery_zone_id) DO NOTHING;

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
