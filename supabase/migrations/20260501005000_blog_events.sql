-- Reader analytics: views, read time and CTA clicks per post.
CREATE TABLE IF NOT EXISTS public.blog_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL,
  type text NOT NULL,            -- 'view' | 'read' | 'cta_click'
  seconds integer NOT NULL DEFAULT 0,
  cta_label text,
  session_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_blog_events_post ON public.blog_events (post_id, type);
CREATE INDEX IF NOT EXISTS idx_blog_events_created ON public.blog_events (created_at DESC);

ALTER TABLE public.blog_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can log blog events" ON public.blog_events
  FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Admins read blog events" ON public.blog_events
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
