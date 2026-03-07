
CREATE TABLE public.page_content (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_slug text NOT NULL,
  section_key text NOT NULL,
  title text,
  content text NOT NULL DEFAULT '',
  sort_order integer DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(page_slug, section_key)
);

ALTER TABLE public.page_content ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view page content"
ON public.page_content FOR SELECT
USING (true);

CREATE POLICY "Admins can manage page content"
ON public.page_content FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_page_content_updated_at
  BEFORE UPDATE ON public.page_content
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
