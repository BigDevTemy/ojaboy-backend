-- Support amount-based order lines (e.g. "N2000 tomatoes" from free-text
-- order parsing): the customer states a Naira amount instead of a
-- quantity+unit, so there's no per-unit price to calculate. Add an explicit
-- pricing_mode discriminator and relax quantity/price_unit_id/unit_price to
-- optional, since an amount-based line has none of those - only a product
-- and the stated total.

-- CreateEnum
CREATE TYPE "OrderItemPricingMode" AS ENUM ('unit', 'amount');

-- AlterTable
ALTER TABLE "order_items" ADD COLUMN "pricing_mode" "OrderItemPricingMode" NOT NULL DEFAULT 'unit';
ALTER TABLE "order_items" ALTER COLUMN "quantity" DROP NOT NULL;
ALTER TABLE "order_items" ALTER COLUMN "price_unit_id" DROP NOT NULL;
ALTER TABLE "order_items" ALTER COLUMN "unit_price" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "order_items_pricing_mode_idx" ON "order_items"("pricing_mode");
