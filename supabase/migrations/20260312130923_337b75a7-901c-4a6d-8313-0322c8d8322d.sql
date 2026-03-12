
-- Allow admins to view all purchases
CREATE POLICY "Admins can view all purchases" ON public.challenge_purchases
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'administrator'::app_role));

-- Allow admins to update purchases (confirm/cancel)
CREATE POLICY "Admins can update purchases" ON public.challenge_purchases
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'administrator'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'administrator'::app_role));
