DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'NotificationSource') THEN
    CREATE TYPE "NotificationSource" AS ENUM (
      'order',
      'price_alert',
      'admin',
      'payment',
      'system'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'NotificationChannel') THEN
    CREATE TYPE "NotificationChannel" AS ENUM (
      'in_app',
      'email',
      'sms',
      'push'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'NotificationStatus') THEN
    CREATE TYPE "NotificationStatus" AS ENUM (
      'pending',
      'sent',
      'delivered',
      'failed'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'NotificationPriority') THEN
    CREATE TYPE "NotificationPriority" AS ENUM (
      'low',
      'normal',
      'high',
      'urgent'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  actor_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  source "NotificationSource" NOT NULL,
  event TEXT,
  channel "NotificationChannel" NOT NULL DEFAULT 'in_app',
  status "NotificationStatus" NOT NULL DEFAULT 'sent',
  priority "NotificationPriority" NOT NULL DEFAULT 'normal',
  read_at TIMESTAMP(3),
  sent_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  delivered_at TIMESTAMP(3),
  failed_at TIMESTAMP(3),
  failure_reason TEXT,
  order_id TEXT REFERENCES orders(id) ON DELETE SET NULL,
  price_alert_id TEXT REFERENCES price_alerts(id) ON DELETE SET NULL,
  payment_id TEXT REFERENCES payments(id) ON DELETE SET NULL,
  metadata JSONB,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS notifications_user_id_idx
  ON notifications(user_id);
CREATE INDEX IF NOT EXISTS notifications_actor_user_id_idx
  ON notifications(actor_user_id);
CREATE INDEX IF NOT EXISTS notifications_source_idx
  ON notifications(source);
CREATE INDEX IF NOT EXISTS notifications_channel_idx
  ON notifications(channel);
CREATE INDEX IF NOT EXISTS notifications_status_idx
  ON notifications(status);
CREATE INDEX IF NOT EXISTS notifications_read_at_idx
  ON notifications(read_at);
CREATE INDEX IF NOT EXISTS notifications_order_id_idx
  ON notifications(order_id);
CREATE INDEX IF NOT EXISTS notifications_price_alert_id_idx
  ON notifications(price_alert_id);
CREATE INDEX IF NOT EXISTS notifications_payment_id_idx
  ON notifications(payment_id);
