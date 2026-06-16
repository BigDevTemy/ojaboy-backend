DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PriceAlertCondition') THEN
    CREATE TYPE "PriceAlertCondition" AS ENUM (
      'below',
      'above',
      'at_or_below',
      'at_or_above'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PriceAlertStatus') THEN
    CREATE TYPE "PriceAlertStatus" AS ENUM (
      'active',
      'paused',
      'triggered',
      'cancelled'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PriceAlertFrequency') THEN
    CREATE TYPE "PriceAlertFrequency" AS ENUM (
      'one_time',
      'once_per_day',
      'once_per_week',
      'every_price_change'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS price_alerts (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  target_price DECIMAL(12, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'NGN',
  unit "PriceUnit" NOT NULL,
  condition "PriceAlertCondition" NOT NULL DEFAULT 'at_or_below',
  frequency "PriceAlertFrequency" NOT NULL DEFAULT 'one_time',
  status "PriceAlertStatus" NOT NULL DEFAULT 'active',
  last_triggered_at TIMESTAMP(3),
  triggered_price DECIMAL(12, 2),
  trigger_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS price_alerts_user_id_idx
  ON price_alerts(user_id);
CREATE INDEX IF NOT EXISTS price_alerts_product_id_idx
  ON price_alerts(product_id);
CREATE INDEX IF NOT EXISTS price_alerts_status_idx
  ON price_alerts(status);
CREATE INDEX IF NOT EXISTS price_alerts_product_unit_status_idx
  ON price_alerts(product_id, unit, status);

ALTER TABLE price_alerts
  ADD COLUMN IF NOT EXISTS frequency "PriceAlertFrequency" NOT NULL DEFAULT 'one_time';
