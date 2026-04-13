
-- Allow admins to view all referrals
CREATE POLICY "Admins can view all referrals"
ON public.affiliate_referrals
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to update referrals (approve/pay commissions)
CREATE POLICY "Admins can update referrals"
ON public.affiliate_referrals
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

