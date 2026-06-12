BEGIN;

DO $$
BEGIN
  CREATE TYPE "OrderPaymentStatus" AS ENUM ('pending', 'paid');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

ALTER TABLE orders
ADD COLUMN IF NOT EXISTS payment_status "OrderPaymentStatus" NOT NULL DEFAULT 'pending';

CREATE INDEX IF NOT EXISTS orders_payment_status_idx
ON orders (payment_status);

COMMIT;
