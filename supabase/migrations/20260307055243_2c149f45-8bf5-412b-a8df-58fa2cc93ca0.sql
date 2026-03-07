
-- Add SEO and feature columns to help_articles
ALTER TABLE public.help_articles
  ADD COLUMN IF NOT EXISTS meta_title text,
  ADD COLUMN IF NOT EXISTS meta_description text,
  ADD COLUMN IF NOT EXISTS featured_image_url text,
  ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS views_count integer NOT NULL DEFAULT 0;

-- Create article feedback table
CREATE TABLE public.help_article_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid REFERENCES public.help_articles(id) ON DELETE CASCADE NOT NULL,
  is_helpful boolean NOT NULL,
  comment text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.help_article_feedback ENABLE ROW LEVEL SECURITY;

-- Anyone can submit feedback (no auth required for help center)
CREATE POLICY "Anyone can insert feedback"
  ON public.help_article_feedback
  FOR INSERT
  WITH CHECK (true);

-- Admins can view all feedback
CREATE POLICY "Admins can view feedback"
  ON public.help_article_feedback
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Admins can delete feedback
CREATE POLICY "Admins can delete feedback"
  ON public.help_article_feedback
  FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- Add icon column to collections if missing
ALTER TABLE public.help_collections
  ADD COLUMN IF NOT EXISTS icon text DEFAULT 'folder';
