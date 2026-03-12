
INSERT INTO public.challenges (name, step_type, account_size, price, profit_target, daily_drawdown, max_drawdown, min_trading_days, leverage, is_active)
VALUES ('2 Step $5K', 'two_step', 5000, 39, '8% / 5%', '5%', '10%', '3 days', '1:100', true);

INSERT INTO public.trading_credentials (challenge_id, mt5_login, mt5_password, mt5_server, is_assigned)
SELECT id, '500001', 'Pass@2024A', 'MetaQuotes-Demo', false FROM public.challenges WHERE step_type = 'two_step' AND account_size = 5000 LIMIT 1;

INSERT INTO public.trading_credentials (challenge_id, mt5_login, mt5_password, mt5_server, is_assigned)
SELECT id, '500002', 'Pass@2024B', 'MetaQuotes-Demo', false FROM public.challenges WHERE step_type = 'two_step' AND account_size = 5000 LIMIT 1;

INSERT INTO public.trading_credentials (challenge_id, mt5_login, mt5_password, mt5_server, is_assigned)
SELECT id, '500003', 'Pass@2024C', 'MetaQuotes-Demo', false FROM public.challenges WHERE step_type = 'two_step' AND account_size = 5000 LIMIT 1;
