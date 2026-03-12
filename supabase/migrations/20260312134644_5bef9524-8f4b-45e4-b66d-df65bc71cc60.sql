
-- Remove the duplicate challenge we inserted (keep the original "5K Two Step")
DELETE FROM public.trading_credentials WHERE challenge_id = '2629dc93-3630-4159-b567-2635e8a7a67b';
DELETE FROM public.challenges WHERE id = '2629dc93-3630-4159-b567-2635e8a7a67b';

-- Ensure the original 5K Two Step challenge has credentials
INSERT INTO public.trading_credentials (challenge_id, mt5_login, mt5_password, mt5_server, is_assigned)
SELECT '7e23a36a-f1b0-4034-9cc9-c480e1fc3c61', '500001', 'Pass@2024A', 'MetaQuotes-Demo', false
WHERE NOT EXISTS (SELECT 1 FROM public.trading_credentials WHERE challenge_id = '7e23a36a-f1b0-4034-9cc9-c480e1fc3c61' AND is_assigned = false);
