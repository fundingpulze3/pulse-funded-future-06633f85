
-- Certificates table
CREATE TABLE public.certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  image_url text NOT NULL,
  sort_order integer DEFAULT 0,
  is_visible boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;

-- Anyone can view visible certificates
CREATE POLICY "Anyone can view visible certificates" ON public.certificates
  FOR SELECT USING (is_visible = true);

-- Admins can manage certificates
CREATE POLICY "Admins can manage certificates" ON public.certificates
  FOR ALL USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

-- Storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('certificates', 'certificates', true);

-- Storage policies
CREATE POLICY "Anyone can view certificate files" ON storage.objects
  FOR SELECT USING (bucket_id = 'certificates');

CREATE POLICY "Admins can upload certificate files" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'certificates' AND has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete certificate files" ON storage.objects
  FOR DELETE USING (bucket_id = 'certificates' AND has_role(auth.uid(), 'admin'));
