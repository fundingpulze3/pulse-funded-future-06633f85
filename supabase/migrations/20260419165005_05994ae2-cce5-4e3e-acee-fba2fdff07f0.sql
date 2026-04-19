-- Backfill Tanmoy Chutia: passed both phases on 5K Two Step but stuck on phase 1
-- 1. Free old credential (90457840)
UPDATE public.trading_credentials
SET is_assigned = false, assigned_to = NULL, purchase_id = NULL, updated_at = now()
WHERE id = 'daae06d6-70b6-450c-aaa6-f151c1959e63';

-- 2. Assign next available credential for the 5K Two Step pool to Tanmoy as his FUNDED account
WITH next_cred AS (
  SELECT id FROM public.trading_credentials
  WHERE challenge_id = '7e23a36a-f1b0-4034-9cc9-c480e1fc3c61'
    AND is_assigned = false
  ORDER BY created_at ASC
  LIMIT 1
)
UPDATE public.trading_credentials tc
SET is_assigned = true,
    assigned_to = '354a65e9-e72f-4662-b89a-eb38a2e46a46',
    purchase_id = 'e1a79593-e671-465e-9745-c060319da341',
    assigned_at = now(),
    updated_at = now()
FROM next_cred
WHERE tc.id = next_cred.id;

-- 3. Move purchase to funded
UPDATE public.challenge_purchases
SET status = 'funded', updated_at = now()
WHERE id = 'e1a79593-e671-465e-9745-c060319da341';

-- 4. Log the status change
INSERT INTO public.account_status_history (user_id, purchase_id, old_status, new_status, note)
VALUES (
  '354a65e9-e72f-4662-b89a-eb38a2e46a46',
  'e1a79593-e671-465e-9745-c060319da341',
  'active',
  'funded',
  'Backfill: passed both phases (certificates issued 2026-04-16) but progression got stuck. New funded MT5 credential assigned.'
);