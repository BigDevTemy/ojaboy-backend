BEGIN;

ALTER TABLE delivery_zones
ADD COLUMN IF NOT EXISTS delivery_cost NUMERIC(12, 2) NOT NULL DEFAULT 0;

UPDATE delivery_zones
SET
  delivery_cost = CASE name
    WHEN 'Yaba' THEN 1500
    WHEN 'Ikeja' THEN 1750
    WHEN 'Lekki' THEN 2500
    WHEN 'Surulere' THEN 1750
    WHEN 'Ajah' THEN 3000
    WHEN 'Victoria Island' THEN 2500
    WHEN 'Ikoyi' THEN 2750
    WHEN 'Lagos Island' THEN 2250
    WHEN 'Gbagada' THEN 1750
    WHEN 'Kosofe' THEN 1750
    WHEN 'Amuwo Odofin' THEN 2500
    WHEN 'Alimosho' THEN 2500
    ELSE delivery_cost
  END,
  updated_at = NOW();

COMMIT;
