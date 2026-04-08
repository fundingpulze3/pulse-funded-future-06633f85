
DROP POLICY IF EXISTS "Admins can manage email groups" ON email_groups;
CREATE POLICY "Admins can manage email groups" ON email_groups FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'administrator'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'administrator'::app_role));

DROP POLICY IF EXISTS "Admins can manage group contacts" ON email_group_contacts;
CREATE POLICY "Admins can manage group contacts" ON email_group_contacts FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'administrator'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'administrator'::app_role));

DROP POLICY IF EXISTS "Admins can manage campaigns" ON email_campaigns;
CREATE POLICY "Admins can manage campaigns" ON email_campaigns FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'administrator'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'administrator'::app_role));

DROP POLICY IF EXISTS "Admins can view campaign events" ON email_campaign_events;
CREATE POLICY "Admins can view campaign events" ON email_campaign_events FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'administrator'::app_role));
