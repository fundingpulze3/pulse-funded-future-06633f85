
-- Trading credentials pool (MT5 accounts admin pre-loads)
CREATE TABLE public.trading_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid REFERENCES public.challenges(id) ON DELETE CASCADE NOT NULL,
  mt5_login text NOT NULL,
  mt5_password text NOT NULL,
  mt5_server text NOT NULL DEFAULT 'MetaQuotes-Demo',
  is_assigned boolean NOT NULL DEFAULT false,
  assigned_to uuid DEFAULT NULL,
  assigned_at timestamp with time zone DEFAULT NULL,
  purchase_id uuid REFERENCES public.challenge_purchases(id) ON DELETE SET NULL DEFAULT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.trading_credentials ENABLE ROW LEVEL SECURITY;

-- Only admins can manage credentials
CREATE POLICY "Admins can manage credentials" ON public.trading_credentials
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Users can view their own assigned credentials
CREATE POLICY "Users can view own credentials" ON public.trading_credentials
  FOR SELECT TO authenticated
  USING (auth.uid() = assigned_to);

-- User certificates (personal, from MT5 PDF parsing)
CREATE TABLE public.user_certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  purchase_id uuid REFERENCES public.challenge_purchases(id) ON DELETE CASCADE DEFAULT NULL,
  credential_id uuid REFERENCES public.trading_credentials(id) ON DELETE SET NULL DEFAULT NULL,
  certificate_type text NOT NULL DEFAULT 'phase1_passed',
  account_number text DEFAULT NULL,
  stats jsonb DEFAULT '{}'::jsonb,
  pdf_url text DEFAULT NULL,
  certificate_image_url text DEFAULT NULL,
  title text NOT NULL DEFAULT 'Certificate',
  description text DEFAULT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.user_certificates ENABLE ROW LEVEL SECURITY;

-- Admins can manage all user certificates
CREATE POLICY "Admins can manage user certificates" ON public.user_certificates
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Users can view own certificates
CREATE POLICY "Users can view own certificates" ON public.user_certificates
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Storage bucket for MT5 PDFs
INSERT INTO storage.buckets (id, name, public) VALUES ('mt5-statements', 'mt5-statements', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for mt5-statements bucket
CREATE POLICY "Admins can upload MT5 statements" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'mt5-statements' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can read MT5 statements" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'mt5-statements' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete MT5 statements" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'mt5-statements' AND public.has_role(auth.uid(), 'admin'::app_role));
