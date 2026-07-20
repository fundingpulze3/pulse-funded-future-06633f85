-- Blog engine v2: slot scheduling, topic feed/queue, pre-generated drafts,
-- slot-run tracking and richer usage stats.

ALTER TABLE public.blog_engine_usage ADD COLUMN IF NOT EXISTS words integer NOT NULL DEFAULT 0;
ALTER TABLE public.blog_settings ADD COLUMN IF NOT EXISTS slots text NOT NULL DEFAULT '09:00,14:00,19:00';
ALTER TABLE public.blog_settings ADD COLUMN IF NOT EXISTS cron_key text NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex');

-- Topics the engine will turn into posts. "feed" = typed by admin (priority), "auto" = rotation.
CREATE TABLE IF NOT EXISTS public.blog_topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  query text NOT NULL,
  research_note text,
  category text,
  country text,
  source text NOT NULL DEFAULT 'feed',
  priority integer NOT NULL DEFAULT 10,
  status text NOT NULL DEFAULT 'queued',
  post_id uuid,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_blog_topics_status ON public.blog_topics (status, priority DESC, created_at);

-- The next post, written ahead of time and held as a draft so a slot publishes instantly.
CREATE TABLE IF NOT EXISTS public.blog_prepared (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL,
  query text,
  source text NOT NULL DEFAULT 'auto',
  status text NOT NULL DEFAULT 'ready',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_blog_prepared_status ON public.blog_prepared (status, created_at);

-- One row per slot per day so the poster never double-posts and recovers after restarts.
CREATE TABLE IF NOT EXISTS public.blog_slot_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  day text NOT NULL,
  slot text NOT NULL,
  post_id uuid,
  status text NOT NULL DEFAULT 'running',
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (day, slot)
);

ALTER TABLE public.blog_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_prepared ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_slot_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage blog topics" ON public.blog_topics FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins read blog prepared" ON public.blog_prepared FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins read blog slot runs" ON public.blog_slot_runs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Tick the engine every 5 minutes; it decides whether a slot is due.
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
DO $cron$
BEGIN
  PERFORM cron.unschedule('blog-engine-tick');
EXCEPTION WHEN OTHERS THEN NULL;
END
$cron$;
SELECT cron.schedule('blog-engine-tick', '*/5 * * * *', $job$
  SELECT net.http_post(
    url := 'https://rpshiyvndmnogbhbgmfm.supabase.co/functions/v1/blog-engine',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-key',(SELECT cron_key FROM public.blog_settings WHERE id=1)),
    body := jsonb_build_object('action','tick')
  );
$job$);
