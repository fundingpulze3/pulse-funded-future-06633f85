UPDATE public.user_certificates AS target
SET stats = COALESCE(source.stats, '{}'::jsonb) || target.stats
FROM (
  SELECT DISTINCT ON (account_number)
    account_number,
    stats
  FROM public.user_certificates
  WHERE account_number IS NOT NULL
    AND stats IS NOT NULL
    AND (
      stats ? 'balance'
      OR stats ? 'totalTrades'
      OR stats ? 'equity'
    )
  ORDER BY account_number, created_at DESC
) AS source
WHERE target.account_number = source.account_number
  AND target.stats IS NOT NULL
  AND NOT (target.stats ? 'balance')
  AND NOT (target.stats ? 'totalTrades')
  AND NOT (target.stats ? 'equity');