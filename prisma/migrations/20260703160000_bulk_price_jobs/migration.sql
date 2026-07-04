-- Tracks a bulk buy-price calculate/generate request processed in small
-- resumable batches, so the frontend can drive it forward one batch at a
-- time (POST /prices/bulk-jobs/:id/process-next) and show live progress
-- instead of a single request blocking for a minute or more.

-- CreateEnum
CREATE TYPE "BulkPriceJobMode" AS ENUM ('calculate', 'generate');
CREATE TYPE "BulkPriceJobStatus" AS ENUM ('pending', 'processing', 'completed', 'failed');

-- CreateTable
CREATE TABLE "bulk_price_jobs" (
    "id" TEXT NOT NULL,
    "mode" "BulkPriceJobMode" NOT NULL,
    "status" "BulkPriceJobStatus" NOT NULL DEFAULT 'pending',
    "strategy" "BuyPriceStrategy" NOT NULL,
    "request_params" JSONB NOT NULL,
    "targets" JSONB NOT NULL,
    "total_targets" INTEGER NOT NULL,
    "processed_targets" INTEGER NOT NULL DEFAULT 0,
    "results" JSONB NOT NULL DEFAULT '[]',
    "error_message" TEXT,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bulk_price_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bulk_price_jobs_status_idx" ON "bulk_price_jobs"("status");
