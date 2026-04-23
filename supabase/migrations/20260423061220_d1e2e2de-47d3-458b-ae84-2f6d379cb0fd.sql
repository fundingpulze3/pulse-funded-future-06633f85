-- Allow administrator role (and admin) to manage page content
DROP POLICY IF EXISTS "Admins can manage page content" ON public.page_content;

CREATE POLICY "Admins can manage page content"
ON public.page_content
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'administrator'::app_role)
  OR public.has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'administrator'::app_role)
  OR public.has_role(auth.uid(), 'admin'::app_role)
);