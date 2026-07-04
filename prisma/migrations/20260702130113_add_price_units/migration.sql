/*
  Warnings:

  - The values [kg,basket,paint_bucket,litre,bottle,piece] on the enum `PriceUnit` will be removed. If these variants are still used in the database, this will fail.
  - The primary key for the `webhook_logs` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the `agent_auth_sessions` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `agent_conversation_messages` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `agent_conversations` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `checkpoint_blobs` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `checkpoint_migrations` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `checkpoint_writes` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `checkpoints` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "PriceUnit_new" AS ENUM ('bag', 'bag_shiya', 'big_bag', 'big_basket', 'bowl', 'bucket', 'bunch', 'crate', 'cup', 'derica', 'kilo', 'mid_basket', 'package', 'paint', 'pan', 'small_bag', 'small_basket', 'three_quarter', 'ten_pieces');
ALTER TABLE "price_alerts" ALTER COLUMN "unit" TYPE "PriceUnit_new" USING ("unit"::text::"PriceUnit_new");
ALTER TABLE "market_prices" ALTER COLUMN "unit" TYPE "PriceUnit_new" USING ("unit"::text::"PriceUnit_new");
ALTER TABLE "buy_prices" ALTER COLUMN "unit" TYPE "PriceUnit_new" USING ("unit"::text::"PriceUnit_new");
ALTER TABLE "wishlist_items" ALTER COLUMN "unit" TYPE "PriceUnit_new" USING ("unit"::text::"PriceUnit_new");
ALTER TABLE "order_items" ALTER COLUMN "unit" TYPE "PriceUnit_new" USING ("unit"::text::"PriceUnit_new");
ALTER TYPE "PriceUnit" RENAME TO "PriceUnit_old";
ALTER TYPE "PriceUnit_new" RENAME TO "PriceUnit";
DROP TYPE "public"."PriceUnit_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "agent_conversation_messages" DROP CONSTRAINT "agent_conversation_messages_session_id_fkey";

-- DropForeignKey
ALTER TABLE "brands" DROP CONSTRAINT "brands_manufacturer_id_fkey";

-- DropForeignKey
ALTER TABLE "buy_prices" DROP CONSTRAINT "buy_prices_product_offering_id_fkey";

-- DropForeignKey
ALTER TABLE "market_analysis_benchmark_markets" DROP CONSTRAINT "market_analysis_benchmark_markets_benchmark_id_fkey";

-- DropForeignKey
ALTER TABLE "market_analysis_benchmark_markets" DROP CONSTRAINT "market_analysis_benchmark_markets_market_id_fkey";

-- DropForeignKey
ALTER TABLE "market_analysis_benchmarks" DROP CONSTRAINT "market_analysis_benchmarks_product_offering_id_fkey";

-- DropForeignKey
ALTER TABLE "market_analysis_snapshot_items" DROP CONSTRAINT "market_analysis_snapshot_items_product_offering_id_fkey";

-- DropForeignKey
ALTER TABLE "market_analysis_snapshot_items" DROP CONSTRAINT "market_analysis_snapshot_items_snapshot_id_fkey";

-- DropForeignKey
ALTER TABLE "market_prices" DROP CONSTRAINT "market_prices_product_offering_id_fkey";

-- DropForeignKey
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_actor_user_id_fkey";

-- DropForeignKey
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_order_id_fkey";

-- DropForeignKey
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_payment_id_fkey";

-- DropForeignKey
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_price_alert_id_fkey";

-- DropForeignKey
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_user_id_fkey";

-- DropForeignKey
ALTER TABLE "order_items" DROP CONSTRAINT "order_items_product_offering_id_fkey";

-- DropForeignKey
ALTER TABLE "price_alerts" DROP CONSTRAINT "price_alerts_product_id_fkey";

-- DropForeignKey
ALTER TABLE "price_alerts" DROP CONSTRAINT "price_alerts_product_offering_id_fkey";

-- DropForeignKey
ALTER TABLE "price_alerts" DROP CONSTRAINT "price_alerts_user_id_fkey";

-- DropForeignKey
ALTER TABLE "product_offerings" DROP CONSTRAINT "product_offerings_brand_id_fkey";

-- DropForeignKey
ALTER TABLE "product_offerings" DROP CONSTRAINT "product_offerings_package_id_fkey";

-- DropForeignKey
ALTER TABLE "product_offerings" DROP CONSTRAINT "product_offerings_product_id_fkey";

-- DropForeignKey
ALTER TABLE "product_offerings" DROP CONSTRAINT "product_offerings_variant_id_fkey";

-- DropForeignKey
ALTER TABLE "product_variants" DROP CONSTRAINT "product_variants_product_id_fkey";

-- DropForeignKey
ALTER TABLE "products" DROP CONSTRAINT "products_category_id_fkey";

-- DropForeignKey
ALTER TABLE "refresh_tokens" DROP CONSTRAINT "refresh_tokens_user_id_fkey";

-- DropForeignKey
ALTER TABLE "support_ticket_assignments" DROP CONSTRAINT "support_ticket_assignments_assigned_by_id_fkey";

-- DropForeignKey
ALTER TABLE "support_ticket_assignments" DROP CONSTRAINT "support_ticket_assignments_new_assignee_id_fkey";

-- DropForeignKey
ALTER TABLE "support_ticket_assignments" DROP CONSTRAINT "support_ticket_assignments_previous_assignee_id_fkey";

-- DropForeignKey
ALTER TABLE "support_ticket_assignments" DROP CONSTRAINT "support_ticket_assignments_ticket_id_fkey";

-- DropForeignKey
ALTER TABLE "support_ticket_attachments" DROP CONSTRAINT "support_ticket_attachments_message_id_fkey";

-- DropForeignKey
ALTER TABLE "support_ticket_messages" DROP CONSTRAINT "support_ticket_messages_sender_id_fkey";

-- DropForeignKey
ALTER TABLE "support_ticket_messages" DROP CONSTRAINT "support_ticket_messages_ticket_id_fkey";

-- DropForeignKey
ALTER TABLE "support_tickets" DROP CONSTRAINT "support_tickets_assigned_to_id_fkey";

-- DropForeignKey
ALTER TABLE "support_tickets" DROP CONSTRAINT "support_tickets_customer_id_fkey";

-- DropForeignKey
ALTER TABLE "support_tickets" DROP CONSTRAINT "support_tickets_order_id_fkey";

-- DropForeignKey
ALTER TABLE "wishlist_items" DROP CONSTRAINT "wishlist_items_product_id_fkey";

-- DropForeignKey
ALTER TABLE "wishlist_items" DROP CONSTRAINT "wishlist_items_product_offering_id_fkey";

-- DropForeignKey
ALTER TABLE "wishlist_items" DROP CONSTRAINT "wishlist_items_wishlist_id_fkey";

-- DropForeignKey
ALTER TABLE "wishlists" DROP CONSTRAINT "wishlists_order_id_fkey";

-- DropForeignKey
ALTER TABLE "wishlists" DROP CONSTRAINT "wishlists_user_id_fkey";

-- DropIndex
DROP INDEX "market_prices_legacy_identity_key";

-- DropIndex
DROP INDEX "market_prices_offering_identity_key";

-- DropIndex
DROP INDEX "market_prices_product_id_market_id_unit_observed_at_key";

-- DropIndex
DROP INDEX "wishlist_items_legacy_identity_key";

-- DropIndex
DROP INDEX "wishlist_items_offering_identity_key";

-- AlterTable
ALTER TABLE "brands" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "manufacturers" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "market_analysis_benchmarks" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "market_analysis_snapshot_items" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "market_analysis_snapshots" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "notifications" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "order_feedbacks" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "paystack_bank_transfer_accounts" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "price_alerts" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "product_categories" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "product_offerings" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "product_packages" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "product_variants" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "refresh_tokens" ALTER COLUMN "expires_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "revoked_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "support_ticket_assignments" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "support_ticket_attachments" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "support_ticket_messages" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "support_tickets" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "webhook_logs" DROP CONSTRAINT "webhook_logs_pkey",
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "received_at" SET DATA TYPE TIMESTAMP(3),
ADD CONSTRAINT "webhook_logs_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "wishlist_items" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "wishlists" ALTER COLUMN "updated_at" DROP DEFAULT;

-- DropTable
DROP TABLE "agent_auth_sessions";

-- DropTable
DROP TABLE "agent_conversation_messages";

-- DropTable
DROP TABLE "agent_conversations";

-- DropTable
DROP TABLE "checkpoint_blobs";

-- DropTable
DROP TABLE "checkpoint_migrations";

-- DropTable
DROP TABLE "checkpoint_writes";

-- DropTable
DROP TABLE "checkpoints";

-- CreateIndex
CREATE INDEX "market_prices_product_id_market_id_unit_observed_at_idx" ON "market_prices"("product_id", "market_id", "unit", "observed_at");

-- CreateIndex
CREATE INDEX "market_prices_product_offering_id_market_id_observed_at_idx" ON "market_prices"("product_offering_id", "market_id", "observed_at");

-- CreateIndex
CREATE INDEX "wishlist_items_wishlist_id_product_id_unit_idx" ON "wishlist_items"("wishlist_id", "product_id", "unit");

-- CreateIndex
CREATE INDEX "wishlist_items_wishlist_id_product_offering_id_idx" ON "wishlist_items"("wishlist_id", "product_offering_id");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "product_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brands" ADD CONSTRAINT "brands_manufacturer_id_fkey" FOREIGN KEY ("manufacturer_id") REFERENCES "manufacturers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_offerings" ADD CONSTRAINT "product_offerings_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_offerings" ADD CONSTRAINT "product_offerings_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_offerings" ADD CONSTRAINT "product_offerings_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_offerings" ADD CONSTRAINT "product_offerings_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "product_packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "market_analysis_benchmarks" ADD CONSTRAINT "market_analysis_benchmarks_product_offering_id_fkey" FOREIGN KEY ("product_offering_id") REFERENCES "product_offerings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "market_analysis_benchmark_markets" ADD CONSTRAINT "market_analysis_benchmark_markets_benchmark_id_fkey" FOREIGN KEY ("benchmark_id") REFERENCES "market_analysis_benchmarks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "market_analysis_benchmark_markets" ADD CONSTRAINT "market_analysis_benchmark_markets_market_id_fkey" FOREIGN KEY ("market_id") REFERENCES "markets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "market_analysis_snapshot_items" ADD CONSTRAINT "market_analysis_snapshot_items_snapshot_id_fkey" FOREIGN KEY ("snapshot_id") REFERENCES "market_analysis_snapshots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "market_analysis_snapshot_items" ADD CONSTRAINT "market_analysis_snapshot_items_product_offering_id_fkey" FOREIGN KEY ("product_offering_id") REFERENCES "product_offerings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_price_alert_id_fkey" FOREIGN KEY ("price_alert_id") REFERENCES "price_alerts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_alerts" ADD CONSTRAINT "price_alerts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_alerts" ADD CONSTRAINT "price_alerts_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_alerts" ADD CONSTRAINT "price_alerts_product_offering_id_fkey" FOREIGN KEY ("product_offering_id") REFERENCES "product_offerings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "market_prices" ADD CONSTRAINT "market_prices_product_offering_id_fkey" FOREIGN KEY ("product_offering_id") REFERENCES "product_offerings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buy_prices" ADD CONSTRAINT "buy_prices_product_offering_id_fkey" FOREIGN KEY ("product_offering_id") REFERENCES "product_offerings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wishlists" ADD CONSTRAINT "wishlists_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wishlists" ADD CONSTRAINT "wishlists_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_wishlist_id_fkey" FOREIGN KEY ("wishlist_id") REFERENCES "wishlists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_product_offering_id_fkey" FOREIGN KEY ("product_offering_id") REFERENCES "product_offerings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_ticket_messages" ADD CONSTRAINT "support_ticket_messages_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "support_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_ticket_messages" ADD CONSTRAINT "support_ticket_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_ticket_attachments" ADD CONSTRAINT "support_ticket_attachments_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "support_ticket_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_ticket_assignments" ADD CONSTRAINT "support_ticket_assignments_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "support_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_ticket_assignments" ADD CONSTRAINT "support_ticket_assignments_previous_assignee_id_fkey" FOREIGN KEY ("previous_assignee_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_ticket_assignments" ADD CONSTRAINT "support_ticket_assignments_new_assignee_id_fkey" FOREIGN KEY ("new_assignee_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_ticket_assignments" ADD CONSTRAINT "support_ticket_assignments_assigned_by_id_fkey" FOREIGN KEY ("assigned_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_offering_id_fkey" FOREIGN KEY ("product_offering_id") REFERENCES "product_offerings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "market_analysis_snapshot_item_snapshot_id_product_offering__key" RENAME TO "market_analysis_snapshot_items_snapshot_id_product_offering_key";

-- RenameIndex
ALTER INDEX "market_analysis_snapshot_items_offering_id_idx" RENAME TO "market_analysis_snapshot_items_product_offering_id_idx";

-- RenameIndex
ALTER INDEX "market_analysis_snapshots_status_date_idx" RENAME TO "market_analysis_snapshots_status_analysis_date_idx";

-- RenameIndex
ALTER INDEX "price_alerts_product_offering_status_idx" RENAME TO "price_alerts_product_offering_id_status_idx";

-- RenameIndex
ALTER INDEX "product_offerings_identity_key" RENAME TO "product_offerings_product_id_variant_id_brand_id_package_id_key";
