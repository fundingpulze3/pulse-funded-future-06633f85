
CREATE TABLE public.account_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id uuid NOT NULL REFERENCES public.challenge_purchases(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  old_status text,
  new_status text NOT NULL,
  changed_by uuid,
  note text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.account_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage status history" ON public.account_status_history
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view own status history" ON public.account_status_history
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX idx_status_history_purchase ON public.account_status_history(purchase_id);
CREATE INDEX idx_status_history_user ON public.account_status_history(user_id);
