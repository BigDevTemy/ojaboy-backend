-- DESTRUCTIVE RESET
--
-- This script deletes all rows from business/catalogue tables while preserving:
--   service_fee_rules
--   delivery_zones
--   delivery_areas
--   user_addresses
--   users
--   email_verification_tokens
--   user_auth_providers
--   password_setup_tokens
--   refresh_tokens
--   order_otp_challenges
--   permissions
--   user_permissions
--
-- CASCADE is intentionally omitted so PostgreSQL will fail instead of
-- unexpectedly clearing a preserved table if a new foreign key is introduced.

BEGIN;

TRUNCATE TABLE
  "market_analysis_snapshot_items",
  "market_analysis_snapshots",
  "market_analysis_benchmark_markets",
  "market_analysis_benchmarks",
  "notifications",
  "price_alerts",
  "wishlist_items",
  "wishlists",
  "order_feedbacks",
  "coupon_redemptions",
  "coupon_customers",
  "order_items",
  "paystack_bank_transfer_accounts",
  "payments",
  "orders",
  "webhook_logs",
  "support_ticket_attachments",
  "support_ticket_messages",
  "support_ticket_assignments",
  "support_tickets",
  "buy_prices",
  "market_prices",
  "promotions",
  "coupons",
  "market_delivery_costs",
  "market_route_costs",
  "product_offerings",
  "product_variants",
  "brands",
  "manufacturers",
  "product_packages",
  "products",
  "product_categories",
  "markets"
RESTART IDENTITY;

COMMIT;
