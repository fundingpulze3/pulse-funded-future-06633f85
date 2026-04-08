
CREATE TABLE public.saved_email_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  html_content TEXT NOT NULL DEFAULT '',
  thumbnail_url TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.saved_email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage saved email templates" ON public.saved_email_templates
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'administrator'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'administrator'::app_role));

CREATE TRIGGER update_saved_email_templates_updated_at
BEFORE UPDATE ON public.saved_email_templates
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
