BEGIN;

ALTER TYPE "PaymentStatus"
ADD VALUE IF NOT EXISTS 'initializing' BEFORE 'pending';

COMMIT;
