-- Fix user_certificates: add administrator role
DROP POLICY IF EXISTS "Admins can manage user certificates" ON public.user_certificates;
CREATE POLICY "Admins can manage user certificates" ON public.user_certificates
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'administrator'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'administrator'::app_role));

-- Fix account_status_history: add administrator role
DROP POLICY IF EXISTS "Admins can manage status history" ON public.account_status_history;
CREATE POLICY "Admins can manage status history" ON public.account_status_history
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'administrator'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'administrator'::app_role));

-- Fix page_visits SELECT: add administrator role
DROP POLICY IF EXISTS "Admins can view all page visits" ON public.page_visits;
CREATE POLICY "Admins can view all page visits" ON public.page_visits
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'administrator'::app_role));

-- Fix challenges policies: add administrator role
DROP POLICY IF EXISTS "Admins can delete challenges" ON public.challenges;
CREATE POLICY "Admins can delete challenges" ON public.challenges
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'administrator'::app_role));

DROP POLICY IF EXISTS "Admins can insert challenges" ON public.challenges;
CREATE POLICY "Admins can insert challenges" ON public.challenges
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'administrator'::app_role));

DROP POLICY IF EXISTS "Admins can update challenges" ON public.challenges;
CREATE POLICY "Admins can update challenges" ON public.challenges
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'administrator'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'administrator'::app_role));