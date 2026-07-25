-- 1) Usage log
CREATE TABLE IF NOT EXISTS public.blog_engine_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  day text NOT NULL,
  model text,
  input_tokens integer NOT NULL DEFAULT 0,
  output_tokens integer NOT NULL DEFAULT 0,
  cost_usd numeric NOT NULL DEFAULT 0,
  topic text,
  ok boolean NOT NULL DEFAULT true,
  words integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_blog_engine_usage_day ON public.blog_engine_usage (day);
GRANT SELECT ON public.blog_engine_usage TO authenticated;
GRANT ALL ON public.blog_engine_usage TO service_role;
ALTER TABLE public.blog_engine_usage ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins read blog engine usage" ON public.blog_engine_usage;
CREATE POLICY "Admins read blog engine usage"
  ON public.blog_engine_usage FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 2) Settings (single row)
CREATE TABLE IF NOT EXISTS public.blog_settings (
  id integer PRIMARY KEY DEFAULT 1,
  brand_context text NOT NULL DEFAULT '',
  themes text NOT NULL DEFAULT '',
  auto_publish boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT blog_settings_singleton CHECK (id = 1)
);
ALTER TABLE public.blog_settings ADD COLUMN IF NOT EXISTS target_countries text NOT NULL DEFAULT '';
ALTER TABLE public.blog_settings ADD COLUMN IF NOT EXISTS slots text NOT NULL DEFAULT '09:00,14:00,19:00';
ALTER TABLE public.blog_settings ADD COLUMN IF NOT EXISTS cron_key text NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex');
INSERT INTO public.blog_settings (id) VALUES (1) ON CONFLICT DO NOTHING;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.blog_settings TO authenticated;
GRANT ALL ON public.blog_settings TO service_role;
ALTER TABLE public.blog_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage blog settings" ON public.blog_settings;
CREATE POLICY "Admins manage blog settings"
  ON public.blog_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

UPDATE public.blog_settings SET
  brand_context = $ctx$Funding Pulze is a proprietary trading firm. Positioning: "Get Funded. Trade Big. Keep the Profits."

WHAT WE OFFER
- Evaluation challenges on account sizes $5K, $10K, $25K, $50K and $100K.
- 2-Step: Phase 1 profit target 8%, Phase 2 target 5%. 1-Step: 8% in a single phase. No time limit on any phase.
- Maximum overall drawdown: 10% of the initial account balance.
- Daily drawdown: 5%, measured from the balance at the start of the trading day (00:00 UTC), resets daily.
- Minimum 3 active trading days per phase (a day where at least one position is opened and closed).
- Weekend holding is allowed. Swap-free accounts are available.

PAYOUTS
- Reward cycles: Weekly (60% profit split), Bi-weekly (80%), On Demand (90%), Monthly (100%).
- Methods: bank wire, crypto (USDT/BTC/ETH) and PayPal. Processed in 24-48 hours. No minimum withdrawal.
- First payout after the first cycle completes (7, 14 or 30 days depending on the cycle chosen).

ONBOARDING
- Login credentials are emailed within minutes of purchase.
- The trader dashboard shows stats, drawdown status and payout history in real time.

NON-NEGOTIABLES (never break these)
- Never guarantee profits or income. Never use "risk-free", "guaranteed", "no risk" or similar.
- Never invent rules, prices, numbers, features or promotions that are not listed above.
- Be honest that evaluations are demanding and many traders do not pass on the first attempt.
- No individualized financial advice. Add a short risk note where it is relevant.
- Never name a competitor as a scam. Describe patterns, not names.
- Trading involves substantial risk of loss.$ctx$,
  themes = 'passing prop firm evaluations, drawdown rules explained, risk management for funded accounts, profit split and payout guides, trading psychology, funded trader roadmap, choosing a prop firm, common evaluation mistakes, position sizing, trading plan building',
  target_countries = 'United States, Canada, United Kingdom, Ireland, Australia, New Zealand, Germany, France, Switzerland, Austria, Netherlands, Belgium, Luxembourg, Denmark, Sweden, Norway, Finland, Iceland, Italy, Spain, Portugal, Singapore, Japan, South Korea, United Arab Emirates, Qatar',
  auto_publish = true
WHERE id = 1 AND coalesce(brand_context, '') = '';

-- 3) Topic queue
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
GRANT SELECT, INSERT, UPDATE, DELETE ON public.blog_topics TO authenticated;
GRANT ALL ON public.blog_topics TO service_role;
ALTER TABLE public.blog_topics ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage blog topics" ON public.blog_topics;
CREATE POLICY "Admins manage blog topics" ON public.blog_topics FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 4) Prepared drafts
CREATE TABLE IF NOT EXISTS public.blog_prepared (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL,
  query text,
  source text NOT NULL DEFAULT 'auto',
  status text NOT NULL DEFAULT 'ready',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_blog_prepared_status ON public.blog_prepared (status, created_at);
GRANT SELECT ON public.blog_prepared TO authenticated;
GRANT ALL ON public.blog_prepared TO service_role;
ALTER TABLE public.blog_prepared ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins read blog prepared" ON public.blog_prepared;
CREATE POLICY "Admins read blog prepared" ON public.blog_prepared FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 5) Slot-run tracking
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
GRANT SELECT ON public.blog_slot_runs TO authenticated;
GRANT ALL ON public.blog_slot_runs TO service_role;
ALTER TABLE public.blog_slot_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins read blog slot runs" ON public.blog_slot_runs;
CREATE POLICY "Admins read blog slot runs" ON public.blog_slot_runs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 6) Reader analytics
CREATE TABLE IF NOT EXISTS public.blog_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL,
  type text NOT NULL,
  seconds integer NOT NULL DEFAULT 0,
  cta_label text,
  session_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_blog_events_post ON public.blog_events (post_id, type);
CREATE INDEX IF NOT EXISTS idx_blog_events_created ON public.blog_events (created_at DESC);
GRANT INSERT ON public.blog_events TO anon, authenticated;
GRANT SELECT ON public.blog_events TO authenticated;
GRANT ALL ON public.blog_events TO service_role;
ALTER TABLE public.blog_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can log blog events" ON public.blog_events;
CREATE POLICY "Anyone can log blog events" ON public.blog_events
  FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Admins read blog events" ON public.blog_events;
CREATE POLICY "Admins read blog events" ON public.blog_events
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));