-- Country targeting + seed the engine with the real business facts so it never
-- invents rules. Only seeds when the field is still empty (never overwrites edits).
ALTER TABLE public.blog_settings ADD COLUMN IF NOT EXISTS target_countries text NOT NULL DEFAULT '';

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
  target_countries = 'United States, Canada, United Kingdom, Ireland, Australia, New Zealand, Germany, France, Switzerland, Austria, Netherlands, Belgium, Luxembourg, Denmark, Sweden, Norway, Finland, Iceland, Italy, Spain, Portugal, Singapore, Japan, South Korea, United Arab Emirates, Qatar'
WHERE id = 1 AND coalesce(brand_context, '') = '';
