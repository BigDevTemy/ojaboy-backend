CREATE TABLE IF NOT EXISTS "paystack_bank_transfer_accounts" (
  "id" TEXT NOT NULL,
  "order_id" TEXT NOT NULL,
  "payment_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "provider_reference" TEXT NOT NULL,
  "account_name" TEXT,
  "account_number" TEXT NOT NULL,
  "bank_name" TEXT,
  "bank_code" TEXT,
  "amount" DECIMAL(12, 2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'NGN',
  "account_expires_at" TIMESTAMP(3),
  "status" "PaymentStatus" NOT NULL DEFAULT 'pending',
  "paid_at" TIMESTAMP(3),
  "generated_raw_provider_data" JSONB,
  "paid_raw_provider_data" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "paystack_bank_transfer_accounts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "paystack_bank_transfer_accounts_order_id_fkey"
    FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "paystack_bank_transfer_accounts_payment_id_fkey"
    FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "paystack_bank_transfer_accounts_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "paystack_bank_transfer_accounts_payment_id_account_number_key"
  ON "paystack_bank_transfer_accounts"("payment_id", "account_number");

CREATE INDEX IF NOT EXISTS "paystack_bank_transfer_accounts_order_id_idx"
  ON "paystack_bank_transfer_accounts"("order_id");

CREATE INDEX IF NOT EXISTS "paystack_bank_transfer_accounts_payment_id_idx"
  ON "paystack_bank_transfer_accounts"("payment_id");

CREATE INDEX IF NOT EXISTS "paystack_bank_transfer_accounts_user_id_idx"
  ON "paystack_bank_transfer_accounts"("user_id");

CREATE INDEX IF NOT EXISTS "paystack_bank_transfer_accounts_provider_reference_idx"
  ON "paystack_bank_transfer_accounts"("provider_reference");

CREATE INDEX IF NOT EXISTS "paystack_bank_transfer_accounts_status_idx"
  ON "paystack_bank_transfer_accounts"("status");
