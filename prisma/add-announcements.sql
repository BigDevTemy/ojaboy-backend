DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AnnouncementType') THEN
    CREATE TYPE "AnnouncementType" AS ENUM (
      'closure',
      'coupon',
      'promotion',
      'custom'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AnnouncementAudienceType') THEN
    CREATE TYPE "AnnouncementAudienceType" AS ENUM (
      'all',
      'role',
      'specific_users'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AnnouncementStatus') THEN
    CREATE TYPE "AnnouncementStatus" AS ENUM (
      'draft',
      'scheduled',
      'sending',
      'sent',
      'partially_failed',
      'cancelled'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AnnouncementRecipientStatus') THEN
    CREATE TYPE "AnnouncementRecipientStatus" AS ENUM (
      'pending',
      'processing',
      'sent',
      'failed'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS announcements (
  id                  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  type                "AnnouncementType" NOT NULL,
  title               TEXT NOT NULL,
  body                TEXT NOT NULL,
  email_template      TEXT NOT NULL,
  template_variables  JSONB,
  audience_type       "AnnouncementAudienceType" NOT NULL,
  audience_role       TEXT,
  audience_user_ids   TEXT[] NOT NULL DEFAULT '{}',
  status              "AnnouncementStatus" NOT NULL DEFAULT 'draft',
  scheduled_at        TIMESTAMP(3),
  published_at        TIMESTAMP(3),
  completed_at        TIMESTAMP(3),
  total_recipients    INTEGER NOT NULL DEFAULT 0,
  sent_count          INTEGER NOT NULL DEFAULT 0,
  failed_count        INTEGER NOT NULL DEFAULT 0,
  created_by_user_id  TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS announcements_status_idx
  ON announcements(status);
CREATE INDEX IF NOT EXISTS announcements_scheduled_at_idx
  ON announcements(scheduled_at);
CREATE INDEX IF NOT EXISTS announcements_type_idx
  ON announcements(type);

CREATE TABLE IF NOT EXISTS announcement_recipients (
  id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  announcement_id  TEXT NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status           "AnnouncementRecipientStatus" NOT NULL DEFAULT 'pending',
  attempts         INTEGER NOT NULL DEFAULT 0,
  next_attempt_at  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_error       TEXT,
  sent_at          TIMESTAMP(3),
  created_at       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (announcement_id, user_id)
);

CREATE INDEX IF NOT EXISTS announcement_recipients_status_next_attempt_idx
  ON announcement_recipients(status, next_attempt_at);
CREATE INDEX IF NOT EXISTS announcement_recipients_user_id_idx
  ON announcement_recipients(user_id);
