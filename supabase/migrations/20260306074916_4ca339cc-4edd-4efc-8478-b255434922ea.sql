
-- Allow admins to insert challenges
CREATE POLICY "Admins can insert challenges"
ON public.challenges
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Allow admins to update challenges
CREATE POLICY "Admins can update challenges"
ON public.challenges
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Allow admins to delete challenges
CREATE POLICY "Admins can delete challenges"
ON public.challenges
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to delete referrals
CREATE POLICY "Admins can delete referrals"
ON public.affiliate_referrals
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
