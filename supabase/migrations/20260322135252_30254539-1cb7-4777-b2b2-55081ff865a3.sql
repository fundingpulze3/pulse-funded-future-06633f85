
ALTER TABLE public.challenge_purchases 
ADD COLUMN IF NOT EXISTS payment_method text DEFAULT 'paypal',
ADD COLUMN IF NOT EXISTS utr_number text DEFAULT NULL;
