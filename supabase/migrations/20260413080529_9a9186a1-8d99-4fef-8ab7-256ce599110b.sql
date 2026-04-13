-- Allow admins to upload to email-assets
CREATE POLICY "Admins can upload email assets"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'email-assets'
  AND EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'administrator')
  )
);

-- Allow anyone to view email assets (public bucket)
CREATE POLICY "Anyone can view email assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'email-assets');

-- Allow admins to delete email assets
CREATE POLICY "Admins can delete email assets"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'email-assets'
  AND EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'administrator')
  )
);

-- Allow admins to update email assets
CREATE POLICY "Admins can update email assets"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'email-assets'
  AND EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'administrator')
  )
);