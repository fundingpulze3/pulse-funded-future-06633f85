
-- Allow authenticated users to update trading_credentials when assigning to themselves
CREATE POLICY "Users can claim unassigned credentials" ON public.trading_credentials
  FOR UPDATE TO authenticated
  USING (is_assigned = false)
  WITH CHECK (assigned_to = auth.uid() AND is_assigned = true);
