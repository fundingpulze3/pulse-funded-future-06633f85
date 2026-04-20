
-- 1. Drop old check constraint and add new one with phase1_passed / phase2_passed
ALTER TABLE public.challenge_purchases
  DROP CONSTRAINT IF EXISTS challenge_purchases_status_check;

ALTER TABLE public.challenge_purchases
  ADD CONSTRAINT challenge_purchases_status_check
  CHECK (status IN ('pending', 'active', 'phase1_passed', 'phase2', 'phase2_passed', 'funded', 'breached', 'completed', 'failed'));

-- 2. Revert Tanmoy: free login 90459314, set status back to phase1_passed
UPDATE public.trading_credentials
SET is_assigned = false, assigned_to = NULL, purchase_id = NULL, assigned_at = NULL, updated_at = now()
WHERE id = 'a7917671-4048-4f52-aba0-7ecda1a12223';

UPDATE public.challenge_purchases
SET status = 'phase1_passed', updated_at = now()
WHERE id = 'e1a79593-e671-465e-9745-c060319da341';

INSERT INTO public.account_status_history (user_id, purchase_id, old_status, new_status, note)
VALUES (
  '354a65e9-e72f-4662-b89a-eb38a2e46a46',
  'e1a79593-e671-465e-9745-c060319da341',
  'phase2',
  'phase1_passed',
  'Reverted: user passed phase 1 only. Awaiting admin manual push to phase 2.'
);
