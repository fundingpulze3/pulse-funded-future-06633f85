-- Single-row settings for the auto-publish "upload timer".
CREATE TABLE public.blog_settings (
  id integer PRIMARY KEY DEFAULT 1,
  brand_context text NOT NULL DEFAULT '',
  themes text NOT NULL DEFAULT '',           -- comma-separated topic themes to draw from
  auto_publish boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT blog_settings_singleton CHECK (id = 1)
);
INSERT INTO public.blog_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

ALTER TABLE public.blog_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage blog settings"
  ON public.blog_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
