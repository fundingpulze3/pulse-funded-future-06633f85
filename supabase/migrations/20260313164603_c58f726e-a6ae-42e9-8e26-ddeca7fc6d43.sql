
-- KYC submissions table
CREATE TABLE public.kyc_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  
  -- Legal document
  document_type text, -- passport, national_id, drivers_license
  document_front_url text,
  document_back_url text,
  
  -- Face video
  face_video_url text,
  
  -- Additional questions
  preferred_trading_strategy text,
  trading_experience text,
  occupation text,
  source_of_funds text,
  
  -- Admin review
  reviewed_by uuid,
  review_note text,
  reviewed_at timestamptz,
  
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.kyc_submissions ENABLE ROW LEVEL SECURITY;

-- Users can view own KYC
CREATE POLICY "Users can view own kyc" ON public.kyc_submissions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Users can insert own KYC
CREATE POLICY "Users can insert own kyc" ON public.kyc_submissions
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can update own pending KYC
CREATE POLICY "Users can update own pending kyc" ON public.kyc_submissions
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND status = 'pending');

-- Admins can manage all KYC
CREATE POLICY "Admins can manage kyc" ON public.kyc_submissions
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Create storage bucket for KYC documents
INSERT INTO storage.buckets (id, name, public) VALUES ('kyc-documents', 'kyc-documents', false);

-- Storage policies for KYC bucket
CREATE POLICY "Users can upload own KYC docs" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'kyc-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can view own KYC docs" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'kyc-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Admins can view all KYC docs" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'kyc-documents' AND has_role(auth.uid(), 'admin'::app_role));

-- Update trigger
CREATE TRIGGER update_kyc_updated_at BEFORE UPDATE ON public.kyc_submissions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
