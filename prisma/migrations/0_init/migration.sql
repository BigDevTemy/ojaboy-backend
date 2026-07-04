-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "public"."AddressZoneStatus" AS ENUM ('supported', 'unsupported', 'zone_inactive');

-- CreateEnum
CREATE TYPE "public"."BuyPriceStrategy" AS ENUM ('cheapest', 'average', 'median', 'preferred_market', 'single_market', 'quality_first', 'fastest_fulfillment', 'hybrid_landed_cost', 'manual_override');

-- CreateEnum
CREATE TYPE "public"."CouponDiscountType" AS ENUM ('percentage', 'fixed');

-- CreateEnum
CREATE TYPE "public"."MarketAnalysisSnapshotStatus" AS ENUM ('processing', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "public"."MarketAnalysisTrend" AS ENUM ('up', 'down', 'unchanged', 'unavailable');

-- CreateEnum
CREATE TYPE "public"."MarketStatus" AS ENUM ('active', 'inactive');

-- CreateEnum
CREATE TYPE "public"."MeasurementUnit" AS ENUM ('kg', 'g', 'litre', 'ml', 'piece');

-- CreateEnum
CREATE TYPE "public"."NotificationChannel" AS ENUM ('in_app', 'email', 'sms', 'push');

-- CreateEnum
CREATE TYPE "public"."NotificationPriority" AS ENUM ('low', 'normal', 'high', 'urgent');

-- CreateEnum
CREATE TYPE "public"."NotificationSource" AS ENUM ('order', 'price_alert', 'admin', 'payment', 'system');

-- CreateEnum
CREATE TYPE "public"."NotificationStatus" AS ENUM ('pending', 'sent', 'delivered', 'failed');

-- CreateEnum
CREATE TYPE "public"."OrderPaymentStatus" AS ENUM ('pending', 'paid');

-- CreateEnum
CREATE TYPE "public"."OrderStatus" AS ENUM ('pending', 'confirmed', 'processing', 'out_for_delivery', 'delivered', 'cancelled');

-- CreateEnum
CREATE TYPE "public"."PackageType" AS ENUM ('weight', 'volume', 'bag', 'basket', 'bucket', 'crate', 'bottle', 'bunch', 'piece', 'other');

-- CreateEnum
CREATE TYPE "public"."PaymentProvider" AS ENUM ('paystack', 'flutterwave', 'stripe', 'bank_transfer', 'cash');

-- CreateEnum
CREATE TYPE "public"."PaymentStatus" AS ENUM ('initializing', 'pending', 'successful', 'failed', 'cancelled', 'refunded');

-- CreateEnum
CREATE TYPE "public"."PriceAlertCondition" AS ENUM ('below', 'above', 'at_or_below', 'at_or_above');

-- CreateEnum
CREATE TYPE "public"."PriceAlertFrequency" AS ENUM ('one_time', 'once_per_day', 'once_per_week', 'every_price_change');

-- CreateEnum
CREATE TYPE "public"."PriceAlertStatus" AS ENUM ('active', 'paused', 'triggered', 'cancelled');

-- CreateEnum
CREATE TYPE "public"."PriceQualityGrade" AS ENUM ('low', 'standard', 'premium');

-- CreateEnum
CREATE TYPE "public"."PriceSource" AS ENUM ('manual', 'agent', 'scraper', 'partner', 'admin');

-- CreateEnum
CREATE TYPE "public"."PriceUnit" AS ENUM ('kg', 'bag', 'basket', 'paint_bucket', 'crate', 'litre', 'bottle', 'bunch', 'piece', 'derica');

-- CreateEnum
CREATE TYPE "public"."ProductStatus" AS ENUM ('active', 'inactive', 'out_of_stock');

-- CreateEnum
CREATE TYPE "public"."SupportTicketAssignmentMethod" AS ENUM ('auto', 'manual');

-- CreateEnum
CREATE TYPE "public"."SupportTicketCategory" AS ENUM ('refund_and_payment', 'order_issue', 'delivery', 'account', 'general');

-- CreateEnum
CREATE TYPE "public"."SupportTicketPriority" AS ENUM ('low', 'normal', 'high', 'urgent');

-- CreateEnum
CREATE TYPE "public"."SupportTicketSenderType" AS ENUM ('customer', 'staff');

-- CreateEnum
CREATE TYPE "public"."SupportTicketStatus" AS ENUM ('open', 'in_review', 'waiting_on_customer', 'resolved');

-- CreateTable
CREATE TABLE "public"."agent_auth_sessions" (
    "session_id" TEXT NOT NULL,
    "user_id" TEXT,
    "encrypted_payload" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_auth_sessions_pkey" PRIMARY KEY ("session_id")
);

-- CreateTable
CREATE TABLE "public"."agent_conversation_messages" (
    "id" BIGSERIAL NOT NULL,
    "session_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "tools" JSONB NOT NULL DEFAULT '[]',
    "sources" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_conversation_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."agent_conversations" (
    "session_id" TEXT NOT NULL,
    "user_id" TEXT,
    "authenticated" BOOLEAN NOT NULL DEFAULT false,
    "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_message_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_conversations_pkey" PRIMARY KEY ("session_id")
);

-- CreateTable
CREATE TABLE "public"."brands" (
    "id" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
    "manufacturer_id" TEXT,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "brands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."buy_prices" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "market_id" TEXT,
    "market_price_id" TEXT,
    "base_market_price" DECIMAL(12,2) NOT NULL,
    "margin_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "logistics_buffer" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "risk_buffer" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "final_price" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "unit" "public"."PriceUnit" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "valid_from" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valid_until" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "strategy_used" "public"."BuyPriceStrategy" NOT NULL DEFAULT 'cheapest',
    "product_offering_id" TEXT,

    CONSTRAINT "buy_prices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."checkpoint_blobs" (
    "thread_id" TEXT NOT NULL,
    "checkpoint_ns" TEXT NOT NULL DEFAULT '',
    "channel" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "blob" BYTEA,

    CONSTRAINT "checkpoint_blobs_pkey" PRIMARY KEY ("thread_id","checkpoint_ns","channel","version")
);

-- CreateTable
CREATE TABLE "public"."checkpoint_migrations" (
    "v" INTEGER NOT NULL,

    CONSTRAINT "checkpoint_migrations_pkey" PRIMARY KEY ("v")
);

-- CreateTable
CREATE TABLE "public"."checkpoint_writes" (
    "thread_id" TEXT NOT NULL,
    "checkpoint_ns" TEXT NOT NULL DEFAULT '',
    "checkpoint_id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "idx" INTEGER NOT NULL,
    "channel" TEXT NOT NULL,
    "type" TEXT,
    "blob" BYTEA NOT NULL,
    "task_path" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "checkpoint_writes_pkey" PRIMARY KEY ("thread_id","checkpoint_ns","checkpoint_id","task_id","idx")
);

-- CreateTable
CREATE TABLE "public"."checkpoints" (
    "thread_id" TEXT NOT NULL,
    "checkpoint_ns" TEXT NOT NULL DEFAULT '',
    "checkpoint_id" TEXT NOT NULL,
    "parent_checkpoint_id" TEXT,
    "type" TEXT,
    "checkpoint" JSONB NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "checkpoints_pkey" PRIMARY KEY ("thread_id","checkpoint_ns","checkpoint_id")
);

-- CreateTable
CREATE TABLE "public"."coupon_customers" (
    "id" TEXT NOT NULL,
    "coupon_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coupon_customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."coupon_redemptions" (
    "id" TEXT NOT NULL,
    "coupon_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "discount_amount" DECIMAL(12,2) NOT NULL,
    "redeemed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coupon_redemptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."coupons" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "discount_type" "public"."CouponDiscountType" NOT NULL,
    "discount_value" DECIMAL(12,2) NOT NULL,
    "maximum_discount" DECIMAL(12,2),
    "minimum_subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "usage_limit" INTEGER,
    "per_customer_limit" INTEGER NOT NULL DEFAULT 1,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "valid_from" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valid_until" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coupons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."delivery_areas" (
    "id" TEXT NOT NULL,
    "delivery_zone_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalized_name" TEXT NOT NULL,
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "locality" TEXT,
    "state" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'Nigeria',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "delivery_areas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."delivery_zones" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "delivery_cost" DECIMAL(12,2) NOT NULL DEFAULT 0,

    CONSTRAINT "delivery_zones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."email_verification_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_verification_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."manufacturers" (
    "id" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "manufacturers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."market_analysis_benchmark_markets" (
    "benchmark_id" TEXT NOT NULL,
    "market_id" TEXT NOT NULL,

    CONSTRAINT "market_analysis_benchmark_markets_pkey" PRIMARY KEY ("benchmark_id","market_id")
);

-- CreateTable
CREATE TABLE "public"."market_analysis_benchmarks" (
    "id" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
    "product_offering_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "market_analysis_benchmarks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."market_analysis_snapshot_items" (
    "id" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
    "snapshot_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "product_offering_id" TEXT NOT NULL,
    "product_name" TEXT NOT NULL,
    "variant_name" TEXT,
    "brand_name" TEXT,
    "package_name" TEXT NOT NULL,
    "current_price" DECIMAL(12,2),
    "previous_price" DECIMAL(12,2),
    "change_percentage" DECIMAL(10,2),
    "trend" "public"."MarketAnalysisTrend" NOT NULL DEFAULT 'unavailable',
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "observation_count" INTEGER NOT NULL DEFAULT 0,
    "last_price_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "market_analysis_snapshot_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."market_analysis_snapshots" (
    "id" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
    "analysis_date" DATE NOT NULL,
    "status" "public"."MarketAnalysisSnapshotStatus" NOT NULL DEFAULT 'processing',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "market_analysis_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."market_delivery_costs" (
    "id" TEXT NOT NULL,
    "market_id" TEXT NOT NULL,
    "delivery_zone_id" TEXT NOT NULL,
    "cost" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "estimated_minutes" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "market_delivery_costs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."market_prices" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "market_id" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "unit" "public"."PriceUnit" NOT NULL,
    "quantity" DECIMAL(12,2) NOT NULL DEFAULT 1,
    "quality_grade" "public"."PriceQualityGrade" NOT NULL DEFAULT 'standard',
    "source" "public"."PriceSource" NOT NULL DEFAULT 'manual',
    "observed_at" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "product_offering_id" TEXT,

    CONSTRAINT "market_prices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."market_route_costs" (
    "id" TEXT NOT NULL,
    "from_market_id" TEXT NOT NULL,
    "to_market_id" TEXT NOT NULL,
    "cost" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "estimated_minutes" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "market_route_costs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."markets" (
    "id" TEXT NOT NULL,
    "marketname" TEXT NOT NULL,
    "marketaddress" TEXT,
    "status" "public"."MarketStatus" NOT NULL DEFAULT 'active',

    CONSTRAINT "markets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."notifications" (
    "id" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
    "user_id" TEXT NOT NULL,
    "actor_user_id" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "source" "public"."NotificationSource" NOT NULL,
    "event" TEXT,
    "channel" "public"."NotificationChannel" NOT NULL DEFAULT 'in_app',
    "status" "public"."NotificationStatus" NOT NULL DEFAULT 'sent',
    "priority" "public"."NotificationPriority" NOT NULL DEFAULT 'normal',
    "read_at" TIMESTAMP(3),
    "sent_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "delivered_at" TIMESTAMP(3),
    "failed_at" TIMESTAMP(3),
    "failure_reason" TEXT,
    "order_id" TEXT,
    "price_alert_id" TEXT,
    "payment_id" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."order_feedbacks" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_feedbacks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."order_items" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "buy_price_id" TEXT,
    "quantity" DECIMAL(12,2) NOT NULL,
    "unit" "public"."PriceUnit" NOT NULL,
    "unit_price" DECIMAL(12,2) NOT NULL,
    "total_price" DECIMAL(12,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "product_offering_id" TEXT,
    "product_name" TEXT,
    "variant_name" TEXT,
    "brand_name" TEXT,
    "package_name" TEXT,
    "offering_sku" TEXT,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."order_otp_challenges" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "full_name" TEXT,
    "code_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "verified_at" TIMESTAMP(3),
    "order_token_hash" TEXT,
    "order_token_expires_at" TIMESTAMP(3),
    "consumed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_otp_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."orders" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "status" "public"."OrderStatus" NOT NULL DEFAULT 'pending',
    "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "service_fee" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "delivery_fee" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "coupon_code" TEXT,
    "coupon_id" TEXT,
    "discount_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "service_fee_base" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "service_fee_percentage" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "service_fee_rule_id" TEXT,
    "coupon_discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "promotion_discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "promotion_id" TEXT,
    "promotion_name" TEXT,
    "delivery_address" TEXT,
    "delivery_address_id" TEXT,
    "delivery_google_place_id" TEXT,
    "delivery_latitude" DECIMAL(10,7),
    "delivery_longitude" DECIMAL(10,7),
    "delivery_phone_number" TEXT,
    "delivery_recipient_name" TEXT,
    "delivery_zone_id" TEXT,
    "payment_status" "public"."OrderPaymentStatus" NOT NULL DEFAULT 'pending',

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."password_setup_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_setup_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."payments" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "order_id" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "provider" "public"."PaymentProvider" NOT NULL,
    "provider_reference" TEXT,
    "status" "public"."PaymentStatus" NOT NULL DEFAULT 'pending',
    "paid_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."paystack_bank_transfer_accounts" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "payment_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "provider_reference" TEXT NOT NULL,
    "account_name" TEXT,
    "account_number" TEXT NOT NULL,
    "bank_name" TEXT,
    "bank_code" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "account_expires_at" TIMESTAMP(3),
    "status" "public"."PaymentStatus" NOT NULL DEFAULT 'pending',
    "paid_at" TIMESTAMP(3),
    "generated_raw_provider_data" JSONB,
    "paid_raw_provider_data" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "paystack_bank_transfer_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."permissions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."price_alerts" (
    "id" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
    "user_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "target_price" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "unit" "public"."PriceUnit" NOT NULL,
    "condition" "public"."PriceAlertCondition" NOT NULL DEFAULT 'at_or_below',
    "status" "public"."PriceAlertStatus" NOT NULL DEFAULT 'active',
    "last_triggered_at" TIMESTAMP(3),
    "triggered_price" DECIMAL(12,2),
    "trigger_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "frequency" "public"."PriceAlertFrequency" NOT NULL DEFAULT 'one_time',
    "product_offering_id" TEXT NOT NULL,

    CONSTRAINT "price_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."product_categories" (
    "id" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "image_url" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."product_offerings" (
    "id" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
    "product_id" TEXT NOT NULL,
    "variant_id" TEXT,
    "brand_id" TEXT,
    "package_id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_offerings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."product_packages" (
    "id" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
    "name" TEXT NOT NULL,
    "package_type" "public"."PackageType" NOT NULL,
    "base_unit" "public"."MeasurementUnit",
    "quantity" DECIMAL(12,3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."product_variants" (
    "id" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
    "product_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."products" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sku" TEXT NOT NULL,
    "image_url" TEXT,
    "status" "public"."ProductStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "category_id" TEXT NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."promotions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "discount_type" "public"."CouponDiscountType" NOT NULL,
    "discount_value" DECIMAL(12,2) NOT NULL,
    "maximum_discount" DECIMAL(12,2),
    "minimum_subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "stack_with_coupons" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "valid_from" TIMESTAMP(3) NOT NULL,
    "valid_until" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "promotions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."refresh_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "family_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "replaced_by_token_id" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."service_fee_rules" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "percentage" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "base_fee" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "minimum_fee" DECIMAL(12,2),
    "maximum_fee" DECIMAL(12,2),
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "valid_from" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valid_until" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_fee_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."support_ticket_assignments" (
    "id" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
    "ticket_id" TEXT NOT NULL,
    "previous_assignee_id" TEXT,
    "new_assignee_id" TEXT NOT NULL,
    "assigned_by_id" TEXT,
    "method" "public"."SupportTicketAssignmentMethod" NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_ticket_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."support_ticket_attachments" (
    "id" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
    "message_id" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_ticket_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."support_ticket_messages" (
    "id" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
    "ticket_id" TEXT NOT NULL,
    "sender_id" TEXT NOT NULL,
    "sender_type" "public"."SupportTicketSenderType" NOT NULL,
    "message" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_ticket_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."support_tickets" (
    "id" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
    "ticket_number" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "assigned_to_id" TEXT NOT NULL,
    "order_id" TEXT,
    "subject" TEXT NOT NULL,
    "category" "public"."SupportTicketCategory" NOT NULL,
    "status" "public"."SupportTicketStatus" NOT NULL DEFAULT 'open',
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_message_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "priority" "public"."SupportTicketPriority" NOT NULL DEFAULT 'normal',

    CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."user_addresses" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "delivery_zone_id" TEXT,
    "label" TEXT,
    "recipient_name" TEXT NOT NULL,
    "phone_number" TEXT NOT NULL,
    "formatted_address" TEXT NOT NULL,
    "address_line_1" TEXT NOT NULL,
    "address_line_2" TEXT,
    "street_number" TEXT,
    "route" TEXT,
    "neighborhood" TEXT,
    "sublocality" TEXT,
    "locality" TEXT,
    "local_government_area" TEXT,
    "administrative_area" TEXT,
    "state" TEXT,
    "country" TEXT NOT NULL,
    "country_code" TEXT,
    "postal_code" TEXT,
    "google_place_id" TEXT NOT NULL,
    "latitude" DECIMAL(10,7) NOT NULL,
    "longitude" DECIMAL(10,7) NOT NULL,
    "google_address_data" JSONB,
    "zone_status" "public"."AddressZoneStatus" NOT NULL DEFAULT 'unsupported',
    "zone_resolution_detail" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."user_auth_providers" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_auth_providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."user_permissions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "permission_id" TEXT NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "role" TEXT NOT NULL DEFAULT 'user',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "full_name" TEXT NOT NULL,
    "authProviders" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "email_verified_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."webhook_logs" (
    "id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "event" TEXT,
    "reference" TEXT,
    "signature" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "raw_body" TEXT NOT NULL,
    "received_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."wishlist_items" (
    "id" TEXT NOT NULL,
    "wishlist_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "quantity" DECIMAL(12,2) NOT NULL,
    "unit" "public"."PriceUnit" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "product_offering_id" TEXT,

    CONSTRAINT "wishlist_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."wishlists" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'My Wishlist',
    "order_id" TEXT,
    "converted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wishlists_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_agent_auth_sessions_expires_at" ON "public"."agent_auth_sessions"("expires_at" ASC);

-- CreateIndex
CREATE INDEX "idx_agent_conversation_messages_session_created" ON "public"."agent_conversation_messages"("session_id" ASC, "created_at" ASC);

-- CreateIndex
CREATE INDEX "idx_agent_conversations_user_id" ON "public"."agent_conversations"("user_id" ASC);

-- CreateIndex
CREATE INDEX "brands_is_active_idx" ON "public"."brands"("is_active" ASC);

-- CreateIndex
CREATE INDEX "brands_manufacturer_id_idx" ON "public"."brands"("manufacturer_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "brands_name_key" ON "public"."brands"("name" ASC);

-- CreateIndex
CREATE INDEX "buy_prices_is_active_idx" ON "public"."buy_prices"("is_active" ASC);

-- CreateIndex
CREATE INDEX "buy_prices_market_id_idx" ON "public"."buy_prices"("market_id" ASC);

-- CreateIndex
CREATE INDEX "buy_prices_market_price_id_idx" ON "public"."buy_prices"("market_price_id" ASC);

-- CreateIndex
CREATE INDEX "buy_prices_product_id_idx" ON "public"."buy_prices"("product_id" ASC);

-- CreateIndex
CREATE INDEX "buy_prices_product_offering_id_idx" ON "public"."buy_prices"("product_offering_id" ASC);

-- CreateIndex
CREATE INDEX "buy_prices_strategy_used_idx" ON "public"."buy_prices"("strategy_used" ASC);

-- CreateIndex
CREATE INDEX "checkpoint_blobs_thread_id_idx" ON "public"."checkpoint_blobs"("thread_id" ASC);

-- CreateIndex
CREATE INDEX "checkpoint_writes_thread_id_idx" ON "public"."checkpoint_writes"("thread_id" ASC);

-- CreateIndex
CREATE INDEX "checkpoints_thread_id_idx" ON "public"."checkpoints"("thread_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "coupon_customers_coupon_id_user_id_key" ON "public"."coupon_customers"("coupon_id" ASC, "user_id" ASC);

-- CreateIndex
CREATE INDEX "coupon_customers_user_id_idx" ON "public"."coupon_customers"("user_id" ASC);

-- CreateIndex
CREATE INDEX "coupon_redemptions_coupon_id_idx" ON "public"."coupon_redemptions"("coupon_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "coupon_redemptions_coupon_id_user_id_order_id_key" ON "public"."coupon_redemptions"("coupon_id" ASC, "user_id" ASC, "order_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "coupon_redemptions_order_id_key" ON "public"."coupon_redemptions"("order_id" ASC);

-- CreateIndex
CREATE INDEX "coupon_redemptions_user_id_idx" ON "public"."coupon_redemptions"("user_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "coupons_code_key" ON "public"."coupons"("code" ASC);

-- CreateIndex
CREATE INDEX "coupons_is_active_valid_from_valid_until_idx" ON "public"."coupons"("is_active" ASC, "valid_from" ASC, "valid_until" ASC);

-- CreateIndex
CREATE INDEX "delivery_areas_delivery_zone_id_idx" ON "public"."delivery_areas"("delivery_zone_id" ASC);

-- CreateIndex
CREATE INDEX "delivery_areas_is_active_idx" ON "public"."delivery_areas"("is_active" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "delivery_areas_normalized_name_state_country_key" ON "public"."delivery_areas"("normalized_name" ASC, "state" ASC, "country" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "delivery_zones_name_key" ON "public"."delivery_zones"("name" ASC);

-- CreateIndex
CREATE INDEX "email_verification_tokens_expires_at_idx" ON "public"."email_verification_tokens"("expires_at" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "email_verification_tokens_token_hash_key" ON "public"."email_verification_tokens"("token_hash" ASC);

-- CreateIndex
CREATE INDEX "email_verification_tokens_user_id_idx" ON "public"."email_verification_tokens"("user_id" ASC);

-- CreateIndex
CREATE INDEX "manufacturers_is_active_idx" ON "public"."manufacturers"("is_active" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "manufacturers_name_key" ON "public"."manufacturers"("name" ASC);

-- CreateIndex
CREATE INDEX "market_analysis_benchmark_markets_market_id_idx" ON "public"."market_analysis_benchmark_markets"("market_id" ASC);

-- CreateIndex
CREATE INDEX "market_analysis_benchmarks_is_active_idx" ON "public"."market_analysis_benchmarks"("is_active" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "market_analysis_benchmarks_product_offering_id_key" ON "public"."market_analysis_benchmarks"("product_offering_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "market_analysis_snapshot_item_snapshot_id_product_offering__key" ON "public"."market_analysis_snapshot_items"("snapshot_id" ASC, "product_offering_id" ASC);

-- CreateIndex
CREATE INDEX "market_analysis_snapshot_items_offering_id_idx" ON "public"."market_analysis_snapshot_items"("product_offering_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "market_analysis_snapshots_analysis_date_key" ON "public"."market_analysis_snapshots"("analysis_date" ASC);

-- CreateIndex
CREATE INDEX "market_analysis_snapshots_status_date_idx" ON "public"."market_analysis_snapshots"("status" ASC, "analysis_date" ASC);

-- CreateIndex
CREATE INDEX "market_delivery_costs_delivery_zone_id_idx" ON "public"."market_delivery_costs"("delivery_zone_id" ASC);

-- CreateIndex
CREATE INDEX "market_delivery_costs_is_active_idx" ON "public"."market_delivery_costs"("is_active" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "market_delivery_costs_market_id_delivery_zone_id_key" ON "public"."market_delivery_costs"("market_id" ASC, "delivery_zone_id" ASC);

-- CreateIndex
CREATE INDEX "market_delivery_costs_market_id_idx" ON "public"."market_delivery_costs"("market_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "market_prices_legacy_identity_key" ON "public"."market_prices"("product_id" ASC, "market_id" ASC, "unit" ASC, "observed_at" ASC);

-- CreateIndex
CREATE INDEX "market_prices_market_id_idx" ON "public"."market_prices"("market_id" ASC);

-- CreateIndex
CREATE INDEX "market_prices_observed_at_idx" ON "public"."market_prices"("observed_at" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "market_prices_offering_identity_key" ON "public"."market_prices"("product_offering_id" ASC, "market_id" ASC, "observed_at" ASC);

-- CreateIndex
CREATE INDEX "market_prices_product_id_idx" ON "public"."market_prices"("product_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "market_prices_product_id_market_id_unit_observed_at_key" ON "public"."market_prices"("product_id" ASC, "market_id" ASC, "unit" ASC, "observed_at" ASC);

-- CreateIndex
CREATE INDEX "market_prices_product_offering_id_idx" ON "public"."market_prices"("product_offering_id" ASC);

-- CreateIndex
CREATE INDEX "market_route_costs_from_market_id_idx" ON "public"."market_route_costs"("from_market_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "market_route_costs_from_market_id_to_market_id_key" ON "public"."market_route_costs"("from_market_id" ASC, "to_market_id" ASC);

-- CreateIndex
CREATE INDEX "market_route_costs_is_active_idx" ON "public"."market_route_costs"("is_active" ASC);

-- CreateIndex
CREATE INDEX "market_route_costs_to_market_id_idx" ON "public"."market_route_costs"("to_market_id" ASC);

-- CreateIndex
CREATE INDEX "notifications_actor_user_id_idx" ON "public"."notifications"("actor_user_id" ASC);

-- CreateIndex
CREATE INDEX "notifications_channel_idx" ON "public"."notifications"("channel" ASC);

-- CreateIndex
CREATE INDEX "notifications_order_id_idx" ON "public"."notifications"("order_id" ASC);

-- CreateIndex
CREATE INDEX "notifications_payment_id_idx" ON "public"."notifications"("payment_id" ASC);

-- CreateIndex
CREATE INDEX "notifications_price_alert_id_idx" ON "public"."notifications"("price_alert_id" ASC);

-- CreateIndex
CREATE INDEX "notifications_read_at_idx" ON "public"."notifications"("read_at" ASC);

-- CreateIndex
CREATE INDEX "notifications_source_idx" ON "public"."notifications"("source" ASC);

-- CreateIndex
CREATE INDEX "notifications_status_idx" ON "public"."notifications"("status" ASC);

-- CreateIndex
CREATE INDEX "notifications_user_id_idx" ON "public"."notifications"("user_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "order_feedbacks_order_id_key" ON "public"."order_feedbacks"("order_id" ASC);

-- CreateIndex
CREATE INDEX "order_feedbacks_rating_idx" ON "public"."order_feedbacks"("rating" ASC);

-- CreateIndex
CREATE INDEX "order_feedbacks_user_id_idx" ON "public"."order_feedbacks"("user_id" ASC);

-- CreateIndex
CREATE INDEX "order_items_buy_price_id_idx" ON "public"."order_items"("buy_price_id" ASC);

-- CreateIndex
CREATE INDEX "order_items_order_id_idx" ON "public"."order_items"("order_id" ASC);

-- CreateIndex
CREATE INDEX "order_items_product_id_idx" ON "public"."order_items"("product_id" ASC);

-- CreateIndex
CREATE INDEX "order_items_product_offering_id_idx" ON "public"."order_items"("product_offering_id" ASC);

-- CreateIndex
CREATE INDEX "order_otp_challenges_email_created_at_idx" ON "public"."order_otp_challenges"("email" ASC, "created_at" ASC);

-- CreateIndex
CREATE INDEX "order_otp_challenges_expires_at_idx" ON "public"."order_otp_challenges"("expires_at" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "order_otp_challenges_order_token_hash_key" ON "public"."order_otp_challenges"("order_token_hash" ASC);

-- CreateIndex
CREATE INDEX "orders_coupon_id_idx" ON "public"."orders"("coupon_id" ASC);

-- CreateIndex
CREATE INDEX "orders_delivery_address_id_idx" ON "public"."orders"("delivery_address_id" ASC);

-- CreateIndex
CREATE INDEX "orders_delivery_zone_id_idx" ON "public"."orders"("delivery_zone_id" ASC);

-- CreateIndex
CREATE INDEX "orders_payment_status_idx" ON "public"."orders"("payment_status" ASC);

-- CreateIndex
CREATE INDEX "orders_promotion_id_idx" ON "public"."orders"("promotion_id" ASC);

-- CreateIndex
CREATE INDEX "orders_service_fee_rule_id_idx" ON "public"."orders"("service_fee_rule_id" ASC);

-- CreateIndex
CREATE INDEX "orders_status_idx" ON "public"."orders"("status" ASC);

-- CreateIndex
CREATE INDEX "orders_user_id_idx" ON "public"."orders"("user_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "password_setup_tokens_token_hash_key" ON "public"."password_setup_tokens"("token_hash" ASC);

-- CreateIndex
CREATE INDEX "payments_order_id_idx" ON "public"."payments"("order_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "payments_provider_reference_key" ON "public"."payments"("provider_reference" ASC);

-- CreateIndex
CREATE INDEX "payments_status_idx" ON "public"."payments"("status" ASC);

-- CreateIndex
CREATE INDEX "payments_user_id_idx" ON "public"."payments"("user_id" ASC);

-- CreateIndex
CREATE INDEX "paystack_bank_transfer_accounts_order_id_idx" ON "public"."paystack_bank_transfer_accounts"("order_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "paystack_bank_transfer_accounts_payment_id_account_number_key" ON "public"."paystack_bank_transfer_accounts"("payment_id" ASC, "account_number" ASC);

-- CreateIndex
CREATE INDEX "paystack_bank_transfer_accounts_payment_id_idx" ON "public"."paystack_bank_transfer_accounts"("payment_id" ASC);

-- CreateIndex
CREATE INDEX "paystack_bank_transfer_accounts_provider_reference_idx" ON "public"."paystack_bank_transfer_accounts"("provider_reference" ASC);

-- CreateIndex
CREATE INDEX "paystack_bank_transfer_accounts_status_idx" ON "public"."paystack_bank_transfer_accounts"("status" ASC);

-- CreateIndex
CREATE INDEX "paystack_bank_transfer_accounts_user_id_idx" ON "public"."paystack_bank_transfer_accounts"("user_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "permissions_name_key" ON "public"."permissions"("name" ASC);

-- CreateIndex
CREATE INDEX "price_alerts_product_id_idx" ON "public"."price_alerts"("product_id" ASC);

-- CreateIndex
CREATE INDEX "price_alerts_product_offering_id_idx" ON "public"."price_alerts"("product_offering_id" ASC);

-- CreateIndex
CREATE INDEX "price_alerts_product_offering_status_idx" ON "public"."price_alerts"("product_offering_id" ASC, "status" ASC);

-- CreateIndex
CREATE INDEX "price_alerts_status_idx" ON "public"."price_alerts"("status" ASC);

-- CreateIndex
CREATE INDEX "price_alerts_user_id_idx" ON "public"."price_alerts"("user_id" ASC);

-- CreateIndex
CREATE INDEX "product_categories_is_active_sort_order_idx" ON "public"."product_categories"("is_active" ASC, "sort_order" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "product_categories_name_key" ON "public"."product_categories"("name" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "product_categories_slug_key" ON "public"."product_categories"("slug" ASC);

-- CreateIndex
CREATE INDEX "product_offerings_brand_id_idx" ON "public"."product_offerings"("brand_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "product_offerings_identity_key" ON "public"."product_offerings"("product_id" ASC, "variant_id" ASC, "brand_id" ASC, "package_id" ASC);

-- CreateIndex
CREATE INDEX "product_offerings_package_id_idx" ON "public"."product_offerings"("package_id" ASC);

-- CreateIndex
CREATE INDEX "product_offerings_product_id_is_active_idx" ON "public"."product_offerings"("product_id" ASC, "is_active" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "product_offerings_sku_key" ON "public"."product_offerings"("sku" ASC);

-- CreateIndex
CREATE INDEX "product_offerings_variant_id_idx" ON "public"."product_offerings"("variant_id" ASC);

-- CreateIndex
CREATE INDEX "product_packages_is_active_idx" ON "public"."product_packages"("is_active" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "product_packages_name_key" ON "public"."product_packages"("name" ASC);

-- CreateIndex
CREATE INDEX "product_packages_package_type_idx" ON "public"."product_packages"("package_type" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "product_variants_product_id_code_key" ON "public"."product_variants"("product_id" ASC, "code" ASC);

-- CreateIndex
CREATE INDEX "product_variants_product_id_is_active_idx" ON "public"."product_variants"("product_id" ASC, "is_active" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "product_variants_product_id_name_key" ON "public"."product_variants"("product_id" ASC, "name" ASC);

-- CreateIndex
CREATE INDEX "products_category_id_idx" ON "public"."products"("category_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "products_sku_key" ON "public"."products"("sku" ASC);

-- CreateIndex
CREATE INDEX "promotions_is_active_valid_from_valid_until_idx" ON "public"."promotions"("is_active" ASC, "valid_from" ASC, "valid_until" ASC);

-- CreateIndex
CREATE INDEX "promotions_priority_idx" ON "public"."promotions"("priority" ASC);

-- CreateIndex
CREATE INDEX "refresh_tokens_expires_at_idx" ON "public"."refresh_tokens"("expires_at" ASC);

-- CreateIndex
CREATE INDEX "refresh_tokens_family_id_idx" ON "public"."refresh_tokens"("family_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "public"."refresh_tokens"("token_hash" ASC);

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "public"."refresh_tokens"("user_id" ASC);

-- CreateIndex
CREATE INDEX "service_fee_rules_is_active_valid_from_valid_until_idx" ON "public"."service_fee_rules"("is_active" ASC, "valid_from" ASC, "valid_until" ASC);

-- CreateIndex
CREATE INDEX "support_ticket_assignments_assigned_by_id_idx" ON "public"."support_ticket_assignments"("assigned_by_id" ASC);

-- CreateIndex
CREATE INDEX "support_ticket_assignments_new_assignee_id_idx" ON "public"."support_ticket_assignments"("new_assignee_id" ASC);

-- CreateIndex
CREATE INDEX "support_ticket_assignments_previous_assignee_id_idx" ON "public"."support_ticket_assignments"("previous_assignee_id" ASC);

-- CreateIndex
CREATE INDEX "support_ticket_assignments_ticket_id_created_at_idx" ON "public"."support_ticket_assignments"("ticket_id" ASC, "created_at" ASC);

-- CreateIndex
CREATE INDEX "support_ticket_attachments_message_id_idx" ON "public"."support_ticket_attachments"("message_id" ASC);

-- CreateIndex
CREATE INDEX "support_ticket_messages_sender_id_idx" ON "public"."support_ticket_messages"("sender_id" ASC);

-- CreateIndex
CREATE INDEX "support_ticket_messages_ticket_id_created_at_idx" ON "public"."support_ticket_messages"("ticket_id" ASC, "created_at" ASC);

-- CreateIndex
CREATE INDEX "support_tickets_assigned_to_id_status_idx" ON "public"."support_tickets"("assigned_to_id" ASC, "status" ASC);

-- CreateIndex
CREATE INDEX "support_tickets_customer_id_status_idx" ON "public"."support_tickets"("customer_id" ASC, "status" ASC);

-- CreateIndex
CREATE INDEX "support_tickets_last_message_at_idx" ON "public"."support_tickets"("last_message_at" ASC);

-- CreateIndex
CREATE INDEX "support_tickets_order_id_idx" ON "public"."support_tickets"("order_id" ASC);

-- CreateIndex
CREATE INDEX "support_tickets_priority_idx" ON "public"."support_tickets"("priority" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "support_tickets_ticket_number_key" ON "public"."support_tickets"("ticket_number" ASC);

-- CreateIndex
CREATE INDEX "user_addresses_delivery_zone_id_idx" ON "public"."user_addresses"("delivery_zone_id" ASC);

-- CreateIndex
CREATE INDEX "user_addresses_google_place_id_idx" ON "public"."user_addresses"("google_place_id" ASC);

-- CreateIndex
CREATE INDEX "user_addresses_user_id_idx" ON "public"."user_addresses"("user_id" ASC);

-- CreateIndex
CREATE INDEX "user_addresses_zone_status_idx" ON "public"."user_addresses"("zone_status" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "user_auth_providers_provider_provider_user_id_key" ON "public"."user_auth_providers"("provider" ASC, "provider_user_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "user_auth_providers_user_id_provider_key" ON "public"."user_auth_providers"("user_id" ASC, "provider" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "user_permissions_user_id_permission_id_key" ON "public"."user_permissions"("user_id" ASC, "permission_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "public"."users"("email" ASC);

-- CreateIndex
CREATE INDEX "webhook_logs_event_idx" ON "public"."webhook_logs"("event" ASC);

-- CreateIndex
CREATE INDEX "webhook_logs_provider_idx" ON "public"."webhook_logs"("provider" ASC);

-- CreateIndex
CREATE INDEX "webhook_logs_received_at_idx" ON "public"."webhook_logs"("received_at" ASC);

-- CreateIndex
CREATE INDEX "webhook_logs_reference_idx" ON "public"."webhook_logs"("reference" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "wishlist_items_legacy_identity_key" ON "public"."wishlist_items"("wishlist_id" ASC, "product_id" ASC, "unit" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "wishlist_items_offering_identity_key" ON "public"."wishlist_items"("wishlist_id" ASC, "product_offering_id" ASC);

-- CreateIndex
CREATE INDEX "wishlist_items_product_id_idx" ON "public"."wishlist_items"("product_id" ASC);

-- CreateIndex
CREATE INDEX "wishlist_items_product_offering_id_idx" ON "public"."wishlist_items"("product_offering_id" ASC);

-- CreateIndex
CREATE INDEX "wishlist_items_wishlist_id_idx" ON "public"."wishlist_items"("wishlist_id" ASC);

-- CreateIndex
CREATE INDEX "wishlists_converted_at_idx" ON "public"."wishlists"("converted_at" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "wishlists_order_id_key" ON "public"."wishlists"("order_id" ASC);

-- CreateIndex
CREATE INDEX "wishlists_user_id_idx" ON "public"."wishlists"("user_id" ASC);

-- AddForeignKey
ALTER TABLE "public"."agent_conversation_messages" ADD CONSTRAINT "agent_conversation_messages_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."agent_conversations"("session_id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."brands" ADD CONSTRAINT "brands_manufacturer_id_fkey" FOREIGN KEY ("manufacturer_id") REFERENCES "public"."manufacturers"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."buy_prices" ADD CONSTRAINT "buy_prices_market_id_fkey" FOREIGN KEY ("market_id") REFERENCES "public"."markets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."buy_prices" ADD CONSTRAINT "buy_prices_market_price_id_fkey" FOREIGN KEY ("market_price_id") REFERENCES "public"."market_prices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."buy_prices" ADD CONSTRAINT "buy_prices_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."buy_prices" ADD CONSTRAINT "buy_prices_product_offering_id_fkey" FOREIGN KEY ("product_offering_id") REFERENCES "public"."product_offerings"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."coupon_customers" ADD CONSTRAINT "coupon_customers_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "public"."coupons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."coupon_customers" ADD CONSTRAINT "coupon_customers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "public"."coupons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."delivery_areas" ADD CONSTRAINT "delivery_areas_delivery_zone_id_fkey" FOREIGN KEY ("delivery_zone_id") REFERENCES "public"."delivery_zones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."email_verification_tokens" ADD CONSTRAINT "email_verification_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."market_analysis_benchmark_markets" ADD CONSTRAINT "market_analysis_benchmark_markets_benchmark_id_fkey" FOREIGN KEY ("benchmark_id") REFERENCES "public"."market_analysis_benchmarks"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."market_analysis_benchmark_markets" ADD CONSTRAINT "market_analysis_benchmark_markets_market_id_fkey" FOREIGN KEY ("market_id") REFERENCES "public"."markets"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."market_analysis_benchmarks" ADD CONSTRAINT "market_analysis_benchmarks_product_offering_id_fkey" FOREIGN KEY ("product_offering_id") REFERENCES "public"."product_offerings"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."market_analysis_snapshot_items" ADD CONSTRAINT "market_analysis_snapshot_items_product_offering_id_fkey" FOREIGN KEY ("product_offering_id") REFERENCES "public"."product_offerings"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."market_analysis_snapshot_items" ADD CONSTRAINT "market_analysis_snapshot_items_snapshot_id_fkey" FOREIGN KEY ("snapshot_id") REFERENCES "public"."market_analysis_snapshots"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."market_delivery_costs" ADD CONSTRAINT "market_delivery_costs_delivery_zone_id_fkey" FOREIGN KEY ("delivery_zone_id") REFERENCES "public"."delivery_zones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."market_delivery_costs" ADD CONSTRAINT "market_delivery_costs_market_id_fkey" FOREIGN KEY ("market_id") REFERENCES "public"."markets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."market_prices" ADD CONSTRAINT "market_prices_market_id_fkey" FOREIGN KEY ("market_id") REFERENCES "public"."markets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."market_prices" ADD CONSTRAINT "market_prices_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."market_prices" ADD CONSTRAINT "market_prices_product_offering_id_fkey" FOREIGN KEY ("product_offering_id") REFERENCES "public"."product_offerings"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."market_route_costs" ADD CONSTRAINT "market_route_costs_from_market_id_fkey" FOREIGN KEY ("from_market_id") REFERENCES "public"."markets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."market_route_costs" ADD CONSTRAINT "market_route_costs_to_market_id_fkey" FOREIGN KEY ("to_market_id") REFERENCES "public"."markets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."notifications" ADD CONSTRAINT "notifications_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."notifications" ADD CONSTRAINT "notifications_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."notifications" ADD CONSTRAINT "notifications_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."notifications" ADD CONSTRAINT "notifications_price_alert_id_fkey" FOREIGN KEY ("price_alert_id") REFERENCES "public"."price_alerts"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."order_feedbacks" ADD CONSTRAINT "order_feedbacks_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."order_feedbacks" ADD CONSTRAINT "order_feedbacks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."order_items" ADD CONSTRAINT "order_items_buy_price_id_fkey" FOREIGN KEY ("buy_price_id") REFERENCES "public"."buy_prices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."order_items" ADD CONSTRAINT "order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."order_items" ADD CONSTRAINT "order_items_product_offering_id_fkey" FOREIGN KEY ("product_offering_id") REFERENCES "public"."product_offerings"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."orders" ADD CONSTRAINT "orders_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "public"."coupons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."orders" ADD CONSTRAINT "orders_delivery_address_id_fkey" FOREIGN KEY ("delivery_address_id") REFERENCES "public"."user_addresses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."orders" ADD CONSTRAINT "orders_delivery_zone_id_fkey" FOREIGN KEY ("delivery_zone_id") REFERENCES "public"."delivery_zones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."orders" ADD CONSTRAINT "orders_promotion_id_fkey" FOREIGN KEY ("promotion_id") REFERENCES "public"."promotions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."orders" ADD CONSTRAINT "orders_service_fee_rule_id_fkey" FOREIGN KEY ("service_fee_rule_id") REFERENCES "public"."service_fee_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."orders" ADD CONSTRAINT "orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."password_setup_tokens" ADD CONSTRAINT "password_setup_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."payments" ADD CONSTRAINT "payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."payments" ADD CONSTRAINT "payments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."paystack_bank_transfer_accounts" ADD CONSTRAINT "paystack_bank_transfer_accounts_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."paystack_bank_transfer_accounts" ADD CONSTRAINT "paystack_bank_transfer_accounts_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."paystack_bank_transfer_accounts" ADD CONSTRAINT "paystack_bank_transfer_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."price_alerts" ADD CONSTRAINT "price_alerts_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."price_alerts" ADD CONSTRAINT "price_alerts_product_offering_id_fkey" FOREIGN KEY ("product_offering_id") REFERENCES "public"."product_offerings"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."price_alerts" ADD CONSTRAINT "price_alerts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."product_offerings" ADD CONSTRAINT "product_offerings_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."product_offerings" ADD CONSTRAINT "product_offerings_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "public"."product_packages"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."product_offerings" ADD CONSTRAINT "product_offerings_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."product_offerings" ADD CONSTRAINT "product_offerings_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."product_variants" ADD CONSTRAINT "product_variants_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."products" ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."product_categories"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."support_ticket_assignments" ADD CONSTRAINT "support_ticket_assignments_assigned_by_id_fkey" FOREIGN KEY ("assigned_by_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."support_ticket_assignments" ADD CONSTRAINT "support_ticket_assignments_new_assignee_id_fkey" FOREIGN KEY ("new_assignee_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."support_ticket_assignments" ADD CONSTRAINT "support_ticket_assignments_previous_assignee_id_fkey" FOREIGN KEY ("previous_assignee_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."support_ticket_assignments" ADD CONSTRAINT "support_ticket_assignments_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "public"."support_tickets"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."support_ticket_attachments" ADD CONSTRAINT "support_ticket_attachments_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."support_ticket_messages"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."support_ticket_messages" ADD CONSTRAINT "support_ticket_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."support_ticket_messages" ADD CONSTRAINT "support_ticket_messages_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "public"."support_tickets"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."support_tickets" ADD CONSTRAINT "support_tickets_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."support_tickets" ADD CONSTRAINT "support_tickets_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."support_tickets" ADD CONSTRAINT "support_tickets_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."user_addresses" ADD CONSTRAINT "user_addresses_delivery_zone_id_fkey" FOREIGN KEY ("delivery_zone_id") REFERENCES "public"."delivery_zones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_addresses" ADD CONSTRAINT "user_addresses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_auth_providers" ADD CONSTRAINT "user_auth_providers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_permissions" ADD CONSTRAINT "user_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_permissions" ADD CONSTRAINT "user_permissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."wishlist_items" ADD CONSTRAINT "wishlist_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."wishlist_items" ADD CONSTRAINT "wishlist_items_product_offering_id_fkey" FOREIGN KEY ("product_offering_id") REFERENCES "public"."product_offerings"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."wishlist_items" ADD CONSTRAINT "wishlist_items_wishlist_id_fkey" FOREIGN KEY ("wishlist_id") REFERENCES "public"."wishlists"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."wishlists" ADD CONSTRAINT "wishlists_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."wishlists" ADD CONSTRAINT "wishlists_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
