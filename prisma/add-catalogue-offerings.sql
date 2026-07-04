DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PackageType') THEN
    CREATE TYPE "PackageType" AS ENUM (
      'weight',
      'volume',
      'bag',
      'basket',
      'bucket',
      'crate',
      'bottle',
      'bunch',
      'piece',
      'other'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MeasurementUnit') THEN
    CREATE TYPE "MeasurementUnit" AS ENUM (
      'kg',
      'g',
      'litre',
      'ml',
      'piece'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS product_variants (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT product_variants_product_id_name_key UNIQUE (product_id, name),
  CONSTRAINT product_variants_product_id_code_key UNIQUE (product_id, code)
);

CREATE TABLE IF NOT EXISTS manufacturers (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS brands (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  manufacturer_id TEXT REFERENCES manufacturers(id) ON DELETE SET NULL,
  name TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS product_packages (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL UNIQUE,
  package_type "PackageType" NOT NULL,
  base_unit "MeasurementUnit",
  quantity DECIMAL(12, 3),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT product_packages_measurement_check CHECK (
    (base_unit IS NULL AND quantity IS NULL)
    OR (base_unit IS NOT NULL AND quantity IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS product_offerings (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  variant_id TEXT REFERENCES product_variants(id) ON DELETE RESTRICT,
  brand_id TEXT REFERENCES brands(id) ON DELETE RESTRICT,
  package_id TEXT NOT NULL REFERENCES product_packages(id) ON DELETE RESTRICT,
  sku TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT product_offerings_identity_key
    UNIQUE (product_id, variant_id, brand_id, package_id)
);

CREATE INDEX IF NOT EXISTS product_variants_product_id_is_active_idx
  ON product_variants(product_id, is_active);
CREATE INDEX IF NOT EXISTS manufacturers_is_active_idx
  ON manufacturers(is_active);
CREATE INDEX IF NOT EXISTS brands_manufacturer_id_idx
  ON brands(manufacturer_id);
CREATE INDEX IF NOT EXISTS brands_is_active_idx
  ON brands(is_active);
CREATE INDEX IF NOT EXISTS product_packages_package_type_idx
  ON product_packages(package_type);
CREATE INDEX IF NOT EXISTS product_packages_is_active_idx
  ON product_packages(is_active);
CREATE INDEX IF NOT EXISTS product_offerings_product_id_is_active_idx
  ON product_offerings(product_id, is_active);
CREATE INDEX IF NOT EXISTS product_offerings_variant_id_idx
  ON product_offerings(variant_id);
CREATE INDEX IF NOT EXISTS product_offerings_brand_id_idx
  ON product_offerings(brand_id);
CREATE INDEX IF NOT EXISTS product_offerings_package_id_idx
  ON product_offerings(package_id);

ALTER TABLE market_prices
  ADD COLUMN IF NOT EXISTS product_offering_id TEXT
  REFERENCES product_offerings(id) ON DELETE SET NULL;
ALTER TABLE buy_prices
  ADD COLUMN IF NOT EXISTS product_offering_id TEXT
  REFERENCES product_offerings(id) ON DELETE SET NULL;
ALTER TABLE wishlist_items
  ADD COLUMN IF NOT EXISTS product_offering_id TEXT
  REFERENCES product_offerings(id) ON DELETE SET NULL;
ALTER TABLE price_alerts
  ADD COLUMN IF NOT EXISTS product_offering_id TEXT
  REFERENCES product_offerings(id) ON DELETE SET NULL;
ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS product_offering_id TEXT
  REFERENCES product_offerings(id) ON DELETE SET NULL;
ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS product_name TEXT;
ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS variant_name TEXT;
ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS brand_name TEXT;
ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS package_name TEXT;
ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS offering_sku TEXT;

CREATE INDEX IF NOT EXISTS market_prices_product_offering_id_idx
  ON market_prices(product_offering_id);
CREATE INDEX IF NOT EXISTS buy_prices_product_offering_id_idx
  ON buy_prices(product_offering_id);
CREATE INDEX IF NOT EXISTS wishlist_items_product_offering_id_idx
  ON wishlist_items(product_offering_id);
CREATE INDEX IF NOT EXISTS price_alerts_product_offering_id_idx
  ON price_alerts(product_offering_id);
CREATE INDEX IF NOT EXISTS order_items_product_offering_id_idx
  ON order_items(product_offering_id);

ALTER TABLE market_prices
  DROP CONSTRAINT IF EXISTS market_prices_product_id_market_id_unit_observed_at_key;
ALTER TABLE market_prices
  DROP CONSTRAINT IF EXISTS "MarketPrice_productId_marketId_unit_observedAt_key";

CREATE UNIQUE INDEX IF NOT EXISTS market_prices_legacy_identity_key
  ON market_prices(product_id, market_id, unit, observed_at)
  WHERE product_offering_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS market_prices_offering_identity_key
  ON market_prices(product_offering_id, market_id, observed_at)
  WHERE product_offering_id IS NOT NULL;

ALTER TABLE wishlist_items
  DROP CONSTRAINT IF EXISTS wishlist_items_wishlist_product_unit_key;
ALTER TABLE wishlist_items
  DROP CONSTRAINT IF EXISTS wishlist_items_wishlist_id_product_id_unit_key;

CREATE UNIQUE INDEX IF NOT EXISTS wishlist_items_legacy_identity_key
  ON wishlist_items(wishlist_id, product_id, unit)
  WHERE product_offering_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS wishlist_items_offering_identity_key
  ON wishlist_items(wishlist_id, product_offering_id)
  WHERE product_offering_id IS NOT NULL;

DROP INDEX IF EXISTS price_alerts_product_unit_status_idx;
CREATE INDEX IF NOT EXISTS price_alerts_product_offering_status_idx
  ON price_alerts(product_offering_id, status);

ALTER TABLE price_alerts
  DROP CONSTRAINT IF EXISTS price_alerts_product_offering_id_fkey;
ALTER TABLE price_alerts
  ADD CONSTRAINT price_alerts_product_offering_id_fkey
  FOREIGN KEY (product_offering_id)
  REFERENCES product_offerings(id)
  ON DELETE CASCADE;
ALTER TABLE price_alerts
  ALTER COLUMN product_offering_id SET NOT NULL;
