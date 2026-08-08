ALTER TABLE public.trading_credentials
  ADD COLUMN IF NOT EXISTS platform text NOT NULL DEFAULT 'mt5',
  ADD COLUMN IF NOT EXISTS ctrader_token text,
  ADD COLUMN IF NOT EXISTS ctrader_is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS ctrader_linked_at timestamptz;

ALTER TABLE public.trading_credentials
  ADD CONSTRAINT trading_credentials_platform_check CHECK (platform IN ('mt5','ctrader'));

ALTER TABLE public.trading_credentials
  ADD CONSTRAINT trading_credentials_ctrader_token_check
  CHECK (ctrader_token IS NULL OR ctrader_token ~ '^[A-Za-z0-9]{5,20}$');

ALTER TABLE public.challenge_purchases
  ADD COLUMN IF NOT EXISTS platform text NOT NULL DEFAULT 'mt5';

ALTER TABLE public.challenge_purchases
  ADD CONSTRAINT challenge_purchases_platform_check CHECK (platform IN ('mt5','ctrader'));

CREATE TABLE public.ctrader_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  credential_id uuid NOT NULL UNIQUE REFERENCES public.trading_credentials(id) ON DELETE CASCADE,
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  ctid_trader_account_id bigint,
  is_live boolean NOT NULL DEFAULT false,
  token_expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.ctrader_credentials TO service_role;
ALTER TABLE public.ctrader_credentials ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.ctrader_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  credential_id uuid NOT NULL REFERENCES public.trading_credentials(id) ON DELETE CASCADE,
  captured_at timestamptz NOT NULL DEFAULT now(),
  balance numeric,
  equity numeric,
  margin_used numeric,
  roi_percent numeric,
  open_positions_count integer,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ctrader_snapshots_cred_time ON public.ctrader_snapshots (credential_id, captured_at DESC);

GRANT SELECT ON public.ctrader_snapshots TO authenticated;
GRANT ALL ON public.ctrader_snapshots TO service_role;
ALTER TABLE public.ctrader_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own ctrader snapshots"
ON public.ctrader_snapshots FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.trading_credentials tc
  WHERE tc.id = ctrader_snapshots.credential_id
    AND tc.assigned_to = auth.uid()
));

CREATE POLICY "Admins view all ctrader snapshots"
ON public.ctrader_snapshots FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'administrator') OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'employee'));

CREATE TRIGGER update_ctrader_credentials_updated_at
BEFORE UPDATE ON public.ctrader_credentials
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();