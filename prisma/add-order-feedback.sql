CREATE TABLE IF NOT EXISTS "order_feedbacks" (
  "id" TEXT NOT NULL,
  "order_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "rating" INTEGER NOT NULL,
  "comment" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "order_feedbacks_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "order_feedbacks_rating_check" CHECK ("rating" BETWEEN 1 AND 5),
  CONSTRAINT "order_feedbacks_order_id_fkey"
    FOREIGN KEY ("order_id") REFERENCES "orders"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "order_feedbacks_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "order_feedbacks_order_id_key"
  ON "order_feedbacks"("order_id");

CREATE INDEX IF NOT EXISTS "order_feedbacks_user_id_idx"
  ON "order_feedbacks"("user_id");

CREATE INDEX IF NOT EXISTS "order_feedbacks_rating_idx"
  ON "order_feedbacks"("rating");
