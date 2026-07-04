-- Convert the PriceUnit enum into a managed table (price_units) and repoint the
-- five consuming tables (price_alerts, market_prices, buy_prices, wishlist_items,
-- order_items) at it via a price_unit_id foreign key. Data-preserving: existing
-- rows are backfilled by matching their old enum value against price_units.code
-- OR price_units.aliases, since two former enum values ('basket', 'paint_bucket')
-- were renamed to 'big_basket'/'paint' and only survive here as aliases.

-- CreateTable
CREATE TABLE "price_units" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "package_type" "PackageType",
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "price_units_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "price_units_code_key" ON "price_units"("code");
CREATE INDEX "price_units_is_active_idx" ON "price_units"("is_active");

-- Seed the unit catalogue (all former enum values plus common canonical units).
-- aliases/package_type drive the name & package-type resolution that used to be
-- hardcoded in the services.
INSERT INTO "price_units" ("id", "code", "label", "aliases", "package_type", "sort_order") VALUES
    (gen_random_uuid(), 'kg',            'Kilogram',      ARRAY['kilogram','kilograms'],        'weight', 1),
    (gen_random_uuid(), 'kilo',          'Kilo',          ARRAY['kilos'],                       NULL,     2),
    (gen_random_uuid(), 'bag',           'Bag',           ARRAY['bags'],                        'bag',    3),
    (gen_random_uuid(), 'bag_shiya',     'Bag (Shiya)',   ARRAY['shiya'],                       NULL,     4),
    (gen_random_uuid(), 'small_bag',     'Small Bag',     ARRAY[]::TEXT[],                      NULL,     5),
    (gen_random_uuid(), 'big_bag',       'Big Bag',       ARRAY[]::TEXT[],                      NULL,     6),
    (gen_random_uuid(), 'big_basket',    'Big Basket',    ARRAY['basket','baskets'],            'basket', 7),
    (gen_random_uuid(), 'mid_basket',    'Mid Basket',    ARRAY[]::TEXT[],                      NULL,     8),
    (gen_random_uuid(), 'small_basket',  'Small Basket',  ARRAY[]::TEXT[],                      NULL,     9),
    (gen_random_uuid(), 'bucket',        'Bucket',        ARRAY['buckets'],                     'bucket', 10),
    (gen_random_uuid(), 'paint',         'Paint',         ARRAY['paint_bucket','paintbucket'],  NULL,     11),
    (gen_random_uuid(), 'crate',         'Crate',         ARRAY['crates'],                      'crate',  12),
    (gen_random_uuid(), 'litre',         'Litre',         ARRAY['litres','liter','liters'],     'volume', 13),
    (gen_random_uuid(), 'bottle',        'Bottle',        ARRAY['bottles'],                     'bottle', 14),
    (gen_random_uuid(), 'bunch',         'Bunch',         ARRAY['bunches'],                     'bunch',  15),
    (gen_random_uuid(), 'piece',         'Piece',         ARRAY['pieces'],                      'piece',  16),
    (gen_random_uuid(), 'derica',        'Derica',        ARRAY['dericas'],                     NULL,     17),
    (gen_random_uuid(), 'bowl',          'Bowl',          ARRAY['bowls'],                       NULL,     18),
    (gen_random_uuid(), 'cup',           'Cup',           ARRAY['cups'],                        NULL,     19),
    (gen_random_uuid(), 'package',       'Package',       ARRAY['packages'],                    NULL,     20),
    (gen_random_uuid(), 'pan',           'Pan',           ARRAY['pans'],                        NULL,     21),
    (gen_random_uuid(), 'ten_pieces',    'Ten Pieces',    ARRAY['tenpieces'],                   NULL,     22),
    (gen_random_uuid(), 'three_quarter', 'Three Quarter', ARRAY['threequarter','3_4','3/4'],    NULL,     23);

-- ============================================================================
-- price_alerts
-- ============================================================================
ALTER TABLE "price_alerts" ADD COLUMN "price_unit_id" TEXT;
UPDATE "price_alerts" t SET "price_unit_id" = pu."id" FROM "price_units" pu WHERE pu."code" = t."unit"::text OR t."unit"::text = ANY(pu."aliases");
ALTER TABLE "price_alerts" ALTER COLUMN "price_unit_id" SET NOT NULL;
ALTER TABLE "price_alerts" DROP COLUMN "unit";
CREATE INDEX "price_alerts_price_unit_id_idx" ON "price_alerts"("price_unit_id");
ALTER TABLE "price_alerts" ADD CONSTRAINT "price_alerts_price_unit_id_fkey" FOREIGN KEY ("price_unit_id") REFERENCES "price_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================================
-- market_prices (drop the enum-bearing composite index first)
-- ============================================================================
DROP INDEX "market_prices_product_id_market_id_unit_observed_at_idx";
ALTER TABLE "market_prices" ADD COLUMN "price_unit_id" TEXT;
UPDATE "market_prices" t SET "price_unit_id" = pu."id" FROM "price_units" pu WHERE pu."code" = t."unit"::text OR t."unit"::text = ANY(pu."aliases");
ALTER TABLE "market_prices" ALTER COLUMN "price_unit_id" SET NOT NULL;
ALTER TABLE "market_prices" DROP COLUMN "unit";
CREATE INDEX "market_prices_prod_market_unit_observed_idx" ON "market_prices"("product_id", "market_id", "price_unit_id", "observed_at");
CREATE INDEX "market_prices_price_unit_id_idx" ON "market_prices"("price_unit_id");
ALTER TABLE "market_prices" ADD CONSTRAINT "market_prices_price_unit_id_fkey" FOREIGN KEY ("price_unit_id") REFERENCES "price_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================================
-- buy_prices
-- ============================================================================
ALTER TABLE "buy_prices" ADD COLUMN "price_unit_id" TEXT;
UPDATE "buy_prices" t SET "price_unit_id" = pu."id" FROM "price_units" pu WHERE pu."code" = t."unit"::text OR t."unit"::text = ANY(pu."aliases");
ALTER TABLE "buy_prices" ALTER COLUMN "price_unit_id" SET NOT NULL;
ALTER TABLE "buy_prices" DROP COLUMN "unit";
CREATE INDEX "buy_prices_price_unit_id_idx" ON "buy_prices"("price_unit_id");
ALTER TABLE "buy_prices" ADD CONSTRAINT "buy_prices_price_unit_id_fkey" FOREIGN KEY ("price_unit_id") REFERENCES "price_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================================
-- wishlist_items (drop the enum-bearing composite index first)
-- ============================================================================
DROP INDEX "wishlist_items_wishlist_id_product_id_unit_idx";
ALTER TABLE "wishlist_items" ADD COLUMN "price_unit_id" TEXT;
UPDATE "wishlist_items" t SET "price_unit_id" = pu."id" FROM "price_units" pu WHERE pu."code" = t."unit"::text OR t."unit"::text = ANY(pu."aliases");
ALTER TABLE "wishlist_items" ALTER COLUMN "price_unit_id" SET NOT NULL;
ALTER TABLE "wishlist_items" DROP COLUMN "unit";
CREATE INDEX "wishlist_items_wishlist_id_product_id_price_unit_id_idx" ON "wishlist_items"("wishlist_id", "product_id", "price_unit_id");
CREATE INDEX "wishlist_items_price_unit_id_idx" ON "wishlist_items"("price_unit_id");
ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_price_unit_id_fkey" FOREIGN KEY ("price_unit_id") REFERENCES "price_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================================
-- order_items
-- ============================================================================
ALTER TABLE "order_items" ADD COLUMN "price_unit_id" TEXT;
UPDATE "order_items" t SET "price_unit_id" = pu."id" FROM "price_units" pu WHERE pu."code" = t."unit"::text OR t."unit"::text = ANY(pu."aliases");
ALTER TABLE "order_items" ALTER COLUMN "price_unit_id" SET NOT NULL;
ALTER TABLE "order_items" DROP COLUMN "unit";
CREATE INDEX "order_items_price_unit_id_idx" ON "order_items"("price_unit_id");
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_price_unit_id_fkey" FOREIGN KEY ("price_unit_id") REFERENCES "price_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================================
-- Finally drop the now-unused enum type
-- ============================================================================
DROP TYPE "PriceUnit";
