-- Repoint ProductPackage.baseUnit at the price_units table instead of the
-- fixed MeasurementUnit enum (kg, g, litre, ml, piece), so a package's base
-- unit can be any managed price unit (e.g. cup, derica, bowl), matching the
-- price_unit_to_table migration already applied to price_alerts,
-- market_prices, buy_prices, wishlist_items, and order_items.
--
-- No backfill needed: every existing product_packages row currently has
-- base_unit = NULL.

-- AddColumn
ALTER TABLE "product_packages" ADD COLUMN "base_unit_id" TEXT;

-- Backfill (defensive, in case any row already has a base_unit set)
UPDATE "product_packages" t
SET "base_unit_id" = pu."id"
FROM "price_units" pu
WHERE pu."code" = t."base_unit"::text OR t."base_unit"::text = ANY(pu."aliases");

-- DropColumn
ALTER TABLE "product_packages" DROP COLUMN "base_unit";

-- CreateIndex
CREATE INDEX "product_packages_base_unit_id_idx" ON "product_packages"("base_unit_id");

-- AddForeignKey
ALTER TABLE "product_packages" ADD CONSTRAINT "product_packages_base_unit_id_fkey" FOREIGN KEY ("base_unit_id") REFERENCES "price_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Drop the now-unused enum type
DROP TYPE "MeasurementUnit";
