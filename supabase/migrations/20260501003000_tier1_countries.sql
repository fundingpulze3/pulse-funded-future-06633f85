-- Retarget the blog engine at tier-1 markets.
UPDATE public.blog_settings SET
  target_countries = 'United States, Canada, United Kingdom, Ireland, Australia, New Zealand, Germany, France, Switzerland, Austria, Netherlands, Belgium, Luxembourg, Denmark, Sweden, Norway, Finland, Iceland, Italy, Spain, Portugal, Singapore, Japan, South Korea, United Arab Emirates, Qatar'
WHERE id = 1;
