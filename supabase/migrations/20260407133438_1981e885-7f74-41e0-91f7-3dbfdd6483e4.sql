
-- Email Groups
CREATE TABLE public.email_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.email_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage email groups" ON public.email_groups FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Email Group Contacts
CREATE TABLE public.email_group_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES public.email_groups(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  subscribed BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(group_id, email)
);
ALTER TABLE public.email_group_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage group contacts" ON public.email_group_contacts FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Email Campaigns
CREATE TABLE public.email_campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  subject TEXT NOT NULL DEFAULT '',
  html_content TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft',
  group_id UUID REFERENCES public.email_groups(id) ON DELETE SET NULL,
  scheduled_at TIMESTAMP WITH TIME ZONE,
  sent_at TIMESTAMP WITH TIME ZONE,
  total_recipients INTEGER NOT NULL DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.email_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage campaigns" ON public.email_campaigns FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Email Campaign Events (tracking)
CREATE TABLE public.email_campaign_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES public.email_campaigns(id) ON DELETE CASCADE,
  contact_email TEXT NOT NULL,
  event_type TEXT NOT NULL, -- sent, opened, clicked
  link_url TEXT,
  user_agent TEXT,
  ip_address TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.email_campaign_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view campaign events" ON public.email_campaign_events FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Anyone can insert tracking events" ON public.email_campaign_events FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- Indexes
CREATE INDEX idx_email_group_contacts_group ON public.email_group_contacts(group_id);
CREATE INDEX idx_email_campaign_events_campaign ON public.email_campaign_events(campaign_id);
CREATE INDEX idx_email_campaign_events_type ON public.email_campaign_events(event_type);
CREATE INDEX idx_email_campaigns_status ON public.email_campaigns(status);

-- Updated at triggers
CREATE TRIGGER update_email_groups_updated_at BEFORE UPDATE ON public.email_groups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_email_campaigns_updated_at BEFORE UPDATE ON public.email_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
