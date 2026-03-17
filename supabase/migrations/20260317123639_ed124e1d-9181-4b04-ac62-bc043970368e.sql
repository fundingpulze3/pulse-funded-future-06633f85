
-- Payout requests table
CREATE TABLE public.payout_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  purchase_id uuid REFERENCES public.challenge_purchases(id) ON DELETE CASCADE NOT NULL,
  payout_number text NOT NULL DEFAULT 'PO-' || SUBSTRING(gen_random_uuid()::text FROM 1 FOR 8),
  amount numeric NOT NULL,
  profit_split_percentage integer NOT NULL DEFAULT 80,
  reward_cycle text NOT NULL DEFAULT 'weekly',
  status text NOT NULL DEFAULT 'pending',
  payment_method text NOT NULL DEFAULT 'crypto',
  payment_details jsonb DEFAULT '{}'::jsonb,
  review_note text,
  reviewed_at timestamptz,
  reviewed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Add reward_cycle column to challenge_purchases for funded accounts
ALTER TABLE public.challenge_purchases 
ADD COLUMN IF NOT EXISTS reward_cycle text DEFAULT 'weekly',
ADD COLUMN IF NOT EXISTS total_profit numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_payout_at timestamptz;

-- Enable RLS
ALTER TABLE public.payout_requests ENABLE ROW LEVEL SECURITY;

-- Users can view own payout requests
CREATE POLICY "Users can view own payouts"
ON public.payout_requests
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Users can insert own payout requests
CREATE POLICY "Users can insert own payouts"
ON public.payout_requests
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Admins can manage all payouts
CREATE POLICY "Admins can manage payouts"
ON public.payout_requests
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Enable realtime for payout_requests
ALTER PUBLICATION supabase_realtime ADD TABLE public.payout_requests;
