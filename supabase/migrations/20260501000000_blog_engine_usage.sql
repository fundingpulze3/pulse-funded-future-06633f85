-- Blog engine usage log: one row per generation. Powers the daily/spend caps
-- and the cost panel in admin. Written by the edge function (service role).
CREATE TABLE public.blog_engine_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  day text NOT NULL,
  model text,
  input_tokens integer NOT NULL DEFAULT 0,
  output_tokens integer NOT NULL DEFAULT 0,
  cost_usd numeric NOT NULL DEFAULT 0,
  topic text,
  ok boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_blog_engine_usage_day ON public.blog_engine_usage (day);

ALTER TABLE public.blog_engine_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read blog engine usage"
  ON public.blog_engine_usage FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
