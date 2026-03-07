
-- Add threading/source columns to help_support_tickets
ALTER TABLE public.help_support_tickets 
  ADD COLUMN gmail_thread_id text,
  ADD COLUMN gmail_message_id text,
  ADD COLUMN priority text NOT NULL DEFAULT 'normal',
  ADD COLUMN last_reply_at timestamptz,
  ADD COLUMN auto_reply_sent boolean NOT NULL DEFAULT false,
  ADD COLUMN source text NOT NULL DEFAULT 'web';

-- Create support_ticket_messages table for threaded conversations
CREATE TABLE public.support_ticket_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid REFERENCES public.help_support_tickets(id) ON DELETE CASCADE NOT NULL,
  sender_type text NOT NULL DEFAULT 'customer',
  sender_email text,
  sender_name text,
  message text NOT NULL,
  gmail_message_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.support_ticket_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage ticket messages" ON public.support_ticket_messages
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Create processed_gmail_ids table to track which emails have been processed
CREATE TABLE public.processed_gmail_ids (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gmail_uid text NOT NULL UNIQUE,
  processed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.processed_gmail_ids ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only service role can manage" ON public.processed_gmail_ids
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Indexes
CREATE INDEX idx_tickets_gmail_thread_id ON public.help_support_tickets(gmail_thread_id);
CREATE INDEX idx_ticket_messages_ticket_id ON public.support_ticket_messages(ticket_id);
CREATE INDEX idx_ticket_messages_gmail_id ON public.support_ticket_messages(gmail_message_id);
CREATE INDEX idx_processed_gmail_uid ON public.processed_gmail_ids(gmail_uid);
