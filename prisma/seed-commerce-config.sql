BEGIN;

UPDATE service_fee_rules
SET
  is_active = FALSE,
  updated_at = NOW()
WHERE is_active = TRUE;

INSERT INTO service_fee_rules (
  id,
  name,
  percentage,
  base_fee,
  minimum_fee,
  maximum_fee,
  currency,
  is_active,
  valid_from,
  valid_until,
  created_at,
  updated_at
) VALUES (
  '37dff811-b394-437f-b950-376e1313be72',
  'Standard service fee',
  3.00,
  300.00,
  500.00,
  3000.00,
  'NGN',
  TRUE,
  NOW(),
  NULL,
  NOW(),
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  percentage = EXCLUDED.percentage,
  base_fee = EXCLUDED.base_fee,
  minimum_fee = EXCLUDED.minimum_fee,
  maximum_fee = EXCLUDED.maximum_fee,
  currency = EXCLUDED.currency,
  is_active = EXCLUDED.is_active,
  valid_from = EXCLUDED.valid_from,
  valid_until = EXCLUDED.valid_until,
  updated_at = NOW();

COMMIT;
