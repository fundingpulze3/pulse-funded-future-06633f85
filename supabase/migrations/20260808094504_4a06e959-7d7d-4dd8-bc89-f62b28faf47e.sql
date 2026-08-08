ALTER TABLE public.ctrader_snapshots
  ADD COLUMN IF NOT EXISTS profit numeric,
  ADD COLUMN IF NOT EXISTS deposits numeric,
  ADD COLUMN IF NOT EXISTS win_rate numeric,
  ADD COLUMN IF NOT EXISTS total_trades integer,
  ADD COLUMN IF NOT EXISTS winning_trades integer,
  ADD COLUMN IF NOT EXISTS losing_trades integer,
  ADD COLUMN IF NOT EXISTS profit_factor numeric,
  ADD COLUMN IF NOT EXISTS max_drawdown_percent numeric,
  ADD COLUMN IF NOT EXISTS avg_win numeric,
  ADD COLUMN IF NOT EXISTS avg_loss numeric,
  ADD COLUMN IF NOT EXISTS best_trade numeric,
  ADD COLUMN IF NOT EXISTS worst_trade numeric,
  ADD COLUMN IF NOT EXISTS currency text,
  ADD COLUMN IF NOT EXISTS account_name text,
  ADD COLUMN IF NOT EXISTS period text;

CREATE TABLE IF NOT EXISTS public.ctrader_sync_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  credential_id uuid NOT NULL UNIQUE REFERENCES public.trading_credentials(id) ON DELETE CASCADE,
  last_sync_at timestamp with time zone,
  last_success_at timestamp with time zone,
  last_status text NOT NULL DEFAULT 'pending',
  last_error text,
  consecutive_failures integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.ctrader_sync_state TO authenticated;
GRANT ALL ON public.ctrader_sync_state TO service_role;

ALTER TABLE public.ctrader_sync_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own ctrader sync state"
  ON public.ctrader_sync_state FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.trading_credentials tc
    WHERE tc.id = ctrader_sync_state.credential_id AND tc.assigned_to = auth.uid()
  ));

CREATE POLICY "Admins view all ctrader sync state"
  ON public.ctrader_sync_state FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'administrator'::app_role)
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'employee'::app_role)
  );

CREATE TRIGGER update_ctrader_sync_state_updated_at
  BEFORE UPDATE ON public.ctrader_sync_state
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.ctrader_snapshots REPLICA IDENTITY FULL;
ALTER TABLE public.ctrader_sync_state REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.ctrader_snapshots;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.ctrader_sync_state;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;