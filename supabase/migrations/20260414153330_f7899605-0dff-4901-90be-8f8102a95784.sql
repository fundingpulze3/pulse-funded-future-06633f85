CREATE TABLE public.announcement_bar (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT false,
  bg_color text NOT NULL DEFAULT '#6366f1',
  text_color text NOT NULL DEFAULT '#ffffff',
  link_url text,
  link_text text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.announcement_bar (message, is_active) VALUES ('', false);

ALTER TABLE public.announcement_bar ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read announcement" ON public.announcement_bar FOR SELECT USING (true);
CREATE POLICY "Admins can manage announcement" ON public.announcement_bar FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'administrator'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role));