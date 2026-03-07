
-- Support contact tickets from help center
CREATE TABLE public.help_support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  subject text NOT NULL,
  message text NOT NULL,
  article_id uuid REFERENCES public.help_articles(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'open',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.help_support_tickets ENABLE ROW LEVEL SECURITY;

-- Anyone can submit a ticket
CREATE POLICY "Anyone can insert tickets"
  ON public.help_support_tickets
  FOR INSERT
  WITH CHECK (true);

-- Admins can view/manage tickets
CREATE POLICY "Admins can view tickets"
  ON public.help_support_tickets
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update tickets"
  ON public.help_support_tickets
  FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete tickets"
  ON public.help_support_tickets
  FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));
