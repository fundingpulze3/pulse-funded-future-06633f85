
-- 1. Add coupon_code column to challenge_purchases
ALTER TABLE public.challenge_purchases
  ADD COLUMN IF NOT EXISTS coupon_code text;

-- 2. Trigger function: increment coupons.current_uses when payment_status flips to completed
CREATE OR REPLACE FUNCTION public.increment_coupon_uses()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.coupon_code IS NOT NULL
     AND NEW.coupon_code <> ''
     AND NEW.payment_status = 'completed'
     AND (OLD.payment_status IS DISTINCT FROM 'completed') THEN
    UPDATE public.coupons
       SET current_uses = current_uses + 1
     WHERE LOWER(code) = LOWER(NEW.coupon_code);
  END IF;
  RETURN NEW;
END;
$$;

-- 3. Trigger on insert (covers cases where order is created already-completed) + update
DROP TRIGGER IF EXISTS trg_increment_coupon_uses_ins ON public.challenge_purchases;
DROP TRIGGER IF EXISTS trg_increment_coupon_uses_upd ON public.challenge_purchases;

CREATE TRIGGER trg_increment_coupon_uses_upd
AFTER UPDATE OF payment_status ON public.challenge_purchases
FOR EACH ROW
EXECUTE FUNCTION public.increment_coupon_uses();

CREATE TRIGGER trg_increment_coupon_uses_ins
AFTER INSERT ON public.challenge_purchases
FOR EACH ROW
WHEN (NEW.payment_status = 'completed' AND NEW.coupon_code IS NOT NULL)
EXECUTE FUNCTION public.increment_coupon_uses();

-- 4. Backfill: count completed purchases per coupon and sync current_uses
WITH usage AS (
  SELECT LOWER(coupon_code) AS code_lc, COUNT(*) AS uses
    FROM public.challenge_purchases
   WHERE coupon_code IS NOT NULL
     AND coupon_code <> ''
     AND payment_status = 'completed'
   GROUP BY LOWER(coupon_code)
)
UPDATE public.coupons c
   SET current_uses = u.uses
  FROM usage u
 WHERE LOWER(c.code) = u.code_lc;
