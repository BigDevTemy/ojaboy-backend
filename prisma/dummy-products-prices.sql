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
  ('0e566a7b-9c7f-4e4a-ae03-8236e77d2d8e', 'Fresh Onions', 'Fresh onions sold by bag.', 'PROD-VEG-ONI-001', 'Vegetables', NULL, 'active', NOW(), NOW())
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
  ('e31d56ea-38fe-4196-b536-b907aa8a258b', 'd87961e7-e4c4-4031-8678-07574a27084d', '2ea198e0-1bd3-476e-b183-ce295e89a60d', 28000.00, 'NGN', 'basket', 1, 'standard', 'manual', '2026-06-04 08:00:00', 'Tomatoes at Ketu Market.', NOW(), NOW()),
  ('07034630-c2a3-48de-bcc6-38cfcd760c1e', '30d3f5cc-ac09-4e76-9c21-f5dc51dd0c57', '37fdf118-46b4-47d3-8e64-5fac92f37e6b', 1200.00, 'NGN', 'derica', 1, 'standard', 'manual', '2026-06-04 08:00:00', 'Garri at Daleko Market.', NOW(), NOW()),
  ('f70575d8-b73c-4e64-8492-3cc10caa615e', '9a9ad4b1-d4e1-4b81-bd90-a4202a336aa3', '2ea198e0-1bd3-476e-b183-ce295e89a60d', 2500.00, 'NGN', 'litre', 1, 'standard', 'manual', '2026-06-04 08:00:00', 'Palm oil at Ketu Market.', NOW(), NOW()),
  ('c8f2d2cb-731d-4af4-b0f2-3f3c118b2997', '1d6b69f8-0084-4fb5-9f29-939d6df6dd71', '37fdf118-46b4-47d3-8e64-5fac92f37e6b', 72000.00, 'NGN', 'bag', 1, 'standard', 'manual', '2026-06-04 08:00:00', 'Local rice at Daleko Market.', NOW(), NOW()),
  ('dcf490c5-cc93-44b4-b8e6-bc7e5c3f7799', '0e566a7b-9c7f-4e4a-ae03-8236e77d2d8e', '2a0a85b6-a4c9-4428-b69e-d0951f62db03', 65000.00, 'NGN', 'bag', 1, 'standard', 'manual', '2026-06-04 08:00:00', 'Onions at Mile 12 Market.', NOW(), NOW());

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
  is_active,
  valid_from,
  valid_until,
  created_at,
  updated_at
) VALUES
  ('a21a9864-d31c-4c4c-935c-663fb61e876e', 'd87961e7-e4c4-4031-8678-07574a27084d', '2a0a85b6-a4c9-4428-b69e-d0951f62db03', '8eb24a3a-f9bd-4229-b7bb-8b5dcfb43890', 26000.00, 2000.00, 1500.00, 1000.00, 30500.00, 'NGN', 'basket', TRUE, '2026-06-04 08:00:00', NULL, NOW(), NOW()),
  ('bbd3df1b-4fb7-4e51-b8ab-21d0cfebd509', '30d3f5cc-ac09-4e76-9c21-f5dc51dd0c57', '37fdf118-46b4-47d3-8e64-5fac92f37e6b', '07034630-c2a3-48de-bcc6-38cfcd760c1e', 1200.00, 150.00, 100.00, 50.00, 1500.00, 'NGN', 'derica', TRUE, '2026-06-04 08:00:00', NULL, NOW(), NOW()),
  ('05fb298b-0d77-448c-a44f-07da3d0b7427', '9a9ad4b1-d4e1-4b81-bd90-a4202a336aa3', '2ea198e0-1bd3-476e-b183-ce295e89a60d', 'f70575d8-b73c-4e64-8492-3cc10caa615e', 2500.00, 350.00, 150.00, 100.00, 3100.00, 'NGN', 'litre', TRUE, '2026-06-04 08:00:00', NULL, NOW(), NOW());
