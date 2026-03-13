
-- Certificate templates table for admin-uploaded backgrounds
CREATE TABLE public.certificate_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  certificate_type TEXT NOT NULL UNIQUE,
  background_image_url TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT 'Certificate',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.certificate_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage certificate templates"
  ON public.certificate_templates FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view certificate templates"
  ON public.certificate_templates FOR SELECT
  TO public
  USING (true);

-- Storage bucket for certificate template backgrounds
INSERT INTO storage.buckets (id, name, public) VALUES ('certificate-templates', 'certificate-templates', true);

CREATE POLICY "Admins can upload certificate templates"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'certificate-templates' AND (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'administrator'))));

CREATE POLICY "Admins can delete certificate templates"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'certificate-templates' AND (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'administrator'))));

CREATE POLICY "Anyone can view certificate template files"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'certificate-templates');
