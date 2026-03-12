
DROP POLICY IF EXISTS "Admins can manage credentials" ON public.trading_credentials;
CREATE POLICY "Admins can manage credentials" ON public.trading_credentials
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'administrator'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'administrator'::app_role));
