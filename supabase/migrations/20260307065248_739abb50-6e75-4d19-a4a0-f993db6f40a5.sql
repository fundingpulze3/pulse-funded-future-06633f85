
-- Blog posts table with enhanced SEO fields
CREATE TABLE public.blog_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  content text NOT NULL DEFAULT '',
  excerpt text,
  author_id uuid NOT NULL,
  -- Thumbnail system
  thumbnail_url text,
  thumbnail_alt text,
  thumbnail_ratio text DEFAULT '16:9',
  -- Publishing
  is_published boolean NOT NULL DEFAULT false,
  is_featured boolean NOT NULL DEFAULT false,
  published_at timestamptz,
  -- SEO fields
  meta_title text,
  meta_description text,
  meta_keywords text[] DEFAULT '{}',
  canonical_url text,
  og_title text,
  og_description text,
  og_image_url text,
  focus_keyword text,
  -- Stats
  views_count integer NOT NULL DEFAULT 0,
  reading_time integer DEFAULT 0,
  sort_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

-- Anyone can view published posts
CREATE POLICY "Anyone can view published blog posts"
  ON public.blog_posts FOR SELECT
  USING (is_published = true);

-- Admins can view all posts
CREATE POLICY "Admins can view all blog posts"
  ON public.blog_posts FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Admins can manage posts
CREATE POLICY "Admins can manage blog posts"
  ON public.blog_posts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Storage bucket for blog thumbnails
INSERT INTO storage.buckets (id, name, public)
VALUES ('blog-thumbnails', 'blog-thumbnails', true);

-- Storage policies
CREATE POLICY "Anyone can view blog thumbnails"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'blog-thumbnails');

CREATE POLICY "Admins can upload blog thumbnails"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'blog-thumbnails' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update blog thumbnails"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'blog-thumbnails' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete blog thumbnails"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'blog-thumbnails' AND public.has_role(auth.uid(), 'admin'));
