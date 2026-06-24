DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SupportTicketStatus') THEN
    CREATE TYPE "SupportTicketStatus" AS ENUM (
      'open',
      'in_review',
      'waiting_on_customer',
      'resolved'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SupportTicketCategory') THEN
    CREATE TYPE "SupportTicketCategory" AS ENUM (
      'refund_and_payment',
      'order_issue',
      'delivery',
      'account',
      'general'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SupportTicketPriority') THEN
    CREATE TYPE "SupportTicketPriority" AS ENUM (
      'low',
      'normal',
      'high',
      'urgent'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SupportTicketSenderType') THEN
    CREATE TYPE "SupportTicketSenderType" AS ENUM ('customer', 'staff');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SupportTicketAssignmentMethod') THEN
    CREATE TYPE "SupportTicketAssignmentMethod" AS ENUM ('auto', 'manual');
  END IF;
END $$;

CREATE SEQUENCE IF NOT EXISTS support_ticket_number_seq START WITH 1000;

CREATE TABLE IF NOT EXISTS support_tickets (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  ticket_number TEXT NOT NULL UNIQUE,
  customer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_to_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  order_id TEXT REFERENCES orders(id) ON DELETE SET NULL,
  subject TEXT NOT NULL,
  category "SupportTicketCategory" NOT NULL,
  priority "SupportTicketPriority" NOT NULL DEFAULT 'normal',
  status "SupportTicketStatus" NOT NULL DEFAULT 'open',
  assigned_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_message_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP(3),
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE support_tickets
  ADD COLUMN IF NOT EXISTS priority "SupportTicketPriority" NOT NULL DEFAULT 'normal';

CREATE TABLE IF NOT EXISTS support_ticket_messages (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  ticket_id TEXT NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  sender_type "SupportTicketSenderType" NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS support_ticket_attachments (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  message_id TEXT NOT NULL REFERENCES support_ticket_messages(id) ON DELETE CASCADE,
  original_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size INTEGER NOT NULL,
  data BYTEA NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS support_ticket_assignments (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  ticket_id TEXT NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  previous_assignee_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  new_assignee_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  assigned_by_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  method "SupportTicketAssignmentMethod" NOT NULL,
  reason TEXT,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS support_tickets_customer_id_status_idx
  ON support_tickets(customer_id, status);
CREATE INDEX IF NOT EXISTS support_tickets_assigned_to_id_status_idx
  ON support_tickets(assigned_to_id, status);
CREATE INDEX IF NOT EXISTS support_tickets_priority_idx
  ON support_tickets(priority);
CREATE INDEX IF NOT EXISTS support_tickets_order_id_idx
  ON support_tickets(order_id);
CREATE INDEX IF NOT EXISTS support_tickets_last_message_at_idx
  ON support_tickets(last_message_at);
CREATE INDEX IF NOT EXISTS support_ticket_messages_ticket_id_created_at_idx
  ON support_ticket_messages(ticket_id, created_at);
CREATE INDEX IF NOT EXISTS support_ticket_messages_sender_id_idx
  ON support_ticket_messages(sender_id);
CREATE INDEX IF NOT EXISTS support_ticket_attachments_message_id_idx
  ON support_ticket_attachments(message_id);
CREATE INDEX IF NOT EXISTS support_ticket_assignments_ticket_id_created_at_idx
  ON support_ticket_assignments(ticket_id, created_at);
CREATE INDEX IF NOT EXISTS support_ticket_assignments_previous_assignee_id_idx
  ON support_ticket_assignments(previous_assignee_id);
CREATE INDEX IF NOT EXISTS support_ticket_assignments_new_assignee_id_idx
  ON support_ticket_assignments(new_assignee_id);
CREATE INDEX IF NOT EXISTS support_ticket_assignments_assigned_by_id_idx
  ON support_ticket_assignments(assigned_by_id);
